export interface Persona {
  name: string;
  role: string;
  domain: string;
  description: string;
  interests: string[];
  expertise: string[];
  tone: string[];
  editorialPrinciples: string[];
}

export interface AgentState {
  agentId: string;
  persona: Persona;
  status: 'INITIALIZED' | 'RUNNING' | 'PAUSED' | 'STOPPED' | 'ERROR' | 'initialized';
  createdAt: string; // ISO 8601 UTC timestamp
  lastCycleAt?: string;
  lastPublishedAt?: string;
  nextCycleAt?: string;
}
