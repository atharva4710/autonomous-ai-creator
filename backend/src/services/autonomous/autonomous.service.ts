import crypto from 'crypto';
import { globalAgentRepository } from '../../repositories/agent.repository';
import { globalTopicRepository } from '../../repositories/topic.repository';
import { globalEditorialRepository } from '../../repositories/editorial.repository';
import { globalMemoryRepository } from '../../repositories/memory.repository';
import { discoveryService } from '../../controllers/discovery.controller';
import { editorialService } from '../../controllers/editorial.controller';
import { globalContentGenerationService } from '../contentGeneration.service';
import { globalPublishingService } from '../publishing.service';
import { memoryService } from '../../controllers/memory.controller';

export class AutonomousService {
  private activeLoops: Map<string, NodeJS.Timeout> = new Map();
  private processingAgents: Set<string> = new Set();

  /**
   * Triggers the periodic execution loop for an initialized agent.
   */
  async startAgentLoop(agentId: string): Promise<void> {
    if (this.activeLoops.has(agentId)) {
      return; // loop already running
    }

    const agent = await globalAgentRepository.findById(agentId);
    if (!agent) {
      return;
    }

    agent.status = 'RUNNING';
    await globalAgentRepository.save(agent);

    // Initial cycle triggered shortly after return
    const initialDelay = 100;
    const timer = setTimeout(() => this.executeCycle(agentId), initialDelay);
    this.activeLoops.set(agentId, timer);
  }

  /**
   * Terminate the loop.
   */
  async stopAgentLoop(agentId: string): Promise<void> {
    const timer = this.activeLoops.get(agentId);
    if (timer) {
      clearTimeout(timer);
      this.activeLoops.delete(agentId);
    }
    this.processingAgents.delete(agentId);

    const agent = await globalAgentRepository.findById(agentId);
    if (agent) {
      agent.status = 'STOPPED';
      await globalAgentRepository.save(agent);
    }
  }

  /**
   * Runs all loops shutdown cleanup.
   */
  async stopAll(): Promise<void> {
    for (const agentId of Array.from(this.activeLoops.keys())) {
      await this.stopAgentLoop(agentId);
    }
  }

