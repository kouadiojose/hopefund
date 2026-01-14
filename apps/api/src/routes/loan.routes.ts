import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { authenticate, authorize } from '../middleware/auth';
import { AppError } from '../middleware/error-handler';
import { config } from '../config';

const router = Router();

router.use(authenticate);

// GET /api/loans/delinquent - Prêts en retard de paiement
router.get('/delinquent', authorize('SUPER_ADMIN', 'DIRECTOR', 'BRANCH_MANAGER', 'CREDIT_OFFICER'), async (req, res, next) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const daysOverdue = parseInt(req.query.daysOverdue as string) || 0; // Filtre par jours de retard minimum

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Trouver les échéances en retard (date_ech < today ET etat != 2 (payé))
    const overdueSchedules = await prisma.$queryRaw`
      SELECT
        e.id_ech,
        e.id_doss,
        e.num_ech,
        e.date_ech,
        e.mnt_capital,
        e.mnt_int,
        e.solde_capital,
        e.solde_int,
        e.mnt_paye,
        e.etat,
        EXTRACT(DAY FROM (CURRENT_DATE - e.date_ech)) as jours_retard,
        d.id_client,
        d.cre_mnt_octr,
        d.cre_etat,
        d.tx_interet_lcr,
        c.pp_nom,
        c.pp_prenom,
        c.pm_raison_sociale,
        c.statut_juridique,
        c.num_port,
        c.email
      FROM ad_sre e
      JOIN ad_dcr d ON e.id_doss = d.id_doss AND e.id_ag = d.id_ag
      JOIN ad_cli c ON d.id_client = c.id_client AND d.id_ag = c.id_ag
      WHERE e.date_ech < CURRENT_DATE
        AND (e.etat IS NULL OR e.etat != 2)
        AND (e.solde_capital > 0 OR e.solde_int > 0)
        AND d.cre_etat IN (5, 8)
        ${daysOverdue > 0 ? prisma.$queryRaw`AND EXTRACT(DAY FROM (CURRENT_DATE - e.date_ech)) >= ${daysOverdue}` : prisma.$queryRaw``}
      ORDER BY jours_retard DESC
      LIMIT ${limit} OFFSET ${(page - 1) * limit}
    ` as any[];

    // Compter le total
    const countResult = await prisma.$queryRaw`
      SELECT COUNT(*) as total
      FROM ad_sre e
      JOIN ad_dcr d ON e.id_doss = d.id_doss AND e.id_ag = d.id_ag
      WHERE e.date_ech < CURRENT_DATE
        AND (e.etat IS NULL OR e.etat != 2)
        AND (e.solde_capital > 0 OR e.solde_int > 0)
        AND d.cre_etat IN (5, 8)
    ` as any[];

    const total = Number(countResult[0]?.total || 0);

    // Formater les résultats
    const formattedResults = overdueSchedules.map((e: any) => ({
      id_ech: e.id_ech,
      id_doss: e.id_doss,
      num_ech: e.num_ech,
      date_ech: e.date_ech,
      mnt_capital: Number(e.mnt_capital || 0),
      mnt_int: Number(e.mnt_int || 0),
      solde_capital: Number(e.solde_capital || 0),
      solde_int: Number(e.solde_int || 0),
      montant_du: Number(e.solde_capital || 0) + Number(e.solde_int || 0),
      mnt_paye: Number(e.mnt_paye || 0),
      jours_retard: Number(e.jours_retard || 0),
      client: {
        id_client: e.id_client,
        nom: e.statut_juridique === 1
          ? `${e.pp_prenom || ''} ${e.pp_nom || ''}`.trim()
          : e.pm_raison_sociale,
        telephone: e.num_port,
        email: e.email,
      },
      credit: {
        montant_octroyé: Number(e.cre_mnt_octr || 0),
        taux_interet: Number(e.tx_interet_lcr || 0),
        etat: e.cre_etat,
      },
    }));

    // Statistiques globales
    const stats = await prisma.$queryRaw`
      SELECT
        COUNT(DISTINCT e.id_doss) as nb_prets_retard,
        COUNT(DISTINCT d.id_client) as nb_clients_retard,
        COALESCE(SUM(e.solde_capital + e.solde_int), 0) as montant_total_retard,
        COUNT(*) as nb_echeances_retard
      FROM ad_sre e
      JOIN ad_dcr d ON e.id_doss = d.id_doss AND e.id_ag = d.id_ag
      WHERE e.date_ech < CURRENT_DATE
        AND (e.etat IS NULL OR e.etat != 2)
        AND (e.solde_capital > 0 OR e.solde_int > 0)
        AND d.cre_etat IN (5, 8)
    ` as any[];

    res.json({
      data: formattedResults,
      stats: {
        nb_prets_retard: Number(stats[0]?.nb_prets_retard || 0),
        nb_clients_retard: Number(stats[0]?.nb_clients_retard || 0),
        montant_total_retard: Number(stats[0]?.montant_total_retard || 0),
        nb_echeances_retard: Number(stats[0]?.nb_echeances_retard || 0),
      },
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

// GET /api/loans/schedule/upcoming - Échéances à venir (tous les prêts)
router.get('/schedule/upcoming', authorize('SUPER_ADMIN', 'DIRECTOR', 'BRANCH_MANAGER', 'CREDIT_OFFICER', 'TELLER'), async (req, res, next) => {
  try {
    const days = parseInt(req.query.days as string) || 30; // Prochains X jours
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);

    const today = new Date();
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + days);

    const upcomingSchedules = await prisma.$queryRaw`
      SELECT
        e.id_ech,
        e.id_doss,
        e.num_ech,
        e.date_ech,
        e.mnt_capital,
        e.mnt_int,
        e.solde_capital,
        e.solde_int,
        e.etat,
        d.id_client,
        d.cre_mnt_octr,
        c.pp_nom,
        c.pp_prenom,
        c.pm_raison_sociale,
        c.statut_juridique,
        c.num_port
      FROM ad_sre e
      JOIN ad_dcr d ON e.id_doss = d.id_doss AND e.id_ag = d.id_ag
      JOIN ad_cli c ON d.id_client = c.id_client AND d.id_ag = c.id_ag
      WHERE e.date_ech >= CURRENT_DATE
        AND e.date_ech <= ${futureDate}
        AND (e.etat IS NULL OR e.etat = 1)
        AND (e.solde_capital > 0 OR e.solde_int > 0)
        AND d.cre_etat = 5
      ORDER BY e.date_ech ASC
      LIMIT ${limit}
    ` as any[];

    const formattedResults = upcomingSchedules.map((e: any) => ({
      id_ech: e.id_ech,
      id_doss: e.id_doss,
      num_ech: e.num_ech,
      date_ech: e.date_ech,
      mnt_capital: Number(e.mnt_capital || 0),
      mnt_int: Number(e.mnt_int || 0),
      montant_du: Number(e.solde_capital || 0) + Number(e.solde_int || 0),
      client: {
        id_client: e.id_client,
        nom: e.statut_juridique === 1
          ? `${e.pp_prenom || ''} ${e.pp_nom || ''}`.trim()
          : e.pm_raison_sociale,
        telephone: e.num_port,
      },
    }));

    res.json({
      data: formattedResults,
      period: { from: today, to: futureDate, days },
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/loans/clients/delinquent - Clients avec des retards de paiement (groupés)
router.get('/clients/delinquent', authorize('SUPER_ADMIN', 'DIRECTOR', 'BRANCH_MANAGER', 'CREDIT_OFFICER'), async (req, res, next) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);

    // Clients avec échéances en retard, groupés
    const delinquentClients = await prisma.$queryRaw`
      SELECT
        c.id_client,
        c.pp_nom,
        c.pp_prenom,
        c.pm_raison_sociale,
        c.statut_juridique,
        c.num_port,
        c.email,
        c.adresse,
        COUNT(DISTINCT d.id_doss) as nb_prets,
        COUNT(e.id_ech) as nb_echeances_retard,
        MAX(EXTRACT(DAY FROM (CURRENT_DATE - e.date_ech))) as max_jours_retard,
        COALESCE(SUM(e.solde_capital + e.solde_int), 0) as montant_total_retard,
        MIN(e.date_ech) as premiere_echeance_retard
      FROM ad_cli c
      JOIN ad_dcr d ON c.id_client = d.id_client AND c.id_ag = d.id_ag
      JOIN ad_sre e ON d.id_doss = e.id_doss AND d.id_ag = e.id_ag
      WHERE e.date_ech < CURRENT_DATE
        AND (e.etat IS NULL OR e.etat != 2)
        AND (e.solde_capital > 0 OR e.solde_int > 0)
        AND d.cre_etat IN (5, 8)
      GROUP BY c.id_client, c.pp_nom, c.pp_prenom, c.pm_raison_sociale,
               c.statut_juridique, c.num_port, c.email, c.adresse
      ORDER BY montant_total_retard DESC
      LIMIT ${limit} OFFSET ${(page - 1) * limit}
    ` as any[];

    // Compter le total de clients délinquants
    const countResult = await prisma.$queryRaw`
      SELECT COUNT(DISTINCT c.id_client) as total
      FROM ad_cli c
      JOIN ad_dcr d ON c.id_client = d.id_client AND c.id_ag = d.id_ag
      JOIN ad_sre e ON d.id_doss = e.id_doss AND d.id_ag = e.id_ag
      WHERE e.date_ech < CURRENT_DATE
        AND (e.etat IS NULL OR e.etat != 2)
        AND (e.solde_capital > 0 OR e.solde_int > 0)
        AND d.cre_etat IN (5, 8)
    ` as any[];

    const total = Number(countResult[0]?.total || 0);

    const formattedResults = delinquentClients.map((c: any) => ({
      id_client: c.id_client,
      nom: c.statut_juridique === 1
        ? `${c.pp_prenom || ''} ${c.pp_nom || ''}`.trim()
        : c.pm_raison_sociale,
      telephone: c.num_port,
      email: c.email,
      adresse: c.adresse,
      nb_prets: Number(c.nb_prets || 0),
      nb_echeances_retard: Number(c.nb_echeances_retard || 0),
      max_jours_retard: Number(c.max_jours_retard || 0),
      montant_total_retard: Number(c.montant_total_retard || 0),
      premiere_echeance_retard: c.premiere_echeance_retard,
      // Classification du risque
      niveau_risque: Number(c.max_jours_retard || 0) > 90 ? 'critique' :
                     Number(c.max_jours_retard || 0) > 60 ? 'eleve' :
                     Number(c.max_jours_retard || 0) > 30 ? 'moyen' : 'faible',
    }));

    res.json({
      data: formattedResults,
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

// GET /api/loans - Liste des prêts
router.get('/', authorize('SUPER_ADMIN', 'DIRECTOR', 'BRANCH_MANAGER', 'CREDIT_OFFICER', 'DIRECTOR'), async (req, res, next) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(
      parseInt(req.query.limit as string) || config.defaultPageSize,
      config.maxPageSize
    );
    const status = req.query.status as string;
    const clientId = req.query.clientId ? parseInt(req.query.clientId as string) : undefined;

    const where: any = {};

    if (req.user!.agenceId && !['SUPER_ADMIN', 'DIRECTOR'].includes(req.user!.role)) {
      where.id_ag = req.user!.agenceId;
    }

    if (status) {
      where.cre_etat = parseInt(status);
    }

    if (clientId) {
      where.id_client = clientId;
    }

    const [loans, total] = await Promise.all([
      prisma.dossierCredit.findMany({
        where,
        include: {
          client: {
            select: {
              id_client: true,
              pp_nom: true,
              pp_prenom: true,
              pm_raison_sociale: true,
              statut_juridique: true,
              num_port: true,
            },
          },
        },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { date_creation: 'desc' },
      }),
      prisma.dossierCredit.count({ where }),
    ]);

    res.json({
      data: loans.map(l => ({
        ...l,
        client_nom: l.client.statut_juridique === 1
          ? `${l.client.pp_prenom || ''} ${l.client.pp_nom || ''}`.trim()
          : l.client.pm_raison_sociale,
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

// GET /api/loans/:id - Détail prêt
router.get('/:id', async (req, res, next) => {
  try {
    const loanId = parseInt(req.params.id);

    const loan = await prisma.dossierCredit.findUnique({
      where: { id_doss: loanId },
      include: {
        client: true,
        echeances: {
          orderBy: { date_ech: 'asc' },
        },
        garanties: true,
      },
    });

    if (!loan) {
      throw new AppError('Loan not found', 404);
    }

    // Calculer les totaux
    const totalCapital = loan.echeances.reduce((sum, e) => sum + Number(e.mnt_capital || 0), 0);
    const totalInteret = loan.echeances.reduce((sum, e) => sum + Number(e.mnt_int || 0), 0);
    const totalPaye = loan.echeances.reduce((sum, e) => sum + Number(e.mnt_paye || 0), 0);
    const soldeCapital = loan.echeances.reduce((sum, e) => sum + Number(e.solde_capital || 0), 0);
    const soldeInteret = loan.echeances.reduce((sum, e) => sum + Number(e.solde_int || 0), 0);

    res.json({
      ...loan,
      resume: {
        totalCapital,
        totalInteret,
        totalDu: totalCapital + totalInteret,
        totalPaye,
        soldeRestant: soldeCapital + soldeInteret,
      },
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/loans/:id/schedule - Échéancier
router.get('/:id/schedule', async (req, res, next) => {
  try {
    const loanId = parseInt(req.params.id);

    const echeances = await prisma.echeance.findMany({
      where: { id_doss: loanId },
      orderBy: { date_ech: 'asc' },
    });

    res.json(echeances);
  } catch (error) {
    next(error);
  }
});

// POST /api/loans - Nouvelle demande de crédit
router.post('/', authorize('SUPER_ADMIN', 'DIRECTOR', 'BRANCH_MANAGER', 'CREDIT_OFFICER'), async (req, res, next) => {
  try {
    const schema = z.object({
      id_client: z.number(),
      id_prod: z.number().optional(),
      mnt_dem: z.number().positive(),
      duree_mois: z.number().min(1).max(120),
      obj_dem: z.number().optional(),
      detail_obj_dem: z.string().optional(),
    });

    const data = schema.parse(req.body);

    // Vérifier que le client existe
    const client = await prisma.client.findUnique({
      where: { id_client: data.id_client },
    });

    if (!client) {
      throw new AppError('Client not found', 404);
    }

    const loan = await prisma.dossierCredit.create({
      data: {
        id_ag: req.user!.agenceId || client.id_ag,
        id_client: data.id_client,
        id_prod: data.id_prod,
        date_dem: new Date(),
        mnt_dem: data.mnt_dem,
        duree_mois: data.duree_mois,
        obj_dem: data.obj_dem,
        detail_obj_dem: data.detail_obj_dem,
        etat: 1, // Nouvelle demande
        id_agent_gest: req.user!.userId,
      },
    });

    await prisma.auditLog.create({
      data: {
        user_id: req.user!.userId,
        action: 'CREATE',
        entity: 'DossierCredit',
        entity_id: loan.id_doss.toString(),
        new_values: data,
        ip_address: req.ip || null,
      },
    });

    res.status(201).json(loan);
  } catch (error) {
    next(error);
  }
});

// PUT /api/loans/:id/approve - Approuver un crédit
router.put('/:id/approve', authorize('SUPER_ADMIN', 'DIRECTOR', 'BRANCH_MANAGER'), async (req, res, next) => {
  try {
    const loanId = parseInt(req.params.id);

    const schema = z.object({
      cre_mnt_octr: z.number().positive(),
      tx_interet_lcr: z.number().min(0).max(100).optional(),
      duree_mois: z.number().optional(),
      commentaire: z.string().optional(),
    });

    const data = schema.parse(req.body);

    const loan = await prisma.dossierCredit.findUnique({
      where: { id_doss: loanId },
    });

    if (!loan) {
      throw new AppError('Loan not found', 404);
    }

    if (loan.cre_etat && loan.cre_etat > 1) {
      throw new AppError('Loan already processed', 400);
    }

    const updatedLoan = await prisma.dossierCredit.update({
      where: { id_doss: loanId },
      data: {
        cre_mnt_octr: data.cre_mnt_octr,
        tx_interet_lcr: data.tx_interet_lcr || 18,
        duree_mois: data.duree_mois || loan.duree_mois,
        cre_date_approb: new Date(),
        cre_etat: 2, // Approuvé
        etat: 3, // En attente déblocage
        date_modif: new Date(),
      },
    });

    await prisma.auditLog.create({
      data: {
        user_id: req.user!.userId,
        action: 'APPROVE',
        entity: 'DossierCredit',
        entity_id: loanId.toString(),
        old_values: { cre_etat: loan.cre_etat },
        new_values: { cre_etat: 2, ...data },
        ip_address: req.ip || null,
      },
    });

    res.json({ message: 'Loan approved', loan: updatedLoan });
  } catch (error) {
    next(error);
  }
});

// PUT /api/loans/:id/reject - Rejeter un crédit
router.put('/:id/reject', authorize('SUPER_ADMIN', 'DIRECTOR', 'BRANCH_MANAGER', 'CREDIT_OFFICER'), async (req, res, next) => {
  try {
    const loanId = parseInt(req.params.id);
    const { motif, commentaire } = req.body;

    const loan = await prisma.dossierCredit.findUnique({
      where: { id_doss: loanId },
    });

    if (!loan) {
      throw new AppError('Loan not found', 404);
    }

    const updatedLoan = await prisma.dossierCredit.update({
      where: { id_doss: loanId },
      data: {
        cre_etat: 9, // Rejeté
        etat: 9,
        motif,
        detail_obj_dem: commentaire, // Utiliser le champ existant pour le commentaire
        date_etat: new Date(),
        date_modif: new Date(),
      },
    });

    await prisma.auditLog.create({
      data: {
        user_id: req.user!.userId,
        action: 'REJECT',
        entity: 'DossierCredit',
        entity_id: loanId.toString(),
        new_values: { motif, commentaire },
        ip_address: req.ip || null,
      },
    });

    res.json({ message: 'Loan rejected', loan: updatedLoan });
  } catch (error) {
    next(error);
  }
});

// PUT /api/loans/:id/disburse - Débloquer les fonds
router.put('/:id/disburse', authorize('SUPER_ADMIN', 'DIRECTOR', 'BRANCH_MANAGER'), async (req, res, next) => {
  try {
    const loanId = parseInt(req.params.id);
    const { accountId } = req.body;

    const loan = await prisma.dossierCredit.findUnique({
      where: { id_doss: loanId },
    });

    if (!loan) {
      throw new AppError('Loan not found', 404);
    }

    if (loan.cre_etat !== 2) {
      throw new AppError('Loan must be approved before disbursement', 400);
    }

    // Transaction pour débloquer les fonds
    await prisma.$transaction(async (tx) => {
      const account = await tx.compte.findUnique({
        where: { id_cpte: accountId },
      });

      if (!account) {
        throw new AppError('Account not found', 404);
      }

      const amount = Number(loan.cre_mnt_octr || 0);
      const oldBalance = Number(account.solde || 0);
      const newBalance = oldBalance + amount;

      // Créditer le compte
      await tx.compte.update({
        where: { id_cpte: accountId },
        data: {
          solde: newBalance,
          date_modif: new Date(),
        },
      });

      // Créer le mouvement
      await tx.mouvement.create({
        data: {
          id_ag: account.id_ag,
          cpte_interne_cli: accountId,
          date_valeur: new Date(),
          sens: 'c',
          montant: amount,
          devise: 'BIF',
          compte: '2.1.1.1',  // Compte comptable
        },
      });

      // Mettre à jour le dossier
      await tx.dossierCredit.update({
        where: { id_doss: loanId },
        data: {
          cre_etat: 5, // Débloqué
          etat: 5,
          cre_date_debloc: new Date(),
          cre_id_cpte: accountId,
          date_modif: new Date(),
        },
      });
    });

    await prisma.auditLog.create({
      data: {
        user_id: req.user!.userId,
        action: 'DISBURSE',
        entity: 'DossierCredit',
        entity_id: loanId.toString(),
        new_values: { accountId, amount: loan.cre_mnt_octr },
        ip_address: req.ip || null,
      },
    });

    res.json({ message: 'Loan disbursed successfully' });
  } catch (error) {
    next(error);
  }
});

export default router;
