import crypto from 'crypto';
import { Memory, MemoryType } from '../models/memory.interface';
import { Topic } from '../models/topic.interface';
import { EditorialDecision } from '../models/editorial.interface';
import { IMemoryRepository } from '../repositories/memory.repository';
import { normalizeText } from '../utils/textNormalizer';

export interface MatchResult {
  isKnown: boolean;
  matchType?: 'EXACT_TOPIC_ID' | 'NORMALIZED_TITLE' | 'TITLE_AND_SOURCE' | 'KEYWORD_OVERLAP';
  matchedMemoryId?: string;
}

export interface MemorySummary {
  totalMemories: number;
  topicsDiscovered: number;
  topicsEvaluated: number;
  acceptedTopics: number;
  rejectedTopics: number;
  publishedPosts: number;
}

export class MemoryService {
  private memoryRepository: IMemoryRepository;

  constructor(memoryRepository: IMemoryRepository) {
    this.memoryRepository = memoryRepository;
  }

  /**
   * Helper to verify keyword overlap ratio between two titles.
   * Checks if overlap matches >= 80% of the shorter word set.
   */
  private keywordOverlap(titleA: string, titleB: string): boolean {
    const normA = normalizeText(titleA).split(' ').filter((w) => w.length > 0);
    const normB = normalizeText(titleB).split(' ').filter((w) => w.length > 0);

    if (normA.length === 0 || normB.length === 0) return false;

    const setA = new Set(normA);
    let matches = 0;

    for (const w of normB) {
      if (setA.has(w)) {
        matches++;
      }
    }

    const minWords = Math.min(normA.length, normB.length);
    return (matches / minWords) >= 0.8;
  }

  /**
   * Records a DISCOVERED_TOPIC memory record.
   */
  async recordTopicDiscovery(agentId: string, topic: Topic): Promise<Memory> {
    // Check if memory for this topicId already exists
    const existing = await this.memoryRepository.findByTopicId(agentId, topic.id);
    if (existing) {
      return existing;
    }

    const memoryId = `memory-${crypto.randomBytes(4).toString('hex')}`;
    const newMemory: Memory = {
      id: memoryId,
      agentId,
      type: 'DISCOVERED_TOPIC',
      topicId: topic.id,
      title: topic.title,
      summary: topic.summary,
      source: topic.source.url,
      createdAt: topic.discoveredAt || new Date().toISOString(),
    };

    return this.memoryRepository.save(newMemory);
  }

  /**
   * Records an EVALUATED_TOPIC, ACCEPTED_TOPIC, or REJECTED_TOPIC memory record.
   */
  async recordEditorialDecision(
    agentId: string,
    topic: Topic,
    decision: EditorialDecision
  ): Promise<Memory> {
    // Determine memory type based on decision outcome
    const type: MemoryType = decision.decision === 'ACCEPT' ? 'ACCEPTED_TOPIC' : 'REJECTED_TOPIC';

    const memoryId = `memory-${crypto.randomBytes(4).toString('hex')}`;
    const newMemory: Memory = {
      id: memoryId,
      agentId,
      type,
      topicId: topic.id,
      title: topic.title,
      summary: topic.summary,
      source: topic.source.url,
      decision: decision.decision,
      score: decision.scores.overall,
      reason: decision.reason,
      createdAt: decision.evaluatedAt || new Date().toISOString(),
    };

    return this.memoryRepository.save(newMemory);
  }

  /**
   * Detects repeated or substantially similar topics for an agent.
   */
  async checkTopicHistory(
    agentId: string,
    topicId: string,
    title: string,
    source: string
  ): Promise<MatchResult> {
    // 1. Exact topic ID match check
    const exactMatch = await this.memoryRepository.findByTopicId(agentId, topicId);
    if (exactMatch) {
      return {
        isKnown: true,
        matchType: 'EXACT_TOPIC_ID',
        matchedMemoryId: exactMatch.id,
      };
    }

    // Load all memories for agent
    const memories = await this.memoryRepository.findByAgentId(agentId);
    const targetNormTitle = normalizeText(title);

    // 2. Normalized title + source match check
    for (const m of memories) {
      const mNormTitle = normalizeText(m.title);
      if (mNormTitle === targetNormTitle && m.source === source) {
        return {
          isKnown: true,
          matchType: 'TITLE_AND_SOURCE',
          matchedMemoryId: m.id,
        };
      }
    }

    // 3. Normalized title match check
    for (const m of memories) {
      const mNormTitle = normalizeText(m.title);
      if (mNormTitle === targetNormTitle) {
        return {
          isKnown: true,
          matchType: 'NORMALIZED_TITLE',
          matchedMemoryId: m.id,
        };
      }
    }

    // 4. Keyword overlap match check (overlap >= 80%)
    for (const m of memories) {
      if (this.keywordOverlap(m.title, title)) {
        return {
          isKnown: true,
          matchType: 'KEYWORD_OVERLAP',
          matchedMemoryId: m.id,
        };
      }
    }

    return {
      isKnown: false,
    };
  }

  /**
   * Retrieves full history list for an agent.
   */
  async getAgentMemory(agentId: string): Promise<Memory[]> {
    return this.memoryRepository.findByAgentId(agentId);
  }

  /**
   * Compiles total and type-specific count statistics.
   */
  async getMemorySummary(agentId: string): Promise<MemorySummary> {
    const memories = await this.memoryRepository.findByAgentId(agentId);

    const discovered = memories.filter((m) => m.type === 'DISCOVERED_TOPIC').length;
    const accepted = memories.filter((m) => m.type === 'ACCEPTED_TOPIC').length;
    const rejected = memories.filter((m) => m.type === 'REJECTED_TOPIC').length;
    const evaluated = accepted + rejected; // sum of decision outcomes

    return {
      totalMemories: memories.length,
      topicsDiscovered: discovered,
      topicsEvaluated: evaluated,
      acceptedTopics: accepted,
      rejectedTopics: rejected,
      publishedPosts: 0, // publishing Stage 6 context placeholder
    };
  }
}
