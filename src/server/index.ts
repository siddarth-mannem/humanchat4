import http from 'http';
import app from './app.js';
import { env } from './config/env.js';
import { setupWebSockets } from './websocket/index.js';
import { logger } from './utils/logger.js';
import { startPresenceSweep } from './services/presenceService.js';

logger.info(`NODE_OPTIONS env: ${process.env.NODE_OPTIONS ?? '(undefined)'}`);

const server = http.createServer(app);
setupWebSockets(server);
startPresenceSweep();

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception', { error: error.message, stack: error.stack });
  // Don't exit - let the process continue
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection', { reason, promise });
  // Don't exit - let the process continue
});

server.on('error', (error) => {
  logger.error('Server error', { error: error.message, stack: error.stack });
});

server.listen(env.port, () => {
  logger.info(`HumanChat API listening on port ${env.port}`);
});

export default server;
