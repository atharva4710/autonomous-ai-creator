import crypto from 'crypto';
import { globalAgentRepository } from '../../repositories/agent.repository';
import { globalTopicRepository } from '../../repositories/topic.repository';
import { globalEditorialRepository } from '../../repositories/editorial.repository';
import { globalPostRepository } from '../../repositories/post.repository';
import { globalMemoryRepository } from '../../repositories/memory.repository';
import { globalActivityService } from '../activity.service';
import { globalContentGenerationService } from '../contentGeneration.service';
import { globalPublishingService } from '../publishing.service';
import { discoveryService } from '../../controllers/discovery.controller';
import { editorialService } from '../../controllers/editorial.controller';
import { memoryService } from '../../controllers/memory.controller';
import { normalizeText } from '../../utils/textNormalizer';

export class AutonomousService {
  private activeLoops: Map<string, NodeJS.Timeout> = new Map();
  private processingAgents: Set<string> = new Set();
  private agentStages: Map<string, string> = new Map();

  /**
   * Restores active autonomous timer loops for running agents upon backend restart.
   */
  async restoreActiveLoops(): Promise<number> {
    try {
      const agents = await globalAgentRepository.findAll();
      let restoredCount = 0;

      for (const agent of agents) {
        if (agent.status === 'RUNNING' || agent.status === 'DEGRADED' || agent.status === 'INITIALIZED' || agent.status === 'initialized') {
          if (this.activeLoops.has(agent.agentId)) {
            continue;
          }

          agent.status = 'RUNNING';
          await globalAgentRepository.save(agent);

          // Downtime recovery logic: check if nextCycleAt is overdue
          const nowMs = Date.now();
          const nextCycleMs = agent.nextCycleAt ? Date.parse(agent.nextCycleAt) : 0;

          if (nextCycleMs > 0 && nextCycleMs <= nowMs) {
            console.log(`[Autonomous Recovery] Overdue cycle detected for agent ${agent.agentId}. Triggering immediate recovery cycle.`);
            setTimeout(() => {
              this.executeCycle(agent.agentId).catch((err) => {
                console.error(`[Autonomous Recovery Error] Agent ${agent.agentId}:`, err.message);
              });
            }, 100);
          }

          this.startAgentLoop(agent.agentId);
          restoredCount++;
        }
      }

      return restoredCount;
    } catch (err: any) {
      console.error('[Autonomous Recovery] Failed to restore active loops:', err.message);
      return 0;
    }
  }

  /**
   * Starts autonomous execution loop for an agent. Guarded against duplicate loops.
   */
  startAgentLoop(agentId: string, customIntervalMs?: number): void {
    if (this.activeLoops.has(agentId)) {
      return;
    }

    const intervalMs = customIntervalMs || parseInt(process.env.AUTONOMOUS_CYCLE_INTERVAL_MS || '900000', 10);

    const interval = setInterval(async () => {
      try {
        await this.executeCycle(agentId);
      } catch (err: any) {
        console.error(`[Autonomous Loop Error] Agent ${agentId}:`, err.message);
      }
    }, intervalMs);

    this.activeLoops.set(agentId, interval);
    this.agentStages.set(agentId, 'IDLE');

    // Asynchronously trigger initial cycle immediately if not processing
    setTimeout(() => {
      this.executeCycle(agentId).catch((err) => {
        console.error(`[Autonomous Initial Cycle Error] Agent ${agentId}:`, err.message);
      });
    }, 100);
  }

  /**
   * Stops autonomous loop for an agent.
   */
  stopAgentLoop(agentId: string): void {
    const timer = this.activeLoops.get(agentId);
    if (timer) {
      clearInterval(timer);
      this.activeLoops.delete(agentId);
    }
    this.processingAgents.delete(agentId);
    this.agentStages.set(agentId, 'STOPPED');
    globalAgentRepository.findById(agentId).then((agent) => {
      if (agent) {
        agent.status = 'STOPPED';
        globalAgentRepository.save(agent).catch(() => {});
      }
    }).catch(() => {});
  }

  /**
   * Stops all active agent loops (graceful shutdown).
   */
  async stopAll(): Promise<void> {
    for (const [agentId, timer] of this.activeLoops.entries()) {
      clearInterval(timer);
      try {
        const agent = await globalAgentRepository.findById(agentId);
        if (agent) {
          agent.status = 'STOPPED';
          await globalAgentRepository.save(agent);
        }
      } catch (_) {}
    }
    this.activeLoops.clear();
    this.processingAgents.clear();
    this.agentStages.clear();
  }

