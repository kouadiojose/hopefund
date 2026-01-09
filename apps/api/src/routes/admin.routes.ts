import { Router } from 'express';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { prisma } from '../lib/prisma';
import { authenticate, authorize } from '../middleware/auth';
import { AppError } from '../middleware/error-handler';
import { logger } from '../utils/logger';
import { requirePermission, getRolePermissions } from '../middleware/permission.middleware';
import { UserRole } from '@prisma/client';

const router = Router();

// All admin routes require authentication and DIRECTION or ADMIN_IT role
router.use(authenticate);
router.use(authorize('SUPER_ADMIN', 'DIRECTOR', 'BRANCH_MANAGER'));

// ==================== UTILISATEURS ====================

// GET /api/admin/users - Liste des utilisateurs
router.get('/users', async (req, res, next) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const search = req.query.search as string;
    const role = req.query.role as string;
    const agencyId = req.query.agencyId ? parseInt(req.query.agencyId as string) : undefined;

    const where: any = {};

    if (search) {
      where.OR = [
        { nom: { contains: search, mode: 'insensitive' } },
        { prenom: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (role) {
      where.role = role;
    }

    if (agencyId) {
      where.id_ag = agencyId;
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          email: true,
          nom: true,
          prenom: true,
          telephone: true,
          role: true,
          id_ag: true,
          is_active: true,
          last_login: true,
          created_at: true,
        },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { created_at: 'desc' },
      }),
      prisma.user.count({ where }),
    ]);

    // Get agency names
    const agencyIds = [...new Set(users.map(u => u.id_ag).filter(Boolean))];
    const agencies = agencyIds.length > 0
      ? await prisma.agence.findMany({
          where: { id_ag: { in: agencyIds as number[] } },
          select: { id_ag: true, libel_ag: true },
        })
      : [];

    const agencyMap = new Map(agencies.map(a => [a.id_ag, a.libel_ag]));

    res.json({
      data: users.map(u => ({
        ...u,
        nom_complet: `${u.prenom} ${u.nom}`,
        agence_nom: u.id_ag ? agencyMap.get(u.id_ag) || 'N/A' : 'Toutes',
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/admin/users/:id - Détail utilisateur
router.get('/users/:id', async (req, res, next) => {
  try {
    const userId = parseInt(req.params.id);

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        nom: true,
        prenom: true,
        telephone: true,
        role: true,
        id_ag: true,
        is_active: true,
        last_login: true,
        failed_attempts: true,
        locked_until: true,
        created_at: true,
        updated_at: true,
      },
    });

    if (!user) {
      throw new AppError('User not found', 404);
    }

    // Get agency info
    let agence = null;
    if (user.id_ag) {
      agence = await prisma.agence.findUnique({
        where: { id_ag: user.id_ag },
      });
    }

    res.json({
      ...user,
      nom_complet: `${user.prenom} ${user.nom}`,
      agence,
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/admin/users - Créer un utilisateur
router.post('/users', async (req, res, next) => {
  try {
    const schema = z.object({
      email: z.string().email(),
      password: z.string().min(6),
      nom: z.string().min(1),
      prenom: z.string().min(1),
      telephone: z.string().optional(),
      role: z.enum(['SUPER_ADMIN', 'DIRECTOR', 'BRANCH_MANAGER', 'CREDIT_OFFICER', 'TELLER']),
      id_ag: z.number().optional().nullable(),
    });

    const data = schema.parse(req.body);

    // Check if email already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: data.email },
    });

    if (existingUser) {
      throw new AppError('Email already exists', 400);
    }

    // Hash password
    const password_hash = await bcrypt.hash(data.password, 12);

    const user = await prisma.user.create({
      data: {
        email: data.email,
        password_hash,
        nom: data.nom,
        prenom: data.prenom,
        telephone: data.telephone,
        role: data.role,
        id_ag: data.id_ag,
        is_active: true,
      },
      select: {
        id: true,
        email: true,
        nom: true,
        prenom: true,
        telephone: true,
        role: true,
        id_ag: true,
        is_active: true,
        created_at: true,
      },
    });

    logger.info(`User created: ${user.email} by ${req.user!.email}`);

    res.status(201).json(user);
  } catch (error) {
    next(error);
  }
});

// PUT /api/admin/users/:id - Modifier un utilisateur
router.put('/users/:id', async (req, res, next) => {
  try {
    const userId = parseInt(req.params.id);

    const schema = z.object({
      email: z.string().email().optional(),
      password: z.string().min(6).optional(),
      nom: z.string().min(1).optional(),
      prenom: z.string().min(1).optional(),
      telephone: z.string().optional().nullable(),
      role: z.enum(['SUPER_ADMIN', 'DIRECTOR', 'BRANCH_MANAGER', 'CREDIT_OFFICER', 'TELLER']).optional(),
      id_ag: z.number().optional().nullable(),
      is_active: z.boolean().optional(),
    });

    const data = schema.parse(req.body);

    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!existingUser) {
      throw new AppError('User not found', 404);
    }

    // Check if email is being changed to one that exists
    if (data.email && data.email !== existingUser.email) {
      const emailExists = await prisma.user.findUnique({
        where: { email: data.email },
      });
      if (emailExists) {
        throw new AppError('Email already exists', 400);
      }
    }

    // Prepare update data
    const updateData: any = { ...data };
    delete updateData.password;

    // Hash new password if provided
    if (data.password) {
      updateData.password_hash = await bcrypt.hash(data.password, 12);
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: {
        id: true,
        email: true,
        nom: true,
        prenom: true,
        telephone: true,
        role: true,
        id_ag: true,
        is_active: true,
        updated_at: true,
      },
    });

    logger.info(`User updated: ${user.email} by ${req.user!.email}`);

    res.json(user);
  } catch (error) {
    next(error);
  }
});

// DELETE /api/admin/users/:id - Désactiver un utilisateur
router.delete('/users/:id', async (req, res, next) => {
  try {
    const userId = parseInt(req.params.id);

    // Don't allow deleting yourself
    if (userId === req.user!.userId) {
      throw new AppError('Cannot delete your own account', 400);
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data: { is_active: false },
    });

    logger.info(`User deactivated: ${user.email} by ${req.user!.email}`);

    res.json({ message: 'User deactivated successfully' });
  } catch (error) {
    next(error);
  }
});

// POST /api/admin/users/:id/unlock - Débloquer un utilisateur
router.post('/users/:id/unlock', async (req, res, next) => {
  try {
    const userId = parseInt(req.params.id);

    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        failed_attempts: 0,
        locked_until: null,
      },
    });

    logger.info(`User unlocked: ${user.email} by ${req.user!.email}`);

    res.json({ message: 'User unlocked successfully' });
  } catch (error) {
    next(error);
  }
});

