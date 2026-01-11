import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate, authorize } from '../middleware/auth';
import { AppError } from '../middleware/error-handler';
import { config } from '../config';

const router = Router();

router.use(authenticate);

// GET /api/accounts/debug - Diagnostic des données (temporaire)
router.get('/debug', async (req, res, next) => {
  try {
    // Sample accounts
    const sampleAccounts = await prisma.compte.findMany({
      take: 10,
      select: { id_cpte: true, num_cpte: true, num_complet_cpte: true, id_titulaire: true },
      orderBy: { id_cpte: 'desc' },
    });

    // Sample movements
    const sampleMovements = await prisma.mouvement.findMany({
      take: 20,
      select: { id_mouvement: true, cpte_interne_cli: true, date_mvt: true, montant: true, libel_mvt: true },
      orderBy: { id_mouvement: 'desc' },
    });

    // Total counts
    const totalAccounts = await prisma.compte.count();
    const totalMovements = await prisma.mouvement.count();

    // Unique cpte_interne_cli values in movements
    const uniqueCpteIds = await prisma.mouvement.findMany({
      distinct: ['cpte_interne_cli'],
      select: { cpte_interne_cli: true },
      take: 50,
    });

    res.json({
      totalAccounts,
      totalMovements,
      sampleAccounts,
      sampleMovements: sampleMovements.map(m => ({
        ...m,
        montant: Number(m.montant || 0),
      })),
      uniqueCpteInterneCliValues: uniqueCpteIds.map(m => m.cpte_interne_cli),
    });
  } catch (error) {
    next(error);
  }
});

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

    // Debug: chercher toutes les transactions pour voir ce qui existe
    const allMouvements = await prisma.mouvement.findMany({
      take: 10,
      orderBy: { id_mouvement: 'desc' },
      select: { id_mouvement: true, cpte_interne_cli: true, id_ag: true, date_mvt: true, montant: true },
    });

    // Récupérer TOUS les comptes du client pour chercher dans tous leurs mouvements
    const comptesClient = await prisma.compte.findMany({
      where: { id_titulaire: compte.id_titulaire },
      select: { id_cpte: true, num_cpte: true },
    });

    // Construire la liste de tous les IDs possibles
    const allPossibleIds: number[] = [];
    comptesClient.forEach(c => {
      allPossibleIds.push(c.id_cpte);
      if (c.num_cpte && !allPossibleIds.includes(c.num_cpte)) {
        allPossibleIds.push(c.num_cpte);
      }
    });

    // Ajouter aussi le num_complet_cpte converti en entier
    if (compte.num_complet_cpte) {
      const numComplet = parseInt(compte.num_complet_cpte);
      if (!isNaN(numComplet) && !allPossibleIds.includes(numComplet)) {
        allPossibleIds.push(numComplet);
      }
    }

    // Rechercher par cpte_interne_cli correspondant à l'un des IDs possibles
    // ET filtrer pour n'afficher que ceux du compte demandé
    const where: any = {
      cpte_interne_cli: { in: allPossibleIds },
    };

    if (startDate || endDate) {
      where.date_mvt = {};
      if (startDate) where.date_mvt.gte = new Date(startDate);
      if (endDate) where.date_mvt.lte = new Date(endDate);
    }

    const [transactions, total] = await Promise.all([
      prisma.mouvement.findMany({
        where,
        skip: all ? 0 : (page - 1) * limit,
        take: limit,
        orderBy: { date_mvt: 'desc' },
      }),
      prisma.mouvement.count({ where }),
    ]);

    // Convertir les décimales en nombres
    const formattedTransactions = transactions.map(t => ({
      id_mouvement: t.id_mouvement,
      date_mvt: t.date_mvt,
      type_mvt: t.type_mvt,
      type_operation: t.type_operation,
      sens: t.sens,
      montant: Number(t.montant || 0),
      libel_mvt: t.libel_mvt,
      solde_avant: Number(t.solde_avant || 0),
      solde_apres: Number(t.solde_apres || 0),
      id_utilisateur: t.id_utilisateur,
    }));

    res.json({
      data: formattedTransactions,
      pagination: {
        page: all ? 1 : page,
        limit: all ? total : limit,
        total,
        totalPages: all ? 1 : Math.ceil(total / limit),
      },
      // Debug info (à supprimer en production)
      _debug: {
        compte: {
          id_cpte: compte.id_cpte,
          num_cpte: compte.num_cpte,
          num_complet_cpte: compte.num_complet_cpte,
          id_ag: compte.id_ag,
          id_titulaire: compte.id_titulaire,
        },
        allComptesDuClient: comptesClient,
        searchedIds: allPossibleIds,
        sampleMouvements: allMouvements.map(m => ({
          id: m.id_mouvement,
          cpte_interne_cli: m.cpte_interne_cli,
          id_ag: m.id_ag,
        })),
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
