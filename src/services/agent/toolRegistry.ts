import { Place, Restaurant, BikeRental, Hotel, TravelSegment, TransportMode } from '../../types/index.js';
import { placesService } from '../google/places.service.js';
import { routesService } from '../google/routes.service.js';
import { calculateHaversineDistance } from '../../utils/geo.js';
import { logger } from '../../utils/logger.js';

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  execute: (args: any) => Promise<any>;
}

export const toolRegistry: Record<string, ToolDefinition> = {
  searchPlaces: {
    name: 'searchPlaces',
    description: 'Search for attractions, historical monuments, museums, and landmarks in a destination',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search term or attraction name' },
        location: { type: 'string', description: 'Destination city name (e.g. Jaipur)' },
        category: { type: 'string', description: 'Category (e.g. historical, nature, shopping, museum)' },
        radius: { type: 'number', description: 'Search radius in meters' },
      },
      required: ['query'],
    },
    execute: async (args: { query: string; location?: string; category?: string; radius?: number }) => {
      logger.info(`Tool searchPlaces called for: ${args.query} in ${args.location || ''}`);
      return await placesService.searchPlaces(args);
    },
  },

  getPlaceDetails: {
    name: 'getPlaceDetails',
    description: 'Get verified place details including address, opening hours, photos, ratings and coordinates',
    parameters: {
      type: 'object',
      properties: {
        placeId: { type: 'string', description: 'The unique Place ID' },
      },
      required: ['placeId'],
    },
    execute: async (args: { placeId: string }) => {
      logger.info(`Tool getPlaceDetails called for: ${args.placeId}`);
      return await placesService.getPlaceDetails(args.placeId);
    },
  },

  calculateRoute: {
    name: 'calculateRoute',
    description: 'Calculate real-world distance, duration, and transit route between two locations',
    parameters: {
      type: 'object',
      properties: {
        origin: {
          type: 'object',
          properties: { latitude: { type: 'number' }, longitude: { type: 'number' } },
          required: ['latitude', 'longitude'],
        },
        destination: {
          type: 'object',
          properties: { latitude: { type: 'number' }, longitude: { type: 'number' } },
          required: ['latitude', 'longitude'],
        },
        travelMode: {
          type: 'string',
          enum: ['bike', 'car', 'cab', 'public', 'walking', 'ai'],
          description: 'Transport mode',
        },
      },
      required: ['origin', 'destination', 'travelMode'],
    },
    execute: async (args: {
      origin: { latitude: number; longitude: number };
      destination: { latitude: number; longitude: number };
      travelMode: TransportMode;
    }) => {
      logger.info(`Tool calculateRoute called for mode: ${args.travelMode}`);
      return await routesService.calculateRoute(args);
    },
  },

  searchRestaurants: {
    name: 'searchRestaurants',
    description: 'Find verified top-rated restaurants, local street food, and cafes near an attraction or area',
    parameters: {
      type: 'object',
      properties: {
        location: { type: 'string', description: 'City or area name' },
        cuisine: { type: 'string', description: 'Cuisine type or dish preference' },
        budget: { type: 'string', description: 'Budget level' },
      },
      required: ['location'],
    },
    execute: async (args: { location: string; cuisine?: string; budget?: string }) => {
      logger.info(`Tool searchRestaurants called for: ${args.location}`);
      return await placesService.searchRestaurants(args.location, args.cuisine);
    },
  },

  searchHotels: {
    name: 'searchHotels',
    description: 'Search for accommodations and hotels to serve as the daily origin/hub',
    parameters: {
      type: 'object',
      properties: {
        location: { type: 'string', description: 'Destination city name' },
      },
      required: ['location'],
    },
    execute: async (args: { location: string }) => {
      logger.info(`Tool searchHotels called for: ${args.location}`);
      return await placesService.searchHotels(args.location);
    },
  },

  searchBikeRentals: {
    name: 'searchBikeRentals',
    description: 'Find verified bike, scooter and motorcycle rental hubs near the destination or station',
    parameters: {
      type: 'object',
      properties: {
        location: { type: 'string', description: 'City name' },
      },
      required: ['location'],
    },
    execute: async (args: { location: string }) => {
      logger.info(`Tool searchBikeRentals called for: ${args.location}`);
      return await placesService.searchBikeRentals(args.location);
    },
  },

  searchNearbyPlaces: {
    name: 'searchNearbyPlaces',
    description: 'Find nearby cafes, viewpoints, or shopping bazaars close to a coordinate',
    parameters: {
      type: 'object',
      properties: {
        location: { type: 'string', description: 'Destination name' },
        category: { type: 'string', description: 'Category to search' },
      },
      required: ['location'],
    },
    execute: async (args: { location: string; category?: string }) => {
      return await placesService.searchPlaces({ query: args.category || 'places', location: args.location });
    },
  },

  searchAlongRoute: {
    name: 'searchAlongRoute',
    description: 'Find pitstops, scenic viewpoints, or snack places along an active route',
    parameters: {
      type: 'object',
      properties: {
        origin: { type: 'object' },
        destination: { type: 'object' },
        category: { type: 'string' },
      },
      required: ['origin', 'destination'],
    },
    execute: async (args: any) => {
      return await placesService.searchPlaces({ query: args.category || 'cafe' });
    },
  },

  searchCarRentals: {
    name: 'searchCarRentals',
    description: 'Find verified car rental agencies and city cab providers',
    parameters: {
      type: 'object',
      properties: {
        location: { type: 'string', description: 'Destination city name' },
      },
      required: ['location'],
    },
    execute: async (args: { location: string }) => {
      logger.info(`Tool searchCarRentals called for: ${args.location}`);
      return await placesService.searchCarRentals(args.location);
    },
  },

  searchPublicTransit: {
    name: 'searchPublicTransit',
    description: 'Get local public bus and metro lines and transit details',
    parameters: {
      type: 'object',
      properties: {
        location: { type: 'string', description: 'Destination city name' },
      },
      required: ['location'],
    },
    execute: async (args: { location: string }) => {
      logger.info(`Tool searchPublicTransit called for: ${args.location}`);
      return await placesService.searchPublicTransit(args.location);
    },
  },

  optimizeRoute: {
    name: 'optimizeRoute',
    description: 'Re-orders a list of locations to minimize total travel time and avoid backtracking',
    parameters: {
      type: 'object',
      properties: {
        places: { type: 'array', items: { type: 'object' } },
        travelMode: { type: 'string' },
      },
      required: ['places'],
    },
    execute: async (args: { places: Place[]; travelMode?: TransportMode }) => {
      const places = args.places;
      if (places.length <= 2) return places;

      // Nearest-neighbor TSP heuristic to eliminate zigzagging
      const unvisited = [...places.slice(1)];
      const ordered = [places[0]];

      while (unvisited.length > 0) {
        const current = ordered[ordered.length - 1];
        let nearestIndex = 0;
        let minDistance = Infinity;

        for (let i = 0; i < unvisited.length; i++) {
          const dist = calculateHaversineDistance(
            { latitude: current.latitude, longitude: current.longitude },
            { latitude: unvisited[i].latitude, longitude: unvisited[i].longitude }
          );
          if (dist < minDistance) {
            minDistance = dist;
            nearestIndex = i;
          }
        }

        ordered.push(unvisited.splice(nearestIndex, 1)[0]);
      }

      return ordered;
    },
  },
};
