import { Request, Response, NextFunction } from 'express';
import { placesService } from '../services/google/places.service.js';
import { CURATED_DESTINATIONS } from '../services/google/curatedData.js';

export const placeController = {
  async searchPlaces(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { query, location, category } = req.query;
      const results = await placesService.searchPlaces({
        query: String(query || 'attractions'),
        location: location ? String(location) : undefined,
        category: category ? String(category) : undefined,
      });

      res.json({
        success: true,
        data: results,
      });
    } catch (error) {
      next(error);
    }
  },

  async getPlaceDetails(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { placeId } = req.params;
      const details = await placesService.getPlaceDetails(placeId);

      if (!details) {
        res.status(404).json({ success: false, error: 'Place details not found' });
        return;
      }

      res.json({
        success: true,
        data: details,
      });
    } catch (error) {
      next(error);
    }
  },

  getPopularDestinations(req: Request, res: Response): void {
    const list = Object.values(CURATED_DESTINATIONS).map((d) => ({
      name: d.name,
      country: d.country,
      tagline: d.tagline,
      coverImage: d.coverImage,
      popularInterests: d.popularInterests,
      center: d.center,
    }));

    res.json({
      success: true,
      data: list,
    });
  },

  async reverseGeocode(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const lat = parseFloat(String(req.query.lat));
      const lng = parseFloat(String(req.query.lng));

      if (isNaN(lat) || isNaN(lng)) {
        res.status(400).json({ success: false, error: 'Valid lat and lng query parameters are required' });
        return;
      }

      const { geocodingService } = await import('../services/google/geocoding.service.js');
      const result = await geocodingService.reverseGeocode(lat, lng);

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  },

  async autocomplete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = String(req.query.query || '');
      const { geocodingService } = await import('../services/google/geocoding.service.js');
      const suggestions = await geocodingService.autocomplete(query);

      res.json({
        success: true,
        data: suggestions,
      });
    } catch (error) {
      next(error);
    }
  },
};
