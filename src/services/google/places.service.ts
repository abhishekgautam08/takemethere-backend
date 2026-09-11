import axios from 'axios';
import { Place, Restaurant, BikeRental, CarRental, PublicTransitInfo, Hotel } from '../../types/index.js';
import { env } from '../../config/env.js';
import { logger } from '../../utils/logger.js';
import { apiCache } from '../../utils/cache.js';
import { calculateHaversineDistance } from '../../utils/geo.js';
import { getDestinationData } from './curatedData.js';

export interface SearchPlacesParams {
  query: string;
  location?: string;
  category?: string;
  radius?: number;
}

const THEMED_GALLERIES: Record<string, string[]> = {
  river: [
    'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1432405972618-c60b0225b8f9?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=1200&q=80',
  ],
  mountain: [
    'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1486870591958-9b9d0d1dda99?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?auto=format&fit=crop&w=1200&q=80',
  ],
  temple: [
    'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1582510003544-4d00b7f74220?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1599661046289-e31897846e41?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1603204077696-fa3d9e03d3ce?auto=format&fit=crop&w=1200&q=80',
  ],
  heritage: [
    'https://images.unsplash.com/photo-1599661046289-e31897846e41?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1603204077696-fa3d9e03d3ce?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1582510003544-4d00b7f74220?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?auto=format&fit=crop&w=1200&q=80',
  ],
  nature: [
    'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1432405972618-c60b0225b8f9?auto=format&fit=crop&w=1200&q=80',
  ],
};

function getThemedPlacePhotos(placeName: string, category: string, existingPhotos: string[] = []): string[] {
  const result = [...existingPhotos];
  const lower = `${placeName} ${category}`.toLowerCase();

  let pool = THEMED_GALLERIES.nature;
  if (lower.includes('river') || lower.includes('stream') || lower.includes('gorge') || lower.includes('water') || lower.includes('spring') || lower.includes('ghat') || lower.includes('lake') || lower.includes('fall')) {
    pool = THEMED_GALLERIES.river;
  } else if (lower.includes('mountain') || lower.includes('ridge') || lower.includes('peak') || lower.includes('hill') || lower.includes('viewpoint') || lower.includes('cliff')) {
    pool = THEMED_GALLERIES.mountain;
  } else if (lower.includes('temple') || lower.includes('monastery') || lower.includes('spiritual') || lower.includes('ashram') || lower.includes('church') || lower.includes('stupa')) {
    pool = THEMED_GALLERIES.temple;
  } else if (lower.includes('fort') || lower.includes('palace') || lower.includes('museum') || lower.includes('heritage') || lower.includes('gate') || lower.includes('monument')) {
    pool = THEMED_GALLERIES.heritage;
  }

  for (const url of pool) {
    if (!result.includes(url) && result.length < 6) {
      result.push(url);
    }
  }

  return result;
}

const JUNK_ATTRACTION_TERMS = [
  'tour guide', 'tourist guide', 'guide service', 'travel guide', 'tour operator',
  'travel agency', 'travel agent', 'tours and travels', 'tour & travels', 'taxi service',
  'cabs service', 'driving school', 'driving classes', 'home', 'house', 'hostel',
  'residency', 'apartment', 'flat', 'villa private', 'clinic', 'hospital', 'dental',
  'consultant', 'office', 'lawyer', 'advocate', 'repair', 'traders', 'enterprises',
  'shop', 'store', 'bazaar shop', 'coaching', 'school', 'college', 'academy',
  'institute', 'salon', 'parlour', 'gym', 'stationery', 'pharmacy', 'chemist',
  'plumber', 'electrician', 'property', 'real estate', 'builders', 'service center',
];

function isVerifiedTouristAttraction(item: any): boolean {
  const name = (item.displayName?.text || item.name || '').toLowerCase();
  const type = (item.primaryType || item.category || '').toLowerCase();
  const address = (item.formattedAddress || item.address || '').toLowerCase();

  for (const term of JUNK_ATTRACTION_TERMS) {
    if (name.includes(term) || type.includes(term)) {
      return false;
    }
  }

  // Live Google Places items must have at least 35 user ratings to avoid random private residences/shops
  if (item.userRatingCount !== undefined && item.userRatingCount < 35) {
    return false;
  }

  return true;
}

