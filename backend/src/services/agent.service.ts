import crypto from 'crypto';
import { AgentState } from '../models/agent.interface';
import { IAgentRepository } from '../repositories/agent.repository';

export class AgentService {
  private agentRepository: IAgentRepository;

  constructor(agentRepository: IAgentRepository) {
    this.agentRepository = agentRepository;
  }

  /**
   * Initializes a new agent persona and stores it in the repository.
   */
  async initializeAgent(name: string, domain: string): Promise<AgentState> {
    const trimmedName = name.trim();
    const trimmedDomain = domain.trim();

    if (!trimmedName || !trimmedDomain) {
      throw new Error('Invalid persona data');
    }

    // Generate unique 8 character hexadecimal random string -> agent-xxxxxxxx
    const randomHex = crypto.randomBytes(4).toString('hex');
    const agentId = `agent-${randomHex}`;

    const newAgent: AgentState = {
      agentId,
      persona: {
        name: trimmedName,
        domain: trimmedDomain,
      },
      status: 'initialized',
      createdAt: new Date().toISOString(), // UTC ISO 8601
    };

    return this.agentRepository.save(newAgent);
  }

  /**
   * Retrieves an existing agent by ID.
   */
  async getAgentById(agentId: string): Promise<AgentState | null> {
    return this.agentRepository.findById(agentId);
  }
}
