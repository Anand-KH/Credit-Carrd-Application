import mongoose from 'mongoose';

export async function connectDatabase(uri, logger) {
  if (!uri) {
    logger.info('database.connection_skipped', { databaseState: 'not_configured' });
    return;
  }

  await mongoose.connect(uri);
  logger.info('database.connected', { databaseState: 'connected' });
}

export async function closeDatabase(logger) {
  await mongoose.disconnect();
  logger.info('database.disconnected', { databaseState: 'disconnected' });
}
