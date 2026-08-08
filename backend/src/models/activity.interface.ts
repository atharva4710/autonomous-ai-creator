export type ActivityType =
  | 'AGENT_INITIALIZED'
  | 'CYCLE_STARTED'
  | 'TOPICS_DISCOVERED'
  | 'TOPIC_DISCOVERED'
  | 'TOPIC_EVALUATED'
  | 'TOPIC_ACCEPTED'
  | 'TOPIC_REJECTED'
  | 'MEMORY_CHECKED'
  | 'CONTENT_GENERATED'
  | 'POST_VALIDATED'
  | 'POST_PUBLISHED'
  | 'CYCLE_COMPLETED'
  | 'CYCLE_FAILED'
  | 'NO_TOPIC_AVAILABLE'
  | 'AI_ERROR'
  | 'SOURCE_ERROR'
  | 'PUBLISH_ERROR';

export interface ActivityEvent {
  id: string;
  agentId: string;
  type: ActivityType;
  timestamp: string; // ISO 8601 UTC
  message: string;
  topicId?: string | null;
  postId?: string | null;
  metadata?: any;
}
