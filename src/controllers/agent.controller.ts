import { Request, Response, NextFunction } from 'express';
import { AgentMessageInputSchema } from '../types/index.js';
import { agentEventBus } from '../services/agent/agentEvents.js';
import { travelAgentService } from '../services/agent/travelAgent.service.js';
import { TripRepository } from '../models/Trip.model.js';

export const agentController = {
  streamAgentEvents(req: Request, res: Response): void {
    const { tripId } = req.params;

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    // Send initial connection ack
    res.write(`event: connected\ndata: ${JSON.stringify({ tripId, timestamp: Date.now() })}\n\n`);

    const unsubscribe = agentEventBus.subscribe(tripId, res);

    req.on('close', () => {
      unsubscribe();
    });
  },

  async sendMessage(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { tripId } = req.params;
      const parsed = AgentMessageInputSchema.parse(req.body);

      const responseText = await travelAgentService.handleChatMessage(
        tripId,
        parsed.message
      );

      const updatedTrip = await TripRepository.findById(tripId);

      res.json({
        success: true,
        data: {
          reply: responseText,
          trip: updatedTrip,
        },
      });
    } catch (error) {
      next(error);
    }
  },
};
