import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import {
  UserRepository,
  hashPassword,
  comparePassword,
  generateToken,
} from '../models/User.model.js';
import { TripRepository } from '../models/Trip.model.js';
import { env } from '../config/env.js';

const COOKIE_NAME = 'takemethere_token';

function setTokenCookie(res: Response, token: string) {
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure: env.IS_PRODUCTION,
    sameSite: env.IS_PRODUCTION ? 'none' : 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    path: '/',
  });
}

function clearTokenCookie(res: Response) {
  res.clearCookie(COOKIE_NAME, {
    httpOnly: true,
    secure: env.IS_PRODUCTION,
    sameSite: env.IS_PRODUCTION ? 'none' : 'lax',
    path: '/',
  });
}

const RegisterSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  role: z.enum(['user', 'admin']).optional(),
  adminSecret: z.string().optional(),
});

const LoginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

export const authController = {
  async register(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = RegisterSchema.parse(req.body);

      // Check if email already registered
      const existing = await UserRepository.findByEmail(parsed.email);
      if (existing) {
        res.status(409).json({
          success: false,
          error: 'An account with this email address already exists. Please log in.',
        });
        return;
      }

      let role: 'user' | 'admin' = 'user';
      if (parsed.role === 'admin') {
        const adminExists = await UserRepository.hasAdmin();
        if (adminExists) {
          res.status(403).json({
            success: false,
            error: 'System limit reached: Only one platform administrator is permitted.',
          });
          return;
        }

        if (!parsed.adminSecret || parsed.adminSecret !== env.ADMIN_SECRET) {
          res.status(403).json({
            success: false,
            error: 'Invalid Admin Passcode. Please provide the authorized admin passcode to register as Administrator.',
          });
          return;
        }
        role = 'admin';
      }

      const hashedPassword = await hashPassword(parsed.password);

      const created = await UserRepository.create({
        name: parsed.name,
        email: parsed.email,
        password: hashedPassword,
        role,
      });

      const authUser = {
        id: created.id,
        name: created.name,
        email: created.email,
        role: created.role,
        paidCredits: created.paidCredits || 0,
      };

      const token = generateToken(authUser);
      setTokenCookie(res, token);

      res.status(201).json({
        success: true,
        data: {
          user: authUser,
          token,
        },
      });
    } catch (error) {
      next(error);
    }
  },

  async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = LoginSchema.parse(req.body);

      const user = await UserRepository.findByEmail(parsed.email);
      if (!user) {
        res.status(401).json({
          success: false,
          error: 'Invalid email or password. Please try again.',
        });
        return;
      }

      const isMatch = await comparePassword(parsed.password, user.password);
      if (!isMatch) {
        res.status(401).json({
          success: false,
          error: 'Invalid email or password. Please try again.',
        });
        return;
      }

      const authUser = {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        paidCredits: user.paidCredits || 0,
      };

      const token = generateToken(authUser);
      setTokenCookie(res, token);

      res.json({
        success: true,
        data: {
          user: authUser,
          token,
        },
      });
    } catch (error) {
      next(error);
    }
  },

  async getMe(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, error: 'Not authenticated' });
        return;
      }

      const user = await UserRepository.findById(req.user.id);
      if (!user) {
        res.status(404).json({ success: false, error: 'User not found' });
        return;
      }

      res.json({
        success: true,
        data: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          paidCredits: user.paidCredits || 0,
        },
      });
    } catch (error) {
      next(error);
    }
  },

  async getUsage(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, error: 'Not authenticated' });
        return;
      }

      const user = await UserRepository.findById(req.user.id);
      if (!user) {
        res.status(404).json({ success: false, error: 'User not found' });
        return;
      }

      const totalTrips = await TripRepository.countByUserId(user.id);
      const freeLimit = 2;
      const freeRemaining = Math.max(0, freeLimit - totalTrips);
      const paidCredits = user.paidCredits || 0;
      const canGenerate = user.role === 'admin' || freeRemaining > 0 || paidCredits > 0;

      res.json({
        success: true,
        data: {
          userId: user.id,
          role: user.role,
          totalTrips,
          freeLimit,
          freeRemaining,
          paidCredits,
          costPerItinerary: 50,
          currency: 'INR',
          canGenerate,
        },
      });
    } catch (error) {
      next(error);
    }
  },

  async purchaseCredit(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, error: 'Not authenticated' });
        return;
      }

      const PurchaseSchema = z.object({
        credits: z.number().int().positive().default(1),
        paymentMethod: z.string().optional().default('upi'),
      });

      const parsed = PurchaseSchema.parse(req.body);
      const credits = parsed.credits || 1;
      const amountPaid = credits * 50;

      const updatedUser = await UserRepository.addCredits(req.user.id, credits);
      if (!updatedUser) {
        res.status(404).json({ success: false, error: 'User not found' });
        return;
      }

      const txnId = `TXN_INR_${Date.now()}_${Math.random().toString(36).substring(2, 7).toUpperCase()}`;

      res.status(200).json({
        success: true,
        data: {
          transactionId: txnId,
          creditsAdded: credits,
          totalCredits: updatedUser.paidCredits || 0,
          amountPaid,
          currency: 'INR',
          paymentMethod: parsed.paymentMethod,
          timestamp: new Date().toISOString(),
          message: `Successfully purchased ${credits} itinerary credit(s) for ₹${amountPaid}.`,
        },
      });
    } catch (error) {
      next(error);
    }
  },

  async listUsers(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const users = await UserRepository.findAll();
      const allTrips = await TripRepository.findAll();

      // Aggregate trip count per user
      const usersWithStats = users.map((u) => {
        const userTrips = allTrips.filter((t) => t.userId === u.id);
        return {
          ...u,
          tripCount: userTrips.length,
          lastActive: userTrips[0]?.updatedAt || u.createdAt,
        };
      });

      res.json({
        success: true,
        data: usersWithStats,
      });
    } catch (error) {
      next(error);
    }
  },

  async getAdminStats(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const totalUsers = await UserRepository.count();
      const adminCount = await UserRepository.countAdmins();
      const allTrips = await TripRepository.findAll();

      let totalActivities = 0;
      allTrips.forEach((t) => {
        t.itinerary?.forEach((day) => {
          totalActivities += day.activities?.length || 0;
        });
      });

      // Calculate paid trips beyond free 2 trips per user
      const userTripCounts = new Map<string, number>();
      allTrips.forEach((t) => {
        if (t.userId) {
          userTripCounts.set(t.userId, (userTripCounts.get(t.userId) || 0) + 1);
        }
      });

      let totalPaidTrips = 0;
      userTripCounts.forEach((count) => {
        if (count > 2) {
          totalPaidTrips += count - 2;
        }
      });
      const estimatedRevenue = totalPaidTrips * 50;

      res.json({
        success: true,
        data: {
          totalUsers,
          adminCount,
          isSingleAdminEnforced: adminCount <= 1,
          totalTrips: allTrips.length,
          totalActivities,
          totalPaidTrips,
          estimatedRevenue,
          currency: 'INR',
          recentTrips: allTrips.slice(0, 10),
        },
      });
    } catch (error) {
      next(error);
    }
  },

  async logout(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      clearTokenCookie(res);
      res.json({ success: true, data: { message: 'Logged out successfully' } });
    } catch (error) {
      next(error);
    }
  },
};
