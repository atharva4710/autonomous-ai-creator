export interface EditorialDecision {
  id: string;
  agentId: string;
  topicId: string;
  decision: 'ACCEPT' | 'REJECT';
  scores: {
    relevance: number;
    personaAlignment: number;
    timeliness: number;
    importance: number;
    novelty: number;
    sourceQuality: number;
    overall: number;
  };
  reason: string;
  evaluatedAt: string; // ISO 8601 UTC
  memoryContext?: {
    isKnown: boolean;
    matchType?: string;
  };
}
