import express from 'express';
import cors from 'cors';
import { config } from './config';
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
  app.listen(config.port, () => {
    console.log(
      `[Server] Running in ${config.nodeEnv} mode on http://localhost:${config.port}`
    );
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
