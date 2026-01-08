import { Router } from 'express';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import jwt, { SignOptions } from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { prisma } from '../lib/prisma';
import { config } from '../config';
import { AppError } from '../middleware/error-handler';
import { authenticate, JwtPayload } from '../middleware/auth';
import { logger } from '../utils/logger';

const router = Router();

// Validation schemas
const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

const refreshSchema = z.object({
  refreshToken: z.string(),
});

// Helper functions
const generateTokens = async (user: { id: number; email: string; role: any; id_ag: number | null }) => {
  const payload: JwtPayload = {
    userId: user.id,
    email: user.email,
    role: user.role,
    agenceId: user.id_ag ?? undefined,
  };

  const signOptions: SignOptions = {
    expiresIn: config.jwtExpiresIn,
  };
  const accessToken = jwt.sign(payload, config.jwtSecret, signOptions);

  const refreshToken = uuidv4();
  const refreshExpiresAt = new Date();
  refreshExpiresAt.setDate(refreshExpiresAt.getDate() + 7); // 7 days

  // Store refresh token
  await prisma.session.create({
    data: {
      user_id: user.id,
      refresh_token: refreshToken,
      expires_at: refreshExpiresAt,
    },
  });

  return { accessToken, refreshToken };
};

// POST /api/auth/login
router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = loginSchema.parse(req.body);

    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      throw new AppError('Invalid credentials', 401);
    }

    // Check if account is locked
    if (user.locked_until && user.locked_until > new Date()) {
      throw new AppError('Account is locked. Please try again later.', 423);
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password_hash);

    if (!isValidPassword) {
      // Increment failed attempts
      const newAttempts = user.failed_attempts + 1;
      const lockUntil = newAttempts >= 5
        ? new Date(Date.now() + 30 * 60 * 1000) // Lock for 30 minutes
        : null;

      await prisma.user.update({
        where: { id: user.id },
        data: {
          failed_attempts: newAttempts,
          locked_until: lockUntil,
        },
      });

      if (lockUntil) {
        throw new AppError('Too many failed attempts. Account locked for 30 minutes.', 423);
      }

      throw new AppError('Invalid credentials', 401);
    }

    // Check if user is active
    if (!user.is_active) {
      throw new AppError('Account is deactivated', 403);
    }

    // Reset failed attempts and update last login
    await prisma.user.update({
      where: { id: user.id },
      data: {
        failed_attempts: 0,
        locked_until: null,
        last_login: new Date(),
      },
    });

    // Generate tokens
    const tokens = await generateTokens(user);

    // Log audit
    await prisma.auditLog.create({
      data: {
        user_id: user.id,
        action: 'LOGIN',
        entity: 'User',
        entity_id: user.id.toString(),
        ip_address: req.ip || null,
        user_agent: req.headers['user-agent'] as string | undefined,
      },
    });

    logger.info(`User ${email} logged in successfully`);

    res.json({
      user: {
        id: user.id,
        email: user.email,
        nom: user.nom,
        prenom: user.prenom,
        role: user.role,
        agenceId: user.id_ag,
      },
      ...tokens,
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/auth/refresh
router.post('/refresh', async (req, res, next) => {
  try {
    const { refreshToken } = refreshSchema.parse(req.body);

    const session = await prisma.session.findUnique({
      where: { refresh_token: refreshToken },
      include: { user: true },
    });

    if (!session) {
      throw new AppError('Invalid refresh token', 401);
    }

    if (session.expires_at < new Date()) {
      await prisma.session.delete({ where: { id: session.id } });
      throw new AppError('Refresh token expired', 401);
    }

    // Delete old session
    await prisma.session.delete({ where: { id: session.id } });

    // Generate new tokens
    const tokens = await generateTokens(session.user);

    res.json(tokens);
  } catch (error) {
    next(error);
  }
});

// POST /api/auth/logout
router.post('/logout', authenticate, async (req, res, next) => {
  try {
    const { refreshToken } = req.body;

    if (refreshToken) {
      await prisma.session.deleteMany({
        where: { refresh_token: refreshToken },
      });
    }

    // Log audit
    await prisma.auditLog.create({
      data: {
        user_id: req.user!.userId,
        action: 'LOGOUT',
        entity: 'User',
        entity_id: req.user!.userId.toString(),
        ip_address: req.ip || null,
        user_agent: req.headers['user-agent'] as string | undefined,
      },
    });

    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    next(error);
  }
});

// GET /api/auth/me
router.get('/me', authenticate, async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      select: {
        id: true,
        email: true,
        nom: true,
        prenom: true,
        telephone: true,
        role: true,
        id_ag: true,
        last_login: true,
      },
    });

    if (!user) {
      throw new AppError('User not found', 404);
    }

    res.json(user);
  } catch (error) {
    next(error);
  }
});

export default router;
