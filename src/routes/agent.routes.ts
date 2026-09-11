import { Router } from 'express';
import { agentController } from '../controllers/agent.controller.js';

export const agentRouter = Router();

agentRouter.get('/:tripId/stream', agentController.streamAgentEvents);
agentRouter.post('/:tripId/message', agentController.sendMessage);
