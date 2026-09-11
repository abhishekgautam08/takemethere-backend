import { Response } from 'express';
import { AgentEvent, AgentEventType } from '../../types/index.js';
import { logger } from '../../utils/logger.js';

class AgentEventBus {
  private clients = new Map<string, Set<Response>>();

  subscribe(tripId: string, res: Response): () => void {
    if (!this.clients.has(tripId)) {
      this.clients.set(tripId, new Set());
    }

    const tripClients = this.clients.get(tripId)!;
    tripClients.add(res);

    logger.info(`Client subscribed to SSE for trip: ${tripId} (Active listeners: ${tripClients.size})`);

    // Return cleanup unsubscribe function
    return () => {
      tripClients.delete(res);
      if (tripClients.size === 0) {
        this.clients.delete(tripId);
      }
      logger.info(`Client unsubscribed from SSE for trip: ${tripId}`);
    };
  }

  emit(tripId: string, type: AgentEventType, message: string, details?: Record<string, unknown>, extra?: any): void {
    const event: AgentEvent = {
      type,
      tripId,
      timestamp: Date.now(),
      message,
      details,
      ...extra,
    };

    const listeners = this.clients.get(tripId);
    if (!listeners || listeners.size === 0) {
      logger.debug(`No active SSE listeners for trip ${tripId}, event: ${type}`);
      return;
    }

    const payload = `event: ${type}\ndata: ${JSON.stringify(event)}\n\n`;

    for (const res of listeners) {
      try {
        res.write(payload);
      } catch (err) {
        logger.warn(`Failed to write SSE event to client for trip ${tripId}`, err);
      }
    }
  }
}

export const agentEventBus = new AgentEventBus();
