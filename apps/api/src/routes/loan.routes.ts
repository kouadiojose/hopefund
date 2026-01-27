import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { authenticate, authorize } from '../middleware/auth';
import { AppError } from '../middleware/error-handler';
import { config } from '../config';

const router = Router();

router.use(authenticate);

// Helper function to generate payment schedule
function generatePaymentSchedule(
  montant: number,
  tauxAnnuel: number,
  dureeMois: number,
  dateDebut: Date = new Date()
): Array<{
  num_ech: number;
  date_ech: Date;
  mnt_capital: number;
  mnt_int: number;
  solde_capital: number;
  solde_int: number;
}> {
  if (montant <= 0 || dureeMois <= 0) return [];

  const tauxMensuel = tauxAnnuel / 100 / 12;
  const capitalParEcheance = montant / dureeMois;
  let soldeRestant = montant;
  const echeances = [];

  for (let i = 1; i <= dureeMois; i++) {
    const interets = soldeRestant * tauxMensuel;
    const capital = capitalParEcheance;
    soldeRestant -= capital;

    const dateEch = new Date(dateDebut);
    dateEch.setMonth(dateEch.getMonth() + i);

    echeances.push({
      num_ech: i,
      date_ech: dateEch,
      mnt_capital: Math.round(capital),
      mnt_int: Math.round(interets),
      solde_capital: Math.round(capital), // Initially, full amount is due
      solde_int: Math.round(interets),
    });
  }

  return echeances;
}

