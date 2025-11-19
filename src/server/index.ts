import http from 'http';
import app from './app.js';
import { env } from './config/env.js';
import { setupWebSockets } from './websocket/index.js';
import { logger } from './utils/logger.js';

logger.info(`NODE_OPTIONS env: ${process.env.NODE_OPTIONS ?? '(undefined)'}`);

const server = http.createServer(app);
setupWebSockets(server);

server.listen(env.port, () => {
  logger.info(`HumanChat API listening on port ${env.port}`);
});

export default server;
