export type BudgetLevel = 'budget' | 'moderate' | 'premium';
export type TransportMode = 'bike' | 'car' | 'cab' | 'public' | 'walking' | 'ai';
export type Pace = 'relaxed' | 'balanced' | 'packed';
export type ActivityType = 'attraction' | 'restaurant' | 'hotel' | 'rental' | 'transit' | 'custom';

export interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface Place {
  placeId?: string;
  name: string;
  category?: string;
  description?: string;
  address?: string;
  latitude: number;
  longitude: number;
  rating?: number;
  userRatingsTotal?: number;
  priceLevel?: number;
  photoUrl?: string;
  photos?: string[];
  openingHours?: string | string[];
  isOpenNow?: boolean;
  website?: string;
  phoneNumber?: string;
  mapsUrl?: string;
  estimatedVisitMinutes?: number;
}

export interface TravelSegment {
  distanceMeters: number;
  durationSeconds: number;
  mode: TransportMode;
  polyline?: string;
  instructions?: string;
  distanceFormatted?: string;
  durationFormatted?: string;
}

export interface Activity {
  id: string;
  title: string;
  type: ActivityType;
  placeId?: string;
  latitude: number;
  longitude: number;
  address?: string;
  startTime?: string;   // optional
  endTime?: string;     // optional
  openingHours?: string; // e.g. "09:00 AM - 06:00 PM"
  suggestedDuration?: string; // e.g. "1.5 - 2 Hours"
  estimatedDurationMinutes: number;
  description: string;
  rating?: number;
  priceLevel?: number;
  photoUrl?: string;
  photos?: string[];
  tips?: string;
  mapsUrl?: string;
  travelFromPrevious?: TravelSegment;
  isCustomMatch?: boolean;
  customTag?: string;
}

export interface Restaurant {
  id: string;
  name: string;
  placeId?: string;
  latitude: number;
  longitude: number;
  address?: string;
  rating?: number;
  priceLevel?: string;
  cuisine?: string;
  photoUrl?: string;
  mealType?: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  recommendedDish?: string;
  localityBadge?: string;
  proximity?: string;
}

export interface MealRecommendation {
  mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  time: string;
  restaurantName: string;
  cuisine?: string;
  placeId?: string;
  latitude: number;
  longitude: number;
  address?: string;
  rating?: number;
  priceLevel?: string;
  mapsUrl?: string;
  recommendedFor?: string;
}

export interface DayPlan {
  day: number;
  title: string;
  date?: string;
  theme?: string;
  activities: Activity[];
  meals?: MealRecommendation[];
  notes?: string[];
  totalDistanceMeters?: number;
  totalDurationSeconds?: number;
}

export interface BikeRental {
  id: string;
  name: string;
  placeId?: string;
  address: string;
  latitude: number;
  longitude: number;
  rating?: number;
  phone?: string;
  mapsUrl?: string;
  website?: string;
  typesAvailable?: string[];
  localityBadge?: string;
  proximity?: string;
}

export interface CarRental {
  id: string;
  name: string;
  placeId?: string;
  address: string;
  latitude: number;
  longitude: number;
  rating?: number;
  phone?: string;
  mapsUrl?: string;
  website?: string;
  typesAvailable?: string[];
  localityBadge?: string;
  proximity?: string;
}

export interface PublicTransitLine {
  routeNumber: string;
  name: string;
  from: string;
  to: string;
  type: 'bus' | 'metro' | 'local_train' | 'tram';
  frequency?: string;
}

export interface PublicTransitInfo {
  destination: string;
  transitSummary: string;
  metroLines?: string[];
  popularBuses?: PublicTransitLine[];
  tips?: string[];
  areaServed?: string;
}

export interface Hotel {
  id: string;
  name: string;
  placeId?: string;
  address: string;
  latitude: number;
  longitude: number;
  rating?: number;
  priceLevel?: string;
  mapsUrl?: string;
  isOrigin?: boolean;
  localityBadge?: string;
  proximity?: string;
}

export interface BudgetBreakdown {
  accommodationPerDay: number;
  foodPerDay: number;
  transportPerDay: number;
  activitiesPerDay: number;
  miscellaneousPerDay: number;
  totalPerDay: number;
  grandTotal: number;
  currency: string;
  currencySymbol: string;
  isEstimated: boolean;
}

export interface TripPreferences {
  interests: string[];
  budget?: BudgetLevel;
  transport: TransportMode;
  pace: Pace;
  customPrompt?: string;
  hotelBooked?: boolean;
  hotelLocation?: string;
  userLocation?: {
    latitude: number;
    longitude: number;
    area?: string;
    city?: string;
  };
}

export interface Destination {
  name: string;
  country?: string;
  placeId?: string;
  latitude: number;
  longitude: number;
  coverImage?: string;
  tagline?: string;
  popularInterests?: string[];
  areaName?: string;
  parentCity?: string;
  isLocalizedArea?: boolean;
}

export type TripStatus = 'planning' | 'generating' | 'ready' | 'error';

export interface Trip {
  id: string;
  destination: Destination;
  duration: number; // in days
  startDate?: string;
  endDate?: string;
  preferences: TripPreferences;
  hotel?: Hotel;
  hotels?: Hotel[];
  restaurants?: Restaurant[];
  bikeRentals?: BikeRental[];
  carRentals?: CarRental[];
  publicTransit?: PublicTransitInfo;
  itinerary: DayPlan[];
  budget?: BudgetBreakdown;
  status: TripStatus;
  userId?: string;
  userEmail?: string;
  userName?: string;
  createdAt: string;
  updatedAt: string;
}
