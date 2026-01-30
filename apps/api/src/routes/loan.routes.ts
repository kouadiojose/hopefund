import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { authenticate, authorize } from '../middleware/auth';
import { AppError } from '../middleware/error-handler';
import { config } from '../config';
import { logger } from '../utils/logger';
import { ecritureDeblocageCredit } from '../services/comptabilite.service';

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

// Helper: Analyze loan status by comparing theoretical schedule with actual payments
interface LoanAnalysis {
  isOverdue: boolean;
  daysOverdue: number;
  expectedPayments: number;
  actualPayments: number;
  expectedCapital: number;
  paidCapital: number;
  overdueCapital: number;
  overdueInterest: number;
  overdueTotal: number;
  nextDueDate: Date | null;
  nextDueAmount: number;
}

function analyzeLoanStatus(
  montantOctroye: number,
  dureeMois: number,
  tauxInteret: number,
  dateDeblocage: Date | null,
  paiements: Array<{ mnt_remb_cap: number; mnt_remb_int: number; date_remb: Date }>
): LoanAnalysis {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Default result for loans without disbursement date
  if (!dateDeblocage || montantOctroye <= 0 || dureeMois <= 0) {
    return {
      isOverdue: false,
      daysOverdue: 0,
      expectedPayments: 0,
      actualPayments: paiements.length,
      expectedCapital: 0,
      paidCapital: paiements.reduce((s, p) => s + Number(p.mnt_remb_cap || 0), 0),
      overdueCapital: 0,
      overdueInterest: 0,
      overdueTotal: 0,
      nextDueDate: null,
      nextDueAmount: 0,
    };
  }

  // Generate theoretical schedule
  const schedule = generatePaymentSchedule(montantOctroye, tauxInteret, dureeMois, dateDeblocage);

  // Calculate total paid
  const paidCapital = paiements.reduce((s, p) => s + Number(p.mnt_remb_cap || 0), 0);
  const paidInterest = paiements.reduce((s, p) => s + Number(p.mnt_remb_int || 0), 0);

  // Find expected payments up to today
  const pastDueSchedule = schedule.filter(e => e.date_ech <= today);
  const expectedPayments = pastDueSchedule.length;
  const expectedCapital = pastDueSchedule.reduce((s, e) => s + e.mnt_capital, 0);
  const expectedInterest = pastDueSchedule.reduce((s, e) => s + e.mnt_int, 0);

  // Calculate overdue amounts
  const overdueCapital = Math.max(0, expectedCapital - paidCapital);
  const overdueInterest = Math.max(0, expectedInterest - paidInterest);
  const overdueTotal = overdueCapital + overdueInterest;

  // Find how many days overdue
  let daysOverdue = 0;
  if (overdueTotal > 0 && pastDueSchedule.length > 0) {
    // Find the oldest unpaid echeance
    let unpaidCapitalRemaining = overdueCapital;
    for (const ech of pastDueSchedule) {
      if (unpaidCapitalRemaining > 0) {
        daysOverdue = Math.floor((today.getTime() - ech.date_ech.getTime()) / (1000 * 60 * 60 * 24));
        unpaidCapitalRemaining -= ech.mnt_capital;
      }
    }
  }

  // Find next due date
  const futureSchedule = schedule.filter(e => e.date_ech > today);
  const nextDue = futureSchedule.length > 0 ? futureSchedule[0] : null;

  return {
    isOverdue: overdueTotal > 0,
    daysOverdue,
    expectedPayments,
    actualPayments: paiements.length,
    expectedCapital,
    paidCapital,
    overdueCapital,
    overdueInterest,
    overdueTotal,
    nextDueDate: nextDue ? nextDue.date_ech : null,
    nextDueAmount: nextDue ? (nextDue.mnt_capital + nextDue.mnt_int) : 0,
  };
}

