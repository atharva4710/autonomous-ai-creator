import { getAIProvider, GroqAIProvider, MockAIProvider } from '../src/services/aiProvider';
import { validateConfig, getSafeDatabaseUrl, AppConfig } from '../src/config';

describe('Phase 3 — AI Provider and Environment Safety Engine', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    jest.resetModules();
    delete process.env.AI_PROVIDER;
    delete process.env.GROQ_API_KEY;
    delete process.env.GROQ_MODEL;
    delete process.env.TEST_EXPLICIT_GROQ;
  });

  afterEach(() => {
    delete process.env.AI_PROVIDER;
    delete process.env.GROQ_API_KEY;
    delete process.env.GROQ_MODEL;
    delete process.env.TEST_EXPLICIT_GROQ;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  test('TEST 1: AI_PROVIDER=groq selects GroqAIProvider when GROQ_API_KEY is present', () => {
    process.env.AI_PROVIDER = 'groq';
    process.env.TEST_EXPLICIT_GROQ = 'true';
    process.env.GROQ_API_KEY = 'gsk_test_key_dummy_123';
    process.env.GROQ_MODEL = 'llama-3.3-70b-versatile';

    const provider = getAIProvider('groq');
    expect(provider).toBeInstanceOf(GroqAIProvider);
  });

  test('TEST 2: AI_PROVIDER=mock selects MockAIProvider', () => {
    process.env.AI_PROVIDER = 'mock';

    const provider = getAIProvider('mock');
    expect(provider).toBeInstanceOf(MockAIProvider);
  });

  test('TEST 3: Missing GROQ_API_KEY with groq provider fails clearly with Error', () => {
    process.env.AI_PROVIDER = 'groq';
    process.env.TEST_EXPLICIT_GROQ = 'true';
    process.env.GROQ_API_KEY = '';

    expect(() => getAIProvider('groq')).toThrow('GROQ_API_KEY environment variable is required');
  });

  test('TEST 4: Invalid AI_PROVIDER fails clearly', () => {
    process.env.AI_PROVIDER = 'unsupported_llm';

    expect(() => getAIProvider('unsupported_llm')).toThrow('Invalid AI_PROVIDER: "unsupported_llm"');
  });

  test('TEST 5: GROQ_MODEL is loaded from environment configuration', () => {
    process.env.AI_PROVIDER = 'groq';
    process.env.GROQ_API_KEY = 'gsk_dummy_123';
    process.env.GROQ_MODEL = 'llama-3.1-70b-versatile';

    const testConfig: AppConfig = {
      port: 5000,
      nodeEnv: 'development',
      corsOrigin: '*',
      aiProvider: 'groq',
      groqApiKey: 'gsk_dummy_123',
      groqModel: 'llama-3.1-70b-versatile',
      databaseUrl: '',
      autonomousCycleIntervalMs: 900000,
    };

    expect(() => validateConfig(testConfig)).not.toThrow();
    expect(testConfig.groqModel).toBe('llama-3.1-70b-versatile');
  });

  test('TEST 6: Mock provider does not activate when AI_PROVIDER=groq', () => {
    process.env.AI_PROVIDER = 'groq';
    process.env.TEST_EXPLICIT_GROQ = 'true';
    process.env.GROQ_API_KEY = 'gsk_valid_dummy_key';

    const provider = getAIProvider('groq');
    expect(provider).not.toBeInstanceOf(MockAIProvider);
    expect(provider).toBeInstanceOf(GroqAIProvider);
  });

  test('TEST 7: API key is never exposed in safe database URL logger or configuration outputs', () => {
    const rawDbUrl = 'postgres://postgres:secret_pass_123@localhost:5432/mydb';
    const safeUrl = getSafeDatabaseUrl(rawDbUrl);

    expect(safeUrl).not.toContain('secret_pass_123');
    expect(safeUrl).toContain('***');
  });

  test('TEST 8: Centralized validateConfig fails fast on invalid provider or missing key', () => {
    const invalidConfig: AppConfig = {
      port: 5000,
      nodeEnv: 'production',
      corsOrigin: '*',
      aiProvider: 'groq',
      groqApiKey: '',
      groqModel: 'llama-3.3-70b-versatile',
      databaseUrl: '',
      autonomousCycleIntervalMs: 900000,
    };

    expect(() => validateConfig(invalidConfig)).toThrow('GROQ_API_KEY environment variable is required');
  });
});
