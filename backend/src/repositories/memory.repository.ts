import { Memory } from '../models/memory.interface';

export interface IMemoryRepository {
  save(memory: Memory): Promise<Memory>;
  findById(id: string): Promise<Memory | null>;
  findByTopicId(agentId: string, topicId: string): Promise<Memory | null>;
  findByAgentId(agentId: string): Promise<Memory[]>;
}

export class InMemoryMemoryRepository implements IMemoryRepository {
  private memories: Map<string, Memory> = new Map();

  async save(memory: Memory): Promise<Memory> {
    const cloned = JSON.parse(JSON.stringify(memory));
    this.memories.set(cloned.id, cloned);
    return cloned;
  }

  async findById(id: string): Promise<Memory | null> {
    const memory = this.memories.get(id);
    if (!memory) return null;
    return JSON.parse(JSON.stringify(memory));
  }

  async findByTopicId(agentId: string, topicId: string): Promise<Memory | null> {
    return Array.from(this.memories.values())
      .filter((m) => m.agentId === agentId && m.topicId === topicId)
      .map((m) => JSON.parse(JSON.stringify(m)))[0] || null;
  }

  async findByAgentId(agentId: string): Promise<Memory[] > {
    return Array.from(this.memories.values())
      .filter((m) => m.agentId === agentId)
      .map((m) => JSON.parse(JSON.stringify(m)));
  }
}

export const globalMemoryRepository = new InMemoryMemoryRepository();
