import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import crypto from 'crypto';
import Razorpay from 'razorpay';
import { UserRepository } from '../models/User.model.js';
import { env } from '../config/env.js';

// Initialize Razorpay instance
const razorpay = new Razorpay({
  key_id: env.RAZORPAY_KEY_ID,
  key_secret: env.RAZORPAY_KEY_SECRET,
});

const COST_PER_CREDIT_INR = 50; // ₹50 per itinerary credit

const CreateOrderSchema = z.object({
  credits: z.number().int().positive().default(1),
});

const VerifyPaymentSchema = z.object({
  razorpay_order_id: z.string().min(1),
  razorpay_payment_id: z.string().min(1),
  razorpay_signature: z.string().min(1),
  credits: z.number().int().positive().default(1),
});

export const paymentController = {
  /**
   * Create a Razorpay order.
   * POST /api/payment/create-order
   */
  async createOrder(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, error: 'Not authenticated' });
        return;
      }

      if (!env.RAZORPAY_KEY_ID || !env.RAZORPAY_KEY_SECRET) {
        res.status(500).json({
          success: false,
          error: 'Payment gateway is not configured. Please contact support.',
        });
        return;
      }

      const parsed = CreateOrderSchema.parse(req.body);
      const credits = parsed.credits;
      const amountInPaise = credits * COST_PER_CREDIT_INR * 100; // Razorpay expects paise

      const order = await razorpay.orders.create({
        amount: amountInPaise,
        currency: 'INR',
        receipt: `rcpt_${req.user.id}_${Date.now()}`,
        notes: {
          userId: req.user.id,
          credits: credits.toString(),
          userEmail: req.user.email,
        },
      });

      res.status(201).json({
        success: true,
        data: {
          orderId: order.id,
          amount: amountInPaise,
          currency: 'INR',
          keyId: env.RAZORPAY_KEY_ID,
          credits,
          amountDisplay: credits * COST_PER_CREDIT_INR,
        },
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Verify Razorpay payment signature and add credits.
   * POST /api/payment/verify
   */
  async verifyPayment(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, error: 'Not authenticated' });
        return;
      }

      const parsed = VerifyPaymentSchema.parse(req.body);

      // Verify signature using HMAC SHA256
      const generatedSignature = crypto
        .createHmac('sha256', env.RAZORPAY_KEY_SECRET)
        .update(`${parsed.razorpay_order_id}|${parsed.razorpay_payment_id}`)
        .digest('hex');

      if (generatedSignature !== parsed.razorpay_signature) {
        res.status(400).json({
          success: false,
          error: 'Payment verification failed. Invalid signature.',
        });
        return;
      }

      // Signature verified — add credits to the user
      const credits = parsed.credits;
      const updatedUser = await UserRepository.addCredits(req.user.id, credits);
      if (!updatedUser) {
        res.status(404).json({ success: false, error: 'User not found' });
        return;
      }

      const amountPaid = credits * COST_PER_CREDIT_INR;

      res.status(200).json({
        success: true,
        data: {
          transactionId: parsed.razorpay_payment_id,
          razorpayOrderId: parsed.razorpay_order_id,
          creditsAdded: credits,
          totalCredits: updatedUser.paidCredits || 0,
          amountPaid,
          currency: 'INR',
          paymentMethod: 'razorpay',
          timestamp: new Date().toISOString(),
          message: `Successfully purchased ${credits} itinerary credit(s) for ₹${amountPaid}.`,
        },
      });
    } catch (error) {
      next(error);
    }
  },
};
