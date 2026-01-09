import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { authenticate, authorize } from '../middleware/auth';
import { AppError } from '../middleware/error-handler';

const router = Router();

// All audit routes require authentication and DIRECTION or ADMIN_IT role
router.use(authenticate);
router.use(authorize('DIRECTION', 'ADMIN_IT'));

// ==================== AUDIT LOGS ====================

// GET /api/audit - Liste des logs d'audit
router.get('/', async (req, res, next) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const userId = req.query.userId ? parseInt(req.query.userId as string) : undefined;
    const action = req.query.action as string | undefined;
    const entity = req.query.entity as string | undefined;
    const startDate = req.query.startDate as string | undefined;
    const endDate = req.query.endDate as string | undefined;

    const where: any = {};

    if (userId) {
      where.user_id = userId;
    }

    if (action) {
      where.action = action;
    }

    if (entity) {
      where.entity = entity;
    }

    if (startDate || endDate) {
      where.created_at = {};
      if (startDate) {
        where.created_at.gte = new Date(startDate);
      }
      if (endDate) {
        where.created_at.lte = new Date(endDate);
      }
    }

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              nom: true,
              prenom: true,
              email: true,
              role: true,
            },
          },
        },
        orderBy: { created_at: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.auditLog.count({ where }),
    ]);

    res.json({
      data: logs,
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

// GET /api/audit/stats - Statistiques des audits
router.get('/stats', async (req, res, next) => {
  try {
    const days = parseInt(req.query.days as string) || 7;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Actions par type
    const actionStats = await prisma.auditLog.groupBy({
      by: ['action'],
      where: { created_at: { gte: startDate } },
      _count: { id: true },
    });

    // Entités les plus modifiées
    const entityStats = await prisma.auditLog.groupBy({
      by: ['entity'],
      where: { created_at: { gte: startDate } },
      _count: { id: true },
    });

    // Utilisateurs les plus actifs
    const userStats = await prisma.auditLog.groupBy({
      by: ['user_id'],
      where: {
        created_at: { gte: startDate },
        user_id: { not: null },
      },
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: 10,
    });

    // Get user details
    const userIds = userStats.map(s => s.user_id).filter(Boolean) as number[];
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, nom: true, prenom: true, email: true },
    });
    const userMap = new Map(users.map(u => [u.id, u]));

    // Activité par jour
    const dailyStats = await prisma.$queryRaw`
      SELECT
        DATE(created_at) as date,
        COUNT(*) as count
      FROM app_audit_logs
      WHERE created_at >= ${startDate}
      GROUP BY DATE(created_at)
      ORDER BY date ASC
    ` as Array<{ date: Date; count: bigint }>;

    res.json({
      period: { days, startDate },
      actionStats: actionStats.map(s => ({ action: s.action, count: s._count.id })),
      entityStats: entityStats.map(s => ({ entity: s.entity, count: s._count.id })),
      userStats: userStats.map(s => ({
        user: userMap.get(s.user_id!) || { id: s.user_id },
        count: s._count.id,
      })),
      dailyStats: dailyStats.map(s => ({ date: s.date, count: Number(s.count) })),
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/audit/actions - Liste des types d'actions
router.get('/actions', async (req, res) => {
  const actions = [
    { code: 'LOGIN', label: 'Connexion', color: 'blue' },
    { code: 'LOGOUT', label: 'Déconnexion', color: 'gray' },
    { code: 'LOGIN_FAILED', label: 'Échec connexion', color: 'red' },
    { code: 'CREATE', label: 'Création', color: 'green' },
    { code: 'UPDATE', label: 'Modification', color: 'yellow' },
    { code: 'DELETE', label: 'Suppression', color: 'red' },
    { code: 'VIEW', label: 'Consultation', color: 'blue' },
    { code: 'APPROVE', label: 'Approbation', color: 'green' },
    { code: 'REJECT', label: 'Rejet', color: 'red' },
    { code: 'DEPOSIT', label: 'Dépôt', color: 'green' },
    { code: 'WITHDRAWAL', label: 'Retrait', color: 'orange' },
    { code: 'TRANSFER', label: 'Transfert', color: 'purple' },
    { code: 'DISBURSEMENT', label: 'Déboursement', color: 'green' },
    { code: 'REPAYMENT', label: 'Remboursement', color: 'blue' },
    { code: 'PASSWORD_CHANGE', label: 'Changement mot de passe', color: 'yellow' },
    { code: 'PERMISSION_CHANGE', label: 'Changement permissions', color: 'purple' },
    { code: 'EXPORT', label: 'Export', color: 'blue' },
  ];

  res.json(actions);
});

// GET /api/audit/entities - Liste des entités auditées
router.get('/entities', async (req, res) => {
  const entities = [
    { code: 'User', label: 'Utilisateur' },
    { code: 'Client', label: 'Client' },
    { code: 'Compte', label: 'Compte' },
    { code: 'DossierCredit', label: 'Dossier de crédit' },
    { code: 'Mouvement', label: 'Transaction' },
    { code: 'Echeance', label: 'Échéance' },
    { code: 'Garantie', label: 'Garantie' },
    { code: 'Permission', label: 'Permission' },
    { code: 'RolePermission', label: 'Permission de rôle' },
    { code: 'Session', label: 'Session' },
    { code: 'Agence', label: 'Agence' },
  ];

  res.json(entities);
});

// GET /api/audit/entity/:entity/:id - Historique d'une entité
router.get('/entity/:entity/:id', async (req, res, next) => {
  try {
    const { entity, id } = req.params;

    const logs = await prisma.auditLog.findMany({
      where: {
        entity,
        entity_id: id,
      },
      include: {
        user: {
          select: {
            id: true,
            nom: true,
            prenom: true,
            email: true,
          },
        },
      },
      orderBy: { created_at: 'desc' },
      take: 100,
    });

    res.json(logs);
  } catch (error) {
    next(error);
  }
});

// GET /api/audit/user/:userId - Activité d'un utilisateur
router.get('/user/:userId', async (req, res, next) => {
  try {
    const userId = parseInt(req.params.userId);
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where: { user_id: userId },
        orderBy: { created_at: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.auditLog.count({ where: { user_id: userId } }),
    ]);

    res.json({
      data: logs,
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

// ==================== SESSIONS ====================

// GET /api/audit/sessions - Sessions actives
router.get('/sessions', async (req, res, next) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const activeOnly = req.query.activeOnly !== 'false';

    const where: any = {};

    if (activeOnly) {
      where.expires_at = { gt: new Date() };
    }

    const [sessions, total] = await Promise.all([
      prisma.session.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              nom: true,
              prenom: true,
              email: true,
              role: true,
            },
          },
        },
        orderBy: { created_at: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.session.count({ where }),
    ]);

    res.json({
      data: sessions.map(s => ({
        ...s,
        is_active: new Date(s.expires_at) > new Date(),
        refresh_token: undefined, // Hide refresh token
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

// DELETE /api/audit/sessions/:id - Invalider une session
router.delete('/sessions/:id', async (req, res, next) => {
  try {
    const sessionId = req.params.id;

    await prisma.session.delete({
      where: { id: sessionId },
    });

    res.json({ message: 'Session invalidated successfully' });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/audit/sessions/user/:userId - Invalider toutes les sessions d'un utilisateur
router.delete('/sessions/user/:userId', async (req, res, next) => {
  try {
    const userId = parseInt(req.params.userId);

    const result = await prisma.session.deleteMany({
      where: { user_id: userId },
    });

    res.json({
      message: 'All sessions invalidated successfully',
      count: result.count,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
