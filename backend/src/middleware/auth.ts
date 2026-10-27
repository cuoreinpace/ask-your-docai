import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config/index.js';

export interface AuthenticatedRequest extends Request {
  user: {
    id: string;
    role: string;
    identityLevel: string;
  };
}

export function authenticate(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ code: 'UNAUTHORIZED', message: 'Missing or invalid authorization header' });
    return;
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, config.jwtSecret) as { sub: string; role: string; identityLevel: string };
    req.user = {
      id: decoded.sub,
      role: decoded.role,
      identityLevel: decoded.identityLevel,
    };
    next();
  } catch {
    res.status(401).json({ code: 'UNAUTHORIZED', message: 'Invalid or expired token' });
  }
}

export function requireRole(...roles: string[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user || !roles.includes(req.user.role)) {
      res.status(403).json({ code: 'FORBIDDEN', message: 'Insufficient permissions' });
      return;
    }
    next();
  };
}

export function requireStrongAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  if (req.user.identityLevel !== 'STRONG') {
    res.status(403).json({ code: 'INSUFFICIENT_AUTH', message: 'Strong authentication required' });
    return;
  }
  next();
}