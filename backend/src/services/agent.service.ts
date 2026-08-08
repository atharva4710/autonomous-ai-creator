import crypto from 'crypto';
import { AgentState, Persona } from '../models/agent.interface';
import { IAgentRepository } from '../repositories/agent.repository';
import { validatePersona } from '../utils/personaValidator';

export class AgentService {
  private agentRepository: IAgentRepository;

  constructor(agentRepository: IAgentRepository) {
    this.agentRepository = agentRepository;
  }

  /**
   * Initializes a new agent persona and stores it in the repository.
   * Leverages domain-specific defaults if optional fields are missing.
   */
  async initializeAgent(
    name: string,
    domain: string,
    extraFields?: Partial<Omit<Persona, 'name' | 'domain'>>
  ): Promise<AgentState> {
    const trimmedName = (name || '').trim();
    const trimmedDomain = (domain || '').trim();

    if (!trimmedName || !trimmedDomain) {
      throw new Error('Invalid persona data');
    }

    // Prepare full persona object for validation
    const candidatePersona: any = {
      name: trimmedName,
      domain: trimmedDomain,
      ...extraFields,
    };

    // Run validator first
    validatePersona(candidatePersona);

    // Apply defaults to optional fields if not explicitly specified
    const isAiSecurity = trimmedDomain.toLowerCase() === 'ai security';

    const role =
      extraFields?.role?.trim() ||
      (isAiSecurity ? 'AI Security Researcher' : `${trimmedDomain} Specialist`);

    const description =
      extraFields?.description?.trim() ||
      (isAiSecurity
        ? 'An analytical AI security researcher focused on practical risks in modern AI systems.'
        : `A dedicated professional focusing on ${trimmedDomain}.`);

    const interests = extraFields?.interests || (isAiSecurity
      ? ['LLM security', 'AI agents', 'prompt injection', 'AI privacy']
      : [trimmedDomain.toLowerCase(), 'artificial intelligence', 'industry trends', 'innovation']);

    const expertise = extraFields?.expertise || (isAiSecurity
      ? ['AI security', 'machine learning', 'LLM vulnerabilities']
      : [trimmedDomain.toLowerCase(), 'machine learning', 'technology']);

    const tone = extraFields?.tone || (isAiSecurity
      ? ['analytical', 'technical', 'concise']
      : ['informative', 'professional', 'clear']);

    const editorialPrinciples = extraFields?.editorialPrinciples || (isAiSecurity
      ? [
          'Evidence over hype',
          'Focus on practical implications',
          'Prefer meaningful developments',
        ]
      : ['Accurate reporting', 'Objective insights', 'Focus on impact']);

    const fullPersona: Persona = {
      name: trimmedName,
      domain: trimmedDomain,
      role,
      description,
      interests,
      expertise,
      tone,
      editorialPrinciples,
    };

    // Generate unique 8 character hexadecimal random string -> agent-xxxxxxxx
    const randomHex = crypto.randomBytes(4).toString('hex');
    const agentId = `agent-${randomHex}`;

    const newAgent: AgentState = {
      agentId,
      persona: fullPersona,
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
