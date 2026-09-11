import { Request, Response, NextFunction } from 'express';
import { CreateTripInputSchema, ModifyActivityInputSchema } from '../types/index.js';
import { TripRepository } from '../models/Trip.model.js';
import { UserRepository } from '../models/User.model.js';
import { travelAgentService } from '../services/agent/travelAgent.service.js';
import { optimizeItinerary } from '../services/itinerary/itineraryOptimizer.js';
import { itineraryService } from '../services/itinerary/itinerary.service.js';
import { getDestinationData } from '../services/google/curatedData.js';

// Authorization check helper
function canAccessTrip(trip: any, user?: any): boolean {
  if (!user) return false;
  if (user.role === 'admin') return true;
  // If trip has no userId (e.g., created before auth), allow access
  if (!trip.userId) return true;
  return trip.userId === user.id;
}

export const tripController = {
  async createTrip(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          error: 'AUTH_REQUIRED',
          message: 'Please sign in or create an account to claim your 2 free itineraries.',
        });
        return;
      }

      // Check quota for non-admin users
      if (req.user.role !== 'admin') {
        const tripCount = await TripRepository.countByUserId(req.user.id);
        const freeLimit = 2;

        if (tripCount >= freeLimit) {
          // User has used their 2 free itineraries, check paid credits
          const dbUser = await UserRepository.findById(req.user.id);
          const credits = dbUser?.paidCredits || 0;

          if (credits <= 0) {
            res.status(402).json({
              success: false,
              error: 'PAYMENT_REQUIRED',
              message: 'You have used your 2 free itineraries. Please pay ₹50 to generate this itinerary.',
              freeLimit,
              usedCount: tripCount,
              costPerItinerary: 50,
              currency: 'INR',
            });
            return;
          }

          // Deduct 1 credit
          await UserRepository.deductCredit(req.user.id);
        }
      }

      const parsed = CreateTripInputSchema.parse(req.body);
      const destData = getDestinationData(parsed.destination);


      const trip = await TripRepository.create({
        destination: {
          name: destData.name,
          country: destData.country,
          latitude: parsed.preferences.userLocation?.latitude || destData.center.latitude,
          longitude: parsed.preferences.userLocation?.longitude || destData.center.longitude,
          tagline: destData.tagline,
          coverImage: destData.coverImage,
          popularInterests: destData.popularInterests,
          areaName: destData.areaName,
          parentCity: destData.parentCity,
          isLocalizedArea: destData.isLocalizedArea,
        },
        duration: parsed.duration,
        startDate: parsed.startDate,
        preferences: parsed.preferences,
        status: 'generating',
        userId: req.user?.id,
        userEmail: req.user?.email,
        userName: req.user?.name,
      });

      // Trigger agent asynchronously
      setTimeout(() => {
        travelAgentService.processPlanTrip(trip.id).catch((err) => {
          console.error('Async trip generation error:', err);
        });
      }, 50);

      res.status(201).json({
        success: true,
        data: trip,
      });
    } catch (error) {
      next(error);
    }
  },

  async getTrip(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { tripId } = req.params;
      const trip = await TripRepository.findById(tripId);

      if (!trip) {
        res.status(404).json({ success: false, error: 'Trip not found' });
        return;
      }

      // Check access permission
      if (!canAccessTrip(trip, req.user)) {
        res.status(403).json({
          success: false,
          error: 'Access denied. You can only view your own travel itineraries.',
        });
        return;
      }

      res.json({
        success: true,
        data: trip,
      });
    } catch (error) {
      next(error);
    }
  },

  async listTrips(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          error: 'Authentication required to view trips.',
        });
        return;
      }

      // Admin gets all trips across all users; regular user only gets their own trips
      const filter = req.user.role === 'admin' ? undefined : { userId: req.user.id };
      const trips = await TripRepository.findAll(filter);

      res.json({
        success: true,
        data: trips,
      });
    } catch (error) {
      next(error);
    }
  },

  async updateTrip(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { tripId } = req.params;
      const existing = await TripRepository.findById(tripId);

      if (!existing) {
        res.status(404).json({ success: false, error: 'Trip not found' });
        return;
      }

      if (!canAccessTrip(existing, req.user)) {
        res.status(403).json({
          success: false,
          error: 'Access denied. You can only modify your own travel itineraries.',
        });
        return;
      }

      const updated = await TripRepository.update(tripId, req.body);

      res.json({
        success: true,
        data: updated,
      });
    } catch (error) {
      next(error);
    }
  },

  async deleteTrip(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { tripId } = req.params;
      const existing = await TripRepository.findById(tripId);

      if (!existing) {
        res.status(404).json({ success: false, error: 'Trip not found' });
        return;
      }

      if (!canAccessTrip(existing, req.user)) {
        res.status(403).json({
          success: false,
          error: 'Access denied. You can only delete your own travel itineraries.',
        });
        return;
      }

      const deleted = await TripRepository.delete(tripId);

      res.json({
        success: deleted,
        message: deleted ? 'Trip deleted successfully' : 'Trip not found',
      });
    } catch (error) {
      next(error);
    }
  },

  async optimizeTrip(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { tripId } = req.params;
      const trip = await TripRepository.findById(tripId);

      if (!trip) {
        res.status(404).json({ success: false, error: 'Trip not found' });
        return;
      }

      if (!canAccessTrip(trip, req.user)) {
        res.status(403).json({
          success: false,
          error: 'Access denied. You can only optimize your own travel itineraries.',
        });
        return;
      }

      const optimization = await optimizeItinerary(
        trip.itinerary,
        trip.preferences.transport
      );

      const updated = await TripRepository.update(tripId, {
        itinerary: optimization.itinerary,
      });

      res.json({
        success: true,
        data: {
          trip: updated,
          optimization: optimization.metrics,
        },
      });
    } catch (error) {
      next(error);
    }
  },

  async modifyActivity(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { tripId } = req.params;
      const parsed = ModifyActivityInputSchema.parse(req.body);

      const trip = await TripRepository.findById(tripId);
      if (!trip) {
        res.status(404).json({ success: false, error: 'Trip not found' });
        return;
      }

      if (!canAccessTrip(trip, req.user)) {
        res.status(403).json({
          success: false,
          error: 'Access denied. You can only modify activities in your own travel itineraries.',
        });
        return;
      }

      const modified = await itineraryService.modifyActivity(
        trip,
        parsed.day,
        parsed.activityId,
        parsed.action === 'remove' ? 'remove' : 'replace',
        parsed.prompt
      );

      const updated = await TripRepository.update(tripId, {
        itinerary: modified.itinerary,
      });

      res.json({
        success: true,
        data: updated,
      });
    } catch (error) {
      next(error);
    }
  },
};

