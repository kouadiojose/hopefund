import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { authenticate, authorize } from '../middleware/auth';
import { AppError } from '../middleware/error-handler';
import { logger } from '../utils/logger';

const router = Router();

router.use(authenticate);

// Schémas de validation
const depositSchema = z.object({
  accountId: z.number(),
  amount: z.number().positive(),
  description: z.string().optional(),
});

const withdrawSchema = z.object({
  accountId: z.number(),
  amount: z.number().positive(),
  description: z.string().optional(),
});

const transferSchema = z.object({
  fromAccountId: z.number(),
  toAccountId: z.number(),
  amount: z.number().positive(),
  description: z.string().optional(),
});

// POST /api/transactions/deposit - Dépôt
router.post('/deposit', authorize('SUPER_ADMIN', 'BRANCH_MANAGER', 'TELLER'), async (req, res, next) => {
  try {
    const { accountId, amount, description } = depositSchema.parse(req.body);

    // Transaction atomique
    const result = await prisma.$transaction(async (tx) => {
      // Récupérer le compte
      const account = await tx.compte.findUnique({
        where: { id_cpte: accountId },
      });

      if (!account) {
        throw new AppError('Account not found', 404);
      }

      if (account.etat_cpte !== 1) {
        throw new AppError('Account is not active', 400);
      }

      const oldBalance = Number(account.solde || 0);
      const newBalance = oldBalance + amount;

      // Mettre à jour le solde
      const updatedAccount = await tx.compte.update({
        where: { id_cpte: accountId },
        data: {
          solde: newBalance,
          date_modif: new Date(),
        },
      });

      // Créer le mouvement
      const movement = await tx.mouvement.create({
        data: {
          id_ag: account.id_ag,
          cpte_interne_cli: accountId,
          date_mvt: new Date(),
          type_mvt: 1, // Crédit
          sens: 'C',
          montant: amount,
          solde_avant: oldBalance,
          solde_apres: newBalance,
          libel_mvt: description || 'Dépôt espèces',
          type_operation: 1, // Dépôt
          id_utilisateur: req.user!.userId,
        },
      });

      return { account: updatedAccount, movement };
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        user_id: req.user!.userId,
        action: 'DEPOSIT',
        entity: 'Compte',
        entity_id: accountId.toString(),
        new_values: { amount, description },
        ip_address: req.ip,
      },
    });

    logger.info(`Deposit of ${amount} to account ${accountId} by user ${req.user!.userId}`);

    res.status(201).json({
      message: 'Deposit successful',
      movement: result.movement,
      newBalance: result.account.solde,
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/transactions/withdraw - Retrait
router.post('/withdraw', authorize('SUPER_ADMIN', 'BRANCH_MANAGER', 'TELLER'), async (req, res, next) => {
  try {
    const { accountId, amount, description } = withdrawSchema.parse(req.body);

    const result = await prisma.$transaction(async (tx) => {
      const account = await tx.compte.findUnique({
        where: { id_cpte: accountId },
      });

      if (!account) {
        throw new AppError('Account not found', 404);
      }

      if (account.etat_cpte !== 1) {
        throw new AppError('Account is not active', 400);
      }

      const solde = Number(account.solde || 0);
      const bloq = Number(account.mnt_bloq || 0);
      const min = Number(account.mnt_min_cpte || 0);
      const decouvert = Number(account.decouvert_max || 0);
      const disponible = solde - bloq - min + decouvert;

      if (amount > disponible) {
        throw new AppError(`Insufficient funds. Available: ${disponible}`, 400);
      }

      const oldBalance = solde;
      const newBalance = oldBalance - amount;

      const updatedAccount = await tx.compte.update({
        where: { id_cpte: accountId },
        data: {
          solde: newBalance,
          date_modif: new Date(),
        },
      });

      const movement = await tx.mouvement.create({
        data: {
          id_ag: account.id_ag,
          cpte_interne_cli: accountId,
          date_mvt: new Date(),
          type_mvt: 2, // Débit
          sens: 'D',
          montant: amount,
          solde_avant: oldBalance,
          solde_apres: newBalance,
          libel_mvt: description || 'Retrait espèces',
          type_operation: 2, // Retrait
          id_utilisateur: req.user!.userId,
        },
      });

      return { account: updatedAccount, movement };
    });

    await prisma.auditLog.create({
      data: {
        user_id: req.user!.userId,
        action: 'WITHDRAW',
        entity: 'Compte',
        entity_id: accountId.toString(),
        new_values: { amount, description },
        ip_address: req.ip,
      },
    });

    logger.info(`Withdrawal of ${amount} from account ${accountId} by user ${req.user!.userId}`);

    res.status(201).json({
      message: 'Withdrawal successful',
      movement: result.movement,
      newBalance: result.account.solde,
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/transactions/transfer - Virement
router.post('/transfer', authorize('SUPER_ADMIN', 'BRANCH_MANAGER', 'TELLER'), async (req, res, next) => {
  try {
    const { fromAccountId, toAccountId, amount, description } = transferSchema.parse(req.body);

    if (fromAccountId === toAccountId) {
      throw new AppError('Cannot transfer to the same account', 400);
    }

    const result = await prisma.$transaction(async (tx) => {
      // Compte source
      const fromAccount = await tx.compte.findUnique({
        where: { id_cpte: fromAccountId },
      });

      if (!fromAccount) {
        throw new AppError('Source account not found', 404);
      }

      // Compte destination
      const toAccount = await tx.compte.findUnique({
        where: { id_cpte: toAccountId },
      });

      if (!toAccount) {
        throw new AppError('Destination account not found', 404);
      }

      // Vérifier les états
      if (fromAccount.etat_cpte !== 1) {
        throw new AppError('Source account is not active', 400);
      }

      if (toAccount.etat_cpte !== 1) {
        throw new AppError('Destination account is not active', 400);
      }

      // Vérifier le solde disponible
      const fromSolde = Number(fromAccount.solde || 0);
      const fromBloq = Number(fromAccount.mnt_bloq || 0);
      const fromMin = Number(fromAccount.mnt_min_cpte || 0);
      const fromDecouvert = Number(fromAccount.decouvert_max || 0);
      const fromDisponible = fromSolde - fromBloq - fromMin + fromDecouvert;

      if (amount > fromDisponible) {
        throw new AppError(`Insufficient funds. Available: ${fromDisponible}`, 400);
      }

      const fromOldBalance = fromSolde;
      const fromNewBalance = fromOldBalance - amount;
      const toOldBalance = Number(toAccount.solde || 0);
      const toNewBalance = toOldBalance + amount;

      // Mettre à jour les soldes
      await tx.compte.update({
        where: { id_cpte: fromAccountId },
        data: { solde: fromNewBalance, date_modif: new Date() },
      });

      await tx.compte.update({
        where: { id_cpte: toAccountId },
        data: { solde: toNewBalance, date_modif: new Date() },
      });

      // Créer les mouvements
      const debitMovement = await tx.mouvement.create({
        data: {
          id_ag: fromAccount.id_ag,
          cpte_interne_cli: fromAccountId,
          date_mvt: new Date(),
          type_mvt: 2,
          sens: 'D',
          montant: amount,
          solde_avant: fromOldBalance,
          solde_apres: fromNewBalance,
          libel_mvt: description || `Virement vers ${toAccount.num_complet_cpte}`,
          type_operation: 3,
          id_utilisateur: req.user!.userId,
        },
      });

      const creditMovement = await tx.mouvement.create({
        data: {
          id_ag: toAccount.id_ag,
          cpte_interne_cli: toAccountId,
          date_mvt: new Date(),
          type_mvt: 1,
          sens: 'C',
          montant: amount,
          solde_avant: toOldBalance,
          solde_apres: toNewBalance,
          libel_mvt: description || `Virement de ${fromAccount.num_complet_cpte}`,
          type_operation: 3,
          id_utilisateur: req.user!.userId,
        },
      });

      return { debitMovement, creditMovement };
    });

    await prisma.auditLog.create({
      data: {
        user_id: req.user!.userId,
        action: 'TRANSFER',
        entity: 'Compte',
        entity_id: `${fromAccountId}->${toAccountId}`,
        new_values: { amount, description },
        ip_address: req.ip,
      },
    });

    logger.info(`Transfer of ${amount} from ${fromAccountId} to ${toAccountId} by user ${req.user!.userId}`);

    res.status(201).json({
      message: 'Transfer successful',
      debitMovement: result.debitMovement,
      creditMovement: result.creditMovement,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
