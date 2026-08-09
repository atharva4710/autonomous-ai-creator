import dotenv from 'dotenv';
import path from 'path';

const initialNodeEnv = process.env.NODE_ENV;
// Load configuration from .env file
dotenv.config({ path: path.resolve(__dirname, '../../.env'), override: true });
if (initialNodeEnv === 'test') {
  process.env.NODE_ENV = 'test';
}

export type AIProviderType = 'groq' | 'mock';

export interface AppConfig {
  port: number;
  nodeEnv: string;
  corsOrigin: string;
  aiProvider: AIProviderType;
  groqApiKey: string;
  groqModel: string;
  databaseUrl: string;
  autonomousCycleIntervalMs: number;
}

const rawAiProvider = process.env.NODE_ENV === 'test'
  ? (process.env.TEST_EXPLICIT_GROQ ? 'groq' : 'mock')
  : (process.env.AI_PROVIDER || 'groq');

export const config: AppConfig = {
  port: parseInt(process.env.PORT || '5000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  aiProvider: (rawAiProvider.trim().toLowerCase()) as AIProviderType,
  groqApiKey: (process.env.GROQ_API_KEY || '').trim(),
  groqModel: (process.env.GROQ_MODEL || 'llama-3.3-70b-versatile').trim(),
  databaseUrl: (process.env.DATABASE_URL || '').trim(),
  get autonomousCycleIntervalMs() {
    return parseInt(process.env.AUTONOMOUS_CYCLE_INTERVAL_MS || '900000', 10);
  },
};

/**
 * Centralized configuration validator. Fails fast on invalid configuration.
 */
export function validateConfig(cfg: AppConfig = config): void {
  const provider = cfg.aiProvider;
  if (provider !== 'groq' && provider !== 'mock') {
    throw new Error(`Invalid AI_PROVIDER: "${provider}". Supported values are "groq" or "mock".`);
  }

  if (provider === 'groq') {
    if (!cfg.groqApiKey) {
      throw new Error('GROQ_API_KEY environment variable is required when AI_PROVIDER is set to "groq".');
    }
    if (!cfg.groqModel) {
      throw new Error('GROQ_MODEL environment variable is required when AI_PROVIDER is set to "groq".');
    }
  }
}

/**
 * Returns a safe, redacted string representation of database URL.
 */
export function getSafeDatabaseUrl(url: string = config.databaseUrl): string {
  if (!url) return 'Not configured (using in-memory fallback)';
  try {
    const parsed = new URL(url);
    if (parsed.password) {
      parsed.password = '***';
    }
    return parsed.toString();
  } catch (_) {
    return 'Configured (redacted credentials)';
  }
}
