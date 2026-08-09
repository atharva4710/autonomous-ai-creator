import express from 'express';
import cors from 'cors';
import { config, validateConfig, getSafeDatabaseUrl } from './config';
import routes from './routes';
import { notFound } from './middleware/notFound';
import { errorHandler } from './middleware/errorHandler';

const app = express();

// Configure CORS
app.use(
  cors({
    origin: config.corsOrigin,
    optionsSuccessStatus: 200,
  })
);

// Body parsing middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Register routes
app.use('/', routes);

// Handle 404 Route Not Found
app.use(notFound);

// Centralized error handling
app.use(errorHandler);

// Only listen if not running in a test environment
if (config.nodeEnv !== 'test') {
  try {
    validateConfig();
  } catch (cfgErr: any) {
    console.error('[Server Configuration Error]:', cfgErr.message);
    process.exit(1);
  }

  const host = process.env.HOST || '0.0.0.0';
  app.listen(config.port, host, async () => {
    console.log(`[Server] Running in ${config.nodeEnv} mode on http://${host}:${config.port}`);
    console.log(`[Server] AI Provider: ${config.aiProvider.toUpperCase()}`);
    if (config.aiProvider === 'groq') {
      console.log(`[Server] AI Model: ${config.groqModel}`);
    }
    console.log(`[Server] Database URL: ${getSafeDatabaseUrl(config.databaseUrl)}`);
    console.log(`[Server] Autonomous Cycle Interval: ${config.autonomousCycleIntervalMs}ms`);

    try {
      const { globalAutonomousService } = require('./services/autonomous/autonomous.service');
      const restored = await globalAutonomousService.restoreActiveLoops();
      console.log(`[Server] Autonomous engine initialized. Restored ${restored} active agent loop(s) from persistent storage.`);
    } catch (err: any) {
      console.error('[Server] Failed to restore active agent loops on startup:', err.message);
    }
  });
}

// Graceful shutdown handler
const shutdown = async () => {
  console.log('\n[Server] Shutting down gracefully...');
  try {
    const { globalAutonomousService } = require('./services/autonomous/autonomous.service');
    await globalAutonomousService.stopAll();
  } catch (err: any) {
    console.error('Error during shutdown:', err.message);
  }
  process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

export default app;
