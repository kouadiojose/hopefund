import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { authenticate, authorize } from '../middleware/auth';
import { AppError } from '../middleware/error-handler';
import { logger } from '../utils/logger';

const router = Router();

router.use(authenticate);

// Schémas de validation - accepte accountId (numérique) ou accountNumber (string)
const depositSchema = z.object({
  accountId: z.number().optional(),
  accountNumber: z.string().optional(),
  amount: z.number().positive(),
  description: z.string().optional(),
}).refine(data => data.accountId !== undefined || data.accountNumber, {
  message: "accountId ou accountNumber est requis",
});

const withdrawSchema = z.object({
  accountId: z.number().optional(),
  accountNumber: z.string().optional(),
  amount: z.number().positive(),
  description: z.string().optional(),
}).refine(data => data.accountId !== undefined || data.accountNumber, {
  message: "accountId ou accountNumber est requis",
});

const transferSchema = z.object({
  fromAccountId: z.number().optional(),
  fromAccountNumber: z.string().optional(),
  toAccountId: z.number().optional(),
  toAccountNumber: z.string().optional(),
  amount: z.number().positive(),
  description: z.string().optional(),
}).refine(data => (data.fromAccountId !== undefined || data.fromAccountNumber) &&
                   (data.toAccountId !== undefined || data.toAccountNumber), {
  message: "Les comptes source et destination sont requis",
});

// Helper pour trouver un compte par ID ou numéro
async function findAccount(tx: any, accountId?: number, accountNumber?: string) {
  if (accountId !== undefined) {
    return tx.compte.findUnique({ where: { id_cpte: accountId } });
  }
  if (accountNumber) {
    return tx.compte.findFirst({
      where: {
        OR: [
          { num_complet_cpte: accountNumber },
          { num_cpte: accountNumber }
        ]
      }
    });
  }
  return null;
}

