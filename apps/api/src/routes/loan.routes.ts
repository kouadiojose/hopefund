import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { authenticate, authorize } from '../middleware/auth';
import { AppError } from '../middleware/error-handler';
import { config } from '../config';

const router = Router();

router.use(authenticate);

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
          date_mvt: new Date(),
          type_mvt: 1,
          sens: 'C',
          montant: amount,
          solde_avant: oldBalance,
          solde_apres: newBalance,
          libel_mvt: `Déblocage crédit #${loanId}`,
          type_operation: 10, // Déblocage crédit
          id_utilisateur: req.user!.userId,
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
