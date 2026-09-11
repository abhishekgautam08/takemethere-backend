import { Activity, Place, Pace, TransportMode, TravelSegment } from '../../types/index.js';
import { routesService } from '../google/routes.service.js';

interface ScheduleParams {
  dayIndex: number;
  places: Place[];
  pace: Pace;
  transportMode: TransportMode;
}

function addMinutesToTime(timeStr: string, minutesToAdd: number): string {
  const [hours, mins] = timeStr.split(':').map(Number);
  const totalMins = hours * 60 + mins + minutesToAdd;
  const newHours = Math.floor(totalMins / 60) % 24;
  const newMins = totalMins % 60;
  return `${String(newHours).padStart(2, '0')}:${String(newMins).padStart(2, '0')}`;
}

export async function buildDaySchedule(params: ScheduleParams): Promise<{
  activities: Activity[];
  totalDistanceMeters: number;
  totalDurationSeconds: number;
}> {
  const { places, pace, transportMode } = params;
  const activities: Activity[] = [];

  let currentTime = pace === 'packed' ? '08:30' : pace === 'relaxed' ? '09:30' : '09:00';
  let totalDistanceMeters = 0;
  let totalDurationSeconds = 0;

  for (let i = 0; i < places.length; i++) {
    const place = places[i];
    let travelSegment: TravelSegment | undefined;

    if (i > 0) {
      const prevPlace = places[i - 1];
      travelSegment = await routesService.calculateRoute({
        origin: { latitude: prevPlace.latitude, longitude: prevPlace.longitude },
        destination: { latitude: place.latitude, longitude: place.longitude },
        travelMode: transportMode,
      });

      totalDistanceMeters += travelSegment.distanceMeters;
      totalDurationSeconds += travelSegment.durationSeconds;

      const travelMinutes = Math.max(10, Math.ceil(travelSegment.durationSeconds / 60));
      currentTime = addMinutesToTime(currentTime, travelMinutes);
    }

    const durationMinutes =
      pace === 'packed' ? 60 : pace === 'relaxed' ? 120 : 90;
    const startTime = currentTime;
    const endTime = addMinutesToTime(startTime, durationMinutes);
    currentTime = endTime;

    activities.push({
      id: `act_${params.dayIndex}_${i + 1}_${place.placeId || Math.random().toString(36).substring(2, 6)}`,
      title: place.name,
      type: 'attraction',
      placeId: place.placeId,
      latitude: place.latitude,
      longitude: place.longitude,
      address: place.address,
      startTime,
      endTime,
      estimatedDurationMinutes: durationMinutes,
      description: place.description || `Visit and explore ${place.name}.`,
      rating: place.rating,
      priceLevel: place.priceLevel,
      photoUrl: place.photoUrl || (place.photos && place.photos[0]),
      photos: (place.photos && place.photos.length > 0) ? place.photos : (place.photoUrl ? [place.photoUrl] : []),
      mapsUrl: place.mapsUrl,
      travelFromPrevious: travelSegment,
    });
  }

  return {
    activities,
    totalDistanceMeters,
    totalDurationSeconds,
  };
}
