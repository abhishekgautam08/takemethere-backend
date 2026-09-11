import mongoose, { Schema } from 'mongoose';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { User, AuthUser, UserRole } from '../types/user.js';
import { isDbConnected } from '../config/database.js';
import { env } from '../config/env.js';

export interface UserDocument extends Omit<User, 'id'> {
  _id: string;
  id: string;
}

const UserSchema = new Schema(
  {
    _id: { type: String, required: true },
    id: { type: String, required: true, unique: true },
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true },
    role: { type: String, enum: ['user', 'admin'], default: 'user' },
    paidCredits: { type: Number, default: 0 },
  },
  {
    timestamps: true,
  }
);

export const MongooseUserModel = mongoose.model<UserDocument>('User', UserSchema);

// In-Memory Storage Fallback
const inMemoryUsers = new Map<string, User>();

// Seed a default admin and traveler into in-memory store
const seedDefaultUsers = async () => {
  if (inMemoryUsers.size === 0) {
    const adminHash = await bcrypt.hash('admin123', 10);
    const userHash = await bcrypt.hash('user123', 10);
    const now = new Date().toISOString();

    const defaultAdmin: User = {
      id: 'usr_admin_default',
      name: 'System Administrator',
      email: 'admin@takemethere.com',
      password: adminHash,
      role: 'admin',
      paidCredits: 0,
      createdAt: now,
      updatedAt: now,
    };

    const defaultUser: User = {
      id: 'usr_traveler_default',
      name: 'Abhishek Traveler',
      email: 'traveler@takemethere.com',
      password: userHash,
      role: 'user',
      paidCredits: 0,
      createdAt: now,
      updatedAt: now,
    };

    inMemoryUsers.set(defaultAdmin.id, defaultAdmin);
    inMemoryUsers.set(defaultUser.id, defaultUser);
  }
};

// Initial seed
seedDefaultUsers().catch(console.error);