  /**
   * Main cycle execution.
   */
  async executeCycle(agentId: string): Promise<void> {
    // 1. Prevent concurrent runs
    if (this.processingAgents.has(agentId)) {
      return;
    }

    const intervalMs = Number(process.env.AUTONOMOUS_CYCLE_INTERVAL_MS) || 60000;

    try {
      this.processingAgents.add(agentId);

      const agent = await globalAgentRepository.findById(agentId);
      if (!agent || agent.status === 'STOPPED') {
        this.processingAgents.delete(agentId);
        return;
      }

      agent.status = 'RUNNING';
      agent.lastCycleAt = new Date().toISOString();
      agent.nextCycleAt = new Date(Date.now() + intervalMs).toISOString();
      await globalAgentRepository.save(agent);

      const { globalActivityService } = require('../activity.service');
      await globalActivityService.recordEvent(
        agentId,
        'CYCLE_STARTED',
        `Autonomous execution cycle started for agent "${agent.persona.name}".`
      );

      // 2. Discover Topics
      let discoveredCount = 0;
      try {
        discoveredCount = await discoveryService.discover(agentId);
        await globalActivityService.recordEvent(
          agentId,
          'TOPICS_DISCOVERED',
          `Topic discovery completed. Discovered count: ${discoveredCount}.`,
          null,
          null,
          { count: discoveredCount }
        );
      } catch (err: any) {
        console.error(`[Autonomous] Discovery failed for agent ${agentId}:`, err.message);
        await globalActivityService.recordEvent(
          agentId,
          'SOURCE_ERROR',
          `Discovery source crawl failed: ${err.message}`
        );
        // Log CYCLE_FAILED or discovery failure in memory
        try {
          await globalMemoryRepository.save({
            id: `memory-err-${crypto.randomUUID().slice(0, 8)}`,
            agentId,
            type: 'DISCOVERED_TOPIC', // general type fallback
            topicId: 'error-discovery',
            title: 'Discovery Failed Error',
            summary: err.message,
            source: 'system',
            createdAt: new Date().toISOString(),
          });
        } catch (_) {}
      }

      // 3. Retrieve all topics for agent
      const topics = await globalTopicRepository.findByAgentId(agentId);

      // Filter topics to prioritize newer and evaluate candidates
      let postPublished = false;

      for (const topic of topics) {
        // 4. Duplicate Check - Skip if already published (by topicId, source URL, or normalized title)
        const { normalizeText } = require('../../utils/textNormalizer');
        const memories = await memoryService.getAgentMemory(agentId);
        const hasPublishedMemory = memories.some(
          (m: any) =>
            m.type === 'PUBLISHED_POST' &&
            (m.topicId === topic.id ||
              m.source === topic.source.url ||
              normalizeText(m.title) === normalizeText(topic.title))
        );
        if (hasPublishedMemory) {
          continue; // Skip already published topic
        }

        // 5. Editorial Evaluation
        try {
          const decision = await editorialService.evaluateTopic(agent, topic);

          if (decision.decision === 'ACCEPT') {
            // 6. Generate Content
            try {
              await globalContentGenerationService.generateContent(
                agentId,
                topic.id
              );
            } catch (genErr: any) {
              await globalActivityService.recordEvent(
                agentId,
                'AI_ERROR',
                `Content generation failed: ${genErr.message}`,
                topic.id
              );
              throw genErr;
            }

            // 7. Publish
            await globalPublishingService.publishPost(agentId, topic.id);

            agent.lastPublishedAt = new Date().toISOString();
            await globalAgentRepository.save(agent);

            postPublished = true;
            break; // Publish at most ONE post per cycle
          }
        } catch (err: any) {
          console.error(
            `[Autonomous] Cycle evaluation/publishing failed for topic ${topic.id}:`,
            err.message
          );
          await globalActivityService.recordEvent(
            agentId,
            'CYCLE_FAILED',
            `Autonomous cycle failed during processing: ${err.message}`,
            topic.id
          );
        }
      }

      if (!postPublished) {
        if (discoveredCount === 0) {
          await globalActivityService.recordEvent(
            agentId,
            'NO_TOPIC_AVAILABLE',
            `No new topics were available from sources to process.`
          );
        }
        // Log NO_TOPIC_AVAILABLE if noAccepted or no topics crawled
        try {
          const type = discoveredCount === 0 ? 'NO_TOPIC_AVAILABLE' : 'ALL_TOPICS_REJECTED';
          await globalMemoryRepository.save({
            id: `memory-cycle-${crypto.randomUUID().slice(0, 8)}`,
            agentId,
            type: 'DISCOVERED_TOPIC', // general type fallback
            topicId: 'cycle-empty',
            title: type === 'NO_TOPIC_AVAILABLE' ? 'No Topics Found' : 'All Topics Rejected',
            summary: `Execution cycle completed. Status: ${type}`,
            source: 'system',
            createdAt: new Date().toISOString(),
          });
        } catch (_) {}
      }

      await globalActivityService.recordEvent(
        agentId,
        'CYCLE_COMPLETED',
        `Autonomous execution cycle completed successfully.`
      );
    } catch (err: any) {
      console.error(`[Autonomous] Error in execution cycle for agent ${agentId}:`, err.message);
      try {
        const { globalActivityService } = require('../activity.service');
        await globalActivityService.recordEvent(
          agentId,
          'CYCLE_FAILED',
          `Autonomous execution cycle failed: ${err.message}`
        );
      } catch (_) {}
    } finally {
      // Always release lock
      this.processingAgents.delete(agentId);

      // Schedule next timeout recursively
      const activeTimer = this.activeLoops.get(agentId);
      if (activeTimer !== undefined) {
        const nextTimer = setTimeout(() => this.executeCycle(agentId), intervalMs);
        this.activeLoops.set(agentId, nextTimer);
      }
    }
  }
}

export const globalAutonomousService = new AutonomousService();
