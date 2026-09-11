import { Router } from 'express';
import { authController } from '../controllers/auth.controller.js';
import { requireAuth, requireAdmin } from '../middleware/auth.middleware.js';

export const authRouter = Router();

authRouter.post('/register', authController.register);
authRouter.post('/login', authController.login);
authRouter.post('/logout', authController.logout);
authRouter.get('/me', requireAuth, authController.getMe);

authRouter.get('/usage', requireAuth, authController.getUsage);
authRouter.post('/purchase-credit', requireAuth, authController.purchaseCredit);
authRouter.get('/users', requireAuth, requireAdmin, authController.listUsers);
authRouter.get('/stats', requireAuth, requireAdmin, authController.getAdminStats);