// GET /api/loans/portfolio/stats - Statistiques du portefeuille pour le CEO
router.get('/portfolio/stats', authorize('SUPER_ADMIN', 'DIRECTOR', 'BRANCH_MANAGER'), async (req, res, next) => {
  try {
    // Statistiques par état de crédit
    const statsByStatus = await prisma.$queryRaw`
      SELECT
        cre_etat,
        COUNT(*) as count,
        COALESCE(SUM(cre_mnt_octr), 0) as montant_total
      FROM ad_dcr
      WHERE cre_etat IS NOT NULL
      GROUP BY cre_etat
      ORDER BY cre_etat
    ` as any[];

    // Montant total du portefeuille actif (décaissés)
    const portfolioTotal = await prisma.$queryRaw`
      SELECT
        COUNT(*) as nb_credits_actifs,
        COALESCE(SUM(cre_mnt_octr), 0) as encours_total
      FROM ad_dcr
      WHERE cre_etat = 5
    ` as any[];

    // Montants en retard (PAR - Portfolio at Risk)
    const parStats = await prisma.$queryRaw`
      SELECT
        COUNT(DISTINCT d.id_doss) as nb_credits_retard,
        COUNT(DISTINCT d.id_client) as nb_clients_retard,
        COALESCE(SUM(e.solde_capital + e.solde_int), 0) as montant_retard
      FROM ad_dcr d
      JOIN ad_sre e ON d.id_doss = e.id_doss AND d.id_ag = e.id_ag
      WHERE d.cre_etat IN (5, 8)
        AND e.date_ech < CURRENT_DATE
        AND (e.etat IS NULL OR e.etat != 2)
        AND (e.solde_capital > 0 OR e.solde_int > 0)
    ` as any[];

    // Répartition PAR par tranche de retard
    const parByAge = await prisma.$queryRaw`
      SELECT
        CASE
          WHEN EXTRACT(DAY FROM (CURRENT_DATE - e.date_ech)) <= 30 THEN '1-30 jours'
          WHEN EXTRACT(DAY FROM (CURRENT_DATE - e.date_ech)) <= 60 THEN '31-60 jours'
          WHEN EXTRACT(DAY FROM (CURRENT_DATE - e.date_ech)) <= 90 THEN '61-90 jours'
          ELSE '90+ jours'
        END as tranche,
        COUNT(DISTINCT d.id_doss) as nb_credits,
        COALESCE(SUM(e.solde_capital + e.solde_int), 0) as montant
      FROM ad_dcr d
      JOIN ad_sre e ON d.id_doss = e.id_doss AND d.id_ag = e.id_ag
      WHERE d.cre_etat IN (5, 8)
        AND e.date_ech < CURRENT_DATE
        AND (e.etat IS NULL OR e.etat != 2)
        AND (e.solde_capital > 0 OR e.solde_int > 0)
      GROUP BY
        CASE
          WHEN EXTRACT(DAY FROM (CURRENT_DATE - e.date_ech)) <= 30 THEN '1-30 jours'
          WHEN EXTRACT(DAY FROM (CURRENT_DATE - e.date_ech)) <= 60 THEN '31-60 jours'
          WHEN EXTRACT(DAY FROM (CURRENT_DATE - e.date_ech)) <= 90 THEN '61-90 jours'
          ELSE '90+ jours'
        END
      ORDER BY
        CASE
          WHEN EXTRACT(DAY FROM (CURRENT_DATE - e.date_ech)) <= 30 THEN 1
          WHEN EXTRACT(DAY FROM (CURRENT_DATE - e.date_ech)) <= 60 THEN 2
          WHEN EXTRACT(DAY FROM (CURRENT_DATE - e.date_ech)) <= 90 THEN 3
          ELSE 4
        END
    ` as any[];

    // Demandes récentes (derniers 30 jours)
    const recentDemands = await prisma.$queryRaw`
      SELECT
        COUNT(*) as total,
        COUNT(CASE WHEN cre_etat = 1 THEN 1 END) as en_analyse,
        COUNT(CASE WHEN cre_etat = 2 THEN 1 END) as approuves,
        COUNT(CASE WHEN cre_etat = 9 THEN 1 END) as rejetes,
        COALESCE(SUM(mnt_dem), 0) as montant_demande
      FROM ad_dcr
      WHERE date_dem >= CURRENT_DATE - INTERVAL '30 days'
    ` as any[];

    // Remboursements du mois
    const monthlyRepayments = await prisma.$queryRaw`
      SELECT
        COALESCE(SUM(mnt_paye), 0) as total_rembourse,
        COUNT(CASE WHEN etat = 2 THEN 1 END) as echeances_payees
      FROM ad_sre
      WHERE date_paiement >= DATE_TRUNC('month', CURRENT_DATE)
        AND date_paiement < DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month'
    ` as any[];

    // Formater les statistiques par état
    const statusLabels: Record<number, string> = {
      1: 'En analyse',
      2: 'Approuvé',
      3: 'Att. décaissement',
      5: 'Actif',
      8: 'En retard',
      9: 'Rejeté',
      10: 'Soldé',
    };

    const formattedStatsByStatus = statsByStatus.map((s: any) => ({
      etat: s.cre_etat,
      label: statusLabels[s.cre_etat] || `État ${s.cre_etat}`,
      count: Number(s.count || 0),
      montant: Number(s.montant_total || 0),
    }));

    // Calculer le PAR ratio
    const encoursTotal = Number(portfolioTotal[0]?.encours_total || 0);
    const montantRetard = Number(parStats[0]?.montant_retard || 0);
    const parRatio = encoursTotal > 0 ? (montantRetard / encoursTotal) * 100 : 0;

    res.json({
      portfolio: {
        nb_credits_actifs: Number(portfolioTotal[0]?.nb_credits_actifs || 0),
        encours_total: encoursTotal,
      },
      par: {
        nb_credits_retard: Number(parStats[0]?.nb_credits_retard || 0),
        nb_clients_retard: Number(parStats[0]?.nb_clients_retard || 0),
        montant_retard: montantRetard,
        par_ratio: Math.round(parRatio * 100) / 100,
      },
      par_by_age: parByAge.map((p: any) => ({
        tranche: p.tranche,
        nb_credits: Number(p.nb_credits || 0),
        montant: Number(p.montant || 0),
      })),
      stats_by_status: formattedStatsByStatus,
      recent_demands: {
        total: Number(recentDemands[0]?.total || 0),
        en_analyse: Number(recentDemands[0]?.en_analyse || 0),
        approuves: Number(recentDemands[0]?.approuves || 0),
        rejetes: Number(recentDemands[0]?.rejetes || 0),
        montant_demande: Number(recentDemands[0]?.montant_demande || 0),
      },
      monthly_repayments: {
        total_rembourse: Number(monthlyRepayments[0]?.total_rembourse || 0),
        echeances_payees: Number(monthlyRepayments[0]?.echeances_payees || 0),
      },
    });
  } catch (error) {
    console.error('Error fetching portfolio stats:', error);
    next(error);
  }
});

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
      num_ech: e.id_ech,
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
      num_ech: e.id_ech,
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
    const search = req.query.search as string;

    const where: any = {};

    if (req.user!.agenceId && !['SUPER_ADMIN', 'DIRECTOR'].includes(req.user!.role)) {
      where.id_ag = req.user!.agenceId;
    }

    if (status) {
      const statusInt = parseInt(status);
      // Filtrer par cre_etat OU etat (certains dossiers n'ont que etat renseigné)
      where.OR = [
        { cre_etat: statusInt },
        { cre_etat: null, etat: statusInt },
      ];
    }

    if (clientId) {
      where.id_client = clientId;
    }

    // Recherche par ID de dossier ou nom de client
    if (search && search.trim()) {
      const searchTerm = search.trim();
      const searchAsNumber = parseInt(searchTerm, 10);

      // Si c'est un nombre, chercher par ID de dossier en priorité
      if (!isNaN(searchAsNumber) && searchAsNumber > 0) {
        // Recherche exacte par ID - prioritaire
        if (where.OR) {
          // Si on a déjà un filtre status, combiner avec AND
          const statusOR = where.OR;
          delete where.OR;
          where.AND = [
            { OR: statusOR },
            { id_doss: searchAsNumber },
          ];
        } else {
          where.id_doss = searchAsNumber;
        }
      } else {
        // Recherche par nom de client (texte)
        const searchConditions: any[] = [
          { client: { pp_nom: { contains: searchTerm, mode: 'insensitive' } } },
          { client: { pp_prenom: { contains: searchTerm, mode: 'insensitive' } } },
          { client: { pm_raison_sociale: { contains: searchTerm, mode: 'insensitive' } } },
        ];

        if (where.OR) {
          const statusOR = where.OR;
          delete where.OR;
          where.AND = [
            { OR: statusOR },
            { OR: searchConditions },
          ];
        } else {
          where.OR = searchConditions;
        }
      }
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

    if (isNaN(loanId)) {
      throw new AppError('Invalid loan ID', 400);
    }

    // Récupérer le dossier de crédit sans include pour éviter les erreurs de relation
    const loan = await prisma.dossierCredit.findUnique({
      where: { id_doss: loanId },
    });

    if (!loan) {
      throw new AppError('Loan not found', 404);
    }

    // Récupérer le client séparément
    let client = null;
    try {
      client = await prisma.client.findFirst({
        where: {
          id_client: loan.id_client,
          id_ag: loan.id_ag,
        },
      });
    } catch (clientError) {
      console.error('Error fetching client:', clientError);
    }

    // Récupérer l'historique des paiements depuis ad_sre (table réelle des remboursements)
    let paiements: any[] = [];
    try {
      paiements = await prisma.$queryRawUnsafe(`
        SELECT id_ech, num_remb, date_remb, mnt_remb_cap, mnt_remb_int, mnt_remb_pen, mnt_remb_gar, annul_remb, date_creation
        FROM ad_sre
        WHERE id_doss = $1 AND id_ag = $2
        ORDER BY date_remb ASC, num_remb ASC
      `, loanId, loan.id_ag) as any[];
    } catch (paiementsError) {
      console.error('Error fetching paiements from ad_sre:', paiementsError);
    }

    // Récupérer les garanties séparément
    let garanties: any[] = [];
    try {
      garanties = await prisma.garantie.findMany({
        where: {
          id_doss: loanId,
          id_ag: loan.id_ag,
        },
      });
    } catch (garantiesError) {
      console.error('Error fetching garanties:', garantiesError);
    }

    // Calculer les totaux depuis les paiements réels
    const totalCapitalRembourse = paiements.reduce((sum, p) => sum + Number(p.mnt_remb_cap || 0), 0);
    const totalInteretRembourse = paiements.reduce((sum, p) => sum + Number(p.mnt_remb_int || 0), 0);
    const totalPenaliteRembourse = paiements.reduce((sum, p) => sum + Number(p.mnt_remb_pen || 0), 0);
    const totalRembourse = totalCapitalRembourse + totalInteretRembourse + totalPenaliteRembourse;
    const montantOctroye = Number(loan.cre_mnt_octr || 0);
    const soldeCapital = montantOctroye - totalCapitalRembourse;

    // Formater les paiements pour l'interface
    const echeances = paiements.map((p, index) => ({
      id_ech: p.id_ech,
      num_ech: p.num_remb || (index + 1),
      date_ech: p.date_remb, // Date du paiement
      date_paiement: p.date_remb,
      mnt_capital: Number(p.mnt_remb_cap || 0),
      mnt_int: Number(p.mnt_remb_int || 0),
      mnt_paye: Number(p.mnt_remb_cap || 0) + Number(p.mnt_remb_int || 0) + Number(p.mnt_remb_pen || 0),
      mnt_penalite: Number(p.mnt_remb_pen || 0),
      solde_capital: 0, // Sera calculé si nécessaire
      solde_int: 0,
      etat: p.annul_remb ? 3 : 2, // 2 = payé, 3 = annulé
      annule: p.annul_remb === 1,
    }));

    res.json({
      ...loan,
      client,
      echeances,
      paiements: paiements.map(p => ({
        id_ech: p.id_ech,
        num_remb: p.num_remb,
        date_remb: p.date_remb,
        mnt_remb_cap: Number(p.mnt_remb_cap || 0),
        mnt_remb_int: Number(p.mnt_remb_int || 0),
        mnt_remb_pen: Number(p.mnt_remb_pen || 0),
        mnt_remb_gar: Number(p.mnt_remb_gar || 0),
        total: Number(p.mnt_remb_cap || 0) + Number(p.mnt_remb_int || 0) + Number(p.mnt_remb_pen || 0),
        annule: p.annul_remb === 1,
        date_creation: p.date_creation,
      })),
      garanties,
      resume: {
        montantOctroye,
        totalCapital: totalCapitalRembourse,
        totalInteret: totalInteretRembourse,
        totalPenalite: totalPenaliteRembourse,
        totalDu: montantOctroye, // Le montant dû est le montant octroyé
        totalPaye: totalRembourse,
        soldeRestant: soldeCapital > 0 ? soldeCapital : 0,
        nombrePaiements: paiements.length,
        creditSolde: soldeCapital <= 0,
      },
    });
  } catch (error) {
    console.error('Error in loan detail:', error);
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

    const disbursementDate = new Date();

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
          date_modif: disbursementDate,
        },
      });

      // Créer le mouvement
      await tx.mouvement.create({
        data: {
          id_ag: account.id_ag,
          cpte_interne_cli: accountId,
          date_valeur: disbursementDate,
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
          cre_date_debloc: disbursementDate,
          cre_id_cpte: accountId,
          date_modif: disbursementDate,
        },
      });

      // Générer et créer l'échéancier
      const duree = Number(loan.duree_mois || 12);
      const taux = Number(loan.tx_interet_lcr || 0);
      const schedule = generatePaymentSchedule(amount, taux, duree, disbursementDate);

      // Créer les échéances en base
      for (const ech of schedule) {
        await tx.echeance.create({
          data: {
            id_ag: loan.id_ag,
            id_doss: loanId,
            date_ech: ech.date_ech,
            mnt_capital: ech.mnt_capital,
            mnt_int: ech.mnt_int,
            solde_capital: ech.solde_capital,
            solde_int: ech.solde_int,
            mnt_paye: 0,
            etat: 1, // Non échu
          },
        });
      }
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

