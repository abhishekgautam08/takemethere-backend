import axios from 'axios';
import { Coordinates, TransportMode, TravelSegment } from '../../types/index.js';
import { env } from '../../config/env.js';
import { logger } from '../../utils/logger.js';
import { apiCache } from '../../utils/cache.js';
import { buildSegment, formatDistance, formatDuration } from '../../utils/geo.js';

export interface RouteRequest {
  origin: Coordinates;
  destination: Coordinates;
  travelMode: TransportMode;
  waypoints?: Coordinates[];
}

export const routesService = {
  async calculateRoute(req: RouteRequest): Promise<TravelSegment> {
    const cacheKey = `route:${req.origin.latitude},${req.origin.longitude}:${req.destination.latitude},${req.destination.longitude}:${req.travelMode}`;
    const cached = apiCache.get<TravelSegment>(cacheKey);
    if (cached) return cached;

    if (env.GOOGLE_MAPS_API_KEY) {
      try {
        const modeMap: Record<TransportMode, string> = {
          bike: 'BICYCLE',
          car: 'DRIVE',
          cab: 'DRIVE',
          public: 'TRANSIT',
          walking: 'WALK',
          ai: 'DRIVE',
        };

        const googleMode = modeMap[req.travelMode] || 'DRIVE';
        const url = 'https://routes.googleapis.com/directions/v2:computeRoutes';

        const response = await axios.post(
          url,
          {
            origin: {
              location: {
                latLng: {
                  latitude: req.origin.latitude,
                  longitude: req.origin.longitude,
                },
              },
            },
            destination: {
              location: {
                latLng: {
                  latitude: req.destination.latitude,
                  longitude: req.destination.longitude,
                },
              },
            },
            travelMode: googleMode,
            routingPreference: googleMode === 'DRIVE' ? 'TRAFFIC_UNAWARE' : undefined,
          },
          {
            headers: {
              'Content-Type': 'application/json',
              'X-Goog-Api-Key': env.GOOGLE_MAPS_API_KEY,
              'X-Goog-FieldMask': 'routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline',
            },
            timeout: 6000,
          }
        );

        if (response.data?.routes?.[0]) {
          const route = response.data.routes[0];
          const distanceMeters = route.distanceMeters || 1000;
          const durationSeconds = parseInt((route.duration || '600s').replace('s', ''), 10);
          const polyline = route.polyline?.encodedPolyline;

          const segment: TravelSegment = {
            distanceMeters,
            durationSeconds,
            mode: req.travelMode,
            polyline,
            distanceFormatted: formatDistance(distanceMeters),
            durationFormatted: formatDuration(durationSeconds),
            instructions: `Travel via ${req.travelMode} (${formatDistance(distanceMeters)}, ~${formatDuration(durationSeconds)})`,
          };

          apiCache.set(cacheKey, segment, 86400);
          return segment;
        }
      } catch (error) {
        logger.warn('Google Routes API error, calculating with geospatial engine', error);
      }
    }

    // High accuracy geospatial fallback calculation
    const fallbackSegment = buildSegment(req.origin, req.destination, req.travelMode);
    apiCache.set(cacheKey, fallbackSegment, 86400);
    return fallbackSegment;
  },
};
