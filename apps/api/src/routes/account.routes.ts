import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate, authorize } from '../middleware/auth';
import { AppError } from '../middleware/error-handler';
import { config } from '../config';

const router = Router();

// GET /api/accounts/debug - Diagnostic des données (temporaire - SANS AUTH)
router.get('/debug', async (req, res) => {
  const result: any = {
    timestamp: new Date().toISOString(),
    status: 'ok',
  };

  try {
    // Discover all tables that might have transaction/date info
    try {
      const allTables = await prisma.$queryRaw`
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public'
        AND (table_name LIKE 'ad_%' OR table_name LIKE 'app_%')
        ORDER BY table_name
      ` as any[];
      result.allTables = Array.isArray(allTables) ? allTables.map((t: any) => t.table_name) : [];
    } catch (e: any) {
      result.allTables = { error: String(e?.message || e) };
    }

    // Get actual column names from ad_mouvement table
    try {
      const mouvementColumns = await prisma.$queryRaw`
        SELECT column_name, data_type
        FROM information_schema.columns
        WHERE table_name = 'ad_mouvement'
        ORDER BY ordinal_position
      ` as any[];
      result.adMouvementColumns = mouvementColumns || [];
    } catch (e: any) {
      result.adMouvementColumns = { error: String(e?.message || e) };
    }

    // Get actual column names from ad_ecriture table (if exists)
    try {
      const ecritureColumns = await prisma.$queryRaw`
        SELECT column_name, data_type
        FROM information_schema.columns
        WHERE table_name = 'ad_ecriture'
        ORDER BY ordinal_position
      ` as any[];
      result.adEcritureColumns = ecritureColumns || [];

      if (Array.isArray(ecritureColumns) && ecritureColumns.length > 0) {
        const sampleEcritures = await prisma.$queryRaw`
          SELECT * FROM ad_ecriture ORDER BY id_ecriture DESC LIMIT 5
        ` as any[];
        result.sampleEcritures = sampleEcritures || [];
      }
    } catch (e: any) {
      result.adEcritureColumns = { note: 'Table not found or error', error: String(e?.message || e) };
    }

    // Sample accounts
    try {
      const sampleAccounts = await prisma.compte.findMany({
        take: 5,
        select: { id_cpte: true, num_cpte: true, num_complet_cpte: true, id_titulaire: true },
        orderBy: { id_cpte: 'desc' },
      });
      result.sampleAccounts = sampleAccounts || [];
      result.totalAccounts = await prisma.compte.count();
    } catch (e: any) {
      result.sampleAccounts = { error: String(e?.message || e) };
    }

    // Sample movements using raw query
    try {
      const sampleMovements = await prisma.$queryRaw`
        SELECT * FROM ad_mouvement ORDER BY id_mouvement DESC LIMIT 5
      ` as any[];
      result.sampleMovements = sampleMovements || [];

      const countResult = await prisma.$queryRaw`SELECT COUNT(*) as count FROM ad_mouvement` as any[];
      result.totalMovements = Array.isArray(countResult) && countResult[0] ? Number(countResult[0].count || 0) : 0;
    } catch (e: any) {
      result.sampleMovements = { error: String(e?.message || e) };
    }

    // Get min/max dates to understand the data range
    try {
      const minMax = await prisma.$queryRaw`
        SELECT
          MIN(date_valeur) as min_date,
          MAX(date_valeur) as max_date,
          COUNT(*) as total
        FROM ad_mouvement
      ` as any[];
      result.dateRange = Array.isArray(minMax) && minMax[0] ? minMax[0] : {};
    } catch (e: any) {
      result.dateRange = { error: String(e?.message || e) };
    }

    // Try to join movements with ecritures to see all dates
    try {
      const movementsWithEcritures = await prisma.$queryRaw`
        SELECT m.id_mouvement, m.id_ecriture, m.date_valeur, m.montant, m.sens,
               e.*
        FROM ad_mouvement m
        LEFT JOIN ad_ecriture e ON m.id_ecriture = e.id_ecriture
        WHERE m.id_ecriture IS NOT NULL
        ORDER BY m.id_mouvement DESC
        LIMIT 5
      ` as any[];
      result.movementsWithEcritures = movementsWithEcritures || [];
    } catch (e: any) {
      result.movementsWithEcritures = { error: String(e?.message || e) };
    }

  } catch (e: any) {
    result.status = 'error';
    result.error = String(e?.message || e);
  }

  res.json(result);
});

// Toutes les autres routes nécessitent une authentification
router.use(authenticate);

// GET /api/accounts - Liste des comptes
router.get('/', authorize('SUPER_ADMIN', 'DIRECTOR', 'BRANCH_MANAGER', 'CREDIT_OFFICER', 'TELLER', 'DIRECTOR'), async (req, res, next) => {
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

// GET /api/accounts/:id/transactions - Transactions du compte (historique complet)
router.get('/:id/transactions', async (req, res, next) => {
  try {
    const accountId = parseInt(req.params.id);
    const page = parseInt(req.query.page as string) || 1;
    const all = req.query.all === 'true'; // Option pour récupérer tout l'historique
    const limit = all ? 10000 : Math.min(
      parseInt(req.query.limit as string) || 50,
      500 // Augmenté de 100 à 500
    );
    const startDate = req.query.startDate as string;
    const endDate = req.query.endDate as string;

    // Récupérer le compte avec toutes les infos nécessaires
    const compte = await prisma.compte.findUnique({
      where: { id_cpte: accountId },
      select: { id_cpte: true, num_cpte: true, num_complet_cpte: true, id_ag: true, id_titulaire: true },
    });

    if (!compte) {
      return res.status(404).json({ error: 'Compte non trouvé' });
    }

    // Rechercher par cpte_interne_cli = id_cpte du compte demandé
    const where: any = {
      cpte_interne_cli: compte.id_cpte,
    };

    if (startDate || endDate) {
      where.date_valeur = {};
      if (startDate) where.date_valeur.gte = new Date(startDate);
      if (endDate) where.date_valeur.lte = new Date(endDate);
    }

    const [transactions, total] = await Promise.all([
      prisma.mouvement.findMany({
        where,
        skip: all ? 0 : (page - 1) * limit,
        take: limit,
        orderBy: { date_valeur: 'desc' },
      }),
      prisma.mouvement.count({ where }),
    ]);

    // Convertir les décimales en nombres et adapter au format attendu par le frontend
    const formattedTransactions = transactions.map(t => ({
      id_mouvement: t.id_mouvement,
      date_mvt: t.date_valeur,  // Renommé pour compatibilité frontend
      sens: t.sens,
      montant: Number(t.montant || 0),
      devise: t.devise,
      compte_comptable: t.compte,
      id_ecriture: t.id_ecriture,
    }));

    res.json({
      data: formattedTransactions,
      pagination: {
        page: all ? 1 : page,
        limit: all ? total : limit,
        total,
        totalPages: all ? 1 : Math.ceil(total / limit),
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
        ip_address: req.ip || null,
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
        ip_address: req.ip || null,
      },
    });

    res.json({ message: 'Account unblocked', account });
  } catch (error) {
    next(error);
  }
});

export default router;
