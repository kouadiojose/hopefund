import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();

router.use(authenticate);
router.use(authorize('SUPER_ADMIN', 'DIRECTOR', 'BRANCH_MANAGER', 'DIRECTOR'));

// GET /api/reports/dashboard - Tableau de bord général
router.get('/dashboard', async (req, res, next) => {
  try {
    const agencyId = req.user!.agenceId;

    const where: any = {};
    if (agencyId && !['SUPER_ADMIN', 'DIRECTOR'].includes(req.user!.role)) {
      where.id_ag = agencyId;
    }

    // Statistiques générales
    const [
      totalClients,
      totalAccounts,
      totalLoans,
      activeLoans,
    ] = await Promise.all([
      prisma.client.count({ where }),
      prisma.compte.count({ where }),
      prisma.dossierCredit.count({ where }),
      prisma.dossierCredit.count({
        where: { ...where, cre_etat: 5 }, // Débloqués
      }),
    ]);

    // Totaux financiers
    const [accountsSum, loansSum] = await Promise.all([
      prisma.compte.aggregate({
        where,
        _sum: { solde: true },
      }),
      prisma.dossierCredit.aggregate({
        where: { ...where, cre_etat: 5 },
        _sum: { cre_mnt_octr: true },
      }),
    ]);

    // Transactions du jour
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todayTransactions = await prisma.mouvement.groupBy({
      by: ['sens'],
      where: {
        ...where,
        date_valeur: { gte: today },
      },
      _sum: { montant: true },
      _count: true,
    });

    const deposits = todayTransactions.find(t => t.sens === 'c') || { _sum: { montant: 0 }, _count: 0 };
    const withdrawals = todayTransactions.find(t => t.sens === 'd') || { _sum: { montant: 0 }, _count: 0 };

    res.json({
      overview: {
        totalClients,
        totalAccounts,
        totalLoans,
        activeLoans,
      },
      financials: {
        totalDeposits: accountsSum._sum.solde || 0,
        totalLoansOutstanding: loansSum._sum.cre_mnt_octr || 0,
      },
      today: {
        deposits: {
          count: deposits._count,
          amount: deposits._sum.montant || 0,
        },
        withdrawals: {
          count: withdrawals._count,
          amount: withdrawals._sum.montant || 0,
        },
      },
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/reports/portfolio - Portefeuille crédit
router.get('/portfolio', async (req, res, next) => {
  try {
    const agencyId = req.user!.agenceId;

    const where: any = { cre_etat: 5 }; // Crédits débloqués
    if (agencyId && !['SUPER_ADMIN', 'DIRECTOR'].includes(req.user!.role)) {
      where.id_ag = agencyId;
    }

    // Répartition par état
    const byStatus = await prisma.dossierCredit.groupBy({
      by: ['cre_etat'],
      where: { ...where, cre_etat: { not: null } },
      _count: true,
      _sum: { cre_mnt_octr: true },
    });

    // PAR (Portfolio at Risk) - Simplié
    // Note: Dans la vraie application, calculer depuis ad_sre (échéances)
    const totalOutstanding = await prisma.dossierCredit.aggregate({
      where,
      _sum: { cre_mnt_octr: true },
    });

    res.json({
      byStatus: byStatus.map(s => ({
        status: s.cre_etat,
        count: s._count,
        amount: s._sum.cre_mnt_octr,
      })),
      totals: {
        outstanding: totalOutstanding._sum.cre_mnt_octr || 0,
      },
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/reports/clients - Évolution clients
router.get('/clients', async (req, res, next) => {
  try {
    const months = parseInt(req.query.months as string) || 12;

    // Clients par mois (simplifié)
    const clientsByMonth = await prisma.$queryRaw`
      SELECT
        DATE_TRUNC('month', date_creation) as month,
        COUNT(*) as count
      FROM ad_cli
      WHERE date_creation >= NOW() - INTERVAL '${months} months'
      GROUP BY DATE_TRUNC('month', date_creation)
      ORDER BY month DESC
    `;

    res.json({
      evolution: clientsByMonth,
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/reports/transactions - Rapport transactions
router.get('/transactions', async (req, res, next) => {
  try {
    const startDate = req.query.startDate as string;
    const endDate = req.query.endDate as string;

    const where: any = {};

    if (startDate) {
      where.date_valeur = { ...where.date_valeur, gte: new Date(startDate) };
    }
    if (endDate) {
      where.date_valeur = { ...where.date_valeur, lte: new Date(endDate) };
    }

    const summary = await prisma.mouvement.groupBy({
      by: ['sens'],
      where,
      _sum: { montant: true },
      _count: true,
    });

    res.json({
      summary: summary.map(s => ({
        type: s.sens === 'c' ? 'credit' : 'debit',
        count: s._count,
        total: s._sum.montant,
      })),
    });
  } catch (error) {
    next(error);
  }
});

export default router;
