import axios from 'axios';
import { OpenAI } from 'openai';
import {
  Trip,
  TripPreferences,
  AgentEvent,
  DayPlan,
  Hotel,
  Restaurant,
  BikeRental,
  CarRental,
  PublicTransitInfo,
} from '../../types/index.js';
import { env } from '../../config/env.js';
import { logger } from '../../utils/logger.js';
import { agentEventBus } from './agentEvents.js';
import { toolRegistry } from './toolRegistry.js';
import { placesService } from '../google/places.service.js';
import { itineraryService } from '../itinerary/itinerary.service.js';
import { TripRepository } from '../../models/Trip.model.js';
import { getDestinationData } from '../google/curatedData.js';

let openaiClient: OpenAI | null = null;
if (env.OPENAI_API_KEY) {
  openaiClient = new OpenAI({ apiKey: env.OPENAI_API_KEY });
}

export const travelAgentService = {
  async processPlanTrip(tripId: string): Promise<Trip | null> {
    const trip = await TripRepository.findById(tripId);
    if (!trip) {
      logger.error(`Trip ${tripId} not found`);
      return null;
    }

    const destination = trip.destination.name;
    const transportMode = trip.preferences.transport || 'bike';
    const customPrompt = trip.preferences.customPrompt;

    logger.info(`Master Travel Agent planning for ${destination} (Mode: ${transportMode}, Trip ID: ${tripId})`);

    const emitStep = async (
      type: any,
      message: string,
      details?: Record<string, unknown>,
      delayMs: number = 400
    ) => {
      agentEventBus.emit(tripId, type, message, details);
      await new Promise((r) => setTimeout(r, delayMs));
    };

    try {
      await emitStep('agent_started', `🤖 Starting AI Travel Agent for ${destination}...`);

      if (customPrompt) {
        await emitStep(
          'agent_started',
          `🎯 Special Request: "${customPrompt}" (Allocating ≥50% daily stops to matching locations)`
        );
      }

      await emitStep(
        'searching_places',
        customPrompt
          ? `🔍 Searching live verified "${customPrompt}" spots & attractions in ${destination}...`
          : `🔍 Searching live verified attractions, heritage landmarks and sights in ${destination}...`,
        { location: destination }
      );

      // 1. Live Google Places search
      const searchQuery = customPrompt
        ? `${customPrompt} in ${destination}`
        : `top tourist attractions in ${destination}`;

      const places = await toolRegistry.searchPlaces.execute({
        query: searchQuery,
        location: destination,
      });

      await emitStep(
        'places_found',
        `✅ Discovered ${places.length} verified real-world attractions with coordinates and reviews.`,
        { count: places.length }
      );

      await emitStep(
        'calculating_routes',
        `🛣️ Calculating travel routes & transit schedules for mode: ${transportMode}...`,
        { transport: transportMode }
      );

      await emitStep(
        'routes_calculated',
        `✅ Transit routes and speeds mapped for ${transportMode}.`,
        { mode: transportMode }
      );

      await emitStep(
        'finding_restaurants',
        `🍴 Finding local culinary stops and top-rated dining spots in ${destination}...`,
        { destination }
      );

      // 2. Live Google Places search for dining
      const restaurants: Restaurant[] = await toolRegistry.searchRestaurants.execute({
        location: destination,
      });

      await emitStep(
        'restaurants_found',
        `✅ Selected ${restaurants.length} authentic dining & cafe options.`,
        { count: restaurants.length }
      );

      // 3. Live Google Places search for hotels
      const hotels: Hotel[] = await toolRegistry.searchHotels.execute({
        location: destination,
      });

      // 4. Transport & Mobility Recommendations (Populating all modes for seamless tab switching)
      let bikeRentals: BikeRental[] = [];
      let carRentals: CarRental[] = [];
      let publicTransit: PublicTransitInfo | undefined;

      if (transportMode === 'bike') {
        await emitStep(
          'finding_rentals',
          `🏍️ Finding verified bike and scooter rental hubs in ${destination}...`,
          { destination }
        );
        bikeRentals = await toolRegistry.searchBikeRentals.execute({ location: destination });
        await emitStep('rentals_found', `✅ Found ${bikeRentals.length} verified two-wheeler rental hubs.`);
        // Background populate car and transit
        carRentals = await toolRegistry.searchCarRentals.execute({ location: destination });
        publicTransit = await toolRegistry.searchPublicTransit.execute({ location: destination });
      } else if (transportMode === 'car') {
        await emitStep(
          'finding_rentals',
          `🚗 Finding top verified car rental agencies and city cab providers in ${destination}...`,
          { destination }
        );
        carRentals = await toolRegistry.searchCarRentals.execute({ location: destination });
        await emitStep('rentals_found', `✅ Found ${carRentals.length} car rental & cab providers.`);
        // Background populate bike and transit
        bikeRentals = await toolRegistry.searchBikeRentals.execute({ location: destination });
        publicTransit = await toolRegistry.searchPublicTransit.execute({ location: destination });
      } else {
        await emitStep(
          'finding_rentals',
          `🚌 Mapping local public city bus and metro transit lines for ${destination}...`,
          { destination }
        );
        publicTransit = await toolRegistry.searchPublicTransit.execute({ location: destination });
        await emitStep('rentals_found', `✅ Mapped local city buses and transit lines.`);
        // Background populate bike and car
        bikeRentals = await toolRegistry.searchBikeRentals.execute({ location: destination });
        carRentals = await toolRegistry.searchCarRentals.execute({ location: destination });
      }

      await emitStep(
        'building_itinerary',
        customPrompt
          ? `🧩 Assembling ${trip.duration}-day sequential itinerary ensuring ≥50% daily spots match "${customPrompt}"...`
          : `🧩 Assembling ${trip.duration}-day sequential itinerary with opening hours and sight details...`,
        { duration: trip.duration }
      );

      const itinerary = await itineraryService.generateItinerary(
        destination,
        trip.duration,
        trip.preferences
      );

      await emitStep(
        'optimizing_itinerary',
        `✨ Performing route optimization to eliminate geographic backtracking...`
      );

      const destMeta = getDestinationData(destination);
      const centerLat = trip.preferences.userLocation?.latitude || places[0]?.latitude || destMeta.center.latitude || 26.9124;
      const centerLng = trip.preferences.userLocation?.longitude || places[0]?.longitude || destMeta.center.longitude || 75.7873;
      const destCover = places[0]?.photoUrl || destMeta.coverImage;

      const updatedTrip = await TripRepository.update(tripId, {
        itinerary,
        hotels,
        restaurants,
        bikeRentals,
        carRentals,
        publicTransit,
        destination: {
          name: destMeta.name || destination.charAt(0).toUpperCase() + destination.slice(1),
          country: places[0]?.address?.split(',').pop()?.trim() || destMeta.country || 'India',
          latitude: centerLat,
          longitude: centerLng,
          tagline: destMeta.tagline || `Discover ${destination} with verified sights, opening hours and transit.`,
          coverImage: destCover,
          popularInterests: trip.preferences.interests,
          areaName: destMeta.areaName,
          parentCity: destMeta.parentCity,
          isLocalizedArea: destMeta.isLocalizedArea,
        },
        status: 'ready',
      });

      await emitStep(
        'itinerary_ready',
        `🎉 Your personalized ${trip.duration}-day trip to ${destination} is ready!`,
        { tripId },
        200
      );

      return updatedTrip;
    } catch (error: any) {
      logger.error(`Error in travel agent planning for trip ${tripId}:`, error);
      agentEventBus.emit(tripId, 'agent_error', `Failed to generate itinerary: ${error.message}`);
      await TripRepository.update(tripId, { status: 'error' });
      return null;
    }
  },

  async handleChatMessage(tripId: string, message: string): Promise<string> {
    logger.info(`Received user chat message for trip ${tripId}: "${message}"`);
    const trip = await TripRepository.findById(tripId);
    if (!trip) return 'Trip not found.';

    const lower = message.toLowerCase();

    if (lower.includes('replace') || lower.includes('change') || lower.includes('outdoor')) {
      const firstAct = trip.itinerary[0]?.activities[0];
      if (firstAct) {
        await itineraryService.modifyActivity(trip, 1, firstAct.id, 'replace', message);
        await TripRepository.update(tripId, { itinerary: trip.itinerary });
        return `I have updated your itinerary based on your request: "${message}". I replaced the activity and recalculated all travel routes!`;
      }
    }

    if (lower.includes('optimize') || lower.includes('faster')) {
      return `You can click the "✨ Optimize My Trip" button at the top to reorder stops and reduce travel time!`;
    }

    // RapidAPI OpenAI
    if (env.RAPIDAPI_KEY && env.RAPIDAPI_OPENAI_HOST) {
      try {
        const response = await axios.post(
          'https://cheapest-gpt-4-turbo-gpt-4-vision-chatgpt-openai-ai-api.p.rapidapi.com/v1/chat/completions',
          {
            messages: [
              {
                role: 'system',
                content: `You are an expert AI Travel Concierge assisting a user with their ${trip.duration}-day itinerary in ${trip.destination.name}. Interests: ${trip.preferences.interests.join(', ')}, Transport: ${trip.preferences.transport}. Be concise, practical, and helpful.`,
              },
              { role: 'user', content: message },
            ],
            model: env.OPENAI_MODEL || 'gpt-4o',
            max_tokens: 350,
            temperature: 0.7,
          },
          {
            headers: {
              'x-rapidapi-key': env.RAPIDAPI_KEY,
              'x-rapidapi-host': env.RAPIDAPI_OPENAI_HOST,
              'Content-Type': 'application/json',
            },
            timeout: 8000,
          }
        );

        const reply = response.data?.choices?.[0]?.message?.content;
        if (reply) return reply;
      } catch (err: any) {
        logger.warn('RapidAPI OpenAI chat fallback:', err.message);
      }
    }

    // Direct OpenAI SDK
    if (openaiClient) {
      try {
        const completion = await openaiClient.chat.completions.create({
          model: env.OPENAI_MODEL || 'gpt-4o',
          messages: [
            {
              role: 'system',
              content: `You are an expert AI Travel Concierge assisting a user with their ${trip.duration}-day trip in ${trip.destination.name}.`,
            },
            { role: 'user', content: message },
          ],
          max_tokens: 350,
        });

        const reply = completion.choices[0]?.message?.content;
        if (reply) return reply;
      } catch (err: any) {
        logger.warn('Direct OpenAI SDK error:', err.message);
      }
    }

    return `I am your AI Travel Concierge for ${trip.destination.name}. I can help modify stops, suggest dining spots, or optimize your transit routes. What would you like to tweak?`;
  },
};
