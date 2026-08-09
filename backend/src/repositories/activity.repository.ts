import { ActivityEvent } from '../models/activity.interface';
import { getDbPool, initDbSchema } from '../db';

export interface IActivityRepository {
  save(event: ActivityEvent): Promise<ActivityEvent>;
  findByAgentId(agentId: string): Promise<ActivityEvent[]>;
  findByTopicId(agentId: string, topicId: string): Promise<ActivityEvent[]>;
  findByPostId(agentId: string, postId: string): Promise<ActivityEvent[]>;
}

export class InMemoryActivityRepository implements IActivityRepository {
  public events: Map<string, ActivityEvent> = new Map();

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

export class PgActivityRepository implements IActivityRepository {
  public inMemoryFallback = new InMemoryActivityRepository();

  get events() {
    return this.inMemoryFallback.events;
  }

  async save(event: ActivityEvent): Promise<ActivityEvent> {
    try {
      const pool = getDbPool();
      if (!pool) {
        return this.inMemoryFallback.save(event);
      }
      await initDbSchema();

      const sql = `
        INSERT INTO activity_events (id, agent_id, type, details, topic_id, post_id, metadata, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT (id) DO UPDATE SET
          type = EXCLUDED.type,
          details = EXCLUDED.details,
          topic_id = EXCLUDED.topic_id,
          post_id = EXCLUDED.post_id,
          metadata = EXCLUDED.metadata
        RETURNING *;
      `;
      const res = await pool.query(sql, [
        event.id,
        event.agentId,
        event.type,
        event.message || '',
        event.topicId || null,
        event.postId || null,
        JSON.stringify(event.metadata || null),
        event.timestamp || new Date().toISOString(),
      ]);
      const row = res.rows[0];
      const result: ActivityEvent = {
        id: row.id,
        agentId: row.agent_id,
        type: row.type,
        message: row.details,
        topicId: row.topic_id,
        postId: row.post_id,
        metadata: typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata,
        timestamp: new Date(row.created_at).toISOString(),
      };
      await this.inMemoryFallback.save(result);
      return result;
    } catch (_) {
      return this.inMemoryFallback.save(event);
    }
  }

  async findByAgentId(agentId: string): Promise<ActivityEvent[]> {
    try {
      const pool = getDbPool();
      if (!pool) {
        return this.inMemoryFallback.findByAgentId(agentId);
      }
      await initDbSchema();

      const res = await pool.query('SELECT * FROM activity_events WHERE agent_id = $1 ORDER BY created_at DESC', [agentId]);
      if (res.rows.length === 0) {
        return this.inMemoryFallback.findByAgentId(agentId);
      }
      return res.rows.map((row) => ({
        id: row.id,
        agentId: row.agent_id,
        type: row.type,
        message: row.details,
        topicId: row.topic_id,
        postId: row.post_id,
        metadata: typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata,
        timestamp: new Date(row.created_at).toISOString(),
      }));
    } catch (_) {
      return this.inMemoryFallback.findByAgentId(agentId);
    }
  }

  async findByTopicId(agentId: string, topicId: string): Promise<ActivityEvent[]> {
    try {
      const pool = getDbPool();
      if (!pool) {
        return this.inMemoryFallback.findByTopicId(agentId, topicId);
      }
      await initDbSchema();

      const res = await pool.query('SELECT * FROM activity_events WHERE agent_id = $1 AND topic_id = $2 ORDER BY created_at DESC', [agentId, topicId]);
      if (res.rows.length === 0) {
        return this.inMemoryFallback.findByTopicId(agentId, topicId);
      }
      return res.rows.map((row) => ({
        id: row.id,
        agentId: row.agent_id,
        type: row.type,
        message: row.details,
        topicId: row.topic_id,
        postId: row.post_id,
        metadata: typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata,
        timestamp: new Date(row.created_at).toISOString(),
      }));
    } catch (_) {
      return this.inMemoryFallback.findByTopicId(agentId, topicId);
    }
  }

  async findByPostId(agentId: string, postId: string): Promise<ActivityEvent[]> {
    try {
      const pool = getDbPool();
      if (!pool) {
        return this.inMemoryFallback.findByPostId(agentId, postId);
      }
      await initDbSchema();

      const res = await pool.query('SELECT * FROM activity_events WHERE agent_id = $1 AND post_id = $2 ORDER BY created_at DESC', [agentId, postId]);
      if (res.rows.length === 0) {
        return this.inMemoryFallback.findByPostId(agentId, postId);
      }
      return res.rows.map((row) => ({
        id: row.id,
        agentId: row.agent_id,
        type: row.type,
        message: row.details,
        topicId: row.topic_id,
        postId: row.post_id,
        metadata: typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata,
        timestamp: new Date(row.created_at).toISOString(),
      }));
    } catch (_) {
      return this.inMemoryFallback.findByPostId(agentId, postId);
    }
  }
}

export const globalActivityRepository: IActivityRepository = new PgActivityRepository();
