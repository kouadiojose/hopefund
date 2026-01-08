import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate, authorize } from '../middleware/auth';
import { AppError } from '../middleware/error-handler';
import { config } from '../config';

const router = Router();

router.use(authenticate);

// GET /api/accounts - Liste des comptes
router.get('/', authorize('SUPER_ADMIN', 'DIRECTOR', 'BRANCH_MANAGER', 'CREDIT_OFFICER', 'TELLER'), async (req, res, next) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(
      parseInt(req.query.limit as string) || config.defaultPageSize,
      config.maxPageSize
    );
    const search = req.query.search as string;
    const clientId = req.query.clientId ? parseInt(req.query.clientId as string) : undefined;

    const where: any = {};

    if (req.user!.agenceId && !['SUPER_ADMIN', 'DIRECTOR'].includes(req.user!.role)) {
      where.id_ag = req.user!.agenceId;
    }

    if (clientId) {
      where.id_titulaire = clientId;
    }

    if (search) {
      where.OR = [
        { num_complet_cpte: { contains: search } },
        { intitule_compte: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [accounts, total] = await Promise.all([
      prisma.compte.findMany({
        where,
        include: {
          titulaire: {
            select: {
              id_client: true,
              pp_nom: true,
              pp_prenom: true,
              pm_raison_sociale: true,
              statut_juridique: true,
            },
          },
        },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { date_creation: 'desc' },
      }),
      prisma.compte.count({ where }),
    ]);

    res.json({
      data: accounts.map(a => ({
        ...a,
        titulaire_nom: a.titulaire.statut_juridique === 1
          ? `${a.titulaire.pp_prenom || ''} ${a.titulaire.pp_nom || ''}`.trim()
          : a.titulaire.pm_raison_sociale,
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

// GET /api/accounts/:id - Détail compte
router.get('/:id', async (req, res, next) => {
  try {
    const accountId = parseInt(req.params.id);

    const account = await prisma.compte.findUnique({
      where: { id_cpte: accountId },
      include: {
        titulaire: {
          select: {
            id_client: true,
            pp_nom: true,
            pp_prenom: true,
            pm_raison_sociale: true,
            statut_juridique: true,
            num_tel: true,
            num_port: true,
          },
        },
      },
    });

    if (!account) {
      throw new AppError('Account not found', 404);
    }

    res.json(account);
  } catch (error) {
    next(error);
  }
});

// GET /api/accounts/:id/balance - Solde du compte
router.get('/:id/balance', async (req, res, next) => {
  try {
    const accountId = parseInt(req.params.id);

    const account = await prisma.compte.findUnique({
      where: { id_cpte: accountId },
      select: {
        id_cpte: true,
        num_complet_cpte: true,
        solde: true,
        mnt_bloq: true,
        mnt_min_cpte: true,
        decouvert_max: true,
        devise: true,
      },
    });

    if (!account) {
      throw new AppError('Account not found', 404);
    }

    const solde = Number(account.solde || 0);
    const bloq = Number(account.mnt_bloq || 0);
    const min = Number(account.mnt_min_cpte || 0);
    const decouvert = Number(account.decouvert_max || 0);

    res.json({
      ...account,
      solde_disponible: solde - bloq - min + decouvert,
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/accounts/:id/transactions - Transactions du compte
router.get('/:id/transactions', async (req, res, next) => {
  try {
    const accountId = parseInt(req.params.id);
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(
      parseInt(req.query.limit as string) || 20,
      100
    );
    const startDate = req.query.startDate as string;
    const endDate = req.query.endDate as string;

    const where: any = {
      cpte_interne_cli: accountId,
    };

    if (startDate || endDate) {
      where.date_mvt = {};
      if (startDate) where.date_mvt.gte = new Date(startDate);
      if (endDate) where.date_mvt.lte = new Date(endDate);
    }

    const [transactions, total] = await Promise.all([
      prisma.mouvement.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { date_mvt: 'desc' },
      }),
      prisma.mouvement.count({ where }),
    ]);

    res.json({
      data: transactions,
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

// POST /api/accounts/:id/block - Bloquer un compte
router.post('/:id/block', authorize('SUPER_ADMIN', 'DIRECTOR', 'BRANCH_MANAGER'), async (req, res, next) => {
  try {
    const accountId = parseInt(req.params.id);
    const { raison } = req.body;

    const account = await prisma.compte.update({
      where: { id_cpte: accountId },
      data: {
        etat_cpte: 2, // Bloqué
      },
    });

    await prisma.auditLog.create({
      data: {
        user_id: req.user!.userId,
        action: 'BLOCK',
        entity: 'Compte',
        entity_id: accountId.toString(),
        new_values: { raison },
        ip_address: req.ip,
      },
    });

    res.json({ message: 'Account blocked', account });
  } catch (error) {
    next(error);
  }
});

// POST /api/accounts/:id/unblock - Débloquer un compte
router.post('/:id/unblock', authorize('SUPER_ADMIN', 'DIRECTOR', 'BRANCH_MANAGER'), async (req, res, next) => {
  try {
    const accountId = parseInt(req.params.id);

    const account = await prisma.compte.update({
      where: { id_cpte: accountId },
      data: {
        etat_cpte: 1, // Actif
      },
    });

    await prisma.auditLog.create({
      data: {
        user_id: req.user!.userId,
        action: 'UNBLOCK',
        entity: 'Compte',
        entity_id: accountId.toString(),
        ip_address: req.ip,
      },
    });

    res.json({ message: 'Account unblocked', account });
  } catch (error) {
    next(error);
  }
});

export default router;