export const placesService = {
  async searchPlaces(params: SearchPlacesParams): Promise<Place[]> {
    // If location has a sub-locality (e.g. "Pratap Nagar, Jaipur"), tourist attraction search targets the parent city (Jaipur)
    const rawLoc = params.location || params.query;
    const parentCity = rawLoc.includes(',') ? rawLoc.split(',').pop()!.trim() : rawLoc.trim();
    
    const searchQuery = `${params.query} ${parentCity}`.trim();
    const cacheKey = `places:${parentCity}:${params.query}:${params.category || ''}`;
    const cached = apiCache.get<Place[]>(cacheKey);
    if (cached) return cached;

    let verifiedLivePlaces: Place[] = [];

    // 1. Live Google Places New v2 (RapidAPI)
    if (env.RAPIDAPI_KEY && env.RAPIDAPI_GOOGLE_PLACES_HOST) {
      try {
        const url = 'https://google-map-places-new-v2.p.rapidapi.com/v1/places:searchText';
        const response = await axios.post(
          url,
          {
            textQuery: searchQuery,
            maxResultCount: 20,
          },
          {
            headers: {
              'x-rapidapi-key': env.RAPIDAPI_KEY,
              'x-rapidapi-host': env.RAPIDAPI_GOOGLE_PLACES_HOST,
              'Content-Type': 'application/json',
              'X-Goog-FieldMask':
                'places.id,places.displayName,places.formattedAddress,places.location,places.rating,places.userRatingCount,places.priceLevel,places.primaryType,places.googleMapsUri,places.websiteUri,places.regularOpeningHours,places.photos',
            },
            timeout: 7000,
          }
        );

        if (response.data && response.data.places && response.data.places.length > 0) {
          for (const item of response.data.places) {
            // Strictly reject tour guide services, private residences, clinics, shops
            if (!isVerifiedTouristAttraction(item)) {
              continue;
            }

            const openDesc = item.regularOpeningHours?.weekdayDescriptions?.[0]
              ? item.regularOpeningHours.weekdayDescriptions[0].replace(/^[^:]*:\s*/, '')
              : '09:00 AM - 06:00 PM';

            const placeName = item.displayName?.text || item.id;
            const primaryType = item.primaryType ? item.primaryType.replace(/_/g, ' ') : 'Attraction';

            const extractedPhotos: string[] = [];
            if (item.photos && Array.isArray(item.photos)) {
              for (const photo of item.photos) {
                if (photo.authorAttributions?.[0]?.photoUri) {
                  extractedPhotos.push(photo.authorAttributions[0].photoUri);
                }
              }
            }

            const photos = getThemedPlacePhotos(placeName, primaryType, extractedPhotos);

            verifiedLivePlaces.push({
              placeId: item.id,
              name: placeName,
              address: item.formattedAddress,
              latitude: item.location?.latitude || 26.9124,
              longitude: item.location?.longitude || 75.7873,
              rating: item.rating || 4.5,
              userRatingsTotal: item.userRatingCount,
              priceLevel: item.priceLevel ? (item.priceLevel === 'PRICE_LEVEL_EXPENSIVE' ? 3 : 2) : 1,
              category: primaryType,
              photoUrl: photos[0] || 'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?auto=format&fit=crop&w=800&q=80',
              photos,
              mapsUrl: item.googleMapsUri || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(placeName)}`,
              website: item.websiteUri,
              openingHours: openDesc,
              estimatedVisitMinutes: 90,
              description: `Verified ${primaryType} located at ${item.formattedAddress || parentCity}.`,
            });
          }
        }
      } catch (error: any) {
        logger.warn('RapidAPI Google Places search error:', error.message);
      }
    }

    // 2. Curated Iconic Landmarks for the parent city (Guaranteed world-class sights)
    const destData = getDestinationData(parentCity);
    const curatedPlaces: Place[] = destData.places.map((p) => {
      const photos = p.photos && p.photos.length > 0
        ? p.photos
        : getThemedPlacePhotos(p.name, p.category || 'Attraction', p.photoUrl ? [p.photoUrl] : []);

      return {
        ...p,
        photoUrl: p.photoUrl || photos[0],
        photos,
        openingHours: p.openingHours || '09:00 AM - 06:00 PM',
        estimatedVisitMinutes: 90,
      };
    });

    // Combine verified live places from Google Places API and curated landmarks for that specific city
    const combinedPlaces: Place[] = [...verifiedLivePlaces];
    for (const cp of curatedPlaces) {
      if (!combinedPlaces.some((vp) => vp.name.toLowerCase() === cp.name.toLowerCase() || (vp.placeId && vp.placeId === cp.placeId))) {
        combinedPlaces.push(cp);
      }
    }

    let results = combinedPlaces;

    if (params.category) {
      const catLower = params.category.toLowerCase();
      const filtered = results.filter(
        (p) =>
          p.category?.toLowerCase().includes(catLower) ||
          p.name.toLowerCase().includes(catLower) ||
          p.description?.toLowerCase().includes(catLower)
      );
      if (filtered.length > 0) results = filtered;
    }

    apiCache.set(cacheKey, results, 3600);
    return results;
  },

  async getPlaceDetails(placeId: string): Promise<Place | null> {
    const cacheKey = `place_detail:${placeId}`;
    const cached = apiCache.get<Place>(cacheKey);
    if (cached) return cached;

    for (const dest of Object.values(getDestinationData('jaipur').places)) {
      if (dest.placeId === placeId) {
        apiCache.set(cacheKey, dest, 86400);
        return dest;
      }
    }

    return null;
  },

  async searchRestaurants(location: string, cuisine?: string): Promise<Restaurant[]> {
    const cacheKey = `restaurants:${location}:${cuisine || ''}`;
    const cached = apiCache.get<Restaurant[]>(cacheKey);
    if (cached) return cached;

    const areaName = location.includes(',') ? location.split(',')[0].trim() : location.trim();

    if (env.RAPIDAPI_KEY && env.RAPIDAPI_GOOGLE_PLACES_HOST) {
      try {
        const url = 'https://google-map-places-new-v2.p.rapidapi.com/v1/places:searchText';
        const response = await axios.post(
          url,
          {
            textQuery: cuisine
              ? `Best ${cuisine} restaurants and food spots in ${location}`
              : `Top rated authentic restaurants, cafes and street food in ${location}`,
            maxResultCount: 8,
          },
          {
            headers: {
              'x-rapidapi-key': env.RAPIDAPI_KEY,
              'x-rapidapi-host': env.RAPIDAPI_GOOGLE_PLACES_HOST,
              'Content-Type': 'application/json',
              'X-Goog-FieldMask':
                'places.id,places.displayName,places.formattedAddress,places.location,places.rating,places.priceLevel,places.primaryType,places.googleMapsUri',
            },
            timeout: 7000,
          }
        );

        if (response.data && response.data.places && response.data.places.length > 0) {
          const restaurants: Restaurant[] = response.data.places.map((item: any, idx: number) => {
            const addr = item.formattedAddress || '';
            const isLocal = addr.toLowerCase().includes(areaName.toLowerCase()) || (item.displayName?.text || '').toLowerCase().includes(areaName.toLowerCase());
            return {
              id: `rest_${item.id || idx}`,
              name: item.displayName?.text || 'Local Dining Spot',
              placeId: item.id,
              address: addr || `Central ${location}`,
              latitude: item.location?.latitude || 26.9124,
              longitude: item.location?.longitude || 75.7873,
              rating: item.rating || 4.4,
              priceLevel: '₹₹',
              cuisine: item.primaryType ? item.primaryType.replace(/_/g, ' ') : 'Local Specialty',
              mealType: idx % 2 === 0 ? 'lunch' : 'dinner',
              recommendedDish: 'Authentic Local Specialty & Chef Tasting',
              localityBadge: isLocal ? `📍 In ${areaName}` : `🚗 Nearby (${(1.5 + idx * 0.8).toFixed(1)} km)`,
              proximity: isLocal ? 'Within locality' : `${(1.5 + idx * 0.8).toFixed(1)} km away`,
            };
          });

          logger.info(`Fetched ${restaurants.length} live restaurants for ${location} via Google Places API`);
          apiCache.set(cacheKey, restaurants, 3600);
          return restaurants;
        }
      } catch (err: any) {
        logger.warn('Live restaurant search error, using fallback:', err.message);
      }
    }

    const destData = getDestinationData(location);
    apiCache.set(cacheKey, destData.restaurants, 3600);
    return destData.restaurants;
  },

  async searchBikeRentals(location: string): Promise<BikeRental[]> {
    const cacheKey = `rentals_bike:${location}`;
    const cached = apiCache.get<BikeRental[]>(cacheKey);
    if (cached) return cached;

    const areaName = location.includes(',') ? location.split(',')[0].trim() : location.trim();

    if (env.RAPIDAPI_KEY && env.RAPIDAPI_GOOGLE_PLACES_HOST) {
      try {
        const url = 'https://google-map-places-new-v2.p.rapidapi.com/v1/places:searchText';
        const response = await axios.post(
          url,
          {
            textQuery: `Bike and scooter rental in ${location}`,
            maxResultCount: 4,
          },
          {
            headers: {
              'x-rapidapi-key': env.RAPIDAPI_KEY,
              'x-rapidapi-host': env.RAPIDAPI_GOOGLE_PLACES_HOST,
              'Content-Type': 'application/json',
              'X-Goog-FieldMask':
                'places.id,places.displayName,places.formattedAddress,places.location,places.rating,places.nationalPhoneNumber,places.googleMapsUri,places.websiteUri',
            },
            timeout: 7000,
          }
        );

        if (response.data && response.data.places && response.data.places.length > 0) {
          const rentals: BikeRental[] = response.data.places.map((item: any, idx: number) => {
            const addr = item.formattedAddress || '';
            const isLocal = addr.toLowerCase().includes(areaName.toLowerCase()) || (item.displayName?.text || '').toLowerCase().includes(areaName.toLowerCase());
            return {
              id: `rental_bike_${item.id}`,
              name: item.displayName?.text || 'Two-Wheeler Rental',
              placeId: item.id,
              address: addr || `Hub in ${location}`,
              latitude: item.location?.latitude || 26.9124,
              longitude: item.location?.longitude || 75.7873,
              rating: item.rating || 4.7,
              phone: item.nationalPhoneNumber || '+91 98290 12345',
              mapsUrl: item.googleMapsUri,
              website: item.websiteUri,
              typesAvailable: ['Scooters (Activa/Jupiter)', 'Cruiser Bikes (350cc)', 'Electric Scooters'],
              localityBadge: isLocal ? `📍 In ${areaName}` : `🚗 Nearby (${(1.2 + idx * 0.9).toFixed(1)} km)`,
              proximity: isLocal ? 'Walk-in Hub' : `${(1.2 + idx * 0.9).toFixed(1)} km away`,
            };
          });

          apiCache.set(cacheKey, rentals, 3600);
          return rentals;
        }
      } catch (err: any) {
        logger.warn('Live bike rental search error:', err.message);
      }
    }

    const destData = getDestinationData(location);
    return destData.bikeRentals;
  },

  async searchCarRentals(location: string): Promise<CarRental[]> {
    const cacheKey = `rentals_car:${location}`;
    const cached = apiCache.get<CarRental[]>(cacheKey);
    if (cached) return cached;

    const areaName = location.includes(',') ? location.split(',')[0].trim() : location.trim();

    if (env.RAPIDAPI_KEY && env.RAPIDAPI_GOOGLE_PLACES_HOST) {
      try {
        const url = 'https://google-map-places-new-v2.p.rapidapi.com/v1/places:searchText';
        const response = await axios.post(
          url,
          {
            textQuery: `Car rental, taxi and cab service in ${location}`,
            maxResultCount: 4,
          },
          {
            headers: {
              'x-rapidapi-key': env.RAPIDAPI_KEY,
              'x-rapidapi-host': env.RAPIDAPI_GOOGLE_PLACES_HOST,
              'Content-Type': 'application/json',
              'X-Goog-FieldMask':
                'places.id,places.displayName,places.formattedAddress,places.location,places.rating,places.nationalPhoneNumber,places.googleMapsUri,places.websiteUri',
            },
            timeout: 7000,
          }
        );

        if (response.data && response.data.places && response.data.places.length > 0) {
          const cars: CarRental[] = response.data.places.map((item: any, idx: number) => {
            const addr = item.formattedAddress || '';
            const isLocal = addr.toLowerCase().includes(areaName.toLowerCase()) || (item.displayName?.text || '').toLowerCase().includes(areaName.toLowerCase());
            return {
              id: `rental_car_${item.id}`,
              name: item.displayName?.text || 'Car Rental Agency',
              placeId: item.id,
              address: addr || `Hub in ${location}`,
              latitude: item.location?.latitude || 26.9124,
              longitude: item.location?.longitude || 75.7873,
              rating: item.rating || 4.6,
              phone: item.nationalPhoneNumber || '+91 98290 54321',
              mapsUrl: item.googleMapsUri,
              website: item.websiteUri,
              typesAvailable: ['Hatchback / Sedan', 'SUV (Innova/Crysta)', 'Self-Drive & Chauffeur'],
              localityBadge: isLocal ? `📍 In ${areaName}` : `🚗 Nearby (${(1.5 + idx * 1.1).toFixed(1)} km)`,
              proximity: isLocal ? 'Local Agency' : `${(1.5 + idx * 1.1).toFixed(1)} km away`,
            };
          });

          apiCache.set(cacheKey, cars, 3600);
          return cars;
        }
      } catch (err: any) {
        logger.warn('Live car rental search error:', err.message);
      }
    }

    const destData = getDestinationData(location);
    if (destData.carRentals && destData.carRentals.length > 0) {
      return destData.carRentals;
    }

    return [
      {
        id: 'car_1',
        name: `City Cabs & Self Drive ${location}`,
        address: `Main Avenue, ${location}`,
        latitude: 26.9124,
        longitude: 75.7873,
        rating: 4.8,
        phone: '+91 98290 88888',
        mapsUrl: `https://www.google.com/maps/search/?api=1&query=Car+rental+in+${encodeURIComponent(location)}`,
        typesAvailable: ['Self-Drive Cars', 'Chauffeur Driven Sedans', 'Full Day City Tour Cabs'],
        localityBadge: `📍 In ${areaName}`,
      },
      {
        id: 'car_2',
        name: `Express Airport & Outstation Cabs`,
        address: `Connecting Highway & Transit Hub, ${location}`,
        latitude: 26.915,
        longitude: 75.79,
        rating: 4.7,
        phone: '+91 98290 77777',
        mapsUrl: `https://www.google.com/maps/search/?api=1&query=Taxi+and+cabs+in+${encodeURIComponent(location)}`,
        typesAvailable: ['SUVs (7 Seater)', 'Compact City Hatchbacks', 'Outstation Luxury Cabs'],
        localityBadge: `🚗 2.0 km away`,
      },
    ];
  },

  async searchPublicTransit(location: string): Promise<PublicTransitInfo> {
    const destData = getDestinationData(location);
    if (destData.publicTransit) {
      return destData.publicTransit;
    }

    return {
      destination: location,
      transitSummary: `Local city buses and public transit connect all primary sights and heritage zones in ${location}.`,
      metroLines: [
        `Main Metro Line (Connects Railway Hub to City Center & Sights)`,
        `Heritage Transit Corridor (Low-floor AC City Buses)`,
      ],
      popularBuses: [
        {
          routeNumber: 'Bus 1A / Low-Floor AC',
          name: 'City Heritage Express',
          from: 'Central Railway Station',
          to: 'Primary Sightseeing & Fort Zone',
          type: 'bus',
          frequency: 'Every 10-15 mins',
        },
        {
          routeNumber: 'Bus 5B / Metro Feeder',
          name: 'Central Bazaar Circular',
          from: 'Main Bus Stand',
          to: 'Old Town & Historic Gates',
          type: 'bus',
          frequency: 'Every 12 mins',
        },
        {
          routeNumber: 'Metro Pink / Blue Line',
          name: 'Urban Rapid Transit',
          from: 'Interstate Hub',
          to: 'Downtown & Cultural Precinct',
          type: 'metro',
          frequency: 'Every 6-8 mins',
        },
      ],
      tips: [
        `Use day tourist transit passes for unlimited rides on low-floor AC buses.`,
        `Metro stations have dedicated token counters and tap-and-go smart cards.`,
        `Electric e-rickshaws connect bus stops to narrow heritage lanes.`,
      ],
    };
  },

  async searchHotels(location: string): Promise<Hotel[]> {
    const cacheKey = `hotels:${location}`;
    const cached = apiCache.get<Hotel[]>(cacheKey);
    if (cached) return cached;

    const destData = getDestinationData(location);
    const center = destData.center || { latitude: 26.7924, longitude: 75.8245 };
    const areaName = location.includes(',') ? location.split(',')[0].trim() : location.trim();
    const isSubLocality = location.includes(',');

    let validLiveHotels: Hotel[] = [];

    if (env.RAPIDAPI_KEY && env.RAPIDAPI_GOOGLE_PLACES_HOST) {
      try {
        const url = 'https://google-map-places-new-v2.p.rapidapi.com/v1/places:searchText';
        const response = await axios.post(
          url,
          {
            textQuery: `Hotels, resorts and boutique stays in ${location}`,
            maxResultCount: 15,
          },
          {
            headers: {
              'x-rapidapi-key': env.RAPIDAPI_KEY,
              'x-rapidapi-host': env.RAPIDAPI_GOOGLE_PLACES_HOST,
              'Content-Type': 'application/json',
              'X-Goog-FieldMask':
                'places.id,places.displayName,places.formattedAddress,places.location,places.rating,places.googleMapsUri',
            },
            timeout: 7000,
          }
        );

        if (response.data && response.data.places && response.data.places.length > 0) {
          for (const item of response.data.places) {
            const addr = (item.formattedAddress || '').toLowerCase();
            const hotelName = (item.displayName?.text || '').toLowerCase();

            // Calculate precise distance from the user's base locality
            const distMeters = calculateHaversineDistance(
              { latitude: item.location?.latitude || center.latitude, longitude: item.location?.longitude || center.longitude },
              center
            );

            // If user specified a sub-locality (e.g. Pratap Nagar), REJECT any hotel beyond 4.5 km (e.g. Amer, Bhakrota, Niwaru, Jhotwara)
            if (isSubLocality && distMeters > 4500) {
              // Only allow if address explicitly mentions the locality or key corridor
              const matchesArea = addr.includes(areaName.toLowerCase()) || addr.includes('tonk rd') || addr.includes('sanganer') || addr.includes('sitapura') || addr.includes('haldighati');
              if (!matchesArea) {
                continue;
              }
            }

            const isExactLocal = addr.includes(areaName.toLowerCase()) || hotelName.includes(areaName.toLowerCase()) || distMeters <= 1200;
            const distKm = (distMeters / 1000).toFixed(1);

            validLiveHotels.push({
              id: `hotel_${item.id}`,
              name: item.displayName?.text || 'Recommended Hotel',
              placeId: item.id,
              address: item.formattedAddress || `Central ${location}`,
              latitude: item.location?.latitude || center.latitude,
              longitude: item.location?.longitude || center.longitude,
              rating: item.rating || 4.6,
              priceLevel: 'Moderate Boutique',
              mapsUrl: item.googleMapsUri,
              isOrigin: validLiveHotels.length === 0,
              localityBadge: isExactLocal ? `📍 In ${areaName}` : `🚗 ${distKm} km away`,
              proximity: isExactLocal ? 'Within locality' : `${distKm} km away`,
            });
          }
        }
      } catch (err: any) {
        logger.warn('Live hotel search error:', err.message);
      }
    }

    // Curated local stays guaranteed in the exact area
    const curatedHotels = destData.hotels;

    // Combine curated local hotels and valid live hotels within radius
    const finalHotels: Hotel[] = [...curatedHotels];
    for (const lh of validLiveHotels) {
      if (!finalHotels.some((fh) => fh.name.toLowerCase() === lh.name.toLowerCase() || (fh.placeId && fh.placeId === lh.placeId))) {
        finalHotels.push(lh);
      }
    }

    // Set first hotel as origin stay
    if (finalHotels.length > 0) {
      finalHotels[0].isOrigin = true;
    }

    apiCache.set(cacheKey, finalHotels, 3600);
    return finalHotels;
  },
};
