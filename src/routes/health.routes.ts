import { Router } from 'express';
import { isDbConnected } from '../config/database.js';
import { env } from '../config/env.js';

export const healthRouter = Router();

healthRouter.get('/', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'travel-agent-ai-api',
    database: isDbConnected() ? 'connected (mongodb)' : 'in-memory-store',
    openai: !!env.OPENAI_API_KEY ? 'configured' : 'deterministic-engine',
    googleMaps: !!env.GOOGLE_MAPS_API_KEY ? 'configured' : 'geospatial-engine',
  });
});
