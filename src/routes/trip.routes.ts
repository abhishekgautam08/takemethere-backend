import { Router } from 'express';
import { tripController } from '../controllers/trip.controller.js';
import { requireAuth, optionalAuth } from '../middleware/auth.middleware.js';

export const tripRouter = Router();

tripRouter.post('/', requireAuth, tripController.createTrip);
tripRouter.get('/', requireAuth, tripController.listTrips);
tripRouter.get('/:tripId', optionalAuth, tripController.getTrip);
tripRouter.patch('/:tripId', optionalAuth, tripController.updateTrip);
tripRouter.delete('/:tripId', requireAuth, tripController.deleteTrip);
tripRouter.post('/:tripId/optimize', optionalAuth, tripController.optimizeTrip);
tripRouter.post('/:tripId/modify-activity', optionalAuth, tripController.modifyActivity);
