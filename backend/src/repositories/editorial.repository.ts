import { EditorialDecision } from '../models/editorial.interface';
import { getDbPool, initDbSchema } from '../db';

export interface IEditorialRepository {
  save(decision: EditorialDecision): Promise<EditorialDecision>;
  findByTopicId(topicId: string): Promise<EditorialDecision | null>;
  findByAgentId(agentId: string): Promise<EditorialDecision[]>;
}

export class InMemoryEditorialRepository implements IEditorialRepository {
  public decisions: Map<string, EditorialDecision> = new Map();

  async save(decision: EditorialDecision): Promise<EditorialDecision> {
    const cloned = JSON.parse(JSON.stringify(decision));
    this.decisions.set(cloned.topicId, cloned);
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

export class PgEditorialRepository implements IEditorialRepository {
  public inMemoryFallback = new InMemoryEditorialRepository();

  get decisions() {
    return this.inMemoryFallback.decisions;
  }

  async save(decision: EditorialDecision): Promise<EditorialDecision> {
    try {
      const pool = getDbPool();
      if (!pool) {
        return this.inMemoryFallback.save(decision);
      }
      await initDbSchema();

      const sql = `
        INSERT INTO editorial_decisions (id, agent_id, topic_id, decision, scores, reason, evaluated_at, selection_rank, comparative_alternatives)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT (topic_id) DO UPDATE SET
          agent_id = EXCLUDED.agent_id,
          decision = EXCLUDED.decision,
          scores = EXCLUDED.scores,
          reason = EXCLUDED.reason,
          evaluated_at = EXCLUDED.evaluated_at,
          selection_rank = EXCLUDED.selection_rank,
          comparative_alternatives = EXCLUDED.comparative_alternatives
        RETURNING *;
      `;
      const res = await pool.query(sql, [
        decision.id,
        decision.agentId || '',
        decision.topicId,
        decision.decision,
        JSON.stringify(decision.scores),
        decision.reason,
        decision.evaluatedAt || new Date().toISOString(),
        decision.selectionRank || null,
        decision.comparativeAlternatives ? JSON.stringify(decision.comparativeAlternatives) : null,
      ]);
      const row = res.rows[0];
      const result: EditorialDecision = {
        id: row.id,
        agentId: row.agent_id,
        topicId: row.topic_id,
        decision: row.decision,
        scores: typeof row.scores === 'string' ? JSON.parse(row.scores) : row.scores,
        reason: row.reason,
        evaluatedAt: new Date(row.evaluated_at).toISOString(),
        selectionRank: row.selection_rank ? Number(row.selection_rank) : undefined,
        comparativeAlternatives: row.comparative_alternatives
          ? (typeof row.comparative_alternatives === 'string' ? JSON.parse(row.comparative_alternatives) : row.comparative_alternatives)
          : undefined,
      };
      await this.inMemoryFallback.save(result);
      return result;
    } catch (_) {
      return this.inMemoryFallback.save(decision);
    }
  }

  async findByTopicId(topicId: string): Promise<EditorialDecision | null> {
    try {
      const pool = getDbPool();
      if (!pool) {
        return this.inMemoryFallback.findByTopicId(topicId);
      }
      await initDbSchema();

      const res = await pool.query('SELECT * FROM editorial_decisions WHERE topic_id = $1', [topicId]);
      if (res.rows.length === 0) {
        return this.inMemoryFallback.findByTopicId(topicId);
      }
      const row = res.rows[0];
      return {
        id: row.id,
        agentId: row.agent_id,
        topicId: row.topic_id,
        decision: row.decision,
        scores: typeof row.scores === 'string' ? JSON.parse(row.scores) : row.scores,
        reason: row.reason,
        evaluatedAt: new Date(row.evaluated_at).toISOString(),
        selectionRank: row.selection_rank ? Number(row.selection_rank) : undefined,
        comparativeAlternatives: row.comparative_alternatives
          ? (typeof row.comparative_alternatives === 'string' ? JSON.parse(row.comparative_alternatives) : row.comparative_alternatives)
          : undefined,
      };
    } catch (_) {
      return this.inMemoryFallback.findByTopicId(topicId);
    }
  }

  async findByAgentId(agentId: string): Promise<EditorialDecision[]> {
    try {
      const pool = getDbPool();
      if (!pool) {
        return this.inMemoryFallback.findByAgentId(agentId);
      }
      await initDbSchema();

      const res = await pool.query('SELECT * FROM editorial_decisions WHERE agent_id = $1 ORDER BY evaluated_at DESC', [agentId]);
      if (res.rows.length === 0) {
        return this.inMemoryFallback.findByAgentId(agentId);
      }
      return res.rows.map((row) => ({
        id: row.id,
        agentId: row.agent_id,
        topicId: row.topic_id,
        decision: row.decision,
        scores: typeof row.scores === 'string' ? JSON.parse(row.scores) : row.scores,
        reason: row.reason,
        evaluatedAt: new Date(row.evaluated_at).toISOString(),
        selectionRank: row.selection_rank ? Number(row.selection_rank) : undefined,
        comparativeAlternatives: row.comparative_alternatives
          ? (typeof row.comparative_alternatives === 'string' ? JSON.parse(row.comparative_alternatives) : row.comparative_alternatives)
          : undefined,
      }));
    } catch (_) {
      return this.inMemoryFallback.findByAgentId(agentId);
    }
  }
}

export const globalEditorialRepository: IEditorialRepository = new PgEditorialRepository();
