import mongoose, { Schema } from 'mongoose';
import { Trip } from '../types/index.js';
import { isDbConnected } from '../config/database.js';

export interface TripDocument extends Omit<Trip, 'id'> {
  _id: string;
  id: string;
}

const TripSchema = new Schema(
  {
    _id: { type: String, required: true },
    id: { type: String, required: true },
    destination: {
      name: { type: String, required: true },
      country: String,
      placeId: String,
      latitude: { type: Number, required: true },
      longitude: { type: Number, required: true },
      coverImage: String,
      tagline: String,
      popularInterests: [String],
    },
    duration: { type: Number, required: true, default: 3 },
    startDate: String,
    endDate: String,
    preferences: {
      interests: { type: [String], default: [] },
      budget: { type: String, enum: ['budget', 'moderate', 'premium'], default: 'moderate' },
      transport: { type: String, enum: ['bike', 'car', 'cab', 'public', 'walking', 'ai'], default: 'bike' },
      pace: { type: String, enum: ['relaxed', 'balanced', 'packed'], default: 'balanced' },
      hotelBooked: Boolean,
      hotelLocation: String,
      customPrompt: String,
    },
    hotel: {
      id: String,
      name: String,
      placeId: String,
      address: String,
      latitude: Number,
      longitude: Number,
      rating: Number,
      priceLevel: String,
      mapsUrl: String,
      isOrigin: Boolean,
    },
    hotels: { type: Array, default: [] },
    restaurants: { type: Array, default: [] },
    bikeRentals: { type: Array, default: [] },
    carRentals: { type: Array, default: [] },
    publicTransit: { type: Object },
    itinerary: { type: Array, default: [] },
    budget: {
      accommodationPerDay: Number,
      foodPerDay: Number,
      transportPerDay: Number,
      activitiesPerDay: Number,
      miscellaneousPerDay: Number,
      totalPerDay: Number,
      grandTotal: Number,
      currency: String,
      currencySymbol: String,
      isEstimated: Boolean,
    },
    status: {
      type: String,
      enum: ['planning', 'generating', 'ready', 'error'],
      default: 'planning',
    },
    userId: { type: String, index: true },
    userEmail: { type: String },
    userName: { type: String },
  },
  {
    timestamps: true,
  }
);

export const MongooseTripModel = mongoose.model<TripDocument>('Trip', TripSchema);

// In-Memory Storage for graceful fallback
const inMemoryTrips = new Map<string, Trip>();

export const TripRepository = {
  async findById(id: string): Promise<Trip | null> {
    if (isDbConnected()) {
      try {
        const doc = await MongooseTripModel.findById(id).lean();
        if (!doc) return null;
        return { ...doc, id: (doc as any)._id.toString() } as unknown as Trip;
      } catch {
        return inMemoryTrips.get(id) || null;
      }
    }
    return inMemoryTrips.get(id) || null;
  },

  async findAll(filter?: { userId?: string }): Promise<Trip[]> {
    const query: Record<string, any> = {};
    if (filter?.userId) {
      query.userId = filter.userId;
    }

    if (isDbConnected()) {
      try {
        const docs = await MongooseTripModel.find(query).sort({ updatedAt: -1 }).lean();
        return docs.map((doc) => ({ ...doc, id: (doc as any)._id.toString() } as unknown as Trip));
      } catch {
        // fallback
      }
    }

    let trips = Array.from(inMemoryTrips.values());
    if (filter?.userId) {
      trips = trips.filter((t) => t.userId === filter.userId);
    }
    return trips.sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
  },

  async count(filter?: { userId?: string }): Promise<number> {
    if (isDbConnected()) {
      try {
        const query = filter?.userId ? { userId: filter.userId } : {};
        return await MongooseTripModel.countDocuments(query);
      } catch {
        // fallback
      }
    }
    if (filter?.userId) {
      return Array.from(inMemoryTrips.values()).filter((t) => t.userId === filter.userId).length;
    }
    return inMemoryTrips.size;
  },

  async create(tripData: Partial<Trip>): Promise<Trip> {
    const id = tripData.id || `trip_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const now = new Date().toISOString();
    const trip: Trip = {
      id,
      destination: tripData.destination || {
        name: 'Jaipur',
        latitude: 26.9124,
        longitude: 75.7873,
      },
      duration: tripData.duration || 3,
      startDate: tripData.startDate,
      endDate: tripData.endDate,
      preferences: tripData.preferences || {
        interests: ['History', 'Food'],
        budget: 'moderate',
        transport: 'bike',
        pace: 'balanced',
      },
      hotel: tripData.hotel,
      hotels: tripData.hotels || [],
      restaurants: tripData.restaurants || [],
      bikeRentals: tripData.bikeRentals || [],
      carRentals: tripData.carRentals || [],
      publicTransit: tripData.publicTransit,
      itinerary: tripData.itinerary || [],
      budget: tripData.budget,
      status: tripData.status || 'planning',
      userId: tripData.userId,
      userEmail: tripData.userEmail,
      userName: tripData.userName,
      createdAt: now,
      updatedAt: now,
    };

    if (isDbConnected()) {
      try {
        const created = await MongooseTripModel.create({
          ...trip,
          _id: trip.id,
          id: trip.id,
        });
        return created.toObject() as unknown as Trip;
      } catch {
        inMemoryTrips.set(id, trip);
        return trip;
      }
    }

    inMemoryTrips.set(id, trip);
    return trip;
  },

  async update(id: string, updates: Partial<Trip>): Promise<Trip | null> {
    const now = new Date().toISOString();

    if (isDbConnected()) {
      try {
        const updated = await MongooseTripModel.findByIdAndUpdate(
          id,
          { ...updates, updatedAt: now },
          { new: true }
        ).lean();
        if (updated) {
          return { ...updated, id: (updated as any)._id.toString() } as unknown as Trip;
        }
      } catch {
        // fallback to memory
      }
    }

    const existing = inMemoryTrips.get(id);
    if (!existing) return null;

    const merged: Trip = {
      ...existing,
      ...updates,
      updatedAt: now,
    };
    inMemoryTrips.set(id, merged);
    return merged;
  },

  async delete(id: string): Promise<boolean> {
    if (isDbConnected()) {
      try {
        await MongooseTripModel.findByIdAndDelete(id);
      } catch {
        // ignore
      }
    }
    return inMemoryTrips.delete(id);
  },

  async countByUserId(userId: string): Promise<number> {
    if (isDbConnected()) {
      try {
        return await MongooseTripModel.countDocuments({ userId });
      } catch {
        // fallback
      }
    }
    return Array.from(inMemoryTrips.values()).filter((t) => t.userId === userId).length;
  },
};