// POST /api/admin/users/:id/reset-password - Réinitialiser mot de passe
router.post('/users/:id/reset-password', async (req, res, next) => {
  try {
    const userId = parseInt(req.params.id);
    const { newPassword } = req.body;

    if (!newPassword || newPassword.length < 6) {
      throw new AppError('Password must be at least 6 characters', 400);
    }

    const password_hash = await bcrypt.hash(newPassword, 12);

    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        password_hash,
        failed_attempts: 0,
        locked_until: null,
      },
    });

    logger.info(`Password reset for: ${user.email} by ${req.user!.email}`);

    res.json({ message: 'Password reset successfully' });
  } catch (error) {
    next(error);
  }
});

// ==================== AGENCES ====================

// GET /api/admin/agencies - Liste des agences
router.get('/agencies', async (req, res, next) => {
  try {
    const agencies = await prisma.agence.findMany({
      orderBy: { id_ag: 'asc' },
    });

    // Get user counts per agency
    const userCounts = await prisma.user.groupBy({
      by: ['id_ag'],
      _count: { id: true },
    });

    const userCountMap = new Map(
      userCounts.map(uc => [uc.id_ag, uc._count.id])
    );

    // Get client counts per agency
    const clientCounts = await prisma.client.groupBy({
      by: ['id_ag'],
      _count: { id_client: true },
    });

    const clientCountMap = new Map(
      clientCounts.map(cc => [cc.id_ag, cc._count.id_client])
    );

    res.json(agencies.map(a => ({
      ...a,
      nombre_utilisateurs: userCountMap.get(a.id_ag) || 0,
      nombre_clients: clientCountMap.get(a.id_ag) || 0,
    })));
  } catch (error) {
    next(error);
  }
});

