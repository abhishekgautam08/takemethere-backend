import { Router } from 'express';
import { healthRouter } from './health.routes.js';
import { tripRouter } from './trip.routes.js';
import { agentRouter } from './agent.routes.js';
import { placeRouter } from './place.routes.js';
import { authRouter } from './auth.routes.js';
import { paymentRouter } from './payment.routes.js';

export const apiRouter = Router();

apiRouter.use('/health', healthRouter);
apiRouter.use('/auth', authRouter);
apiRouter.use('/payment', paymentRouter);
apiRouter.use('/trips', tripRouter);
apiRouter.use('/agent', agentRouter);
apiRouter.use('/places', placeRouter);