// POST /api/transactions/deposit - Dépôt
router.post('/deposit', authorize('SUPER_ADMIN', 'DIRECTOR', 'BRANCH_MANAGER', 'TELLER'), async (req, res, next) => {
  try {
    const { accountId, accountNumber, amount, description } = depositSchema.parse(req.body);

    // Transaction atomique
    const result = await prisma.$transaction(async (tx) => {
      // Récupérer le compte par ID ou numéro
      const account = await findAccount(tx, accountId, accountNumber);

      if (!account) {
        throw new AppError('Compte non trouvé', 404);
      }

      if (account.etat_cpte !== 1) {
        throw new AppError('Le compte n\'est pas actif', 400);
      }

      const oldBalance = Number(account.solde || 0);
      const newBalance = oldBalance + amount;

      // Mettre à jour le solde
      const updatedAccount = await tx.compte.update({
        where: { id_cpte: account.id_cpte },
        data: {
          solde: newBalance,
          date_modif: new Date(),
        },
      });

      // Créer le mouvement
      const movement = await tx.mouvement.create({
        data: {
          id_ag: account.id_ag,
          cpte_interne_cli: account.id_cpte,
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
        entity_id: result.account.id_cpte.toString(),
        new_values: { amount, description, accountNumber },
        ip_address: req.ip || null,
      },
    });

    logger.info(`Deposit of ${amount} to account ${result.account.num_complet_cpte} by user ${req.user!.userId}`);

    res.status(201).json({
      message: 'Dépôt effectué avec succès',
      movement: result.movement,
      newBalance: result.account.solde,
      accountNumber: result.account.num_complet_cpte,
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/transactions/withdraw - Retrait
router.post('/withdraw', authorize('SUPER_ADMIN', 'DIRECTOR', 'BRANCH_MANAGER', 'TELLER'), async (req, res, next) => {
  try {
    const { accountId, accountNumber, amount, description } = withdrawSchema.parse(req.body);

    const result = await prisma.$transaction(async (tx) => {
      const account = await findAccount(tx, accountId, accountNumber);

      if (!account) {
        throw new AppError('Compte non trouvé', 404);
      }

      if (account.etat_cpte !== 1) {
        throw new AppError('Le compte n\'est pas actif', 400);
      }

      const solde = Number(account.solde || 0);
      const bloq = Number(account.mnt_bloq || 0);
      const min = Number(account.mnt_min_cpte || 0);
      const decouvert = Number(account.decouvert_max || 0);
      const disponible = solde - bloq - min + decouvert;

      if (amount > disponible) {
        throw new AppError(`Solde insuffisant. Disponible: ${disponible}`, 400);
      }

      const oldBalance = solde;
      const newBalance = oldBalance - amount;

      const updatedAccount = await tx.compte.update({
        where: { id_cpte: account.id_cpte },
        data: {
          solde: newBalance,
          date_modif: new Date(),
        },
      });

      const movement = await tx.mouvement.create({
        data: {
          id_ag: account.id_ag,
          cpte_interne_cli: account.id_cpte,
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
        entity_id: result.account.id_cpte.toString(),
        new_values: { amount, description, accountNumber },
        ip_address: req.ip || null,
      },
    });

    logger.info(`Withdrawal of ${amount} from account ${result.account.num_complet_cpte} by user ${req.user!.userId}`);

    res.status(201).json({
      message: 'Retrait effectué avec succès',
      movement: result.movement,
      newBalance: result.account.solde,
      accountNumber: result.account.num_complet_cpte,
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/transactions/transfer - Virement
router.post('/transfer', authorize('SUPER_ADMIN', 'DIRECTOR', 'BRANCH_MANAGER', 'TELLER'), async (req, res, next) => {
  try {
    const { fromAccountId, fromAccountNumber, toAccountId, toAccountNumber, amount, description } = transferSchema.parse(req.body);

    const result = await prisma.$transaction(async (tx) => {
      // Compte source
      const fromAccount = await findAccount(tx, fromAccountId, fromAccountNumber);

      if (!fromAccount) {
        throw new AppError('Compte source non trouvé', 404);
      }

      // Compte destination
      const toAccount = await findAccount(tx, toAccountId, toAccountNumber);

      if (!toAccount) {
        throw new AppError('Compte destination non trouvé', 404);
      }

      // Vérifier qu'on ne vire pas vers le même compte
      if (fromAccount.id_cpte === toAccount.id_cpte) {
        throw new AppError('Impossible de virer vers le même compte', 400);
      }

      // Vérifier les états
      if (fromAccount.etat_cpte !== 1) {
        throw new AppError('Le compte source n\'est pas actif', 400);
      }

      if (toAccount.etat_cpte !== 1) {
        throw new AppError('Le compte destination n\'est pas actif', 400);
      }

      // Vérifier le solde disponible
      const fromSolde = Number(fromAccount.solde || 0);
      const fromBloq = Number(fromAccount.mnt_bloq || 0);
      const fromMin = Number(fromAccount.mnt_min_cpte || 0);
      const fromDecouvert = Number(fromAccount.decouvert_max || 0);
      const fromDisponible = fromSolde - fromBloq - fromMin + fromDecouvert;

      if (amount > fromDisponible) {
        throw new AppError(`Solde insuffisant. Disponible: ${fromDisponible}`, 400);
      }

      const fromOldBalance = fromSolde;
      const fromNewBalance = fromOldBalance - amount;
      const toOldBalance = Number(toAccount.solde || 0);
      const toNewBalance = toOldBalance + amount;

      // Mettre à jour les soldes
      await tx.compte.update({
        where: { id_cpte: fromAccount.id_cpte },
        data: { solde: fromNewBalance, date_modif: new Date() },
      });

      await tx.compte.update({
        where: { id_cpte: toAccount.id_cpte },
        data: { solde: toNewBalance, date_modif: new Date() },
      });

      // Créer les mouvements
      const debitMovement = await tx.mouvement.create({
        data: {
          id_ag: fromAccount.id_ag,
          cpte_interne_cli: fromAccount.id_cpte,
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
          cpte_interne_cli: toAccount.id_cpte,
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

      return { debitMovement, creditMovement, fromAccount, toAccount };
    });

    await prisma.auditLog.create({
      data: {
        user_id: req.user!.userId,
        action: 'TRANSFER',
        entity: 'Compte',
        entity_id: `${result.fromAccount.num_complet_cpte}->${result.toAccount.num_complet_cpte}`,
        new_values: { amount, description, fromAccountNumber, toAccountNumber },
        ip_address: req.ip || null,
      },
    });

    logger.info(`Transfer of ${amount} from ${result.fromAccount.num_complet_cpte} to ${result.toAccount.num_complet_cpte} by user ${req.user!.userId}`);

    res.status(201).json({
      message: 'Virement effectué avec succès',
      debitMovement: result.debitMovement,
      creditMovement: result.creditMovement,
      fromAccountNumber: result.fromAccount.num_complet_cpte,
      toAccountNumber: result.toAccount.num_complet_cpte,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
