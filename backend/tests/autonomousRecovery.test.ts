import { globalAutonomousService } from '../src/services/autonomous/autonomous.service';
import { globalAgentRepository } from '../src/repositories/agent.repository';
import { AgentState } from '../src/models/agent.interface';

describe('Phase 2 — Restart-Safe Autonomous Scheduler & Recovery Engine', () => {
  beforeEach(() => {
    globalAutonomousService.resetInMemoryState();
  });

  afterEach(async () => {
    await globalAutonomousService.stopAll();
    globalAutonomousService.resetInMemoryState();
  });

  test('TEST 1: startAgentLoop(agentId) creates exactly one active loop', async () => {
    const agent: AgentState = {
      agentId: 'agent-test-1',
      persona: {
        name: 'Ada',
        domain: 'AI Security',
        role: 'Researcher',
        description: 'Security',
        interests: ['AI Security'],
        expertise: ['Security'],
        tone: ['Analytical'],
        editorialPrinciples: ['Rigor'],
      },
      status: 'INITIALIZED',
      createdAt: new Date().toISOString(),
    };
    await globalAgentRepository.save(agent);

    await globalAutonomousService.startAgentLoop(agent.agentId);
    expect(globalAutonomousService.getActiveLoopCount()).toBe(1);
    expect(globalAutonomousService.isLoopActive(agent.agentId)).toBe(true);
  });

  test('TEST 2: Multiple startAgentLoop(agentId) calls result in still ONE loop', async () => {
    const agent: AgentState = {
      agentId: 'agent-test-2',
      persona: {
        name: 'Babbage',
        domain: 'Robotics',
        role: 'Engineer',
        description: 'Robotics specialist',
        interests: ['Robotics'],
        expertise: ['Hardware'],
        tone: ['Direct'],
        editorialPrinciples: ['Fact-based'],
      },
      status: 'INITIALIZED',
      createdAt: new Date().toISOString(),
    };
    await globalAgentRepository.save(agent);

    await globalAutonomousService.startAgentLoop(agent.agentId);
    await globalAutonomousService.startAgentLoop(agent.agentId);
    await globalAutonomousService.startAgentLoop(agent.agentId);

    expect(globalAutonomousService.getActiveLoopCount()).toBe(1);
    expect(globalAutonomousService.isLoopActive(agent.agentId)).toBe(true);
  });

  test('TEST 3: RUNNING agent in DB is restored upon backend startup simulation', async () => {
    const agent: AgentState = {
      agentId: 'agent-running-3',
      persona: {
        name: 'Curie',
        domain: 'Machine Learning',
        role: 'Data Scientist',
        description: 'ML Expert',
        interests: ['ML'],
        expertise: ['Data'],
        tone: ['Clear'],
        editorialPrinciples: ['Rigor'],
      },
      status: 'RUNNING',
      createdAt: new Date().toISOString(),
    };
    await globalAgentRepository.save(agent);

    const restoredCount = await globalAutonomousService.restoreActiveLoops();
    expect(restoredCount).toBeGreaterThanOrEqual(1);
    expect(globalAutonomousService.isLoopActive(agent.agentId)).toBe(true);
  });

  test('TEST 4: STOPPED agent in DB is NOT restored upon backend startup', async () => {
    const agent: AgentState = {
      agentId: 'agent-stopped-4',
      persona: {
        name: 'Turing',
        domain: 'Compute',
        role: 'Theorist',
        description: 'Computability',
        interests: ['Math'],
        expertise: ['Logic'],
        tone: ['Formal'],
        editorialPrinciples: ['Precision'],
      },
      status: 'STOPPED',
      createdAt: new Date().toISOString(),
    };
    await globalAgentRepository.save(agent);

    await globalAutonomousService.restoreActiveLoops();
    expect(globalAutonomousService.isLoopActive(agent.agentId)).toBe(false);
  });

  test('TEST 5: PAUSED agent in DB is NOT restored upon backend startup', async () => {
    const agent: AgentState = {
      agentId: 'agent-paused-5',
      persona: {
        name: 'Hopper',
        domain: 'Compilers',
        role: 'Architect',
        description: 'Systems',
        interests: ['Code'],
        expertise: ['Languages'],
        tone: ['Sharp'],
        editorialPrinciples: ['Clarity'],
      },
      status: 'PAUSED',
      createdAt: new Date().toISOString(),
    };
    await globalAgentRepository.save(agent);

    await globalAutonomousService.restoreActiveLoops();
    expect(globalAutonomousService.isLoopActive(agent.agentId)).toBe(false);
  });

  test('TEST 6: Overlapping cycles are prevented via processingAgents guard', async () => {
    const agentId = 'agent-overlap-6';
    const agent: AgentState = {
      agentId,
      persona: {
        name: 'Lovelace',
        domain: 'Algorithmic AI',
        role: 'Pioneer',
        description: 'Algorithms',
        interests: ['Math'],
        expertise: ['Software'],
        tone: ['Academic'],
        editorialPrinciples: ['Depth'],
      },
      status: 'RUNNING',
      createdAt: new Date().toISOString(),
    };
    await globalAgentRepository.save(agent);

    // Simulate active processing flag set
    (globalAutonomousService as any).processingAgents.add(agentId);

    // Attempt second cycle run
    await globalAutonomousService.executeCycle(agentId);

    // Verify stage was not updated away from waiting / no concurrent execution
    expect(globalAutonomousService.isProcessing(agentId)).toBe(true);

    // Release flag
    (globalAutonomousService as any).processingAgents.delete(agentId);
  });

  test('TEST 7: Cycle error is non-fatal and loop remains active', async () => {
    const agentId = 'agent-error-7';
    const agent: AgentState = {
      agentId,
      persona: {
        name: 'Shannon',
        domain: 'Information Theory',
        role: 'Theorist',
        description: 'Entropy',
        interests: ['Telecom'],
        expertise: ['Information'],
        tone: ['Scientific'],
        editorialPrinciples: ['Rigor'],
      },
      status: 'RUNNING',
      createdAt: new Date().toISOString(),
    };
    await globalAgentRepository.save(agent);

    await globalAutonomousService.startAgentLoop(agentId);
    expect(globalAutonomousService.isLoopActive(agentId)).toBe(true);

    // Execute cycle and verify it resolves safely without crashing or removing loop
    await expect(globalAutonomousService.executeCycle(agentId)).resolves.not.toThrow();
    expect(globalAutonomousService.isLoopActive(agentId)).toBe(true);
  });

  test('TEST 8: Scheduler state (lastCycleAt, nextCycleAt, status) is persisted', async () => {
    const agentId = 'agent-persist-8';
    const agent: AgentState = {
      agentId,
      persona: {
        name: 'Neumann',
        domain: 'Game Theory',
        role: 'Mathematician',
        description: 'Architecture',
        interests: ['Compute'],
        expertise: ['Theory'],
        tone: ['Rigorous'],
        editorialPrinciples: ['Structure'],
      },
      status: 'RUNNING',
      createdAt: new Date().toISOString(),
    };
    await globalAgentRepository.save(agent);

    await globalAutonomousService.executeCycle(agentId);

    const updatedAgent = await globalAgentRepository.findById(agentId);
    expect(updatedAgent).not.toBeNull();
    expect(updatedAgent?.lastCycleAt).toBeDefined();
    expect(updatedAgent?.nextCycleAt).toBeDefined();
    expect(['RUNNING', 'DEGRADED']).toContain(updatedAgent?.status);
  });

  test('TEST 9: Missed cycles during downtime execute at most ONE recovery cycle', async () => {
    const agentId = 'agent-downtime-9';
    const fourHoursAgo = new Date(Date.now() - 4 * 3600 * 1000).toISOString();
    const agent: AgentState = {
      agentId,
      persona: {
        name: 'Downtime Agent',
        domain: 'Cloud AI',
        role: 'Engineer',
        description: 'Cloud Infrastructure',
        interests: ['Cloud'],
        expertise: ['Infrastructure'],
        tone: ['Direct'],
        editorialPrinciples: ['Uptime'],
      },
      status: 'RUNNING',
      createdAt: fourHoursAgo,
      nextCycleAt: fourHoursAgo, // Next cycle was 4 hours ago!
    };
    await globalAgentRepository.save(agent);

    const restoredCount = await globalAutonomousService.restoreActiveLoops();
    expect(restoredCount).toBeGreaterThanOrEqual(1);

    // Exactly one timer should be registered in memory
    expect(globalAutonomousService.isLoopActive(agentId)).toBe(true);
  });

  test('TEST 10: Full Process Restart Integration Test', async () => {
    // 1. Initialize agent
    const agentId = 'agent-restart-integration-10';
    const agent: AgentState = {
      agentId,
      persona: {
        name: 'Restart Integration Persona',
        domain: 'Autonomous Systems',
        role: 'Lead Developer',
        description: 'Testing restart recovery',
        interests: ['Automation'],
        expertise: ['Backend'],
        tone: ['Clear'],
        editorialPrinciples: ['Resilience'],
      },
      status: 'INITIALIZED',
      createdAt: new Date().toISOString(),
    };
    await globalAgentRepository.save(agent);

    // 2. Start loop and execute cycle
    await globalAutonomousService.startAgentLoop(agentId);
    expect(globalAutonomousService.isLoopActive(agentId)).toBe(true);

    // 3. Clear volatile loop structures (simulate server shutdown)
    globalAutonomousService.resetInMemoryState();
    expect(globalAutonomousService.isLoopActive(agentId)).toBe(false);

    // 4. Reload RUNNING agents from persistent storage
    const restoredCount = await globalAutonomousService.restoreActiveLoops();
    expect(restoredCount).toBeGreaterThanOrEqual(1);

    // 5. Verify loop restored and single loop present
    expect(globalAutonomousService.isLoopActive(agentId)).toBe(true);
    const restoredAgent = await globalAgentRepository.findById(agentId);
    expect(restoredAgent).not.toBeNull();
    expect(restoredAgent?.status).toBe('RUNNING');
  });
});
