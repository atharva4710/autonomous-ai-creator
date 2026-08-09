import { Topic } from '../models/topic.interface';
import { getDbPool, initDbSchema } from '../db';

export interface ITopicRepository {
  save(topic: Topic): Promise<Topic>;
  saveAll(topics: Topic[]): Promise<Topic[]>;
  findByAgentId(agentId: string): Promise<Topic[]>;
  findById(id: string): Promise<Topic | null>;
}

export class InMemoryTopicRepository implements ITopicRepository {
  public topics: Map<string, Topic> = new Map();

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

export class PgTopicRepository implements ITopicRepository {
  public inMemoryFallback = new InMemoryTopicRepository();

  get topics() {
    return this.inMemoryFallback.topics;
  }

  async save(topic: Topic): Promise<Topic> {
    try {
      const pool = getDbPool();
      if (!pool) {
        return this.inMemoryFallback.save(topic);
      }
      await initDbSchema();

      const sql = `
        INSERT INTO topics (id, agent_id, title, summary, source_name, source_url, published_at, discovered_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT (id) DO UPDATE SET
          title = EXCLUDED.title,
          summary = EXCLUDED.summary,
          source_name = EXCLUDED.source_name,
          source_url = EXCLUDED.source_url,
          published_at = EXCLUDED.published_at
        RETURNING *;
      `;
      const res = await pool.query(sql, [
        topic.id,
        topic.agentId,
        topic.title,
        topic.summary || '',
        topic.source?.name || '',
        topic.source?.url || '',
        topic.publishedAt || new Date().toISOString(),
        topic.discoveredAt || new Date().toISOString(),
      ]);
      const row = res.rows[0];
      const result: Topic = {
        id: row.id,
        agentId: row.agent_id,
        title: row.title,
        summary: row.summary,
        source: {
          name: row.source_name,
          url: row.source_url,
        },
        publishedAt: new Date(row.published_at).toISOString(),
        discoveredAt: new Date(row.discovered_at).toISOString(),
      };
      await this.inMemoryFallback.save(result);
      return result;
    } catch (_) {
      return this.inMemoryFallback.save(topic);
    }
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
    try {
      const pool = getDbPool();
      if (!pool) {
        return this.inMemoryFallback.findByAgentId(agentId);
      }
      await initDbSchema();

      const res = await pool.query('SELECT * FROM topics WHERE agent_id = $1 ORDER BY discovered_at DESC', [agentId]);
      if (res.rows.length === 0) {
        return this.inMemoryFallback.findByAgentId(agentId);
      }
      return res.rows.map((row) => ({
        id: row.id,
        agentId: row.agent_id,
        title: row.title,
        summary: row.summary,
        source: {
          name: row.source_name,
          url: row.source_url,
        },
        publishedAt: new Date(row.published_at).toISOString(),
        discoveredAt: new Date(row.discovered_at).toISOString(),
      }));
    } catch (_) {
      return this.inMemoryFallback.findByAgentId(agentId);
    }
  }

  async findById(id: string): Promise<Topic | null> {
    try {
      const pool = getDbPool();
      if (!pool) {
        return this.inMemoryFallback.findById(id);
      }
      await initDbSchema();

      const res = await pool.query('SELECT * FROM topics WHERE id = $1', [id]);
      if (res.rows.length === 0) {
        return this.inMemoryFallback.findById(id);
      }
      const row = res.rows[0];
      return {
        id: row.id,
        agentId: row.agent_id,
        title: row.title,
        summary: row.summary,
        source: {
          name: row.source_name,
          url: row.source_url,
        },
        publishedAt: new Date(row.published_at).toISOString(),
        discoveredAt: new Date(row.discovered_at).toISOString(),
      };
    } catch (_) {
      return this.inMemoryFallback.findById(id);
    }
  }
}

export const globalTopicRepository: ITopicRepository = new PgTopicRepository();
