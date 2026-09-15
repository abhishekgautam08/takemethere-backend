import { Router } from 'express';
import { paymentController } from '../controllers/payment.controller.js';
import { requireAuth } from '../middleware/auth.middleware.js';

export const paymentRouter = Router();

paymentRouter.post('/create-order', requireAuth, paymentController.createOrder);
paymentRouter.post('/verify', requireAuth, paymentController.verifyPayment);
