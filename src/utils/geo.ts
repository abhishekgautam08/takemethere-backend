import { Coordinates, TransportMode, TravelSegment } from '../types/index.js';

/**
 * Calculates distance between two coordinates in meters using the Haversine formula
 */
export function calculateHaversineDistance(
  coord1: Coordinates,
  coord2: Coordinates
): number {
  const R = 6371e3; // Earth radius in meters
  const lat1Rad = (coord1.latitude * Math.PI) / 180;
  const lat2Rad = (coord2.latitude * Math.PI) / 180;
  const deltaLat = ((coord2.latitude - coord1.latitude) * Math.PI) / 180;
  const deltaLng = ((coord2.longitude - coord1.longitude) * Math.PI) / 180;

  const a =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(lat1Rad) * Math.cos(lat2Rad) * Math.sin(deltaLng / 2) * Math.sin(deltaLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return Math.round(R * c);
}

/**
 * Average speeds in km/h based on urban conditions and transport modes
 */
const SPEED_KMH: Record<TransportMode, number> = {
  bike: 18,
  car: 32,
  cab: 30,
  public: 20,
  walking: 4.8,
  ai: 25,
};

/**
 * Estimates travel duration in seconds based on direct distance & mode
 */
export function estimateTravelDuration(
  distanceMeters: number,
  mode: TransportMode
): number {
  // Add 25% urban road routing winding factor over direct aerial distance
  const routeDistanceKm = (distanceMeters * 1.25) / 1000;
  const speedKmh = SPEED_KMH[mode] || 25;
  const hours = routeDistanceKm / speedKmh;
  const seconds = Math.round(hours * 3600);
  // Minimum transit duration is 2 minutes (120s)
  return Math.max(120, seconds);
}

export function formatDistance(distanceMeters: number): string {
  if (distanceMeters < 1000) {
    return `${Math.round(distanceMeters)} m`;
  }
  return `${(distanceMeters / 1000).toFixed(1)} km`;
}

export function formatDuration(durationSeconds: number): string {
  const minutes = Math.round(durationSeconds / 60);
  if (minutes < 60) {
    return `${minutes} min${minutes !== 1 ? 's' : ''}`;
  }
  const hours = Math.floor(minutes / 60);
  const remainingMins = minutes % 60;
  if (remainingMins === 0) {
    return `${hours} hr${hours !== 1 ? 's' : ''}`;
  }
  return `${hours} hr ${remainingMins} min`;
}

/**
 * Creates a simple polyline representation or returns simulated coordinate waypoints
 */
export function buildSegment(
  origin: Coordinates,
  destination: Coordinates,
  mode: TransportMode = 'bike'
): TravelSegment {
  const directDistance = calculateHaversineDistance(origin, destination);
  const routedDistance = Math.round(directDistance * 1.22); // urban routing multiplier
  const durationSec = estimateTravelDuration(routedDistance, mode);

  return {
    distanceMeters: routedDistance,
    durationSeconds: durationSec,
    mode,
    distanceFormatted: formatDistance(routedDistance),
    durationFormatted: formatDuration(durationSec),
    instructions: `Travel via ${mode} (${formatDistance(routedDistance)}, approx ${formatDuration(durationSec)})`,
  };
}
