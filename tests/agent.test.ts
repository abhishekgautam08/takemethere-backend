import { describe, it } from 'node:test';
import assert from 'node:assert';
import { toolRegistry } from '../src/services/agent/toolRegistry.js';
import { validateItinerary } from '../src/services/itinerary/itineraryValidator.js';
import { optimizeItinerary } from '../src/services/itinerary/itineraryOptimizer.js';
import { itineraryService } from '../src/services/itinerary/itinerary.service.js';

describe('Travel Agent Tools and Itinerary Engine', () => {
  it('searchPlaces tool returns verified places with coordinates', async () => {
    const places = await toolRegistry.searchPlaces.execute({
      query: 'Jaipur',
      location: 'Jaipur',
    });

    assert.ok(Array.isArray(places));
    assert.ok(places.length > 0);
    assert.strictEqual(typeof places[0].latitude, 'number');
    assert.strictEqual(typeof places[0].longitude, 'number');
    assert.ok(places[0].name.length > 0);
  });

  it('calculateRoute computes realistic distance and duration for bike mode', async () => {
    const segment = await toolRegistry.calculateRoute.execute({
      origin: { latitude: 26.9239, longitude: 75.8267 }, // Hawa Mahal
      destination: { latitude: 26.9258, longitude: 75.8236 }, // City Palace
      travelMode: 'bike',
    });

    assert.strictEqual(segment.mode, 'bike');
    assert.ok(segment.distanceMeters > 0);
    assert.ok(segment.durationSeconds > 0);
    assert.ok(segment.distanceFormatted.includes('m') || segment.distanceFormatted.includes('km'));
  });

  it('generates structured itinerary for Jaipur', async () => {
    const itinerary = await itineraryService.generateItinerary('Jaipur', 3, {
      interests: ['History', 'Food'],
      budget: 'moderate',
      transport: 'bike',
      pace: 'balanced',
    });

    assert.strictEqual(itinerary.length, 3);
    assert.strictEqual(itinerary[0].day, 1);
    assert.ok(itinerary[0].activities.length > 0);

    const validation = validateItinerary(itinerary);
    assert.strictEqual(validation.isValid, true);
    assert.strictEqual(validation.errors.length, 0);
  });

  it('optimizeRoute eliminates backtracking and calculates travel savings', async () => {
    const itinerary = await itineraryService.generateItinerary('Jaipur', 3, {
      interests: ['History'],
      budget: 'moderate',
      transport: 'bike',
      pace: 'balanced',
    });

    const result = await optimizeItinerary(itinerary, 'bike');
    assert.ok(result.metrics);
    assert.strictEqual(typeof result.metrics.distanceSavedMeters, 'number');
    assert.strictEqual(typeof result.metrics.timeSavedSeconds, 'number');
    assert.ok(result.metrics.summary.length > 0);
  });
});
