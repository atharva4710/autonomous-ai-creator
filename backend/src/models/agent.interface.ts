export interface AgentState {
  agentId: string;
  persona: {
    name: string;
    domain: string;
  };
  status: 'initialized';
  createdAt: string; // ISO 8601 UTC timestamp
}
