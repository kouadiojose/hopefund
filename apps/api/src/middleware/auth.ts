import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { AppError } from './error-handler';
import { prisma } from '../lib/prisma';
import { UserRole } from '@prisma/client';

export interface JwtPayload {
  userId: number;
  email: string;
  role: UserRole;
  agenceId?: number;
}

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

export const authenticate = async (
  req: Request,
  _res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AppError('Authentication required', 401);
    }

    const token = authHeader.substring(7);

    const payload = jwt.verify(token, config.jwtSecret) as JwtPayload;

    // Verify user still exists and is active
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { id: true, is_active: true, locked_until: true },
    });

    if (!user || !user.is_active) {
      throw new AppError('User not found or inactive', 401);
    }

    if (user.locked_until && user.locked_until > new Date()) {
      throw new AppError('Account is locked', 423);
    }

    req.user = payload;
    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      next(new AppError('Invalid token', 401));
    } else if (error instanceof jwt.TokenExpiredError) {
      next(new AppError('Token expired', 401));
    } else {
      next(error);
    }
  }
};

export const authorize = (...roles: UserRole[]) => {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new AppError('Authentication required', 401));
    }

    if (!roles.includes(req.user.role)) {
      return next(new AppError('Insufficient permissions', 403));
    }

    next();
  };
};

export const authorizeAgency = (
  req: Request,
  _res: Response,
  next: NextFunction
) => {
  if (!req.user) {
    return next(new AppError('Authentication required', 401));
  }

  // Super Admin and Director can access all agencies
  if (['SUPER_ADMIN', 'DIRECTOR'].includes(req.user.role)) {
    return next();
  }

  // Check if user has access to the requested agency
  const requestedAgencyId = parseInt(req.params.agencyId || req.body.id_ag, 10);

  if (requestedAgencyId && req.user.agenceId !== requestedAgencyId) {
    return next(new AppError('Access denied for this agency', 403));
  }

  next();
};
