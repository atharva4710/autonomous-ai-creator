export type MemoryType =
  | 'DISCOVERED_TOPIC'
  | 'EVALUATED_TOPIC'
  | 'ACCEPTED_TOPIC'
  | 'REJECTED_TOPIC'
  | 'PUBLISHED_POST'
  | 'CONTENT_GENERATED';

export interface Memory {
  id: string;
  agentId: string;
  type: MemoryType;
  topicId: string;
  title: string;
  summary: string;
  source: string;
  decision?: 'ACCEPT' | 'REJECT';
  score?: number;
  reason?: string;
  postId?: string;
  createdAt: string; // ISO 8601 UTC
}
