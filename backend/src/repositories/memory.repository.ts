import { Memory } from '../models/memory.interface';
import { getDbPool, initDbSchema } from '../db';

export interface IMemoryRepository {
  save(memory: Memory): Promise<Memory>;
  findById(id: string): Promise<Memory | null>;
  findByTopicId(agentId: string, topicId: string): Promise<Memory | null>;
  findByAgentId(agentId: string): Promise<Memory[]>;
}

export class InMemoryMemoryRepository implements IMemoryRepository {
  public memories: Map<string, Memory> = new Map();

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

  async findByAgentId(agentId: string): Promise<Memory[]> {
    return Array.from(this.memories.values())
      .filter((m) => m.agentId === agentId)
      .map((m) => JSON.parse(JSON.stringify(m)));
  }
}

export class PgMemoryRepository implements IMemoryRepository {
  public inMemoryFallback = new InMemoryMemoryRepository();

  get memories() {
    return this.inMemoryFallback.memories;
  }

  async save(memory: Memory): Promise<Memory> {
    try {
      const pool = getDbPool();
      if (!pool) {
        return this.inMemoryFallback.save(memory);
      }
      await initDbSchema();

      const sql = `
        INSERT INTO memories (id, agent_id, type, topic_id, title, summary, source, decision, score, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        ON CONFLICT (id) DO UPDATE SET
          type = EXCLUDED.type,
          topic_id = EXCLUDED.topic_id,
          title = EXCLUDED.title,
          summary = EXCLUDED.summary,
          source = EXCLUDED.source,
          decision = EXCLUDED.decision,
          score = EXCLUDED.score
        RETURNING *;
      `;
      const res = await pool.query(sql, [
        memory.id,
        memory.agentId,
        memory.type,
        memory.topicId || null,
        memory.title || '',
        memory.summary || null,
        memory.source || null,
        memory.decision || null,
        memory.score || null,
        memory.createdAt || new Date().toISOString(),
      ]);
      const row = res.rows[0];
      const result: Memory = {
        id: row.id,
        agentId: row.agent_id,
        type: row.type,
        topicId: row.topic_id,
        title: row.title,
        summary: row.summary,
        source: row.source,
        decision: row.decision,
        score: row.score,
        createdAt: new Date(row.created_at).toISOString(),
      };
      await this.inMemoryFallback.save(result);
      return result;
    } catch (_) {
      return this.inMemoryFallback.save(memory);
    }
  }

  async findById(id: string): Promise<Memory | null> {
    try {
      const pool = getDbPool();
      if (!pool) {
        return this.inMemoryFallback.findById(id);
      }
      await initDbSchema();

      const res = await pool.query('SELECT * FROM memories WHERE id = $1', [id]);
      if (res.rows.length === 0) {
        return this.inMemoryFallback.findById(id);
      }
      const row = res.rows[0];
      return {
        id: row.id,
        agentId: row.agent_id,
        type: row.type,
        topicId: row.topic_id,
        title: row.title,
        summary: row.summary,
        source: row.source,
        decision: row.decision,
        score: row.score,
        createdAt: new Date(row.created_at).toISOString(),
      };
    } catch (_) {
      return this.inMemoryFallback.findById(id);
    }
  }

  async findByTopicId(agentId: string, topicId: string): Promise<Memory | null> {
    try {
      const pool = getDbPool();
      if (!pool) {
        return this.inMemoryFallback.findByTopicId(agentId, topicId);
      }
      await initDbSchema();

      const res = await pool.query('SELECT * FROM memories WHERE agent_id = $1 AND topic_id = $2 LIMIT 1', [agentId, topicId]);
      if (res.rows.length === 0) {
        return this.inMemoryFallback.findByTopicId(agentId, topicId);
      }
      const row = res.rows[0];
      return {
        id: row.id,
        agentId: row.agent_id,
        type: row.type,
        topicId: row.topic_id,
        title: row.title,
        summary: row.summary,
        source: row.source,
        decision: row.decision,
        score: row.score,
        createdAt: new Date(row.created_at).toISOString(),
      };
    } catch (_) {
      return this.inMemoryFallback.findByTopicId(agentId, topicId);
    }
  }

  async findByAgentId(agentId: string): Promise<Memory[]> {
    try {
      const pool = getDbPool();
      if (!pool) {
        return this.inMemoryFallback.findByAgentId(agentId);
      }
      await initDbSchema();

      const res = await pool.query('SELECT * FROM memories WHERE agent_id = $1 ORDER BY created_at DESC', [agentId]);
      if (res.rows.length === 0) {
        return this.inMemoryFallback.findByAgentId(agentId);
      }
      return res.rows.map((row) => ({
        id: row.id,
        agentId: row.agent_id,
        type: row.type,
        topicId: row.topic_id,
        title: row.title,
        summary: row.summary,
        source: row.source,
        decision: row.decision,
        score: row.score,
        createdAt: new Date(row.created_at).toISOString(),
      }));
    } catch (_) {
      return this.inMemoryFallback.findByAgentId(agentId);
    }
  }
}

export const globalMemoryRepository: IMemoryRepository = new PgMemoryRepository();
