import { AgentState } from '../models/agent.interface';

export interface IAgentRepository {
  save(agent: AgentState): Promise<AgentState>;
  findById(agentId: string): Promise<AgentState | null>;
  findAll(): Promise<AgentState[]>;
}

export class InMemoryAgentRepository implements IAgentRepository {
  private agents: Map<string, AgentState> = new Map();

  async save(agent: AgentState): Promise<AgentState> {
    // Clone to prevent external mutations
    const cloned = JSON.parse(JSON.stringify(agent));
    this.agents.set(cloned.agentId, cloned);
    return cloned;
  }

  async findById(agentId: string): Promise<AgentState | null> {
    const agent = this.agents.get(agentId);
    if (!agent) return null;
    return JSON.parse(JSON.stringify(agent));
  }

  async findAll(): Promise<AgentState[]> {
    return Array.from(this.agents.values()).map((agent) =>
      JSON.parse(JSON.stringify(agent))
    );
  }
}
