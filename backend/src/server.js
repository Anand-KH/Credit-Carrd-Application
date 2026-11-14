import { createApp } from './app.js';
import { loadConfig } from './config/env.js';
import { closeDatabase, connectDatabase } from './services/database.service.js';
import { createLogger, getErrorLogDetails } from './utils/logger.js';

const config = loadConfig();
const logger = createLogger();
const app = createApp({ config, logger });
let server;
let shuttingDown = false;

async function shutdown(signal) {
  if (shuttingDown) {
    return;
  }
  shuttingDown = true;
  logger.info('server.shutdown_started', { signal });

  server.close(async (serverError) => {
    try {
      await closeDatabase(logger);
      if (serverError) {
        throw serverError;
      }
      logger.info('server.shutdown_complete');
    } catch (error) {
      logger.error('server.shutdown_failed', {
        errorName: error.name,
        code: 'SHUTDOWN_FAILED',
      });
      process.exitCode = 1;
    }
  });
}

try {
  await connectDatabase(config.mongoUri, logger);
  server = await new Promise((resolve, reject) => {
    const listeningServer = app.listen(config.port);
    listeningServer.once('error', reject);
    listeningServer.once('listening', () => resolve(listeningServer));
  });
  logger.info('server.listening', { port: config.port });
  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
} catch (error) {
  logger.error('server.startup_failed', {
    errorName: error.name,
    ...getErrorLogDetails(error),
    code: 'STARTUP_FAILED',
  });
  try {
    await closeDatabase(logger);
  } catch (cleanupError) {
    logger.error('server.startup_cleanup_failed', {
      errorName: cleanupError.name,
      code: 'STARTUP_CLEANUP_FAILED',
    });
  }
  process.exitCode = 1;
}
