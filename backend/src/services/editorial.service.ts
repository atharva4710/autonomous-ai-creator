import crypto from 'crypto';
import { Topic } from '../models/topic.interface';
import { AgentState } from '../models/agent.interface';
import { EditorialDecision } from '../models/editorial.interface';
import { IEditorialRepository } from '../repositories/editorial.repository';
import { expandDomainQueries } from '../utils/domainQueryExpander';
import { globalActivityService } from './activity.service';
import { memoryService } from '../controllers/memory.controller';

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
    const summary = (topic.summary || '').toLowerCase();
    const content = `${title} ${summary}`;

    // 1. RELEVANCE (0-100)
    const expandedQueries = expandDomainQueries(agent.persona.domain, agent.persona.interests || []);

    let relevance = 15;
    if (content.includes(domain)) {
      relevance = 100;
    } else {
      let conceptHits = 0;
      for (const query of expandedQueries) {
        const lowerQuery = query.toLowerCase();
        if (lowerQuery.length >= 3 && content.includes(lowerQuery)) {
          conceptHits++;
        }
      }
      if (conceptHits >= 2) relevance = 95;
      else if (conceptHits === 1) relevance = 85;
      else {
        const domainWords = domain.split(/\s+/).filter((w) => w.length >= 3);
        let wordHits = 0;
        for (const w of domainWords) {
          if (content.includes(w)) wordHits++;
        }
        if (domainWords.length > 0 && wordHits === domainWords.length) relevance = 75;
        else if (wordHits > 0) relevance = 45;
      }
    }

    // 2. PERSONA ALIGNMENT (0-100)
    const interests = agent.persona.interests || [];
    const expertise = agent.persona.expertise || [];
    const focusTerms = [...interests, ...expertise].map((t) => t.toLowerCase());

    let alignmentMatches = 0;
    for (const term of focusTerms) {
      if (content.includes(term)) {
        alignmentMatches += 2;
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
        'robot',
        'learning',
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

    // 3. TIMELINESS / FRESHNESS (0-100)
    let timeliness = 50;
    const pubTime = Date.parse(topic.publishedAt);
    const discTime = Date.parse(topic.discoveredAt);
    if (!isNaN(pubTime) && !isNaN(discTime)) {
      const diffMs = Math.abs(discTime - pubTime);
      const diffHours = diffMs / (1000 * 60 * 60);

      if (diffHours <= 24) timeliness = 95;
      else if (diffHours <= 48) timeliness = 80;
      else if (diffHours <= 168) timeliness = 55; // Within 7 days
      else timeliness = 20; // Stale (> 7 days)
    }

    // 4. IMPORTANCE (0-100)
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
      'benchmark',
      'launch',
    ];
    const medTriggers = ['update', 'improved', 'new', 'model', 'change', 'framework'];

    let importance = 50;
    if (highTriggers.some((t) => content.includes(t))) {
      importance = 90;
    } else if (medTriggers.some((t) => content.includes(t))) {
      importance = 70;
    }

    // 5. NOVELTY (0-100)
    const versionRegex = /\b\d+\.\d+\b|gpt-|claude|llama|gemini|astra|deepseek|qwen/i;
    const novelty = versionRegex.test(content) ? 85 : 70;

    // 6. SOURCE QUALITY (0-100)
    let sourceQuality = 60;
    const srcName = (topic.source.name || '').toLowerCase();
    const srcUrl = (topic.source.url || '').toLowerCase();

    if (
      srcName.includes('techcrunch') ||
      srcName.includes('arxiv') ||
      srcName.includes('openai') ||
      srcName.includes('anthropic') ||
      srcName.includes('deepmind') ||
      srcUrl.includes('techcrunch.com') ||
      srcUrl.includes('arxiv.org')
    ) {
      sourceQuality = 92;
    } else if (
      srcName.includes('hacker news') ||
      srcName.includes('github') ||
      srcName.includes('hugging') ||
      srcUrl.includes('ycombinator.com') ||
      srcUrl.includes('github.com')
    ) {
      sourceQuality = 85;
    } else if (srcName.includes('spam') || srcName.includes('farm') || srcUrl.includes('contentfarm')) {
      sourceQuality = 20;
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
      historyMatch = await memoryService.checkTopicHistory(
        agent.agentId,
        topic.id,
        topic.title,
        topic.source.url
      );

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

    // Apply repetition penalty if memory check flags exact/near-duplicate coverage
    if (historyMatch.isKnown) {
      overall = Math.max(0, overall - 30);
    }

    // Quality gate threshold validation
    const isEligible = overall >= this.DECISION_THRESHOLD && relevance >= 35 && timeliness >= 20;
    const decision = isEligible ? 'ACCEPT' : 'REJECT';

    // Formulate justification reason
    let reason = '';
    if (decision === 'ACCEPT') {
      reason = `Highly relevant (score: ${relevance}) to the persona's "${agent.persona.domain}" focus and represents a significant current development. Accepted with overall score ${overall}/100, timeliness (${timeliness}/100), and source quality (${sourceQuality}/100).`;
    } else {
      reason = `The topic overall score did not meet the required threshold of ${this.DECISION_THRESHOLD}, primarily due to low relevance (score: ${relevance}) to the persona's domain of "${agent.persona.domain}". Rejected with overall score ${overall}/100.`;
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

    if (historyMatch.isKnown) {
      reason += ` (Repetitive topic matching "${historyMatch.matchType}", -30 score penalty applied).`;
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
      await memoryService.recordEditorialDecision(agent.agentId, topic, savedDecision);

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
