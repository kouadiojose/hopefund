import { Router } from 'express';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { prisma } from '../lib/prisma';
import { authenticate, authorize } from '../middleware/auth';
import { AppError } from '../middleware/error-handler';
import { logger } from '../utils/logger';
import { requirePermission, getRolePermissions } from '../middleware/permission.middleware';

const router = Router();

// All admin routes require authentication and SUPER_ADMIN, DIRECTOR or BRANCH_MANAGER role
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
      throw new AppError('Cet email existe déjà', 400);
    }

    // Hash password
    const password_hash = await bcrypt.hash(data.password, 12);

    const user = await prisma.user.create({
      data: {
        email: data.email,
        password_hash,
        nom: data.nom,
        prenom: data.prenom,
        telephone: data.telephone || null,
        role: data.role,
        id_ag: data.id_ag || null,
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
    logger.error('Error creating user:', error);
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
    const updateData: any = {};

    if (data.email) updateData.email = data.email;
    if (data.nom) updateData.nom = data.nom;
    if (data.prenom) updateData.prenom = data.prenom;
    if (data.telephone !== undefined) updateData.telephone = data.telephone;
    if (data.role) updateData.role = data.role;
    if (data.id_ag !== undefined) updateData.id_ag = data.id_ag;
    if (data.is_active !== undefined) updateData.is_active = data.is_active;

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
    logger.error('Error updating user:', error);
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

// ==================== RÔLES ====================

// Rôles système par défaut (pour initialisation)
const defaultSystemRoles = [
  { code: 'SUPER_ADMIN', label: 'Super Admin', description: 'Accès complet à tous les modules du système', color: 'purple', is_system: true },
  { code: 'DIRECTOR', label: 'Directeur', description: 'Lecture globale et validation des opérations', color: 'blue', is_system: true },
  { code: 'BRANCH_MANAGER', label: 'Chef d\'Agence', description: 'Gestion complète de l\'agence', color: 'indigo', is_system: true },
  { code: 'CREDIT_OFFICER', label: 'Agent de Crédit', description: 'Gestion des dossiers de crédit', color: 'green', is_system: true },
  { code: 'TELLER', label: 'Caissier', description: 'Opérations de guichet et caisse', color: 'yellow', is_system: true },
];

// GET /api/admin/roles - Liste des rôles disponibles
router.get('/roles', async (req, res, next) => {
  try {
    // Essayer de récupérer les rôles depuis la base de données
    let roles = await prisma.role.findMany({
      where: { is_active: true },
      orderBy: [{ is_system: 'desc' }, { label: 'asc' }],
    });

    // Si aucun rôle n'existe, initialiser avec les rôles par défaut
    if (roles.length === 0) {
      await prisma.role.createMany({
        data: defaultSystemRoles,
        skipDuplicates: true,
      });
      roles = await prisma.role.findMany({
        where: { is_active: true },
        orderBy: [{ is_system: 'desc' }, { label: 'asc' }],
      });
    }

    // Ajouter les permissions pour chaque rôle
    const rolesWithPermissions = await Promise.all(
      roles.map(async (role) => {
        try {
          const permissions = await getRolePermissions(role.code);
          return {
            id: role.id,
            value: role.code,
            code: role.code,
            label: role.label,
            description: role.description,
            color: role.color,
            is_system: role.is_system,
            permissions,
            permissionCount: permissions.length,
          };
        } catch {
          return {
            id: role.id,
            value: role.code,
            code: role.code,
            label: role.label,
            description: role.description,
            color: role.color,
            is_system: role.is_system,
            permissions: [],
            permissionCount: 0,
          };
        }
      })
    );

    res.json(rolesWithPermissions);
  } catch (error) {
    next(error);
  }
});

// POST /api/admin/roles - Créer un nouveau rôle
router.post('/roles', authorize('SUPER_ADMIN', 'DIRECTOR'), async (req, res, next) => {
  try {
    const schema = z.object({
      code: z.string().min(2).max(50).regex(/^[A-Z_]+$/, 'Le code doit être en majuscules avec underscores'),
      label: z.string().min(2).max(100),
      description: z.string().max(500).optional(),
      color: z.string().max(20).default('gray'),
    });

    const data = schema.parse(req.body);

    // Vérifier que le code n'existe pas
    const existing = await prisma.role.findUnique({ where: { code: data.code } });
    if (existing) {
      throw new AppError('Un rôle avec ce code existe déjà', 400);
    }

    const role = await prisma.role.create({
      data: {
        code: data.code,
        label: data.label,
        description: data.description,
        color: data.color,
        is_system: false,
      },
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        user_id: req.user!.userId,
        action: 'CREATE',
        entity: 'Role',
        entity_id: role.id.toString(),
        new_values: data,
        ip_address: req.ip || null,
      },
    });

    res.status(201).json({
      id: role.id,
      value: role.code,
      code: role.code,
      label: role.label,
      description: role.description,
      color: role.color,
      is_system: role.is_system,
      permissions: [],
      permissionCount: 0,
    });
  } catch (error) {
    next(error);
  }
});

// PUT /api/admin/roles/:code - Modifier un rôle
router.put('/roles/:code', authorize('SUPER_ADMIN', 'DIRECTOR'), async (req, res, next) => {
  try {
    const { code } = req.params;
    const schema = z.object({
      label: z.string().min(2).max(100).optional(),
      description: z.string().max(500).optional(),
      color: z.string().max(20).optional(),
    });

    const data = schema.parse(req.body);

    const role = await prisma.role.findUnique({ where: { code } });
    if (!role) {
      throw new AppError('Rôle non trouvé', 404);
    }

    // Les rôles système ne peuvent pas être supprimés mais peuvent être modifiés (label, description, color)
    const updatedRole = await prisma.role.update({
      where: { code },
      data,
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        user_id: req.user!.userId,
        action: 'UPDATE',
        entity: 'Role',
        entity_id: role.id.toString(),
        old_values: { label: role.label, description: role.description, color: role.color },
        new_values: data,
        ip_address: req.ip || null,
      },
    });

    const permissions = await getRolePermissions(updatedRole.code);

    res.json({
      id: updatedRole.id,
      value: updatedRole.code,
      code: updatedRole.code,
      label: updatedRole.label,
      description: updatedRole.description,
      color: updatedRole.color,
      is_system: updatedRole.is_system,
      permissions,
      permissionCount: permissions.length,
    });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/admin/roles/:code - Supprimer un rôle
router.delete('/roles/:code', authorize('SUPER_ADMIN'), async (req, res, next) => {
  try {
    const { code } = req.params;

    const role = await prisma.role.findUnique({ where: { code } });
    if (!role) {
      throw new AppError('Rôle non trouvé', 404);
    }

    if (role.is_system) {
      throw new AppError('Les rôles système ne peuvent pas être supprimés', 400);
    }

    // Vérifier si des utilisateurs utilisent ce rôle
    const usersWithRole = await prisma.user.count({ where: { role: code } });
    if (usersWithRole > 0) {
      throw new AppError(`Ce rôle est utilisé par ${usersWithRole} utilisateur(s). Réassignez-les d'abord.`, 400);
    }

    // Supprimer les permissions associées
    await prisma.rolePermission.deleteMany({ where: { role: code } });

    // Désactiver le rôle (soft delete)
    await prisma.role.update({
      where: { code },
      data: { is_active: false },
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        user_id: req.user!.userId,
        action: 'DELETE',
        entity: 'Role',
        entity_id: role.id.toString(),
        old_values: { code: role.code, label: role.label },
        ip_address: req.ip || null,
      },
    });

    res.json({ message: 'Rôle supprimé avec succès' });
  } catch (error) {
    next(error);
  }
});

// POST /api/admin/clients/activate-all - Activer tous les clients
router.post('/clients/activate-all', authorize('SUPER_ADMIN', 'DIRECTOR'), async (req, res, next) => {
  try {
    const result = await prisma.client.updateMany({
      where: { etat: { not: 1 } },
      data: { etat: 1 },
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        user_id: req.user!.userId,
        action: 'BATCH_UPDATE',
        entity: 'Client',
        entity_id: 'ALL',
        new_values: { etat: 1, count: result.count },
        ip_address: req.ip || null,
      },
    });

    logger.info(`Activated ${result.count} clients`);
    res.json({ message: `${result.count} clients ont été activés avec succès` });
  } catch (error) {
    next(error);
  }
});

// GET /api/admin/clients/duplicates - Rechercher les doublons de clients
router.get('/clients/duplicates', authorize('SUPER_ADMIN', 'DIRECTOR'), async (req, res, next) => {
  try {
    // Find clients with same name/prenom (case-insensitive)
    const duplicates = await prisma.$queryRaw`
      SELECT
        LOWER(TRIM(pp_nom)) as nom_lower,
        LOWER(TRIM(pp_prenom)) as prenom_lower,
        MAX(pp_nom) as pp_nom,
        MAX(pp_prenom) as pp_prenom,
        COUNT(*) as count,
        STRING_AGG(id_client::text, ', ' ORDER BY id_client) as client_ids,
        STRING_AGG(COALESCE(etat::text, '0'), ', ' ORDER BY id_client) as etats
      FROM ad_cli
      WHERE pp_nom IS NOT NULL AND pp_prenom IS NOT NULL
        AND TRIM(pp_nom) != '' AND TRIM(pp_prenom) != ''
      GROUP BY LOWER(TRIM(pp_nom)), LOWER(TRIM(pp_prenom))
      HAVING COUNT(*) > 1
      ORDER BY COUNT(*) DESC
      LIMIT 100
    ` as any[];

    // Get statistics
    const [totalClients, inactiveClients, totalAccounts, totalCredits] = await Promise.all([
      prisma.client.count(),
      prisma.client.count({ where: { etat: { not: 1 } } }),
      prisma.compte.count(),
      prisma.dossierCredit.count(),
    ]);

    res.json({
      duplicates: duplicates.map((d: any) => ({
        nom: d.pp_nom,
        prenom: d.pp_prenom,
        count: Number(d.count),
        clientIds: d.client_ids ? d.client_ids.split(', ').map((id: string) => parseInt(id)) : [],
        etats: d.etats ? d.etats.split(', ') : [],
      })),
      statistics: {
        totalClients,
        inactiveClients,
        totalAccounts,
        totalCredits,
        duplicateGroups: duplicates.length,
      }
    });
  } catch (error) {
    logger.error('Error fetching duplicates:', error);
    next(error);
  }
});

// GET /api/admin/clients/:id/full-analysis - Analyse complète d'un client
router.get('/clients/:id/full-analysis', authorize('SUPER_ADMIN', 'DIRECTOR'), async (req, res, next) => {
  try {
    const clientId = parseInt(req.params.id);

    // Get client details - without nested includes that might fail due to schema mismatches
    const client = await prisma.client.findUnique({
      where: { id_client: clientId },
      include: {
        comptes: true,
        dossiers_credit: true,
      }
    });

    if (!client) {
      return res.status(404).json({ error: 'Client non trouvé' });
    }

    // Fetch echeances and garanties counts separately to avoid column issues
    const echeancesCounts = await Promise.all(
      client.dossiers_credit.map(async (dossier: any) => {
        try {
          const count = await prisma.echeance.count({
            where: { id_doss: dossier.id_doss }
          });
          return { id_doss: dossier.id_doss, count };
        } catch {
          return { id_doss: dossier.id_doss, count: 0 };
        }
      })
    );

    // Fetch garanties counts separately
    const garantiesCounts = await Promise.all(
      client.dossiers_credit.map(async (dossier: any) => {
        try {
          const count = await prisma.garantie.count({
            where: { id_doss: dossier.id_doss }
          });
          return { id_doss: dossier.id_doss, count };
        } catch {
          return { id_doss: dossier.id_doss, count: 0 };
        }
      })
    );

    // Search for potential duplicates with same name
    const potentialDuplicates = await prisma.client.findMany({
      where: {
        OR: [
          {
            pp_nom: { equals: client.pp_nom || '', mode: 'insensitive' },
            pp_prenom: { equals: client.pp_prenom || '', mode: 'insensitive' },
            id_client: { not: clientId }
          },
          {
            pp_nom: { contains: client.pp_nom || '', mode: 'insensitive' },
            id_client: { not: clientId }
          }
        ]
      },
      include: {
        comptes: {
          select: { id_cpte: true, solde: true, etat_cpte: true }
        },
        dossiers_credit: {
          select: { id_doss: true, cre_mnt_octr: true, cre_etat: true }
        }
      },
      take: 20
    });

    // Check for accounts across all agencies
    const accountsAllAgencies = await prisma.compte.findMany({
      where: { id_titulaire: clientId }
    });

    // Check for credits across all agencies (don't include echeances due to schema mismatch)
    const creditsAllAgencies = await prisma.dossierCredit.findMany({
      where: { id_client: clientId },
    });

    res.json({
      client: {
        id_client: client.id_client,
        id_ag: client.id_ag,
        nom: client.pp_nom,
        prenom: client.pp_prenom,
        nom_complet: `${client.pp_prenom || ''} ${client.pp_nom || ''}`.trim(),
        etat: client.etat,
        date_adh: client.date_adh,
        telephone: client.num_tel || client.num_port,
        email: client.email,
      },
      comptes: client.comptes.map((c: any) => ({
        id_cpte: c.id_cpte,
        id_ag: c.id_ag,
        num_complet: c.num_complet_cpte,
        intitule: c.intitule_compte,
        solde: c.solde,
        etat: c.etat_cpte,
        date_ouvert: c.date_ouvert,
        date_clot: c.date_clot,
      })),
      credits: client.dossiers_credit.map((d: any) => {
        const echCount = echeancesCounts.find((e: any) => e.id_doss === d.id_doss);
        const garCount = garantiesCounts.find((g: any) => g.id_doss === d.id_doss);
        return {
          id_doss: d.id_doss,
          id_ag: d.id_ag,
          montant_octroye: d.cre_mnt_octr,
          etat: d.cre_etat,
          date_demande: d.date_dem,
          date_deblocage: d.cre_date_debloc,
          duree_mois: d.duree_mois,
          echeances_count: echCount?.count || 0,
          garanties_count: garCount?.count || 0,
        };
      }),
      accountsAllAgencies: accountsAllAgencies.length,
      creditsAllAgencies: creditsAllAgencies.length,
      potentialDuplicates: potentialDuplicates.map((p: any) => ({
        id_client: p.id_client,
        id_ag: p.id_ag,
        nom: p.pp_nom,
        prenom: p.pp_prenom,
        etat: p.etat,
        comptes_count: p.comptes.length,
        credits_count: p.dossiers_credit.length,
      })),
      summary: {
        totalComptes: client.comptes.length,
        totalCredits: client.dossiers_credit.length,
        comptesActifs: client.comptes.filter((c: any) => c.etat_cpte === 1).length,
        creditsEnCours: client.dossiers_credit.filter((d: any) => [5, 6, 8].includes(d.cre_etat || 0)).length,
        hasDuplicates: potentialDuplicates.length > 0,
      }
    });
  } catch (error) {
    logger.error('Error in full-analysis:', error);
    next(error);
  }
});

// POST /api/admin/clients/merge - Fusionner deux clients (déplacer comptes/crédits)
router.post('/clients/merge', authorize('SUPER_ADMIN'), async (req, res, next) => {
  try {
    const { sourceClientId, targetClientId } = req.body;

    if (!sourceClientId || !targetClientId || sourceClientId === targetClientId) {
      return res.status(400).json({ error: 'IDs de clients invalides' });
    }

    // Verify both clients exist
    const [sourceClient, targetClient] = await Promise.all([
      prisma.client.findUnique({ where: { id_client: sourceClientId } }),
      prisma.client.findUnique({ where: { id_client: targetClientId } }),
    ]);

    if (!sourceClient) {
      return res.status(404).json({ error: `Client source #${sourceClientId} non trouvé` });
    }
    if (!targetClient) {
      return res.status(404).json({ error: `Client cible #${targetClientId} non trouvé` });
    }

    // Use raw SQL to update accounts (bypass composite key constraints)
    const movedAccountsResult = await prisma.$executeRaw`
      UPDATE ad_cpt
      SET id_titulaire = ${targetClientId}
      WHERE id_titulaire = ${sourceClientId}
    `;

    // Use raw SQL to update credits (bypass composite key constraints)
    const movedCreditsResult = await prisma.$executeRaw`
      UPDATE ad_dcr
      SET id_client = ${targetClientId}
      WHERE id_client = ${sourceClientId}
    `;

    // Mark source client as inactive
    await prisma.$executeRaw`
      UPDATE ad_cli
      SET etat = 2
      WHERE id_client = ${sourceClientId}
    `;

    // Audit log - convert bigint to number for JSON serialization
    await prisma.auditLog.create({
      data: {
        user_id: req.user!.userId,
        action: 'MERGE',
        entity: 'Client',
        entity_id: `${sourceClientId}->${targetClientId}`,
        old_values: { sourceClientId, sourceClient: { nom: sourceClient.pp_nom, prenom: sourceClient.pp_prenom } },
        new_values: {
          targetClientId,
          movedAccounts: Number(movedAccountsResult),
          movedCredits: Number(movedCreditsResult)
        },
        ip_address: req.ip || null,
      },
    });

    logger.info(`Merged client ${sourceClientId} into ${targetClientId}: ${movedAccountsResult} accounts, ${movedCreditsResult} credits`);

    res.json({
      message: 'Fusion réussie',
      details: {
        sourceClient: { id: sourceClientId, nom: `${sourceClient.pp_prenom} ${sourceClient.pp_nom}` },
        targetClient: { id: targetClientId, nom: `${targetClient.pp_prenom} ${targetClient.pp_nom}` },
        movedAccounts: movedAccountsResult,
        movedCredits: movedCreditsResult,
      }
    });
  } catch (error) {
    logger.error('Error in merge:', error);
    next(error);
  }
});

export default router;
