import axios from 'axios';
import { logger } from '../../utils/logger.js';
import { apiCache } from '../../utils/cache.js';

export interface GeocodeResult {
  locality?: string;
  suburb?: string;
  city: string;
  state?: string;
  country: string;
  formattedName: string;
  latitude: number;
  longitude: number;
}

export interface LocationSuggestion {
  name: string;
  subTitle: string;
  city: string;
  area?: string;
  latitude?: number;
  longitude?: number;
}

export const geocodingService = {
  /**
   * Dynamically reverse geocodes latitude/longitude coordinates into real-world localities and cities
   */
  async reverseGeocode(latitude: number, longitude: number): Promise<GeocodeResult> {
    const cacheKey = `reverse_geo:${latitude.toFixed(4)}:${longitude.toFixed(4)}`;
    const cached = apiCache.get<GeocodeResult>(cacheKey);
    if (cached) return cached;

    try {
      // Live dynamic reverse geocode via OpenStreetMap Nominatim
      const response = await axios.get('https://nominatim.openstreetmap.org/reverse', {
        params: {
          format: 'json',
          lat: latitude,
          lon: longitude,
          zoom: 18,
          addressdetails: 1,
        },
        headers: {
          'User-Agent': 'TakeMeThereAI-LiveGeocoding/2.0',
        },
        timeout: 6000,
      });

      if (response.data && response.data.address) {
        const addr = response.data.address;
        const locality =
          addr.suburb ||
          addr.neighbourhood ||
          addr.residential ||
          addr.quarter ||
          addr.road ||
          addr.village ||
          '';

        const city =
          addr.city ||
          addr.town ||
          addr.municipality ||
          addr.city_district ||
          addr.county ||
          addr.state_district ||
          addr.state ||
          'Unknown Location';

        const state = addr.state || '';
        const country = addr.country || '';

        let formattedName = '';
        if (locality && city && locality.toLowerCase() !== city.toLowerCase()) {
          formattedName = `${locality}, ${city}`;
        } else if (city && state && city.toLowerCase() !== state.toLowerCase()) {
          formattedName = `${city}, ${state}`;
        } else {
          formattedName = city || `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
        }

        const result: GeocodeResult = {
          locality,
          suburb: addr.suburb || locality,
          city,
          state,
          country,
          formattedName,
          latitude,
          longitude,
        };

        apiCache.set(cacheKey, result, 86400);
        return result;
      }
    } catch (err: any) {
      logger.warn('Live reverse geocode failed:', err.message);
    }

    // Dynamic coordinate-based result if network lookup is unavailable
    const fallbackFormatted = `Location (${latitude.toFixed(3)}, ${longitude.toFixed(3)})`;
    return {
      city: 'Custom Location',
      locality: 'Current Area',
      country: '',
      formattedName: fallbackFormatted,
      latitude,
      longitude,
    };
  },

  /**
   * Dynamically searches live location suggestions across the globe using live geocoding
   */
  async autocomplete(query: string): Promise<LocationSuggestion[]> {
    if (!query || query.trim().length < 2) {
      return [];
    }

    const cleanQuery = query.trim();
    const cacheKey = `autocomplete_live:${cleanQuery.toLowerCase()}`;
    const cached = apiCache.get<LocationSuggestion[]>(cacheKey);
    if (cached) return cached;

    try {
      const response = await axios.get('https://nominatim.openstreetmap.org/search', {
        params: {
          q: cleanQuery,
          format: 'json',
          addressdetails: 1,
          limit: 8,
        },
        headers: {
          'User-Agent': 'TakeMeThereAI-LiveGeocoding/2.0',
        },
        timeout: 5000,
      });

      if (response.data && Array.isArray(response.data)) {
        const suggestions: LocationSuggestion[] = [];

        for (const item of response.data) {
          const addr = item.address || {};
          const locality =
            addr.suburb ||
            addr.neighbourhood ||
            addr.residential ||
            addr.quarter ||
            addr.road ||
            addr.village ||
            '';

          const city =
            addr.city ||
            addr.town ||
            addr.municipality ||
            addr.city_district ||
            addr.county ||
            addr.state_district ||
            addr.state ||
            cleanQuery;

          const state = addr.state || '';
          const country = addr.country || '';

          let displayName = '';
          if (locality && city && locality.toLowerCase() !== city.toLowerCase()) {
            displayName = `${locality}, ${city}`;
          } else if (city && state && city.toLowerCase() !== state.toLowerCase()) {
            displayName = `${city}, ${state}`;
          } else {
            displayName = city || item.display_name.split(',')[0];
          }

          const subParts = [state, country].filter(Boolean);
          const subTitle = item.display_name || subParts.join(', ');

          const lat = parseFloat(item.lat);
          const lon = parseFloat(item.lon);

          if (!suggestions.some((s) => s.name.toLowerCase() === displayName.toLowerCase())) {
            suggestions.push({
              name: displayName,
              subTitle,
              city,
              area: locality,
              latitude: isNaN(lat) ? undefined : lat,
              longitude: isNaN(lon) ? undefined : lon,
            });
          }
        }

        apiCache.set(cacheKey, suggestions, 3600);
        return suggestions;
      }
    } catch (err: any) {
      logger.warn('Live autocomplete search error:', err.message);
    }

    return [];
  },
};
