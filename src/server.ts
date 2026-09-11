import { createApp } from './app.js';
import { env } from './config/env.js';
import { connectDatabase } from './config/database.js';
import { logger } from './utils/logger.js';

async function startServer(): Promise<void> {
  try {
    // Attempt database connection
    await connectDatabase();

    const app = createApp();

    const server = app.listen(env.PORT, () => {
      logger.info(`🚀 Travel Agent AI Backend running on http://localhost:${env.PORT}`);
      logger.info(`📍 Health Endpoint: http://localhost:${env.PORT}/api/health`);
      logger.info(`🤖 Agent Model: ${env.OPENAI_API_KEY ? env.OPENAI_MODEL : 'Deterministic Fallback Engine'}`);
    });

    const shutdown = () => {
      logger.info('Shutting down server gracefully...');
      server.close(() => {
        logger.info('Server closed.');
        process.exit(0);
      });
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();
