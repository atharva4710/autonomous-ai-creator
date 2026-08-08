export interface Topic {
  id: string;
  agentId: string;
  title: string;
  summary: string;
  source: {
    name: string;
    url: string;
  };
  publishedAt: string; // ISO 8601 UTC
  discoveredAt: string; // ISO 8601 UTC
}
