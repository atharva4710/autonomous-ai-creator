import { Persona } from '../models/agent.interface';
import { IAgentRepository } from '../repositories/agent.repository';
import { validatePersona } from '../utils/personaValidator';

export class PersonaService {
  private agentRepository: IAgentRepository;

  constructor(agentRepository: IAgentRepository) {
    this.agentRepository = agentRepository;
  }

  /**
   * Retrieves the persona context configuration for an agent.
   */
  async getPersonaContext(agentId: string): Promise<Persona | null> {
    const agent = await this.agentRepository.findById(agentId);
    if (!agent) return null;
    return agent.persona;
  }

  /**
   * Performs controlled partial updates to a persona configuration.
   */
  async updatePersona(
    agentId: string,
    updates: Partial<Omit<Persona, 'name' | 'domain'>>
  ): Promise<Persona> {
    const agent = await this.agentRepository.findById(agentId);
    if (!agent) {
      throw new Error('Agent not found');
    }

    // Merge existing persona with new updates for validation
    const candidatePersona: Persona = {
      ...agent.persona,
      ...updates,
    };

    // Prevent arbitrary extra parameters inside update payload
    const allowedKeys = [
      'role',
      'description',
      'interests',
      'expertise',
      'tone',
      'editorialPrinciples',
    ];

    for (const key of Object.keys(updates)) {
      if (!allowedKeys.includes(key)) {
        throw new Error(`Unauthorized parameter: "${key}" cannot be updated.`);
      }
    }

    // Validate the merged result
    validatePersona(candidatePersona);

    // Save changes to agent database
    agent.persona = candidatePersona;
    await this.agentRepository.save(agent);

    return candidatePersona;
  }
}