// GET /api/loans/portfolio/stats - Statistiques du portefeuille pour le CEO
router.get('/portfolio/stats', authorize('SUPER_ADMIN', 'DIRECTOR', 'BRANCH_MANAGER'), async (req, res, next) => {
  try {
    // Get all active loans with their payments
    const activeLoans = await prisma.$queryRaw`
      SELECT
        d.id_doss, d.id_ag, d.id_client, d.cre_mnt_octr, d.cre_date_debloc,
        d.duree_mois, d.tx_interet_lcr, d.cre_etat
      FROM ad_dcr d
      WHERE d.cre_etat IN (5, 8) AND d.cre_mnt_octr > 0
    ` as any[];

    // Analyze each active loan
    let nbCreditsEnRetard = 0;
    let montantTotalRetard = 0;
    let clientsEnRetard = new Set<number>();
    const parByAge: Record<string, { count: number; montant: number }> = {
      '1-30 jours': { count: 0, montant: 0 },
      '31-60 jours': { count: 0, montant: 0 },
      '61-90 jours': { count: 0, montant: 0 },
      '90+ jours': { count: 0, montant: 0 },
    };

    for (const loan of activeLoans) {
      // Get payments for this loan
      const paiements = await prisma.$queryRawUnsafe(`
        SELECT date_remb, mnt_remb_cap, mnt_remb_int
        FROM ad_sre
        WHERE id_doss = $1 AND id_ag = $2 AND annul_remb IS DISTINCT FROM 1
      `, loan.id_doss, loan.id_ag) as any[];

      const analysis = analyzeLoanStatus(
        Number(loan.cre_mnt_octr || 0),
        Number(loan.duree_mois || 12),
        Number(loan.tx_interet_lcr || 0),
        loan.cre_date_debloc ? new Date(loan.cre_date_debloc) : null,
        paiements
      );

      if (analysis.isOverdue && analysis.overdueTotal > 0) {
        nbCreditsEnRetard++;
        montantTotalRetard += analysis.overdueTotal;
        clientsEnRetard.add(loan.id_client);

        // Categorize by age
        if (analysis.daysOverdue <= 30) {
          parByAge['1-30 jours'].count++;
          parByAge['1-30 jours'].montant += analysis.overdueTotal;
        } else if (analysis.daysOverdue <= 60) {
          parByAge['31-60 jours'].count++;
          parByAge['31-60 jours'].montant += analysis.overdueTotal;
        } else if (analysis.daysOverdue <= 90) {
          parByAge['61-90 jours'].count++;
          parByAge['61-90 jours'].montant += analysis.overdueTotal;
        } else {
          parByAge['90+ jours'].count++;
          parByAge['90+ jours'].montant += analysis.overdueTotal;
        }
      }
    }

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
      WHERE cre_etat IN (5, 8)
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

    // Remboursements du mois (from actual payments in ad_sre)
    const monthlyRepayments = await prisma.$queryRaw`
      SELECT
        COALESCE(SUM(mnt_remb_cap + mnt_remb_int), 0) as total_rembourse,
        COUNT(*) as nb_paiements
      FROM ad_sre
      WHERE date_remb >= DATE_TRUNC('month', CURRENT_DATE)
        AND date_remb < DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month'
        AND annul_remb IS DISTINCT FROM 1
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
    const parRatio = encoursTotal > 0 ? (montantTotalRetard / encoursTotal) * 100 : 0;

    res.json({
      portfolio: {
        nb_credits_actifs: Number(portfolioTotal[0]?.nb_credits_actifs || 0),
        encours_total: encoursTotal,
      },
      par: {
        nb_credits_retard: nbCreditsEnRetard,
        nb_clients_retard: clientsEnRetard.size,
        montant_retard: Math.round(montantTotalRetard),
        par_ratio: Math.round(parRatio * 100) / 100,
      },
      par_by_age: Object.entries(parByAge).map(([tranche, data]) => ({
        tranche,
        nb_credits: data.count,
        montant: Math.round(data.montant),
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
        nb_paiements: Number(monthlyRepayments[0]?.nb_paiements || 0),
      },
    });
  } catch (error) {
    console.error('Error fetching portfolio stats:', error);
    next(error);
  }
});

// GET /api/loans/delinquent/diagnostic - Diagnostic des données pour les retards
router.get('/delinquent/diagnostic', authorize('SUPER_ADMIN', 'DIRECTOR', 'BRANCH_MANAGER'), async (req, res, next) => {
  try {
    // Compter tous les crédits par état
    const creditsByState = await prisma.$queryRaw`
      SELECT cre_etat, etat, COUNT(*) as count
      FROM ad_dcr
      GROUP BY cre_etat, etat
      ORDER BY cre_etat, etat
    ` as any[];

    // Crédits actifs (cre_etat 5 ou 8)
    const activeLoansCount = await prisma.$queryRaw`
      SELECT COUNT(*) as total
      FROM ad_dcr
      WHERE cre_etat IN (5, 8)
    ` as any[];

    // Crédits avec date de déblocage
    const loansWithDisbursement = await prisma.$queryRaw`
      SELECT COUNT(*) as total
      FROM ad_dcr
      WHERE cre_etat IN (5, 8) AND cre_date_debloc IS NOT NULL
    ` as any[];

    // Crédits avec montant octroyé > 0
    const loansWithAmount = await prisma.$queryRaw`
      SELECT COUNT(*) as total
      FROM ad_dcr
      WHERE cre_etat IN (5, 8) AND cre_mnt_octr > 0
    ` as any[];

    // Crédits qui remplissent toutes les conditions
    const eligibleLoans = await prisma.$queryRaw`
      SELECT COUNT(*) as total
      FROM ad_dcr
      WHERE cre_etat IN (5, 8) AND cre_mnt_octr > 0 AND cre_date_debloc IS NOT NULL
    ` as any[];

    // Échéances dans ad_sre
    const echeancesCount = await prisma.$queryRaw`
      SELECT COUNT(*) as total FROM ad_sre
    ` as any[];

    // Échéances en retard (selon ancienne logique)
    const overdueEcheances = await prisma.$queryRaw`
      SELECT COUNT(*) as total
      FROM ad_sre e
      JOIN ad_dcr d ON e.id_doss = d.id_doss AND e.id_ag = d.id_ag
      WHERE e.date_ech < CURRENT_DATE
        AND (e.etat IS NULL OR e.etat != 2)
        AND (e.solde_capital > 0 OR e.solde_int > 0)
        AND d.cre_etat IN (5, 8)
    ` as any[];

    // Exemple de 5 crédits actifs
    const sampleLoans = await prisma.$queryRaw`
      SELECT id_doss, id_client, cre_etat, etat, cre_mnt_octr, cre_date_debloc, duree_mois, tx_interet_lcr
      FROM ad_dcr
      WHERE cre_etat IN (5, 8) OR etat IN (5, 8)
      LIMIT 5
    ` as any[];

    // Vérifier aussi les crédits avec etat (pas cre_etat)
    const loansWithEtat = await prisma.$queryRaw`
      SELECT COUNT(*) as total
      FROM ad_dcr
      WHERE etat IN (5, 8)
    ` as any[];

    res.json({
      diagnostic: {
        credits_by_state: creditsByState,
        active_loans_cre_etat_5_8: Number(activeLoansCount[0]?.total || 0),
        active_loans_etat_5_8: Number(loansWithEtat[0]?.total || 0),
        loans_with_disbursement_date: Number(loansWithDisbursement[0]?.total || 0),
        loans_with_amount: Number(loansWithAmount[0]?.total || 0),
        eligible_loans: Number(eligibleLoans[0]?.total || 0),
        total_echeances: Number(echeancesCount[0]?.total || 0),
        overdue_echeances: Number(overdueEcheances[0]?.total || 0),
        sample_loans: sampleLoans,
      },
    });
  } catch (error) {
    console.error('Diagnostic error:', error);
    next(error);
  }
});

// GET /api/loans/delinquent - Prêts en retard de paiement (calcul hybride: échéancier ou théorique)
router.get('/delinquent', authorize('SUPER_ADMIN', 'DIRECTOR', 'BRANCH_MANAGER', 'CREDIT_OFFICER'), async (req, res, next) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const minDaysOverdue = parseInt(req.query.daysOverdue as string) || 0;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // 1. Récupérer tous les crédits actifs avec date de déblocage
    // Note: certains crédits utilisent cre_etat, d'autres utilisent etat
    const activeLoans = await prisma.$queryRaw`
      SELECT
        d.id_doss, d.id_ag, d.id_client, d.cre_mnt_octr, d.cre_date_debloc,
        d.duree_mois, d.tx_interet_lcr, d.cre_etat, d.etat,
        d.mnt_dem, d.date_dem, d.cre_date_approb,
        c.pp_nom, c.pp_prenom, c.pm_raison_sociale, c.statut_juridique,
        c.num_port, c.email
      FROM ad_dcr d
      JOIN ad_cli c ON d.id_client = c.id_client AND d.id_ag = c.id_ag
      WHERE (d.cre_etat IN (5, 8) OR d.etat IN (5, 8))
        AND (d.cre_mnt_octr > 0 OR d.mnt_dem > 0)
    ` as any[];

    const overdueLoans: any[] = [];
    const clientsEnRetard = new Set<number>();
    let totalOverdueAmount = 0;
    let totalOverdueSchedules = 0;

    for (const loan of activeLoans) {
      // Utiliser cre_mnt_octr en priorité, sinon mnt_dem
      const montantOctroye = Number(loan.cre_mnt_octr || loan.mnt_dem || 0);
      const dureeMois = Number(loan.duree_mois || 12);
      const tauxInteret = Number(loan.tx_interet_lcr || 0);
      // Utiliser cre_date_debloc en priorité, sinon cre_date_approb, sinon date_dem
      const dateDeblocage = loan.cre_date_debloc ? new Date(loan.cre_date_debloc)
        : loan.cre_date_approb ? new Date(loan.cre_date_approb)
        : loan.date_dem ? new Date(loan.date_dem) : null;

      if (!dateDeblocage || montantOctroye <= 0) continue;

      // 2. Vérifier si le crédit a des échéances dans ad_sre
      const echeances = await prisma.$queryRawUnsafe(`
        SELECT id_ech, date_ech, mnt_capital, mnt_int, solde_capital, solde_int, etat, mnt_paye
        FROM ad_sre
        WHERE id_doss = $1 AND id_ag = $2
        ORDER BY date_ech ASC
      `, loan.id_doss, loan.id_ag) as any[];

      let overdueCapital = 0;
      let overdueInterest = 0;
      let daysOverdue = 0;
      let nbEcheancesRetard = 0;

      if (echeances.length > 0) {
        // 3a. Utiliser les échéances existantes
        for (const ech of echeances) {
          const dateEch = new Date(ech.date_ech);
          const soldeCapital = Number(ech.solde_capital || 0);
          const soldeInt = Number(ech.solde_int || 0);
          const etat = ech.etat;

          // Échéance passée, non payée (etat != 2) et avec solde restant
          if (dateEch < today && etat !== 2 && (soldeCapital > 0 || soldeInt > 0)) {
            overdueCapital += soldeCapital;
            overdueInterest += soldeInt;
            nbEcheancesRetard++;
            const joursRetardEch = Math.floor((today.getTime() - dateEch.getTime()) / (1000 * 60 * 60 * 24));
            daysOverdue = Math.max(daysOverdue, joursRetardEch);
          }
        }
      } else {
        // 3b. Calculer théoriquement basé sur les paramètres du crédit
        const theoreticalSchedule = generatePaymentSchedule(montantOctroye, tauxInteret, dureeMois, dateDeblocage);

        // Calculer ce qui aurait dû être payé jusqu'à aujourd'hui
        for (const ech of theoreticalSchedule) {
          if (ech.date_ech <= today) {
            // Échéance passée - on considère qu'elle n'a pas été payée (pas d'échéances = pas de paiements)
            overdueCapital += ech.mnt_capital;
            overdueInterest += ech.mnt_int;
            nbEcheancesRetard++;
            const joursRetardEch = Math.floor((today.getTime() - ech.date_ech.getTime()) / (1000 * 60 * 60 * 24));
            daysOverdue = Math.max(daysOverdue, joursRetardEch);
          }
        }
      }

      const overdueTotal = overdueCapital + overdueInterest;

      // 4. Filtrer par jours de retard minimum
      if (overdueTotal > 0 && daysOverdue >= minDaysOverdue) {
        overdueLoans.push({
          id_doss: loan.id_doss,
          id_client: loan.id_client,
          montant_octroye: montantOctroye,
          date_deblocage: dateDeblocage,
          duree_mois: dureeMois,
          taux_interet: tauxInteret,
          jours_retard: daysOverdue,
          capital_impaye: Math.round(overdueCapital),
          interet_impaye: Math.round(overdueInterest),
          montant_du: Math.round(overdueTotal),
          nb_echeances_retard: nbEcheancesRetard,
          has_echeances: echeances.length > 0,
          client: {
            id_client: loan.id_client,
            nom: loan.statut_juridique === 1
              ? `${loan.pp_prenom || ''} ${loan.pp_nom || ''}`.trim()
              : loan.pm_raison_sociale,
            telephone: loan.num_port,
            email: loan.email,
          },
          niveau_risque: daysOverdue > 90 ? 'critique' :
                        daysOverdue > 60 ? 'eleve' :
                        daysOverdue > 30 ? 'moyen' : 'faible',
        });

        totalOverdueAmount += overdueTotal;
        totalOverdueSchedules += nbEcheancesRetard;
        clientsEnRetard.add(loan.id_client);
      }
    }

    // Trier par jours de retard (le plus élevé en premier)
    overdueLoans.sort((a, b) => b.jours_retard - a.jours_retard);

    // Paginer
    const total = overdueLoans.length;
    const startIdx = (page - 1) * limit;
    const paginatedLoans = overdueLoans.slice(startIdx, startIdx + limit);

    res.json({
      data: paginatedLoans,
      stats: {
        nb_prets_retard: total,
        nb_clients_retard: clientsEnRetard.size,
        montant_total_retard: Math.round(totalOverdueAmount),
        nb_echeances_retard: totalOverdueSchedules,
      },
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    logger.error('Error fetching delinquent loans:', error);
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

// GET /api/loans/clients/delinquent - Clients avec des retards de paiement (calcul hybride)
router.get('/clients/delinquent', authorize('SUPER_ADMIN', 'DIRECTOR', 'BRANCH_MANAGER', 'CREDIT_OFFICER'), async (req, res, next) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // 1. Récupérer tous les crédits actifs avec leurs clients
    // Note: certains crédits utilisent cre_etat, d'autres utilisent etat
    const activeLoans = await prisma.$queryRaw`
      SELECT
        d.id_doss, d.id_ag, d.id_client, d.cre_mnt_octr, d.cre_date_debloc,
        d.duree_mois, d.tx_interet_lcr, d.mnt_dem, d.date_dem, d.cre_date_approb,
        c.pp_nom, c.pp_prenom, c.pm_raison_sociale, c.statut_juridique,
        c.num_port, c.email, c.adresse
      FROM ad_dcr d
      JOIN ad_cli c ON d.id_client = c.id_client AND d.id_ag = c.id_ag
      WHERE (d.cre_etat IN (5, 8) OR d.etat IN (5, 8))
        AND (d.cre_mnt_octr > 0 OR d.mnt_dem > 0)
    ` as any[];

    // Map pour agréger par client
    const clientStats = new Map<number, any>();
    let totalOverdueAmount = 0;
    let totalOverdueLoans = 0;
    let totalOverdueSchedules = 0;

    for (const loan of activeLoans) {
      // Utiliser cre_mnt_octr en priorité, sinon mnt_dem
      const montantOctroye = Number(loan.cre_mnt_octr || loan.mnt_dem || 0);
      const dureeMois = Number(loan.duree_mois || 12);
      const tauxInteret = Number(loan.tx_interet_lcr || 0);
      // Utiliser cre_date_debloc en priorité, sinon cre_date_approb, sinon date_dem
      const dateDeblocage = loan.cre_date_debloc ? new Date(loan.cre_date_debloc)
        : loan.cre_date_approb ? new Date(loan.cre_date_approb)
        : loan.date_dem ? new Date(loan.date_dem) : null;

      if (!dateDeblocage || montantOctroye <= 0) continue;

      // 2. Vérifier si le crédit a des échéances dans ad_sre
      const echeances = await prisma.$queryRawUnsafe(`
        SELECT id_ech, date_ech, mnt_capital, mnt_int, solde_capital, solde_int, etat
        FROM ad_sre
        WHERE id_doss = $1 AND id_ag = $2
        ORDER BY date_ech ASC
      `, loan.id_doss, loan.id_ag) as any[];

      let loanOverdueCapital = 0;
      let loanOverdueInterest = 0;
      let loanDaysOverdue = 0;
      let loanNbEcheancesRetard = 0;
      let premiereEcheanceRetard: Date | null = null;

      if (echeances.length > 0) {
        // 3a. Utiliser les échéances existantes
        for (const ech of echeances) {
          const dateEch = new Date(ech.date_ech);
          const soldeCapital = Number(ech.solde_capital || 0);
          const soldeInt = Number(ech.solde_int || 0);
          const etat = ech.etat;

          if (dateEch < today && etat !== 2 && (soldeCapital > 0 || soldeInt > 0)) {
            loanOverdueCapital += soldeCapital;
            loanOverdueInterest += soldeInt;
            loanNbEcheancesRetard++;
            const joursRetardEch = Math.floor((today.getTime() - dateEch.getTime()) / (1000 * 60 * 60 * 24));
            loanDaysOverdue = Math.max(loanDaysOverdue, joursRetardEch);
            if (!premiereEcheanceRetard || dateEch < premiereEcheanceRetard) {
              premiereEcheanceRetard = dateEch;
            }
          }
        }
      } else {
        // 3b. Calculer théoriquement
        const theoreticalSchedule = generatePaymentSchedule(montantOctroye, tauxInteret, dureeMois, dateDeblocage);

        for (const ech of theoreticalSchedule) {
          if (ech.date_ech <= today) {
            loanOverdueCapital += ech.mnt_capital;
            loanOverdueInterest += ech.mnt_int;
            loanNbEcheancesRetard++;
            const joursRetardEch = Math.floor((today.getTime() - ech.date_ech.getTime()) / (1000 * 60 * 60 * 24));
            loanDaysOverdue = Math.max(loanDaysOverdue, joursRetardEch);
            if (!premiereEcheanceRetard || ech.date_ech < premiereEcheanceRetard) {
              premiereEcheanceRetard = ech.date_ech;
            }
          }
        }
      }

      const loanOverdueTotal = loanOverdueCapital + loanOverdueInterest;

      // 4. Agréger par client si en retard
      if (loanOverdueTotal > 0) {
        totalOverdueAmount += loanOverdueTotal;
        totalOverdueLoans++;
        totalOverdueSchedules += loanNbEcheancesRetard;

        if (!clientStats.has(loan.id_client)) {
          clientStats.set(loan.id_client, {
            id_client: loan.id_client,
            nom: loan.statut_juridique === 1
              ? `${loan.pp_prenom || ''} ${loan.pp_nom || ''}`.trim()
              : loan.pm_raison_sociale,
            telephone: loan.num_port,
            email: loan.email,
            adresse: loan.adresse,
            nb_prets: 0,
            nb_echeances_retard: 0,
            max_jours_retard: 0,
            montant_total_retard: 0,
            premiere_echeance_retard: null,
          });
        }

        const stat = clientStats.get(loan.id_client);
        stat.nb_prets++;
        stat.nb_echeances_retard += loanNbEcheancesRetard;
        stat.max_jours_retard = Math.max(stat.max_jours_retard, loanDaysOverdue);
        stat.montant_total_retard += loanOverdueTotal;
        if (!stat.premiere_echeance_retard || (premiereEcheanceRetard && premiereEcheanceRetard < stat.premiere_echeance_retard)) {
          stat.premiere_echeance_retard = premiereEcheanceRetard;
        }
      }
    }

    // Convertir en array et ajouter niveau de risque
    const delinquentClients = Array.from(clientStats.values())
      .map(c => ({
        ...c,
        montant_total_retard: Math.round(c.montant_total_retard),
        niveau_risque: c.max_jours_retard > 90 ? 'critique' :
                      c.max_jours_retard > 60 ? 'eleve' :
                      c.max_jours_retard > 30 ? 'moyen' : 'faible',
      }))
      .sort((a, b) => b.montant_total_retard - a.montant_total_retard);

    // Paginer
    const total = delinquentClients.length;
    const startIdx = (page - 1) * limit;
    const paginatedClients = delinquentClients.slice(startIdx, startIdx + limit);

    res.json({
      data: paginatedClients,
      stats: {
        nb_prets_retard: totalOverdueLoans,
        nb_clients_retard: total,
        montant_total_retard: Math.round(totalOverdueAmount),
        nb_echeances_retard: totalOverdueSchedules,
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

    // Analyze loan status (overdue calculation)
    const loanAnalysis = analyzeLoanStatus(
      montantOctroye,
      Number(loan.duree_mois || 12),
      Number(loan.tx_interet_lcr || 0),
      loan.cre_date_debloc ? new Date(loan.cre_date_debloc) : null,
      paiements.map(p => ({
        mnt_remb_cap: Number(p.mnt_remb_cap || 0),
        mnt_remb_int: Number(p.mnt_remb_int || 0),
        date_remb: p.date_remb,
      }))
    );

    // Generate theoretical schedule for display
    const theoreticalSchedule = loan.cre_date_debloc
      ? generatePaymentSchedule(
          montantOctroye,
          Number(loan.tx_interet_lcr || 0),
          Number(loan.duree_mois || 12),
          new Date(loan.cre_date_debloc)
        )
      : [];

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
      // Échéancier théorique (basé sur paramètres du crédit)
      echeancier_theorique: theoreticalSchedule.map((e, idx) => ({
        num_ech: e.num_ech,
        date_ech: e.date_ech,
        mnt_capital: e.mnt_capital,
        mnt_interet: e.mnt_int,
        montant_total: e.mnt_capital + e.mnt_int,
      })),
      // Analyse des retards
      analyse: {
        en_retard: loanAnalysis.isOverdue,
        jours_retard: loanAnalysis.daysOverdue,
        echeances_attendues: loanAnalysis.expectedPayments,
        paiements_effectues: loanAnalysis.actualPayments,
        capital_attendu: Math.round(loanAnalysis.expectedCapital),
        capital_paye: Math.round(loanAnalysis.paidCapital),
        capital_impaye: Math.round(loanAnalysis.overdueCapital),
        interet_impaye: Math.round(loanAnalysis.overdueInterest),
        montant_impaye: Math.round(loanAnalysis.overdueTotal),
        prochaine_echeance: loanAnalysis.nextDueDate,
        montant_prochaine_echeance: Math.round(loanAnalysis.nextDueAmount),
        niveau_risque: loanAnalysis.daysOverdue > 90 ? 'critique' :
                       loanAnalysis.daysOverdue > 60 ? 'eleve' :
                       loanAnalysis.daysOverdue > 30 ? 'moyen' :
                       loanAnalysis.isOverdue ? 'faible' : 'aucun',
      },
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

    // Générer les écritures comptables pour le déblocage
    let ecrituresIds: number[] = [];
    try {
      const fraisDossier = Number(loan.mnt_frais_doss || 0);
      const assurance = Number(loan.mnt_assurance || 0);
      const objetCredit = Number(loan.obj_dem || 6); // 6 = Autres par défaut

      ecrituresIds = await ecritureDeblocageCredit(
        loan.id_ag,
        loanId,
        accountId,
        Number(loan.cre_mnt_octr || 0),
        objetCredit,
        fraisDossier,
        assurance
      );
    } catch (err) {
      logger.warn(`Échec création écritures comptables pour déblocage crédit ${loanId}: ${err}`);
    }

    await prisma.auditLog.create({
      data: {
        user_id: req.user!.userId,
        action: 'DISBURSE',
        entity: 'DossierCredit',
        entity_id: loanId.toString(),
        new_values: { accountId, amount: loan.cre_mnt_octr, ecrituresIds },
        ip_address: req.ip || null,
      },
    });

    logger.info(`Loan ${loanId} disbursed to account ${accountId}, écritures: ${ecrituresIds.join(', ')}`);

    res.json({ message: 'Loan disbursed successfully', ecrituresIds });
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