// POST /api/loans/:id/generate-schedule - Générer l'échéancier pour un prêt existant sans échéancier
router.post('/:id/generate-schedule', authorize('SUPER_ADMIN', 'DIRECTOR', 'BRANCH_MANAGER'), async (req, res, next) => {
  try {
    const loanId = parseInt(req.params.id);

    const loan = await prisma.dossierCredit.findUnique({
      where: { id_doss: loanId },
      include: { echeances: true },
    });

    if (!loan) {
      throw new AppError('Loan not found', 404);
    }

    // Vérifier si le prêt a déjà des échéances
    if (loan.echeances && loan.echeances.length > 0) {
      throw new AppError('Ce prêt a déjà un échéancier. Utilisez un autre endpoint pour le régénérer.', 400);
    }

    // Vérifier que le prêt est décaissé
    if (!loan.cre_date_debloc && loan.cre_etat !== 5 && loan.etat !== 5) {
      throw new AppError('Ce prêt n\'est pas encore décaissé', 400);
    }

    const amount = Number(loan.cre_mnt_octr || loan.mnt_dem || 0);
    const duree = Number(loan.duree_mois || 12);
    const taux = Number(loan.tx_interet_lcr || 0);
    const startDate = loan.cre_date_debloc || loan.cre_date_approb || new Date();

    if (amount <= 0) {
      throw new AppError('Montant du prêt invalide', 400);
    }

    const schedule = generatePaymentSchedule(amount, taux, duree, new Date(startDate));

    // Créer les échéances en base
    await prisma.$transaction(async (tx) => {
      for (const ech of schedule) {
        await tx.echeance.create({
          data: {
            id_ag: loan.id_ag,
            id_doss: loanId,
            date_ech: ech.date_ech,
            mnt_capital: ech.mnt_capital,
            mnt_int: ech.mnt_int,
            solde_capital: ech.solde_capital,
            solde_int: ech.solde_int,
            mnt_paye: 0,
            etat: 1, // Non échu
          },
        });
      }
    });

    await prisma.auditLog.create({
      data: {
        user_id: req.user!.userId,
        action: 'GENERATE_SCHEDULE',
        entity: 'DossierCredit',
        entity_id: loanId.toString(),
        new_values: { echeances_count: schedule.length, montant: amount, duree, taux },
        ip_address: req.ip || null,
      },
    });

    res.json({
      message: `Échéancier généré avec succès (${schedule.length} échéances)`,
      schedule: schedule.map(e => ({
        num_ech: e.num_ech,
        date_ech: e.date_ech,
        mnt_capital: e.mnt_capital,
        mnt_int: e.mnt_int,
        total: e.mnt_capital + e.mnt_int,
      })),
    });
  } catch (error) {
    next(error);
  }
});

