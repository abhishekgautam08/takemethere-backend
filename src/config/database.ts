import mongoose from 'mongoose';
import { env } from './env.js';
import { logger } from '../utils/logger.js';

let isMongoConnected = false;

export async function connectDatabase(): Promise<boolean> {
  if (!env.MONGODB_URI) {
    logger.info('No MONGODB_URI configured. Running with in-memory persistent store fallback.');
    return false;
  }

  try {
    await mongoose.connect(env.MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,
    });
    isMongoConnected = true;
    logger.info('Connected to MongoDB database successfully.');
    return true;
  } catch (error: any) {
    logger.warn(`Could not connect to MongoDB (${error.message || 'unknown error'}), seamlessly using in-memory persistent store fallback.`);
    isMongoConnected = false;
    return false;
  }
}

export function isDbConnected(): boolean {
  return isMongoConnected;
}