  /**
   * Returns current execution stage for an agent.
   */
  getAgentStage(agentId: string): string {
    return this.agentStages.get(agentId) || 'IDLE';
  }

  /**
   * Checks if an autonomous loop is active for an agent.
   */
  isLoopActive(agentId: string): boolean {
    return this.activeLoops.has(agentId);
  }

  /**
   * Returns number of active loops.
   */
  getActiveLoopCount(): number {
    return this.activeLoops.size;
  }

  /**
   * Checks if an agent cycle is currently processing.
   */
  isProcessing(agentId: string): boolean {
    return this.processingAgents.has(agentId);
  }

  /**
   * Resets in-memory loop state (for test isolation).
   */
  resetInMemoryState(): void {
    for (const timer of this.activeLoops.values()) {
      clearInterval(timer);
    }
    this.activeLoops.clear();
    this.processingAgents.clear();
    this.agentStages.clear();
  }

  /**
   * Returns status overview of active loops.
   */
  getActiveLoopIds(): string[] {
    return Array.from(this.activeLoops.keys());
  }

  /**
   * Executes a single autonomous operation cycle for an agent.
   */
  async executeCycle(agentId: string): Promise<void> {
    if (this.processingAgents.has(agentId)) {
      if (process.env.NODE_ENV !== 'test') {
        console.log(`[Autonomous] Agent ${agentId} is currently processing another cycle. Skipping.`);
      }
      return;
    }

    this.processingAgents.add(agentId);
    const cycleErrors: Error[] = [];

    try {
      const agent = await globalAgentRepository.findById(agentId);
      if (!agent) {
        throw new Error(`Agent ${agentId} not found`);
      }

      if (agent.status === 'STOPPED' || agent.status === 'PAUSED') {
        return;
      }

      const cycleIntervalMs = parseInt(process.env.AUTONOMOUS_CYCLE_INTERVAL_MS || '900000', 10);

      // 5. Update agent cycle timestamp
      const cycleMs = parseInt(process.env.AUTONOMOUS_CYCLE_INTERVAL_MS || '900000', 10);
      const nextCycleDate = new Date(Date.now() + cycleMs);
      agent.lastCycleAt = new Date().toISOString();
      agent.nextCycleAt = nextCycleDate.toISOString();
      await globalAgentRepository.save(agent);

      await globalActivityService.recordEvent(
        agentId,
        'CYCLE_STARTED',
        `Autonomous execution cycle started for agent "${agent.persona.name}".`
      );

      // 1. Topic Discovery
      this.agentStages.set(agentId, 'DISCOVERY');
      let discoveredCount = 0;
      try {
        discoveredCount = await discoveryService.discover(agentId);
        await globalActivityService.recordEvent(
          agentId,
          'TOPIC_DISCOVERED',
          `Discovered ${discoveredCount} live candidate topics for domain "${agent.persona.domain}".`,
          null,
          null,
          { count: discoveredCount }
        );
      } catch (err: any) {
        cycleErrors.push(err);
        console.error(`[Autonomous] Discovery failed for agent ${agentId}:`, err.message);
        await globalActivityService.recordEvent(
          agentId,
          'SOURCE_ERROR',
          `Discovery source crawl failed: ${err.message}`
        );
        await globalActivityService.recordEvent(
          agentId,
          'CYCLE_FAILED',
          `Discovery failed for agent ${agentId}: ${err.message}`
        );
        try {
          await globalMemoryRepository.save({
            id: `memory-err-${crypto.randomUUID().slice(0, 8)}`,
            agentId,
            type: 'DISCOVERED_TOPIC',
            topicId: 'error-discovery',
            title: 'Discovery Failed Error',
            summary: err.message,
            source: 'system',
            createdAt: new Date().toISOString(),
          });
        } catch (_) {}
      }

      // 2. Retrieve all topics for agent
      const topics = await globalTopicRepository.findByAgentId(agentId);

      let postPublished = false;
      const cycleEvaluations: Array<{ topic: any; decision: any }> = [];
      const eligibleCandidates: Array<{ topic: any; decision: any }> = [];

      for (const topic of topics) {
        // Memory Check for published posts
        this.agentStages.set(agentId, 'MEMORY_CHECK');
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

        // Editorial Evaluation
        this.agentStages.set(agentId, 'EDITORIAL_EVALUATION');
        try {
          const decision = await editorialService.evaluateTopic(agent, topic);
          cycleEvaluations.push({ topic, decision });

          if (decision.decision === 'ACCEPT') {
            eligibleCandidates.push({ topic, decision });
          }
        } catch (err: any) {
          cycleErrors.push(err);
          console.error(
            `[Autonomous] Cycle evaluation failed for topic ${topic.id}:`,
            err.message
          );
        }
      }

      // Sort ALL cycle evaluations descending by overall score for comparison
      cycleEvaluations.sort((a, b) => b.decision.scores.overall - a.decision.scores.overall);

      // Sort eligible candidates descending by overall score
      eligibleCandidates.sort((a, b) => b.decision.scores.overall - a.decision.scores.overall);

      // Iterate down the eligible candidate list until a post is successfully generated & published
      for (let i = 0; i < eligibleCandidates.length; i++) {
        const candidate = eligibleCandidates[i];
        const selectedTopic = candidate.topic;

        // Double check against published posts repository to prevent duplicate publishing
        const publishedPosts = await globalPostRepository.findByAgentId(agentId);
        const alreadyPublished = publishedPosts.some(
          (p) =>
            p.topicId === selectedTopic.id ||
            (p.sources && p.sources.includes(selectedTopic.source.url)) ||
            normalizeText(p.text).includes(normalizeText(selectedTopic.title).slice(0, 30))
        );

        if (alreadyPublished) {
          continue;
        }

        // Build top rejected alternatives comparison set
        const rejectedAlternatives = cycleEvaluations
          .filter((item) => item.topic.id !== selectedTopic.id)
          .slice(0, 5)
          .map((item) => ({
            topicId: item.topic.id,
            title: item.topic.title,
            score: item.decision.scores.overall,
            rejectionReason: item.decision.reason,
          }));

        candidate.decision.selectionRank = i + 1;
        candidate.decision.comparativeAlternatives = rejectedAlternatives;
        await globalEditorialRepository.save(candidate.decision);

        // 3. Generate Content
        this.agentStages.set(agentId, 'CONTENT_GENERATION');
        try {
          try {
            await globalContentGenerationService.generateContent(
              agentId,
              selectedTopic.id
            );
          } catch (genErr: any) {
            await globalActivityService.recordEvent(
              agentId,
              'AI_ERROR',
              `Content generation failed for "${selectedTopic.title}": ${genErr.message}`,
              selectedTopic.id
            );
            throw genErr;
          }

          // 4. Publish
          this.agentStages.set(agentId, 'PUBLISHING');
          await globalPublishingService.publishPost(agentId, selectedTopic.id);

          agent.lastPublishedAt = new Date().toISOString();
          await globalAgentRepository.save(agent);

          postPublished = true;
          break; // Successfully published post for this cycle
        } catch (err: any) {
          cycleErrors.push(err);
          console.error(
            `[Autonomous] Content generation/publishing failed for topic ${selectedTopic.id}:`,
            err.message
          );
          await globalActivityService.recordEvent(
            agentId,
            'CYCLE_FAILED',
            `Attempt failed for topic "${selectedTopic.title}": ${err.message}`,
            selectedTopic.id
          );
          // Continue down the list to next eligible candidate
        }
      }

      if (!postPublished) {
        const type = discoveredCount === 0 ? 'NO_TOPIC_AVAILABLE' : 'NO_TOPIC_SELECTED';
        try {
          await globalActivityService.recordEvent(
            agentId,
            type,
            `Cycle finished without post creation. Discovered: ${discoveredCount}, Evaluated: ${topics.length}, Eligible: ${eligibleCandidates.length}.`
          );
        } catch (_) {}
      }

      // Update Agent Status
      if (postPublished) {
        if (agent.status !== 'RUNNING') {
          agent.status = 'RUNNING';
          await globalAgentRepository.save(agent);
          await globalActivityService.recordEvent(
            agentId,
            'AGENT_RECOVERED',
            'Agent recovered to RUNNING status after clean cycle execution.'
          );
        }
      } else if (cycleErrors.length > 0) {
        agent.status = 'DEGRADED';
        await globalAgentRepository.save(agent);
        await globalActivityService.recordEvent(
          agentId,
          'AGENT_DEGRADED',
          `Agent status transitioned to DEGRADED due to ${cycleErrors.length} non-fatal error(s) during cycle.`
        );
      }

      await globalActivityService.recordEvent(
        agentId,
        'CYCLE_COMPLETED',
        `Autonomous execution cycle completed for agent ${agentId}. Post Published: ${postPublished}.`
      );
    } finally {
      this.processingAgents.delete(agentId);
      this.agentStages.set(agentId, 'IDLE');
    }
  }
}

export const globalAutonomousService: AutonomousService = new AutonomousService();