// PUT /api/loans/:id/mark-closed - Marquer un prêt comme soldé (pour anciens prêts sans échéancier)
router.put('/:id/mark-closed', authorize('SUPER_ADMIN', 'DIRECTOR', 'BRANCH_MANAGER'), async (req, res, next) => {
  try {
    const loanId = parseInt(req.params.id);
    const { motif } = req.body;

    const loan = await prisma.dossierCredit.findUnique({
      where: { id_doss: loanId },
      include: { echeances: true },
    });

    if (!loan) {
      throw new AppError('Prêt non trouvé', 404);
    }

    // If there are echéances with remaining balance, warn
    const hasRemainingBalance = loan.echeances?.some(e =>
      (Number(e.solde_capital || 0) + Number(e.solde_int || 0)) > 0
    );

    if (hasRemainingBalance) {
      return res.status(400).json({
        error: 'Ce prêt a encore des échéances avec un solde restant. Utilisez le remboursement normal.',
        hasRemainingBalance: true,
      });
    }

    // Mark all echeances as paid if any exist
    if (loan.echeances && loan.echeances.length > 0) {
      await prisma.echeance.updateMany({
        where: { id_doss: loanId, id_ag: loan.id_ag },
        data: {
          etat: 2, // Payé
          solde_capital: 0,
          solde_int: 0,
          date_paiement: new Date(),
        },
      });
    }

    // Update loan status to Soldé
    await prisma.dossierCredit.update({
      where: { id_doss: loanId },
      data: {
        cre_etat: 10, // Soldé
        etat: 10,
        date_modif: new Date(),
      },
    });

    // Audit log
    try {
      await prisma.auditLog.create({
        data: {
          user_id: req.user!.userId,
          action: 'CLOSE_LOAN',
          entity: 'DossierCredit',
          entity_id: loanId.toString(),
          new_values: JSON.parse(JSON.stringify({
            previous_etat: loan.cre_etat || loan.etat,
            new_etat: 10,
            motif: motif || 'Marqué comme soldé manuellement',
          })),
          ip_address: req.ip || null,
        },
      });
    } catch (auditError) {
      console.warn('Could not create audit log:', auditError);
    }

    res.json({
      message: 'Prêt marqué comme soldé',
      loan: { id_doss: loanId, cre_etat: 10 },
    });
  } catch (error) {
    next(error);
  }
});