// GET /api/admin/agencies/:id - Détail agence
router.get('/agencies/:id', async (req, res, next) => {
  try {
    const agencyId = parseInt(req.params.id);

    const agency = await prisma.agence.findUnique({
      where: { id_ag: agencyId },
    });

    if (!agency) {
      throw new AppError('Agency not found', 404);
    }

    // Get statistics
    const [userCount, clientCount, accountCount, loanCount] = await Promise.all([
      prisma.user.count({ where: { id_ag: agencyId } }),
      prisma.client.count({ where: { id_ag: agencyId } }),
      prisma.compte.count({ where: { id_ag: agencyId } }),
      prisma.dossierCredit.count({ where: { id_ag: agencyId } }),
    ]);

    // Get users of this agency
    const users = await prisma.user.findMany({
      where: { id_ag: agencyId },
      select: {
        id: true,
        email: true,
        nom: true,
        prenom: true,
        role: true,
        is_active: true,
      },
    });

    res.json({
      ...agency,
      statistiques: {
        nombre_utilisateurs: userCount,
        nombre_clients: clientCount,
        nombre_comptes: accountCount,
        nombre_credits: loanCount,
      },
      utilisateurs: users,
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/admin/agencies - Créer une agence
router.post('/agencies', authorize('SUPER_ADMIN', 'DIRECTOR'), async (req, res, next) => {
  try {
    const schema = z.object({
      id_ag: z.number(),
      libel_ag: z.string().min(1),
      sigle_ag: z.string().optional(),
      adresse_ag: z.string().optional(),
      tel_ag: z.string().optional(),
      email_ag: z.string().email().optional(),
    });

    const data = schema.parse(req.body);

    // Check if ID already exists
    const existing = await prisma.agence.findUnique({
      where: { id_ag: data.id_ag },
    });

    if (existing) {
      throw new AppError('Agency ID already exists', 400);
    }

    const agency = await prisma.agence.create({
      data: {
        ...data,
        etat_ag: 1,
      },
    });

    logger.info(`Agency created: ${agency.libel_ag} by ${req.user!.email}`);

    res.status(201).json(agency);
  } catch (error) {
    next(error);
  }
});

// PUT /api/admin/agencies/:id - Modifier une agence
router.put('/agencies/:id', authorize('SUPER_ADMIN', 'DIRECTOR'), async (req, res, next) => {
  try {
    const agencyId = parseInt(req.params.id);

    const schema = z.object({
      libel_ag: z.string().min(1).optional(),
      sigle_ag: z.string().optional(),
      adresse_ag: z.string().optional(),
      tel_ag: z.string().optional(),
      email_ag: z.string().email().optional(),
      etat_ag: z.number().optional(),
    });

    const data = schema.parse(req.body);

    const agency = await prisma.agence.update({
      where: { id_ag: agencyId },
      data,
    });

    logger.info(`Agency updated: ${agency.libel_ag} by ${req.user!.email}`);

    res.json(agency);
  } catch (error) {
    next(error);
  }
});

// ==================== STATISTIQUES GLOBALES ====================

// GET /api/admin/stats - Statistiques globales du système
router.get('/stats', async (req, res, next) => {
  try {
    const [
      totalClients,
      totalAccounts,
      totalLoans,
      totalUsers,
      totalAgencies,
      activeLoans,
      overdueLoans,
    ] = await Promise.all([
      prisma.client.count(),
      prisma.compte.count(),
      prisma.dossierCredit.count(),
      prisma.user.count({ where: { is_active: true } }),
      prisma.agence.count({ where: { etat_ag: 1 } }),
      prisma.dossierCredit.count({ where: { cre_etat: { in: [5, 6] } } }),
      prisma.dossierCredit.count({ where: { cre_etat: 8 } }),
    ]);

    // Get total portfolio
    const portfolioResult = await prisma.dossierCredit.aggregate({
      where: { cre_etat: { in: [5, 6, 8] } },
      _sum: { cre_mnt_octr: true },
    });

    // Get total deposits
    const depositsResult = await prisma.compte.aggregate({
      where: { etat_cpte: 1 },
      _sum: { solde: true },
    });

    // Users by role
    const usersByRole = await prisma.user.groupBy({
      by: ['role'],
      _count: { id: true },
      where: { is_active: true },
    });

    // Loans by status
    const loansByStatus = await prisma.dossierCredit.groupBy({
      by: ['cre_etat'],
      _count: { id_doss: true },
    });

    res.json({
      clients: {
        total: totalClients,
      },
      comptes: {
        total: totalAccounts,
        total_solde: parseFloat(depositsResult._sum.solde?.toString() || '0'),
      },
      credits: {
        total: totalLoans,
        en_cours: activeLoans,
        en_retard: overdueLoans,
        portefeuille: parseFloat(portfolioResult._sum.cre_mnt_octr?.toString() || '0'),
      },
      utilisateurs: {
        total: totalUsers,
        par_role: usersByRole.map(r => ({
          role: r.role,
          count: r._count.id,
        })),
      },
      agences: {
        total: totalAgencies,
      },
      credits_par_etat: loansByStatus.map(l => ({
        etat: l.cre_etat,
        count: l._count.id_doss,
      })),
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/admin/roles - Liste des rôles disponibles
router.get('/roles', async (req, res) => {
  const roles = [
    {
      value: 'SUPER_ADMIN',
      label: 'Super Admin',
      description: 'Accès complet à tous les modules du système',
      color: 'purple',
    },
    {
      value: 'DIRECTOR',
      label: 'Directeur',
      description: 'Lecture globale et validation des opérations',
      color: 'blue',
    },
    {
      value: 'BRANCH_MANAGER',
      label: 'Chef d\'Agence',
      description: 'Gestion complète de l\'agence',
      color: 'indigo',
    },
    {
      value: 'CREDIT_OFFICER',
      label: 'Agent de Crédit',
      description: 'Gestion des dossiers de crédit',
      color: 'green',
    },
    {
      value: 'TELLER',
      label: 'Caissier',
      description: 'Opérations de guichet et caisse',
      color: 'yellow',
    },
  ];

  // Ajouter les permissions pour chaque rôle
  const rolesWithPermissions = await Promise.all(
    roles.map(async (role) => {
      try {
        const permissions = await getRolePermissions(role.value as UserRole);
        return { ...role, permissions, permissionCount: permissions.length };
      } catch {
        return { ...role, permissions: [], permissionCount: 0 };
      }
    })
  );

  res.json(rolesWithPermissions);
});

export default router;
