import { ActivityEvent } from '../models/activity.interface';

export interface IActivityRepository {
  save(event: ActivityEvent): Promise<ActivityEvent>;
  findByAgentId(agentId: string): Promise<ActivityEvent[]>;
  findByTopicId(agentId: string, topicId: string): Promise<ActivityEvent[]>;
  findByPostId(agentId: string, postId: string): Promise<ActivityEvent[]>;
}

export class InMemoryActivityRepository implements IActivityRepository {
  private events: Map<string, ActivityEvent> = new Map();

  async save(event: ActivityEvent): Promise<ActivityEvent> {
    const cloned = JSON.parse(JSON.stringify(event));
    this.events.set(cloned.id, cloned);
    return cloned;
  }

  async findByAgentId(agentId: string): Promise<ActivityEvent[]> {
    return Array.from(this.events.values())
      .filter((e) => e.agentId === agentId)
      .map((e) => JSON.parse(JSON.stringify(e)));
  }

  async findByTopicId(agentId: string, topicId: string): Promise<ActivityEvent[]> {
    return Array.from(this.events.values())
      .filter((e) => e.agentId === agentId && e.topicId === topicId)
      .map((e) => JSON.parse(JSON.stringify(e)));
  }

  async findByPostId(agentId: string, postId: string): Promise<ActivityEvent[]> {
    return Array.from(this.events.values())
      .filter((e) => e.agentId === agentId && e.postId === postId)
      .map((e) => JSON.parse(JSON.stringify(e)));
  }
}

export const globalActivityRepository = new InMemoryActivityRepository();