// PUT /api/loans/:id/reopen - Réouvrir un prêt soldé (si erreur)
router.put('/:id/reopen', authorize('SUPER_ADMIN', 'DIRECTOR'), async (req, res, next) => {
  try {
    const loanId = parseInt(req.params.id);
    const { motif } = req.body;

    const loan = await prisma.dossierCredit.findUnique({
      where: { id_doss: loanId },
    });

    if (!loan) {
      throw new AppError('Prêt non trouvé', 404);
    }

    if (loan.cre_etat !== 10 && loan.cre_etat !== 7 && loan.etat !== 10 && loan.etat !== 7) {
      throw new AppError('Ce prêt n\'est pas soldé', 400);
    }

    // Reopen loan as active
    await prisma.dossierCredit.update({
      where: { id_doss: loanId },
      data: {
        cre_etat: 5, // Actif
        etat: 5,
        date_modif: new Date(),
      },
    });

    // Audit log
    try {
      await prisma.auditLog.create({
        data: {
          user_id: req.user!.userId,
          action: 'REOPEN_LOAN',
          entity: 'DossierCredit',
          entity_id: loanId.toString(),
          new_values: JSON.parse(JSON.stringify({
            previous_etat: loan.cre_etat || loan.etat,
            new_etat: 5,
            motif: motif || 'Réouvert manuellement',
          })),
          ip_address: req.ip || null,
        },
      });
    } catch (auditError) {
      console.warn('Could not create audit log:', auditError);
    }

    res.json({
      message: 'Prêt réouvert avec succès',
      loan: { id_doss: loanId, cre_etat: 5 },
    });
  } catch (error) {
    next(error);
  }
});

export default router;
