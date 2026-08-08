import { Post } from '../models/post.interface';

export interface IPostRepository {
  save(post: Post): Promise<Post>;
  findById(id: string): Promise<Post | null>;
  findByTopicId(agentId: string, topicId: string): Promise<Post | null>;
  findByAgentId(agentId: string): Promise<Post[]>;
}

export class InMemoryPostRepository implements IPostRepository {
  private posts: Map<string, Post> = new Map();

  async save(post: Post): Promise<Post> {
    const cloned = JSON.parse(JSON.stringify(post));
    this.posts.set(cloned.id, cloned);
    return cloned;
  }

  async findById(id: string): Promise<Post | null> {
    const post = this.posts.get(id);
    if (!post) return null;
    return JSON.parse(JSON.stringify(post));
  }

  async findByTopicId(agentId: string, topicId: string): Promise<Post | null> {
    return Array.from(this.posts.values())
      .filter((p) => p.agentId === agentId && p.topicId === topicId)
      .map((p) => JSON.parse(JSON.stringify(p)))[0] || null;
  }

  async findByAgentId(agentId: string): Promise<Post[]> {
    return Array.from(this.posts.values())
      .filter((p) => p.agentId === agentId)
      .map((p) => JSON.parse(JSON.stringify(p)));
  }
}

export const globalPostRepository = new InMemoryPostRepository();
