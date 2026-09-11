import { z } from 'zod';

export const CoordinatesSchema = z.object({
  latitude: z.number(),
  longitude: z.number(),
});

export const BudgetLevelSchema = z.enum(['budget', 'moderate', 'premium']);
export const TransportModeSchema = z.enum(['bike', 'car', 'cab', 'public', 'walking', 'ai']);
export const PaceSchema = z.enum(['relaxed', 'balanced', 'packed']);

export const TripPreferencesSchema = z.object({
  interests: z.array(z.string()).min(1, 'Select at least one interest'),
  budget: BudgetLevelSchema.optional(),
  transport: TransportModeSchema.default('bike'),
  pace: PaceSchema.default('balanced'),
  customPrompt: z.string().optional(),
  hotelBooked: z.boolean().optional(),
  hotelLocation: z.string().optional(),
  userLocation: z
    .object({
      latitude: z.number(),
      longitude: z.number(),
      area: z.string().optional(),
      city: z.string().optional(),
    })
    .optional(),
});

export const TravelSegmentSchema = z.object({
  distanceMeters: z.number(),
  durationSeconds: z.number(),
  mode: TransportModeSchema,
  polyline: z.string().optional(),
  instructions: z.string().optional(),
  distanceFormatted: z.string().optional(),
  durationFormatted: z.string().optional(),
});

export const ActivitySchema = z.object({
  id: z.string(),
  title: z.string(),
  type: z.enum([
    'attraction',
    'food',
    'transport',
    'rental',
    'hotel',
    'leisure',
    'shopping',
    'photography',
    'cultural',
    'restaurant',
    'transit',
    'custom',
  ]),
  placeId: z.string().optional(),
  latitude: z.number(),
  longitude: z.number(),
  address: z.string().optional(),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
  openingHours: z.string().optional(),
  suggestedDuration: z.string().optional(),
  estimatedDurationMinutes: z.number().positive(),
  description: z.string(),
  rating: z.number().min(0).max(5).optional(),
  priceLevel: z.number().optional(),
  photoUrl: z.string().optional(),
  photos: z.array(z.string()).optional(),
  tips: z.string().optional(),
  mapsUrl: z.string().optional(),
  travelFromPrevious: TravelSegmentSchema.optional(),
  isCustomMatch: z.boolean().optional(),
  customTag: z.string().optional(),
});

export const MealRecommendationSchema = z.object({
  mealType: z.enum(['breakfast', 'lunch', 'dinner', 'snack']),
  time: z.string(),
  restaurantName: z.string(),
  cuisine: z.string().optional(),
  placeId: z.string().optional(),
  latitude: z.number(),
  longitude: z.number(),
  address: z.string().optional(),
  rating: z.number().optional(),
  priceLevel: z.string().optional(),
  mapsUrl: z.string().optional(),
  recommendedFor: z.string().optional(),
});

export const DayPlanSchema = z.object({
  day: z.number().int().positive(),
  title: z.string(),
  date: z.string().optional(),
  theme: z.string().optional(),
  activities: z.array(ActivitySchema),
  meals: z.array(MealRecommendationSchema).optional(),
  notes: z.array(z.string()).optional(),
  totalDistanceMeters: z.number().optional(),
  totalDurationSeconds: z.number().optional(),
});

export const DestinationSchema = z.object({
  name: z.string().min(1),
  country: z.string().optional(),
  placeId: z.string().optional(),
  latitude: z.number(),
  longitude: z.number(),
  coverImage: z.string().optional(),
  tagline: z.string().optional(),
  popularInterests: z.array(z.string()).optional(),
});

export const CreateTripInputSchema = z.object({
  destination: z.string().min(1, 'Destination is required'),
  duration: z.number().int().min(1).max(30).default(3),
  preferences: TripPreferencesSchema,
  startDate: z.string().optional(),
});

export const ModifyActivityInputSchema = z.object({
  activityId: z.string(),
  day: z.number().int().positive(),
  action: z.enum(['replace', 'remove', 'move', 'custom_prompt']),
  prompt: z.string().optional(),
  targetCategory: z.string().optional(),
});

export const AgentMessageInputSchema = z.object({
  message: z.string().min(1),
  tripId: z.string().optional(),
  quickResponseKey: z.string().optional(),
});

export const OptimizeTripInputSchema = z.object({
  tripId: z.string(),
  focus: z.enum(['minimize_travel', 'balance_pace', 'scenic_route']).default('minimize_travel'),
});