export const UserRepository = {
  async findById(id: string): Promise<User | null> {
    if (isDbConnected()) {
      try {
        const doc = await MongooseUserModel.findById(id).lean();
        if (!doc) return null;
        return {
          id: (doc as any)._id.toString(),
          name: doc.name,
          email: doc.email,
          password: doc.password,
          role: doc.role as UserRole,
          paidCredits: (doc as any).paidCredits || 0,
          createdAt: (doc as any).createdAt?.toISOString() || new Date().toISOString(),
          updatedAt: (doc as any).updatedAt?.toISOString() || new Date().toISOString(),
        };
      } catch {
        return inMemoryUsers.get(id) || null;
      }
    }
    return inMemoryUsers.get(id) || null;
  },

  async findByEmail(email: string): Promise<User | null> {
    const normalized = email.toLowerCase().trim();
    if (isDbConnected()) {
      try {
        const doc = await MongooseUserModel.findOne({ email: normalized }).lean();
        if (!doc) return null;
        return {
          id: (doc as any)._id.toString(),
          name: doc.name,
          email: doc.email,
          password: doc.password,
          role: doc.role as UserRole,
          paidCredits: (doc as any).paidCredits || 0,
          createdAt: (doc as any).createdAt?.toISOString() || new Date().toISOString(),
          updatedAt: (doc as any).updatedAt?.toISOString() || new Date().toISOString(),
        };
      } catch {
        return (
          Array.from(inMemoryUsers.values()).find(
            (u) => u.email.toLowerCase() === normalized
          ) || null
        );
      }
    }
    return (
      Array.from(inMemoryUsers.values()).find(
        (u) => u.email.toLowerCase() === normalized
      ) || null
    );
  },

  async hasAdmin(): Promise<boolean> {
    if (isDbConnected()) {
      try {
        const count = await MongooseUserModel.countDocuments({ role: 'admin' });
        if (count > 0) return true;
      } catch {
        // fallback
      }
    }
    return Array.from(inMemoryUsers.values()).some((u) => u.role === 'admin');
  },

  async countAdmins(): Promise<number> {
    if (isDbConnected()) {
      try {
        return await MongooseUserModel.countDocuments({ role: 'admin' });
      } catch {
        // fallback
      }
    }
    return Array.from(inMemoryUsers.values()).filter((u) => u.role === 'admin').length;
  },

  async create(userData: {
    name: string;
    email: string;
    password: string;
    role?: UserRole;
  }): Promise<User> {
    // Enforce single-admin limit
    if (userData.role === 'admin') {
      const adminExists = await this.hasAdmin();
      if (adminExists) {
        throw new Error('System limit reached: Only one platform administrator is permitted.');
      }
    }

    const id = `usr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const now = new Date().toISOString();
    const newUser: User = {
      id,
      name: userData.name.trim(),
      email: userData.email.toLowerCase().trim(),
      password: userData.password,
      role: userData.role || 'user',
      paidCredits: 0,
      createdAt: now,
      updatedAt: now,
    };

    if (isDbConnected()) {
      try {
        await MongooseUserModel.create({
          ...newUser,
          _id: newUser.id,
          id: newUser.id,
        });
        return newUser;
      } catch (err) {
        inMemoryUsers.set(id, newUser);
        return newUser;
      }
    }

    inMemoryUsers.set(id, newUser);
    return newUser;
  },

  async addCredits(userId: string, credits: number): Promise<User | null> {
    if (isDbConnected()) {
      try {
        const updated = await MongooseUserModel.findByIdAndUpdate(
          userId,
          { $inc: { paidCredits: credits } },
          { new: true }
        ).lean();
        if (updated) {
          return {
            id: (updated as any)._id.toString(),
            name: updated.name,
            email: updated.email,
            password: updated.password,
            role: updated.role as UserRole,
            paidCredits: (updated as any).paidCredits || 0,
            createdAt: (updated as any).createdAt?.toISOString() || new Date().toISOString(),
            updatedAt: (updated as any).updatedAt?.toISOString() || new Date().toISOString(),
          };
        }
      } catch {
        // fallback
      }
    }

    const user = inMemoryUsers.get(userId);
    if (!user) return null;
    user.paidCredits = (user.paidCredits || 0) + credits;
    user.updatedAt = new Date().toISOString();
    inMemoryUsers.set(userId, user);
    return user;
  },

  async deductCredit(userId: string): Promise<User | null> {
    if (isDbConnected()) {
      try {
        const updated = await MongooseUserModel.findByIdAndUpdate(
          userId,
          { $inc: { paidCredits: -1 } },
          { new: true }
        ).lean();
        if (updated) {
          return {
            id: (updated as any)._id.toString(),
            name: updated.name,
            email: updated.email,
            password: updated.password,
            role: updated.role as UserRole,
            paidCredits: Math.max(0, (updated as any).paidCredits || 0),
            createdAt: (updated as any).createdAt?.toISOString() || new Date().toISOString(),
            updatedAt: (updated as any).updatedAt?.toISOString() || new Date().toISOString(),
          };
        }
      } catch {
        // fallback
      }
    }

    const user = inMemoryUsers.get(userId);
    if (!user) return null;
    user.paidCredits = Math.max(0, (user.paidCredits || 0) - 1);
    user.updatedAt = new Date().toISOString();
    inMemoryUsers.set(userId, user);
    return user;
  },

  async findAll(): Promise<AuthUser[]> {
    if (isDbConnected()) {
      try {
        const docs = await MongooseUserModel.find()
          .select('-password')
          .sort({ createdAt: -1 })
          .lean();
        return docs.map((d) => ({
          id: (d as any)._id.toString(),
          name: d.name,
          email: d.email,
          role: d.role as UserRole,
          paidCredits: (d as any).paidCredits || 0,
          createdAt: (d as any).createdAt?.toISOString() || new Date().toISOString(),
          updatedAt: (d as any).updatedAt?.toISOString() || new Date().toISOString(),
        }));
      } catch {
        // fallback
      }
    }

    return Array.from(inMemoryUsers.values()).map((u) => {
      const { password, ...safe } = u;
      return safe;
    });
  },

  async count(): Promise<number> {
    if (isDbConnected()) {
      try {
        return await MongooseUserModel.countDocuments();
      } catch {
        return inMemoryUsers.size;
      }
    }
    return inMemoryUsers.size;
  },
};

// Auth helpers
export async function hashPassword(plain: string): Promise<string> {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(plain, salt);
}

export async function comparePassword(plain: string, hashed: string): Promise<boolean> {
  return bcrypt.compare(plain, hashed);
}

export function generateToken(user: AuthUser): string {
  const payload = {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
  };
  return jwt.sign(payload, env.JWT_SECRET, { expiresIn: '7d' });
}

export function verifyToken(token: string): AuthUser | null {
  try {
    const decoded = jwt.verify(token, env.JWT_SECRET) as any;
    return {
      id: decoded.id,
      email: decoded.email,
      name: decoded.name,
      role: decoded.role,
      createdAt: '',
      updatedAt: '',
    };
  } catch {
    return null;
  }
}
