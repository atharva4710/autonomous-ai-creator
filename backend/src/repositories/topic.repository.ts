import { Topic } from '../models/topic.interface';

export interface ITopicRepository {
  save(topic: Topic): Promise<Topic>;
  saveAll(topics: Topic[]): Promise<Topic[]>;
  findByAgentId(agentId: string): Promise<Topic[]>;
  findById(id: string): Promise<Topic | null>;
}

export class InMemoryTopicRepository implements ITopicRepository {
  private topics: Map<string, Topic> = new Map();

  async save(topic: Topic): Promise<Topic> {
    const cloned = JSON.parse(JSON.stringify(topic));
    this.topics.set(cloned.id, cloned);
    return cloned;
  }

  async saveAll(topicsList: Topic[]): Promise<Topic[]> {
    const savedList: Topic[] = [];
    for (const t of topicsList) {
      const saved = await this.save(t);
      savedList.push(saved);
    }
    return savedList;
  }

  async findByAgentId(agentId: string): Promise<Topic[]> {
    return Array.from(this.topics.values())
      .filter((t) => t.agentId === agentId)
      .map((t) => JSON.parse(JSON.stringify(t)));
  }

  async findById(id: string): Promise<Topic | null> {
    const topic = this.topics.get(id);
    if (!topic) return null;
    return JSON.parse(JSON.stringify(topic));
  }
}

export const globalTopicRepository = new InMemoryTopicRepository();
