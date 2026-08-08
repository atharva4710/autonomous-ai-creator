export interface Post {
  id: string;
  agentId: string;
  topicId: string;
  decisionId: string;
  status: 'DRAFT' | 'VALIDATED' | 'PUBLISHED' | 'FAILED';
  text: string;
  angle?: string;
  keyPoints?: string[];
  sources: string[];
  rationale?: string;
  regenerationsCount: number;
  createdAt: string; // ISO 8601 UTC
  publishedAt?: string; // ISO 8601 UTC
}
