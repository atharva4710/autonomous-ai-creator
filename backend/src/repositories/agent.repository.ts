import { AgentState } from '../models/agent.interface';
import { getDbPool, initDbSchema } from '../db';

export interface IAgentRepository {
  save(agent: AgentState): Promise<AgentState>;
  findById(agentId: string): Promise<AgentState | null>;
  findAll(): Promise<AgentState[]>;
}

export class InMemoryAgentRepository implements IAgentRepository {
  public agents: Map<string, AgentState> = new Map();

  async save(agent: AgentState): Promise<AgentState> {
    const cloned = JSON.parse(JSON.stringify(agent));
    this.agents.set(cloned.agentId, cloned);
    return cloned;
  }

  async findById(agentId: string): Promise<AgentState | null> {
    const agent = this.agents.get(agentId);
    if (!agent) return null;
    return JSON.parse(JSON.stringify(agent));
  }

  async findAll(): Promise<AgentState[]> {
    return Array.from(this.agents.values()).map((agent) =>
      JSON.parse(JSON.stringify(agent))
    );
  }
}

export class PgAgentRepository implements IAgentRepository {
  public inMemoryFallback = new InMemoryAgentRepository();

  get agents() {
    return this.inMemoryFallback.agents;
  }

  async save(agent: AgentState): Promise<AgentState> {
    try {
      const pool = getDbPool();
      if (!pool) {
        return this.inMemoryFallback.save(agent);
      }
      await initDbSchema();

      const sql = `
        INSERT INTO agents (agent_id, persona, status, created_at, last_cycle_at, last_published_at, next_cycle_at, interval_minutes)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT (agent_id) DO UPDATE SET
          persona = EXCLUDED.persona,
          status = EXCLUDED.status,
          last_cycle_at = EXCLUDED.last_cycle_at,
          last_published_at = EXCLUDED.last_published_at,
          next_cycle_at = EXCLUDED.next_cycle_at,
          interval_minutes = EXCLUDED.interval_minutes
        RETURNING *;
      `;
      const res = await pool.query(sql, [
        agent.agentId,
        JSON.stringify(agent.persona),
        agent.status,
        agent.createdAt || new Date().toISOString(),
        agent.lastCycleAt || null,
        agent.lastPublishedAt || null,
        agent.nextCycleAt || null,
        agent.intervalMinutes || 15,
      ]);
      const row = res.rows[0];
      const result: AgentState = {
        agentId: row.agent_id,
        persona: typeof row.persona === 'string' ? JSON.parse(row.persona) : row.persona,
        status: row.status,
        createdAt: new Date(row.created_at).toISOString(),
        lastCycleAt: row.last_cycle_at ? new Date(row.last_cycle_at).toISOString() : undefined,
        lastPublishedAt: row.last_published_at ? new Date(row.last_published_at).toISOString() : undefined,
        nextCycleAt: row.next_cycle_at ? new Date(row.next_cycle_at).toISOString() : undefined,
        intervalMinutes: row.interval_minutes,
      };
      await this.inMemoryFallback.save(result);
      return result;
    } catch (_) {
      return this.inMemoryFallback.save(agent);
    }
  }

  async findById(agentId: string): Promise<AgentState | null> {
    try {
      const pool = getDbPool();
      if (!pool) {
        return this.inMemoryFallback.findById(agentId);
      }
      await initDbSchema();

      const res = await pool.query('SELECT * FROM agents WHERE agent_id = $1', [agentId]);
      if (res.rows.length === 0) {
        return this.inMemoryFallback.findById(agentId);
      }
      const row = res.rows[0];
      return {
        agentId: row.agent_id,
        persona: typeof row.persona === 'string' ? JSON.parse(row.persona) : row.persona,
        status: row.status,
        createdAt: new Date(row.created_at).toISOString(),
        lastCycleAt: row.last_cycle_at ? new Date(row.last_cycle_at).toISOString() : undefined,
        lastPublishedAt: row.last_published_at ? new Date(row.last_published_at).toISOString() : undefined,
        nextCycleAt: row.next_cycle_at ? new Date(row.next_cycle_at).toISOString() : undefined,
        intervalMinutes: row.interval_minutes,
      };
    } catch (_) {
      return this.inMemoryFallback.findById(agentId);
    }
  }

  async findAll(): Promise<AgentState[]> {
    try {
      const pool = getDbPool();
      if (!pool) {
        return this.inMemoryFallback.findAll();
      }
      await initDbSchema();

      const res = await pool.query('SELECT * FROM agents ORDER BY created_at DESC');
      if (res.rows.length === 0) {
        return this.inMemoryFallback.findAll();
      }
      return res.rows.map((row) => ({
        agentId: row.agent_id,
        persona: typeof row.persona === 'string' ? JSON.parse(row.persona) : row.persona,
        status: row.status,
        createdAt: new Date(row.created_at).toISOString(),
        lastCycleAt: row.last_cycle_at ? new Date(row.last_cycle_at).toISOString() : undefined,
        lastPublishedAt: row.last_published_at ? new Date(row.last_published_at).toISOString() : undefined,
        nextCycleAt: row.next_cycle_at ? new Date(row.next_cycle_at).toISOString() : undefined,
        intervalMinutes: row.interval_minutes,
      }));
    } catch (_) {
      return this.inMemoryFallback.findAll();
    }
  }
}

export const globalAgentRepository: IAgentRepository = new PgAgentRepository();
