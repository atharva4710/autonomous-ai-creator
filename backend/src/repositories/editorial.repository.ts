import { EditorialDecision } from '../models/editorial.interface';

export interface IEditorialRepository {
  save(decision: EditorialDecision): Promise<EditorialDecision>;
  findByTopicId(topicId: string): Promise<EditorialDecision | null>;
  findByAgentId(agentId: string): Promise<EditorialDecision[]>;
}

export class InMemoryEditorialRepository implements IEditorialRepository {
  private decisions: Map<string, EditorialDecision> = new Map();

  async save(decision: EditorialDecision): Promise<EditorialDecision> {
    const cloned = JSON.parse(JSON.stringify(decision));
    this.decisions.set(cloned.topicId, cloned); // One decision per topicId
    return cloned;
  }

  async findByTopicId(topicId: string): Promise<EditorialDecision | null> {
    const decision = this.decisions.get(topicId);
    if (!decision) return null;
    return JSON.parse(JSON.stringify(decision));
  }

  async findByAgentId(agentId: string): Promise<EditorialDecision[]> {
    return Array.from(this.decisions.values())
      .filter((d) => d.agentId === agentId)
      .map((d) => JSON.parse(JSON.stringify(d)));
  }
}

export const globalEditorialRepository = new InMemoryEditorialRepository();
