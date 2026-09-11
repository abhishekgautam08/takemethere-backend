import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../models/User.model.js';
import { AuthUser } from '../types/user.js';

// Extend Express Request interface
declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  // Try cookie first, then Authorization header
  let token: string | undefined;

  if (req.cookies?.takemethere_token) {
    token = req.cookies.takemethere_token;
  } else {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    }
  }

  if (!token) {
    res.status(401).json({
      success: false,
      error: 'Authentication required. Please sign in to continue.',
    });
    return;
  }

  const user = verifyToken(token);

  if (!user) {
    res.status(401).json({
      success: false,
      error: 'Invalid or expired authentication session. Please sign in again.',
    });
    return;
  }

  req.user = user;
  next();
}


export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({
      success: false,
      error: 'Authentication required.',
    });
    return;
  }

  if (req.user.role !== 'admin') {
    res.status(403).json({
      success: false,
      error: 'Access denied. Administrator privileges required.',
    });
    return;
  }

  next();
}

export function optionalAuth(req: Request, res: Response, next: NextFunction): void {
  let token: string | undefined;

  if (req.cookies?.takemethere_token) {
    token = req.cookies.takemethere_token;
  } else {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    }
  }

  if (token) {
    const user = verifyToken(token);
    if (user) {
      req.user = user;
    }
  }

  next();
}

