import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';
import { logger } from '../utils/logger';
import { config } from '../config';

export class AppError extends Error {
  statusCode: number;
  isOperational: boolean;

  constructor(message: string, statusCode: number) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
) => {
  // Log error with full details
  logger.error({
    message: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
    name: err.name,
  });

  // Zod validation errors
  if (err instanceof ZodError) {
    return res.status(400).json({
      error: 'Validation failed',
      details: err.errors.map((e) => ({
        field: e.path.join('.'),
        message: e.message,
      })),
    });
  }

  // Custom AppError
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      error: err.message,
    });
  }

  // Prisma errors
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    logger.error(`Prisma error code: ${err.code}, meta: ${JSON.stringify(err.meta)}`);

    if (err.code === 'P2002') {
      return res.status(400).json({
        error: 'Cette valeur existe déjà',
        field: (err.meta?.target as string[])?.join(', '),
      });
    }

    if (err.code === 'P2025') {
      return res.status(404).json({
        error: 'Enregistrement non trouvé',
      });
    }

    return res.status(400).json({
      error: 'Erreur de base de données',
      code: err.code,
    });
  }

  if (err instanceof Prisma.PrismaClientValidationError) {
    logger.error(`Prisma validation error: ${err.message}`);
    return res.status(400).json({
      error: 'Erreur de validation des données',
      details: err.message.includes('enum')
        ? 'Erreur de type enum - vérifiez que les rôles sont valides'
        : 'Vérifiez les données envoyées',
    });
  }

  // Database connection errors
  if (err.message?.includes('connect') || err.message?.includes('database')) {
    return res.status(503).json({
      error: 'Erreur de connexion à la base de données',
    });
  }

  // Default error - show more info for debugging
  const statusCode = 500;
  const message = config.nodeEnv === 'production'
    ? 'Internal server error'
    : err.message;

  return res.status(statusCode).json({
    error: message,
    type: err.name,
    ...(config.nodeEnv !== 'production' && { stack: err.stack }),
  });
};
