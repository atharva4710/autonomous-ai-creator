import request from 'supertest';
import app from '../src/server';
import { retry, withTimeout } from '../src/utils/retry';
import { AppError } from '../src/utils/errors';
import { globalAIProvider } from '../src/services/aiProvider';
import { globalAgentRepository } from '../src/repositories/agent.repository';
import { globalTopicRepository } from '../src/repositories/topic.repository';
import { globalEditorialRepository } from '../src/repositories/editorial.repository';
import { globalPostRepository } from '../src/repositories/post.repository';
import { globalAutonomousService } from '../src/services/autonomous/autonomous.service';
import { globalActivityService } from '../src/services/activity.service';
import { globalContentGenerationService } from '../src/services/contentGeneration.service';

describe('Stage 9 - Reliability & Error Recovery Tests', () => {
  jest.setTimeout(30000);
  beforeEach(async () => {
    process.env.AUTONOMOUS_ENABLED = 'false';
    // Reset AI Provider simulated failure modes
    globalAIProvider.setFailureMode(null);
  });

  describe('Retry Utility checks', () => {
    it('1. Retry succeeds on second attempt', async () => {
      let attempts = 0;
      const result = await retry(
        async () => {
          attempts++;
          if (attempts < 2) {
            throw new Error('Temp failure');
          }
          return 'success';
        },
        { maxAttempts: 3, delayMs: 10 }
      );
      expect(result).toBe('success');
      expect(attempts).toBe(2);
    });

    it('2. Retry succeeds on third attempt', async () => {
      let attempts = 0;
      const result = await retry(
        async () => {
          attempts++;
          if (attempts < 3) {
            throw new Error('Temp failure');
          }
          return 'success';
        },
        { maxAttempts: 3, delayMs: 10 }
      );
      expect(result).toBe('success');
      expect(attempts).toBe(3);
    });

    it('3. Retry stops after maximum attempts', async () => {
      let attempts = 0;
      await expect(
        retry(
          async () => {
            attempts++;
            throw new Error('Permanent failure');
          },
          { maxAttempts: 3, delayMs: 10 }
        )
      ).rejects.toThrow();
      expect(attempts).toBe(3);
    });

    it('4. Non-retryable error is not retried', async () => {
      let attempts = 0;
      await expect(
        retry(
          async () => {
            attempts++;
            throw new AppError('FATAL', 'Non-retryable error', false);
          },
          { maxAttempts: 3, delayMs: 10 }
        )
      ).rejects.toThrow('Non-retryable error');
      expect(attempts).toBe(1);
    });
  });

  describe('Timeout Utility checks', () => {
    it('5. Timeout is handled', async () => {
      const slowOp = () => new Promise<string>((resolve) => setTimeout(() => resolve('done'), 150));
      await expect(
        withTimeout(slowOp, 50, 'Slow Op')
      ).rejects.toThrow('Slow Op timed out after 50ms');
    });
  });

  describe('Service Failure & Recovery checks', () => {
    it('6. AI provider failure is handled', async () => {
      // 1. Initialize agent and topic
      const agentRes = await request(app)
        .post('/api/agent/init')
        .send({
          persona: {
            name: 'Reliability Tester',
            domain: 'AI Vulnerability Prevention',
          },
        });
      const agentId = agentRes.body.agentId;

      const topicId = 'topic-rel-1';
      await globalTopicRepository.save({
        id: topicId,
        agentId,
        title: 'Exploit Mitigation System',
        summary: 'mitigation rules',
        source: { name: 'TechCrunch', url: 'https://tc.com/1' },
        publishedAt: new Date().toISOString(),
        discoveredAt: new Date().toISOString(),
      });

      // Save accepted editorial decision directly
      const crypto = require('crypto');
      await globalEditorialRepository.save({
        id: 'dec-' + crypto.randomBytes(4).toString('hex'),
        agentId,
        topicId,
        decision: 'ACCEPT',
        scores: { relevance: 90, personaAlignment: 90, timeliness: 90, importance: 90, novelty: 90, sourceQuality: 90, overall: 90 },
        reason: 'Highly relevant topic',
        evaluatedAt: new Date().toISOString(),
      });

      // 2. Set AI failure mode to rate limit (all attempts fail)
      globalAIProvider.setFailureMode('rate_limit', 3);

      // 3. Attempt content generation, verify it throws structured AI provider error
      await expect(
        request(app)
          .post('/api/agent/content/generate')
          .send({ agentId, topicId })
      ).resolves.toHaveProperty('status', 400);
    });

    it('7. AI provider malformed response is handled', async () => {
      const agentRes = await request(app)
        .post('/api/agent/init')
        .send({
          persona: {
            name: 'Reliability Tester',
            domain: 'AI Security',
          },
        });
      const agentId = agentRes.body.agentId;

      const topicId = 'topic-rel-2';
      await globalTopicRepository.save({
        id: topicId,
        agentId,
        title: 'Malformed Prompt Injection',
        summary: 'mitigation',
        source: { name: 'Hacker News', url: 'https://hn.com/2' },
        publishedAt: new Date().toISOString(),
        discoveredAt: new Date().toISOString(),
      });

      const crypto = require('crypto');
      await globalEditorialRepository.save({
        id: 'dec-' + crypto.randomBytes(4).toString('hex'),
        agentId,
        topicId,
        decision: 'ACCEPT',
        scores: { relevance: 90, personaAlignment: 90, timeliness: 90, importance: 90, novelty: 90, sourceQuality: 90, overall: 90 },
        reason: 'Highly relevant topic',
        evaluatedAt: new Date().toISOString(),
      });

      // Set malformed response
      globalAIProvider.setFailureMode('malformed', 1);

      const response = await request(app)
        .post('/api/agent/content/generate')
        .send({ agentId, topicId });
      
      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('CONTENT_GENERATION_ERROR');
    });

    it('8. One RSS source failure does not stop discovery', async () => {
      const agentRes = await request(app)
        .post('/api/agent/init')
        .send({
          persona: { name: 'Tester', domain: 'AI Security' },
        });
      const agentId = agentRes.body.agentId;

      // Mock discoveryService sources configuration to have a failing one and a working one
      const { discoveryService } = require('../src/controllers/discovery.controller');
      const origSources = (discoveryService as any).sources;
      const origFetch = global.fetch;

      (discoveryService as any).sources = [
        { name: 'Broken Feed', url: 'https://invalid-domain-for-testing.xxx/rss', type: 'rss', enabled: true },
        { name: 'Mock HN', url: 'https://news.ycombinator.com/rss', type: 'rss', enabled: true },
      ];

      global.fetch = jest.fn().mockImplementation((url: string) => {
        if (url.includes('invalid-domain')) {
          return Promise.reject(new Error('Network error on broken feed'));
        }
        return Promise.resolve({
          ok: true,
          status: 200,
          text: () => Promise.resolve('<rss><channel><item><title>Mock HN Item</title><link>https://news.ycombinator.com/item?id=1</link><pubDate>Sat, 08 Aug 2026 12:00:00 GMT</pubDate></item></channel></rss>'),
        } as Response);
      });

      try {
        const count = await discoveryService.discover(agentId);
        // Should complete successfully without crashing, returning 0 or positive count
        expect(typeof count).toBe('number');

        // Check activity log for SOURCE_ERROR event
        const activities = await globalActivityService.getAgentActivity(agentId);
        const sourceErr = activities.find((e: any) => e.type === 'SOURCE_ERROR');
        expect(sourceErr).toBeDefined();
      } finally {
        (discoveryService as any).sources = origSources;
        global.fetch = origFetch;
      }
    });

    it('9. Content generation failure does not crash agent loop', async () => {
      const agentRes = await request(app)
        .post('/api/agent/init')
        .send({
          persona: { name: 'Loop Tester', domain: 'AI Security' },
        });
      const agentId = agentRes.body.agentId;

      // Save a topic and accept it
      const topicId = 'topic-rel-loop';
      const topic = await globalTopicRepository.save({
        id: topicId,
        agentId,
        title: 'MITRE vulnerability alert',
        summary: 'mitre details',
        source: { name: 'TechCrunch', url: 'https://tc.com/loop' },
        publishedAt: new Date().toISOString(),
        discoveredAt: new Date().toISOString(),
      });

      const crypto = require('crypto');
      await globalEditorialRepository.save({
        id: 'dec-' + crypto.randomBytes(4).toString('hex'),
        agentId,
        topicId,
        decision: 'ACCEPT',
        scores: { relevance: 90, personaAlignment: 90, timeliness: 90, importance: 90, novelty: 90, sourceQuality: 90, overall: 90 },
        reason: 'Highly relevant topic',
        evaluatedAt: new Date().toISOString(),
      });

      // Trigger AI provider timeout failure
      globalAutonomousService.stopAgentLoop(agentId);
      (globalContentGenerationService as any).aiProvider = globalAIProvider;
      globalAIProvider.setFailureMode('timeout', 100);

      // Execute autonomous cycle manually, verify it doesn't throw or crash the execution loop
      await expect(
        globalAutonomousService.executeCycle(agentId)
      ).resolves.toBeUndefined();

      // Check agent status is degraded because of AI generation failure
      const updatedAgent = await globalAgentRepository.findById(agentId);
      expect(updatedAgent?.status).toBe('DEGRADED');

      // Verify AI_ERROR event recorded in the raw repository (bypassing the newest 50 events limit)
      const { globalActivityRepository } = require('../src/repositories/activity.repository');
      const activities = await globalActivityRepository.findByAgentId(agentId);
      const aiErr = activities.find((e: any) => e.type === 'AI_ERROR');
      expect(aiErr).toBeDefined();
    });

    it('10. Publishing failure does not mark post published', async () => {
      const agentRes = await request(app)
        .post('/api/agent/init')
        .send({
          persona: { name: 'Pub Tester', domain: 'AI Security' },
        });
      const agentId = agentRes.body.agentId;

      const topicId = 'topic-rel-pub';
      await globalTopicRepository.save({
        id: topicId,
        agentId,
        title: 'Vulnerability exploit pub failure',
        summary: 'pub fail summary',
        source: { name: 'TechCrunch', url: 'https://tc.com/pub' },
        publishedAt: new Date().toISOString(),
        discoveredAt: new Date().toISOString(),
      });

      // Save dummy validated post draft
      const postDraft = await globalPostRepository.save({
        id: 'post-rel-pub-id',
        agentId,
        topicId,
        decisionId: 'dec-1',
        status: 'VALIDATED',
        text: 'valid draft post text contents',
        angle: 'analysis',
        keyPoints: [],
        sources: ['https://tc.com/pub'],
        regenerationsCount: 0,
        createdAt: new Date().toISOString(),
      });

      // Stub save method to reject and simulate Database/Storage failure
      const origSave = globalPostRepository.save;
      globalPostRepository.save = jest.fn().mockRejectedValue(new Error('Simulated DB failure'));

      try {
        const { globalPublishingService } = require('../src/services/publishing.service');
        await expect(
          globalPublishingService.publishPost(agentId, topicId)
        ).rejects.toThrow('Database save failed during publishing');

        // Check activity log records PUBLISH_ERROR
        const activities = await globalActivityService.getAgentActivity(agentId);
        const pubErr = activities.find((e: any) => e.type === 'PUBLISH_ERROR');
        expect(pubErr).toBeDefined();
      } finally {
        globalPostRepository.save = origSave;
      }
    });

    it('11. Database/Repository failure is handled at service boundary', async () => {
      const origFind = globalAgentRepository.findById;
      globalAgentRepository.findById = jest.fn().mockRejectedValue(new Error('Simulated Repository query failure'));

      try {
        const response = await request(app).get('/api/agent/status?agentId=agent-xyz');
        expect(response.status).toBe(500);
        expect(response.body.error.code).toBe('INTERNAL_SERVER_ERROR');
      } finally {
        globalAgentRepository.findById = origFind;
      }
    });

    it('12. Autonomous cycle survives a recoverable error and transitions to DEGRADED', async () => {
      const agentRes = await request(app)
        .post('/api/agent/init')
        .send({
          persona: { name: 'Cycle Tester', domain: 'AI Security' },
        });
      const agentId = agentRes.body.agentId;

      // Mock discoveryService to throw error
      const { discoveryService } = require('../src/controllers/discovery.controller');
      const origDiscover = discoveryService.discover;
      discoveryService.discover = jest.fn().mockRejectedValue(new Error('Discovery Network Timeout'));

      try {
        await globalAutonomousService.executeCycle(agentId);
        
        // Agent status degraded
        const freshAgent = await globalAgentRepository.findById(agentId);
        expect(freshAgent?.status).toBe('DEGRADED');

        // Records SOURCE_ERROR activity
        const activities = await globalActivityService.getAgentActivity(agentId);
        const hasErr = activities.some((e: any) => e.type === 'SOURCE_ERROR');
        expect(hasErr).toBe(true);
      } finally {
        discoveryService.discover = origDiscover;
      }
    });

    it('15. /health still works', async () => {
      const response = await request(app).get('/health');
      expect(response.status).toBe(200);
      expect(response.body).toEqual({ status: 'ok' });
    });
  });
});
