import crypto from 'crypto';
import { Topic } from '../models/topic.interface';
import { AgentState } from '../models/agent.interface';
import { EditorialDecision } from '../models/editorial.interface';
import { IEditorialRepository } from '../repositories/editorial.repository';

export class EditorialService {
  private editorialRepository: IEditorialRepository;

  // Configurable threshold and weights
  private readonly DECISION_THRESHOLD = 65;
  private readonly WEIGHTS = {
    relevance: 0.25,
    personaAlignment: 0.20,
    timeliness: 0.15,
    importance: 0.15,
    novelty: 0.15,
    sourceQuality: 0.10,
  };

  constructor(editorialRepository: IEditorialRepository) {
    this.editorialRepository = editorialRepository;
  }

  /**
   * Evaluates a topic against an agent's persona configuration.
   */
  async evaluateTopic(agent: AgentState, topic: Topic): Promise<EditorialDecision> {
    // Check if evaluation already exists to prevent duplicate processing
    const existing = await this.editorialRepository.findByTopicId(topic.id);
    if (existing) {
      return existing;
    }

    const domain = agent.persona.domain.toLowerCase();
    const title = topic.title.toLowerCase();
    const summary = topic.summary.toLowerCase();
    const content = `${title} ${summary}`;

    // 1. RELEVANCE (0-100)
    // Extract keywords from agent's domain and count hits
    const domainWords = domain.split(/\s+/).filter((w) => w.length > 2);
    let relevanceHits = 0;
    for (const word of domainWords) {
      if (content.includes(word)) {
        relevanceHits++;
      }
    }
    let relevance = 10;
    if (relevanceHits === 1) relevance = 50;
    else if (relevanceHits === 2) relevance = 85;
    else if (relevanceHits >= 3) relevance = 100;

    // 2. PERSONA ALIGNMENT (0-100)
    // Check match against persona interests and expertise arrays
    const interests = agent.persona.interests || [];
    const expertise = agent.persona.expertise || [];
    const focusTerms = [...interests, ...expertise].map((t) => t.toLowerCase());

    let alignmentMatches = 0;
    for (const term of focusTerms) {
      if (content.includes(term)) {
        alignmentMatches += 2; // High weight for exact phrase match
      } else {
        const words = term.split(/\s+/).filter((w) => w.length > 2);
        for (const word of words) {
          if (content.includes(word)) {
            alignmentMatches += 0.5;
          }
        }
      }
    }

    let personaAlignment = 40;
    if (focusTerms.length === 0) {
      const interestKeywords = [
        'security',
        'vulnerability',
        'privacy',
        'leak',
        'exploit',
        'threat',
        'hack',
        'safe',
        'patch',
        'agent',
        'model',
        'intelligence',
        'research',
      ];
      let alignmentHits = 0;
      for (const key of interestKeywords) {
        if (content.includes(key) && domain.includes(key)) {
          alignmentHits++;
        }
      }
      personaAlignment = alignmentHits > 0 ? 95 : 40;
    } else {
      if (alignmentMatches >= 5) {
        personaAlignment = 95;
      } else if (alignmentMatches >= 2) {
        personaAlignment = 85;
      } else if (alignmentMatches > 0) {
        personaAlignment = 60;
      }
    }

    // 3. TIMELINESS (0-100)
    // Check age of topic relative to discovery time
    let timeliness = 50;
    const pubTime = Date.parse(topic.publishedAt);
    const discTime = Date.parse(topic.discoveredAt);
    if (!isNaN(pubTime) && !isNaN(discTime)) {
      const diffMs = Math.abs(discTime - pubTime);
      const diffHours = diffMs / (1000 * 60 * 60);

      if (diffHours < 12) timeliness = 100;
      else if (diffHours < 24) timeliness = 90;
      else if (diffHours < 48) timeliness = 75;
      else if (diffHours < 168) timeliness = 50; // 7 days
      else timeliness = 30;
    }

    // 4. IMPORTANCE (0-100)
    // Look for high-importance tags in text
    const highTriggers = [
      'breakthrough',
      'critical',
      'release',
      'vulnerability',
      'zero-day',
      'exploit',
      'breach',
      'hack',
      'research',
      'major',
    ];
    const medTriggers = ['update', 'improved', 'new', 'model', 'change'];

    let importance = 50;
    if (highTriggers.some((t) => content.includes(t))) {
      importance = 90;
    } else if (medTriggers.some((t) => content.includes(t))) {
      importance = 70;
    }

    // 5. NOVELTY (0-100)
    // Look for version specifiers or unique LLM references
    const versionRegex = /\b\d+\.\d+\b|gpt-|claude|llama|gemini|astra/i;
    const novelty = versionRegex.test(content) ? 85 : 70;

    // 6. SOURCE QUALITY (0-100)
    let sourceQuality = 60;
    const srcName = topic.source.name.toLowerCase();
    if (srcName.includes('techcrunch')) {
      sourceQuality = 90;
    } else if (srcName.includes('hacker news')) {
      sourceQuality = 85;
    }

    // Calculate overall weighted score
    const overallFloat =
      relevance * this.WEIGHTS.relevance +
      personaAlignment * this.WEIGHTS.personaAlignment +
      timeliness * this.WEIGHTS.timeliness +
      importance * this.WEIGHTS.importance +
      novelty * this.WEIGHTS.novelty +
      sourceQuality * this.WEIGHTS.sourceQuality;

    let overall = Math.round(overallFloat);

    // Call memory check using dynamic require to prevent dependency cycles
    let historyMatch = { isKnown: false } as any;
    try {
      const { memoryService } = require('../controllers/memory.controller');
      historyMatch = await memoryService.checkTopicHistory(
        agent.agentId,
        topic.id,
        topic.title,
        topic.source.url
      );
      
      const { globalActivityService } = require('./activity.service');
      await globalActivityService.recordEvent(
        agent.agentId,
        'MEMORY_CHECKED',
        `Checked duplicate memory check for topic: "${topic.title}". isKnown: ${historyMatch.isKnown}`,
        topic.id,
        null,
        { isKnown: historyMatch.isKnown, matchType: historyMatch.matchType }
      );
    } catch (err: any) {
      console.error('[Editorial] Memory check error:', err.message);
    }

    if (historyMatch.isKnown) {
      overall = Math.max(0, overall - 20); // apply -20 repetition penalty
    }

    const decision = overall >= this.DECISION_THRESHOLD ? 'ACCEPT' : 'REJECT';

    // Formulate justification reason influenced by persona domain and editorial principles
    let reason = `The topic overall score did not meet the required threshold of ${this.DECISION_THRESHOLD}, primarily due to low relevance (score: ${relevance}) to the persona's domain of "${agent.persona.domain}".`;
    if (decision === 'ACCEPT') {
      reason = `Highly relevant (score: ${relevance}) to the persona's "${agent.persona.domain}" focus and represents a significant current development.`;
    }

    // Apply editorial principles warnings/notes dynamically
    let principlesNote = '';
    const principles = agent.persona.editorialPrinciples || [];
    const hypeKeywords = [
      'replace',
      'hype',
      'next gen',
      'revolutionary',
      'game changer',
      'killer',
      'apocalypse',
      '100x',
      'disrupt',
      'speculation',
    ];
    const containsHype = hypeKeywords.some((w) => content.includes(w));

    for (const pr of principles) {
      const lowerPr = pr.toLowerCase();
      if (lowerPr.includes('hype') || lowerPr.includes('evidence')) {
        if (containsHype) {
          principlesNote += ` Speculative hype detected; evaluated under principle: "${pr}".`;
        }
      } else if (lowerPr.includes('practical') || lowerPr.includes('implication')) {
        if (
          content.includes('exploit') ||
          content.includes('vulnerability') ||
          content.includes('risk') ||
          content.includes('research')
        ) {
          principlesNote += ` Noted under principle: "${pr}" for practical risks.`;
        }
      }
    }

    if (principlesNote) {
      reason += principlesNote;
    }

    // Append penalty comment if repetitive
    if (historyMatch.isKnown) {
      reason += ` (Note: This topic is repetitive with previously encountered coverage matching "${historyMatch.matchType}", resulting in a score penalty).`;
    }

    const randomHex = crypto.randomBytes(4).toString('hex');
    const decisionId = `decision-${randomHex}`;

    const newDecision: EditorialDecision = {
      id: decisionId,
      agentId: agent.agentId,
      topicId: topic.id,
      decision,
      scores: {
        relevance,
        personaAlignment,
        timeliness,
        importance,
        novelty,
        sourceQuality,
        overall,
      },
      reason,
      evaluatedAt: new Date().toISOString(),
      memoryContext: {
        isKnown: historyMatch.isKnown,
        matchType: historyMatch.matchType,
      },
    };

    const savedDecision = await this.editorialRepository.save(newDecision);

    // Auto-log to memory service and activity service
    try {
      const { memoryService } = require('../controllers/memory.controller');
      await memoryService.recordEditorialDecision(agent.agentId, topic, savedDecision);

      const { globalActivityService } = require('./activity.service');
      await globalActivityService.recordEvent(
        agent.agentId,
        'TOPIC_EVALUATED',
        `Evaluated topic "${topic.title}" with overall score ${overall}.`,
        topic.id,
        null,
        { decision, score: overall, reason }
      );
      if (decision === 'ACCEPT') {
        await globalActivityService.recordEvent(
          agent.agentId,
          'TOPIC_ACCEPTED',
          `Topic "${topic.title}" accepted by editorial engine.`,
          topic.id
        );
      } else {
        await globalActivityService.recordEvent(
          agent.agentId,
          'TOPIC_REJECTED',
          `Topic "${topic.title}" rejected by editorial engine: score (${overall}) below threshold.`,
          topic.id
        );
      }
    } catch (err: any) {
      console.error('[Editorial] Failed to record decision memory/activity:', err.message);
    }

    return savedDecision;
  }

  /**
   * Retrieves configured weights details.
   */
  getWeights() {
    return { ...this.WEIGHTS };
  }

  /**
   * Retrieves configured threshold value.
   */
  getThreshold() {
    return this.DECISION_THRESHOLD;
  }
}
