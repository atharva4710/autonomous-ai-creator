import { Post } from '../models/post.interface';
import { getDbPool, initDbSchema } from '../db';

export interface IPostRepository {
  save(post: Post): Promise<Post>;
  findById(id: string): Promise<Post | null>;
  findByTopicId(agentId: string, topicId: string): Promise<Post | null>;
  findByAgentId(agentId: string): Promise<Post[]>;
}

export class InMemoryPostRepository implements IPostRepository {
  public posts: Map<string, Post> = new Map();

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

export class PgPostRepository implements IPostRepository {
  public inMemoryFallback = new InMemoryPostRepository();

  get posts() {
    return this.inMemoryFallback.posts;
  }

  async save(post: Post): Promise<Post> {
    try {
      const pool = getDbPool();
      if (!pool) {
        return this.inMemoryFallback.save(post);
      }
      await initDbSchema();

      const sql = `
        INSERT INTO posts (id, agent_id, topic_id, decision_id, status, text, rationale, sources, content, selected_format, regenerations_count, created_at, published_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        ON CONFLICT (id) DO UPDATE SET
          status = EXCLUDED.status,
          text = EXCLUDED.text,
          rationale = EXCLUDED.rationale,
          sources = EXCLUDED.sources,
          content = EXCLUDED.content,
          selected_format = EXCLUDED.selected_format,
          regenerations_count = EXCLUDED.regenerations_count,
          published_at = EXCLUDED.published_at
        RETURNING *;
      `;
      const res = await pool.query(sql, [
        post.id,
        post.agentId,
        post.topicId,
        post.decisionId || null,
        post.status,
        post.text,
        post.rationale || null,
        JSON.stringify(post.sources || []),
        JSON.stringify(post.content || null),
        post.selectedFormat || null,
        post.regenerationsCount || 0,
        post.createdAt || new Date().toISOString(),
        post.publishedAt || null,
      ]);
      const row = res.rows[0];
      const result: Post = {
        id: row.id,
        agentId: row.agent_id,
        topicId: row.topic_id,
        decisionId: row.decision_id,
        status: row.status,
        text: row.text,
        rationale: row.rationale,
        sources: typeof row.sources === 'string' ? JSON.parse(row.sources) : (row.sources || []),
        content: typeof row.content === 'string' ? JSON.parse(row.content) : row.content,
        selectedFormat: row.selected_format,
        regenerationsCount: row.regenerations_count || 0,
        createdAt: new Date(row.created_at).toISOString(),
        publishedAt: row.published_at ? new Date(row.published_at).toISOString() : undefined,
      };
      await this.inMemoryFallback.save(result);
      return result;
    } catch (_) {
      return this.inMemoryFallback.save(post);
    }
  }

  async findById(id: string): Promise<Post | null> {
    try {
      const pool = getDbPool();
      if (!pool) {
        return this.inMemoryFallback.findById(id);
      }
      await initDbSchema();

      const res = await pool.query('SELECT * FROM posts WHERE id = $1', [id]);
      if (res.rows.length === 0) {
        return this.inMemoryFallback.findById(id);
      }
      const row = res.rows[0];
      return {
        id: row.id,
        agentId: row.agent_id,
        topicId: row.topic_id,
        decisionId: row.decision_id,
        status: row.status,
        text: row.text,
        rationale: row.rationale,
        sources: typeof row.sources === 'string' ? JSON.parse(row.sources) : (row.sources || []),
        content: typeof row.content === 'string' ? JSON.parse(row.content) : row.content,
        selectedFormat: row.selected_format,
        regenerationsCount: row.regenerations_count || 0,
        createdAt: new Date(row.created_at).toISOString(),
        publishedAt: row.published_at ? new Date(row.published_at).toISOString() : undefined,
      };
    } catch (_) {
      return this.inMemoryFallback.findById(id);
    }
  }

  async findByTopicId(agentId: string, topicId: string): Promise<Post | null> {
    try {
      const pool = getDbPool();
      if (!pool) {
        return this.inMemoryFallback.findByTopicId(agentId, topicId);
      }
      await initDbSchema();

      const res = await pool.query('SELECT * FROM posts WHERE agent_id = $1 AND topic_id = $2 LIMIT 1', [agentId, topicId]);
      if (res.rows.length === 0) {
        return this.inMemoryFallback.findByTopicId(agentId, topicId);
      }
      const row = res.rows[0];
      return {
        id: row.id,
        agentId: row.agent_id,
        topicId: row.topic_id,
        decisionId: row.decision_id,
        status: row.status,
        text: row.text,
        rationale: row.rationale,
        sources: typeof row.sources === 'string' ? JSON.parse(row.sources) : (row.sources || []),
        content: typeof row.content === 'string' ? JSON.parse(row.content) : row.content,
        selectedFormat: row.selected_format,
        regenerationsCount: row.regenerations_count || 0,
        createdAt: new Date(row.created_at).toISOString(),
        publishedAt: row.published_at ? new Date(row.published_at).toISOString() : undefined,
      };
    } catch (_) {
      return this.inMemoryFallback.findByTopicId(agentId, topicId);
    }
  }

  async findByAgentId(agentId: string): Promise<Post[]> {
    try {
      const pool = getDbPool();
      if (!pool) {
        return this.inMemoryFallback.findByAgentId(agentId);
      }
      await initDbSchema();

      const res = await pool.query('SELECT * FROM posts WHERE agent_id = $1 ORDER BY created_at DESC', [agentId]);
      if (res.rows.length === 0) {
        return this.inMemoryFallback.findByAgentId(agentId);
      }
      return res.rows.map((row) => ({
        id: row.id,
        agentId: row.agent_id,
        topicId: row.topic_id,
        decisionId: row.decision_id,
        status: row.status,
        text: row.text,
        rationale: row.rationale,
        sources: typeof row.sources === 'string' ? JSON.parse(row.sources) : (row.sources || []),
        content: typeof row.content === 'string' ? JSON.parse(row.content) : row.content,
        selectedFormat: row.selected_format,
        regenerationsCount: row.regenerations_count || 0,
        createdAt: new Date(row.created_at).toISOString(),
        publishedAt: row.published_at ? new Date(row.published_at).toISOString() : undefined,
      }));
    } catch (_) {
      return this.inMemoryFallback.findByAgentId(agentId);
    }
  }
}

export const globalPostRepository: IPostRepository = new PgPostRepository();
