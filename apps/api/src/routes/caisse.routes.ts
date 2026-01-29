import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { authenticate, authorize } from '../middleware/auth';
import { AppError } from '../middleware/error-handler';
import { logger } from '../utils/logger';
import { Decimal } from '@prisma/client/runtime/library';
import {
  ecritureApprovisionnementCaisse,
  ecritureReversementCaisse,
  ecritureManquantCaisse,
  ecritureExcedentCaisse,
} from '../services/comptabilite.service';

const router = Router();

// All caisse routes require authentication
router.use(authenticate);

// ==================== CONSTANTES ====================

// Valeurs des billets BIF (Franc Burundais)
const BILLETS_BIF = {
  billets_10000: 10000,
  billets_5000: 5000,
  billets_2000: 2000,
  billets_1000: 1000,
  billets_500: 500,
  billets_100: 100,
  billets_50: 50,
  billets_20: 20,
  billets_10: 10,
};

// Valeurs des pièces BIF
const PIECES_BIF = {
  pieces_50: 50,
  pieces_10: 10,
  pieces_5: 5,
  pieces_1: 1,
};

// Valeurs des billets USD (pour les opérations en devises)
const BILLETS_USD = {
  billets_100_usd: 100,
  billets_50_usd: 50,
  billets_20_usd: 20,
  billets_10_usd: 10,
  billets_5_usd: 5,
  billets_1_usd: 1,
};

// Types de décompte
const TYPE_DECOMPTE = {
  OUVERTURE: 1,
  FERMETURE: 2,
  APPROVISIONNEMENT: 3,
  REVERSEMENT: 4,
};

// Types de mouvement
const TYPE_MOUVEMENT = {
  APPROVISIONNEMENT: 1,
  REVERSEMENT: 2,
};

// États de session
const ETAT_SESSION = {
  OUVERTE: 1,
  FERMEE: 2,
  VALIDEE: 3,
};

// États de mouvement
const ETAT_MOUVEMENT = {
  EN_ATTENTE: 1,
  VALIDE: 2,
  REJETE: 3,
};

// ==================== HELPERS ====================

// Calculer le total d'un décompte
function calculerTotalDecompte(decompte: any): { totalBillets: number; totalPieces: number; totalGeneral: number } {
  let totalBillets = 0;
  let totalPieces = 0;

  // Billets BIF
  for (const [key, valeur] of Object.entries(BILLETS_BIF)) {
    totalBillets += (decompte[key] || 0) * valeur;
  }

  // Pièces BIF
  for (const [key, valeur] of Object.entries(PIECES_BIF)) {
    totalPieces += (decompte[key] || 0) * valeur;
  }

  // Billets USD (pour les opérations en devises - pas ajoutés au total BIF)
  // Les devises sont gérées séparément

  return {
    totalBillets,
    totalPieces,
    totalGeneral: totalBillets + totalPieces,
  };
}

// Schéma de validation pour le décompte
const decompteSchema = z.object({
  devise: z.string().default('BIF'),
  // Billets BIF (Franc Burundais)
  billets_10000: z.number().int().min(0).default(0),
  billets_5000: z.number().int().min(0).default(0),
  billets_2000: z.number().int().min(0).default(0),
  billets_1000: z.number().int().min(0).default(0),
  billets_500: z.number().int().min(0).default(0),
  billets_100: z.number().int().min(0).default(0),
  billets_50: z.number().int().min(0).default(0),
  billets_20: z.number().int().min(0).default(0),
  billets_10: z.number().int().min(0).default(0),
  // Pièces BIF
  pieces_50: z.number().int().min(0).default(0),
  pieces_10: z.number().int().min(0).default(0),
  pieces_5: z.number().int().min(0).default(0),
  pieces_1: z.number().int().min(0).default(0),
  // Billets USD (pour opérations en devises)
  billets_100_usd: z.number().int().min(0).default(0),
  billets_50_usd: z.number().int().min(0).default(0),
  billets_20_usd: z.number().int().min(0).default(0),
  billets_10_usd: z.number().int().min(0).default(0),
  billets_5_usd: z.number().int().min(0).default(0),
  billets_1_usd: z.number().int().min(0).default(0),
  commentaire: z.string().optional(),
});

// ==================== SESSION DE CAISSE ====================

// GET /api/caisse/session/current - Session actuelle du caissier
router.get('/session/current', async (req, res, next) => {
  try {
    const userId = req.user!.userId;
    const agenceId = req.user!.agenceId;

    if (!agenceId) {
      throw new AppError('Vous devez être assigné à une agence', 400);
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const session = await prisma.caisseSession.findFirst({
      where: {
        user_id: userId,
        id_ag: agenceId,
        date_session: today,
      },
      include: {
        decomptes: {
          orderBy: { created_at: 'desc' },
        },
        mouvements: {
          orderBy: { created_at: 'desc' },
        },
      },
    });

    if (!session) {
      return res.json({
        hasSession: false,
        message: 'Aucune session de caisse ouverte pour aujourd\'hui',
      });
    }

    // Calculer le solde théorique
    const soldeTheorique = parseFloat(session.montant_ouverture.toString()) +
      parseFloat(session.total_entrees.toString()) -
      parseFloat(session.total_sorties.toString());

    res.json({
      hasSession: true,
      session: {
        ...session,
        solde_theorique: soldeTheorique,
        montant_ouverture: parseFloat(session.montant_ouverture.toString()),
        total_entrees: parseFloat(session.total_entrees.toString()),
        total_sorties: parseFloat(session.total_sorties.toString()),
        montant_fermeture: session.montant_fermeture ? parseFloat(session.montant_fermeture.toString()) : null,
        ecart: session.ecart ? parseFloat(session.ecart.toString()) : null,
      },
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/caisse/session/ouvrir - Ouvrir la caisse
router.post('/session/ouvrir', async (req, res, next) => {
  try {
    const userId = req.user!.userId;
    const agenceId = req.user!.agenceId;

    if (!agenceId) {
      throw new AppError('Vous devez être assigné à une agence', 400);
    }

    const schema = z.object({
      decompte: decompteSchema,
    });

    const { decompte } = schema.parse(req.body);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Vérifier qu'il n'y a pas déjà une session ouverte
    const existingSession = await prisma.caisseSession.findFirst({
      where: {
        user_id: userId,
        id_ag: agenceId,
        date_session: today,
      },
    });

    if (existingSession) {
      throw new AppError('Une session de caisse existe déjà pour aujourd\'hui', 400);
    }

    // Calculer les totaux du décompte
    const totaux = calculerTotalDecompte(decompte);

    // Récupérer la configuration de la caisse principale pour les seuils
    const caissePrincipale = await prisma.caissePrincipale.findUnique({
      where: { id_ag: agenceId },
    });

    // Créer la session et le décompte dans une transaction
    const result = await prisma.$transaction(async (tx) => {
      // Créer la session
      const session = await tx.caisseSession.create({
        data: {
          id_ag: agenceId,
          user_id: userId,
          date_session: today,
          heure_ouverture: new Date(),
          montant_ouverture: totaux.totalGeneral,
          etat: ETAT_SESSION.OUVERTE,
          seuil_max: caissePrincipale?.seuil_max_caissier_cdf || null,
        },
      });

      // Créer le décompte d'ouverture
      const decompteRecord = await tx.caisseDecompte.create({
        data: {
          session_id: session.id,
          type_decompte: TYPE_DECOMPTE.OUVERTURE,
          devise: decompte.devise,
          billets_20000: decompte.billets_20000,
          billets_10000: decompte.billets_10000,
          billets_5000: decompte.billets_5000,
          billets_1000: decompte.billets_1000,
          billets_500: decompte.billets_500,
          billets_200: decompte.billets_200,
          billets_100: decompte.billets_100,
          billets_50: decompte.billets_50,
          pieces_50: decompte.pieces_50,
          pieces_25: decompte.pieces_25,
          pieces_10: decompte.pieces_10,
          pieces_5: decompte.pieces_5,
          pieces_1: decompte.pieces_1,
          billets_100_usd: decompte.billets_100_usd,
          billets_50_usd: decompte.billets_50_usd,
          billets_20_usd: decompte.billets_20_usd,
          billets_10_usd: decompte.billets_10_usd,
          billets_5_usd: decompte.billets_5_usd,
          billets_1_usd: decompte.billets_1_usd,
          total_billets: totaux.totalBillets,
          total_pieces: totaux.totalPieces,
          total_general: totaux.totalGeneral,
          commentaire: decompte.commentaire,
        },
      });

      // Mettre à jour la session avec l'ID du décompte
      await tx.caisseSession.update({
        where: { id: session.id },
        data: { decompte_ouverture_id: decompteRecord.id },
      });

      return { session, decompte: decompteRecord };
    });

    logger.info(`Caisse ouverte: User ${userId}, Agence ${agenceId}, Montant: ${totaux.totalGeneral}`);

    res.status(201).json({
      message: 'Caisse ouverte avec succès',
      session: result.session,
      decompte: result.decompte,
      totaux,
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/caisse/session/fermer - Fermer la caisse
router.post('/session/fermer', async (req, res, next) => {
  try {
    const userId = req.user!.userId;
    const agenceId = req.user!.agenceId;

    if (!agenceId) {
      throw new AppError('Vous devez être assigné à une agence', 400);
    }

    const schema = z.object({
      decompte: decompteSchema,
    });

    const { decompte } = schema.parse(req.body);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Récupérer la session actuelle
    const session = await prisma.caisseSession.findFirst({
      where: {
        user_id: userId,
        id_ag: agenceId,
        date_session: today,
        etat: ETAT_SESSION.OUVERTE,
      },
    });

    if (!session) {
      throw new AppError('Aucune session de caisse ouverte', 400);
    }

    // Vérifier qu'il n'y a pas de mouvements en attente
    const mouvementsEnAttente = await prisma.caisseMouvement.count({
      where: {
        session_id: session.id,
        etat: ETAT_MOUVEMENT.EN_ATTENTE,
      },
    });

    if (mouvementsEnAttente > 0) {
      throw new AppError(`${mouvementsEnAttente} mouvement(s) en attente de validation. Veuillez les traiter avant de fermer.`, 400);
    }

    // Calculer les totaux du décompte
    const totaux = calculerTotalDecompte(decompte);

    // Calculer le solde théorique
    const soldeTheorique = parseFloat(session.montant_ouverture.toString()) +
      parseFloat(session.total_entrees.toString()) -
      parseFloat(session.total_sorties.toString());

    // Calculer l'écart
    const ecart = totaux.totalGeneral - soldeTheorique;

    // Mettre à jour dans une transaction
    const result = await prisma.$transaction(async (tx) => {
      // Créer le décompte de fermeture
      const decompteRecord = await tx.caisseDecompte.create({
        data: {
          session_id: session.id,
          type_decompte: TYPE_DECOMPTE.FERMETURE,
          devise: decompte.devise,
          billets_20000: decompte.billets_20000,
          billets_10000: decompte.billets_10000,
          billets_5000: decompte.billets_5000,
          billets_1000: decompte.billets_1000,
          billets_500: decompte.billets_500,
          billets_200: decompte.billets_200,
          billets_100: decompte.billets_100,
          billets_50: decompte.billets_50,
          pieces_50: decompte.pieces_50,
          pieces_25: decompte.pieces_25,
          pieces_10: decompte.pieces_10,
          pieces_5: decompte.pieces_5,
          pieces_1: decompte.pieces_1,
          billets_100_usd: decompte.billets_100_usd,
          billets_50_usd: decompte.billets_50_usd,
          billets_20_usd: decompte.billets_20_usd,
          billets_10_usd: decompte.billets_10_usd,
          billets_5_usd: decompte.billets_5_usd,
          billets_1_usd: decompte.billets_1_usd,
          total_billets: totaux.totalBillets,
          total_pieces: totaux.totalPieces,
          total_general: totaux.totalGeneral,
          commentaire: decompte.commentaire,
        },
      });

      // Mettre à jour la session
      const updatedSession = await tx.caisseSession.update({
        where: { id: session.id },
        data: {
          heure_fermeture: new Date(),
          montant_fermeture: totaux.totalGeneral,
          decompte_fermeture_id: decompteRecord.id,
          ecart: ecart,
          commentaire_ecart: Math.abs(ecart) > 0 ? `Écart de ${ecart} BIF` : null,
          etat: ETAT_SESSION.FERMEE,
        },
      });

      return { session: updatedSession, decompte: decompteRecord };
    });

    // Générer une écriture comptable si écart détecté
    let ecritureId: number | null = null;
    if (Math.abs(ecart) > 0) {
      try {
        if (ecart < 0) {
          // Manquant de caisse
          ecritureId = await ecritureManquantCaisse(agenceId, Math.abs(ecart), userId);
        } else {
          // Excédent de caisse
          ecritureId = await ecritureExcedentCaisse(agenceId, ecart, userId);
        }
      } catch (err) {
        logger.warn(`Échec création écriture comptable pour écart de caisse: ${err}`);
      }
    }

    logger.info(`Caisse fermée: User ${userId}, Agence ${agenceId}, Montant: ${totaux.totalGeneral}, Écart: ${ecart}, Écriture: ${ecritureId}`);

    res.json({
      message: 'Caisse fermée avec succès',
      session: result.session,
      decompte: result.decompte,
      totaux,
      soldeTheorique,
      ecart,
      ecritureId,
    });
  } catch (error) {
    next(error);
  }
});

// ==================== APPROVISIONNEMENT ====================

// POST /api/caisse/approvisionnement - Demander un approvisionnement
router.post('/approvisionnement', async (req, res, next) => {
  try {
    const userId = req.user!.userId;
    const agenceId = req.user!.agenceId;

    if (!agenceId) {
      throw new AppError('Vous devez être assigné à une agence', 400);
    }

    const schema = z.object({
      montant: z.number().positive(),
      devise: z.string().default('BIF'),
      decompte: decompteSchema.optional(),
      commentaire: z.string().optional(),
    });

    const data = schema.parse(req.body);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Récupérer la session actuelle
    const session = await prisma.caisseSession.findFirst({
      where: {
        user_id: userId,
        id_ag: agenceId,
        date_session: today,
        etat: ETAT_SESSION.OUVERTE,
      },
    });

    if (!session) {
      throw new AppError('Vous devez d\'abord ouvrir votre caisse', 400);
    }

    // Créer le mouvement et le décompte si fourni
    const result = await prisma.$transaction(async (tx) => {
      // Créer le mouvement
      const mouvement = await tx.caisseMouvement.create({
        data: {
          session_id: session.id,
          id_ag: agenceId,
          type_mouvement: TYPE_MOUVEMENT.APPROVISIONNEMENT,
          montant: data.montant,
          devise: data.devise,
          de_caisse_principale: true,
          demande_par: userId,
          etat: ETAT_MOUVEMENT.EN_ATTENTE,
          commentaire: data.commentaire,
        },
      });

      // Si un décompte est fourni, le créer
      let decompteRecord = null;
      if (data.decompte) {
        const totaux = calculerTotalDecompte(data.decompte);
        decompteRecord = await tx.caisseDecompte.create({
          data: {
            session_id: session.id,
            type_decompte: TYPE_DECOMPTE.APPROVISIONNEMENT,
            devise: data.decompte.devise,
            billets_20000: data.decompte.billets_20000,
            billets_10000: data.decompte.billets_10000,
            billets_5000: data.decompte.billets_5000,
            billets_1000: data.decompte.billets_1000,
            billets_500: data.decompte.billets_500,
            billets_200: data.decompte.billets_200,
            billets_100: data.decompte.billets_100,
            billets_50: data.decompte.billets_50,
            pieces_50: data.decompte.pieces_50,
            pieces_25: data.decompte.pieces_25,
            pieces_10: data.decompte.pieces_10,
            pieces_5: data.decompte.pieces_5,
            pieces_1: data.decompte.pieces_1,
            billets_100_usd: data.decompte.billets_100_usd,
            billets_50_usd: data.decompte.billets_50_usd,
            billets_20_usd: data.decompte.billets_20_usd,
            billets_10_usd: data.decompte.billets_10_usd,
            billets_5_usd: data.decompte.billets_5_usd,
            billets_1_usd: data.decompte.billets_1_usd,
            total_billets: totaux.totalBillets,
            total_pieces: totaux.totalPieces,
            total_general: totaux.totalGeneral,
            commentaire: data.decompte.commentaire,
          },
        });
      }

      return { mouvement, decompte: decompteRecord };
    });

    logger.info(`Demande approvisionnement: User ${userId}, Montant: ${data.montant} ${data.devise}`);

    res.status(201).json({
      message: 'Demande d\'approvisionnement créée. En attente de validation.',
      mouvement: result.mouvement,
      decompte: result.decompte,
    });
  } catch (error) {
    next(error);
  }
});

// ==================== REVERSEMENT ====================

// POST /api/caisse/reversement - Demander un reversement
router.post('/reversement', async (req, res, next) => {
  try {
    const userId = req.user!.userId;
    const agenceId = req.user!.agenceId;

    if (!agenceId) {
      throw new AppError('Vous devez être assigné à une agence', 400);
    }

    const schema = z.object({
      montant: z.number().positive(),
      devise: z.string().default('BIF'),
      decompte: decompteSchema,
      commentaire: z.string().optional(),
    });

    const data = schema.parse(req.body);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Récupérer la session actuelle
    const session = await prisma.caisseSession.findFirst({
      where: {
        user_id: userId,
        id_ag: agenceId,
        date_session: today,
        etat: ETAT_SESSION.OUVERTE,
      },
    });

    if (!session) {
      throw new AppError('Vous devez d\'abord ouvrir votre caisse', 400);
    }

    // Vérifier que le montant est disponible
    const soldeActuel = parseFloat(session.montant_ouverture.toString()) +
      parseFloat(session.total_entrees.toString()) -
      parseFloat(session.total_sorties.toString());

    if (data.montant > soldeActuel) {
      throw new AppError(`Solde insuffisant. Solde actuel: ${soldeActuel} ${data.devise}`, 400);
    }

    // Calculer et vérifier le décompte
    const totaux = calculerTotalDecompte(data.decompte);
    if (Math.abs(totaux.totalGeneral - data.montant) > 0.01) {
      throw new AppError(`Le décompte (${totaux.totalGeneral}) ne correspond pas au montant demandé (${data.montant})`, 400);
    }

    // Créer le mouvement et le décompte
    const result = await prisma.$transaction(async (tx) => {
      // Créer le décompte
      const decompteRecord = await tx.caisseDecompte.create({
        data: {
          session_id: session.id,
          type_decompte: TYPE_DECOMPTE.REVERSEMENT,
          devise: data.decompte.devise,
          billets_20000: data.decompte.billets_20000,
          billets_10000: data.decompte.billets_10000,
          billets_5000: data.decompte.billets_5000,
          billets_1000: data.decompte.billets_1000,
          billets_500: data.decompte.billets_500,
          billets_200: data.decompte.billets_200,
          billets_100: data.decompte.billets_100,
          billets_50: data.decompte.billets_50,
          pieces_50: data.decompte.pieces_50,
          pieces_25: data.decompte.pieces_25,
          pieces_10: data.decompte.pieces_10,
          pieces_5: data.decompte.pieces_5,
          pieces_1: data.decompte.pieces_1,
          billets_100_usd: data.decompte.billets_100_usd,
          billets_50_usd: data.decompte.billets_50_usd,
          billets_20_usd: data.decompte.billets_20_usd,
          billets_10_usd: data.decompte.billets_10_usd,
          billets_5_usd: data.decompte.billets_5_usd,
          billets_1_usd: data.decompte.billets_1_usd,
          total_billets: totaux.totalBillets,
          total_pieces: totaux.totalPieces,
          total_general: totaux.totalGeneral,
          commentaire: data.decompte.commentaire,
        },
      });

      // Créer le mouvement
      const mouvement = await tx.caisseMouvement.create({
        data: {
          session_id: session.id,
          id_ag: agenceId,
          type_mouvement: TYPE_MOUVEMENT.REVERSEMENT,
          montant: data.montant,
          devise: data.devise,
          vers_caisse_principale: true,
          demande_par: userId,
          etat: ETAT_MOUVEMENT.EN_ATTENTE,
          commentaire: data.commentaire,
        },
      });

      return { mouvement, decompte: decompteRecord };
    });

    logger.info(`Demande reversement: User ${userId}, Montant: ${data.montant} ${data.devise}`);

    res.status(201).json({
      message: 'Demande de reversement créée. En attente de validation.',
      mouvement: result.mouvement,
      decompte: result.decompte,
      totaux,
    });
  } catch (error) {
    next(error);
  }
});

// ==================== VALIDATION (SUPERVISEUR) ====================

// GET /api/caisse/mouvements/pending - Mouvements en attente de validation
router.get('/mouvements/pending', authorize('SUPER_ADMIN', 'DIRECTOR', 'BRANCH_MANAGER'), async (req, res, next) => {
  try {
    const agenceId = req.user!.agenceId;

    const where: any = {
      etat: ETAT_MOUVEMENT.EN_ATTENTE,
    };

    // Si l'utilisateur est un BRANCH_MANAGER, limiter à son agence
    if (req.user!.role === 'BRANCH_MANAGER' && agenceId) {
      where.id_ag = agenceId;
    }

    const mouvements = await prisma.caisseMouvement.findMany({
      where,
      include: {
        session: {
          select: {
            id: true,
            user_id: true,
            date_session: true,
          },
        },
      },
      orderBy: { created_at: 'asc' },
    });

    // Récupérer les infos des utilisateurs
    const userIds = mouvements.map(m => m.demande_par);
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, nom: true, prenom: true },
    });
    const userMap = new Map(users.map(u => [u.id, `${u.prenom} ${u.nom}`]));

    res.json(mouvements.map(m => ({
      ...m,
      montant: parseFloat(m.montant.toString()),
      demandeur_nom: userMap.get(m.demande_par) || 'Inconnu',
      type_label: m.type_mouvement === TYPE_MOUVEMENT.APPROVISIONNEMENT ? 'Approvisionnement' : 'Reversement',
    })));
  } catch (error) {
    next(error);
  }
});

// POST /api/caisse/mouvements/:id/valider - Valider un mouvement
router.post('/mouvements/:id/valider', authorize('SUPER_ADMIN', 'DIRECTOR', 'BRANCH_MANAGER'), async (req, res, next) => {
  try {
    const mouvementId = parseInt(req.params.id);
    const userId = req.user!.userId;

    const mouvement = await prisma.caisseMouvement.findUnique({
      where: { id: mouvementId },
      include: { session: true },
    });

    if (!mouvement) {
      throw new AppError('Mouvement non trouvé', 404);
    }

    if (mouvement.etat !== ETAT_MOUVEMENT.EN_ATTENTE) {
      throw new AppError('Ce mouvement a déjà été traité', 400);
    }

    // Mettre à jour le mouvement et la session
    await prisma.$transaction(async (tx) => {
      // Valider le mouvement
      await tx.caisseMouvement.update({
        where: { id: mouvementId },
        data: {
          etat: ETAT_MOUVEMENT.VALIDE,
          valide_par: userId,
          date_validation: new Date(),
        },
      });

      // Mettre à jour les totaux de la session
      if (mouvement.type_mouvement === TYPE_MOUVEMENT.APPROVISIONNEMENT) {
        await tx.caisseSession.update({
          where: { id: mouvement.session_id },
          data: {
            total_entrees: {
              increment: mouvement.montant,
            },
            nombre_operations: {
              increment: 1,
            },
          },
        });
      } else if (mouvement.type_mouvement === TYPE_MOUVEMENT.REVERSEMENT) {
        await tx.caisseSession.update({
          where: { id: mouvement.session_id },
          data: {
            total_sorties: {
              increment: mouvement.montant,
            },
            nombre_operations: {
              increment: 1,
            },
          },
        });
      }
    });

    // Générer l'écriture comptable
    let ecritureId: number | null = null;
    try {
      const montant = parseFloat(mouvement.montant.toString());
      const guichetierId = mouvement.demande_par;

      if (mouvement.type_mouvement === TYPE_MOUVEMENT.APPROVISIONNEMENT) {
        ecritureId = await ecritureApprovisionnementCaisse(
          mouvement.id_ag,
          montant,
          guichetierId
        );
      } else if (mouvement.type_mouvement === TYPE_MOUVEMENT.REVERSEMENT) {
        ecritureId = await ecritureReversementCaisse(
          mouvement.id_ag,
          montant,
          guichetierId
        );
      }
    } catch (err) {
      logger.warn(`Échec création écriture comptable pour mouvement ${mouvementId}: ${err}`);
    }

    logger.info(`Mouvement validé: ${mouvementId} par User ${userId} (écriture: ${ecritureId})`);

    res.json({ message: 'Mouvement validé avec succès', ecritureId });
  } catch (error) {
    next(error);
  }
});

// POST /api/caisse/mouvements/:id/rejeter - Rejeter un mouvement
router.post('/mouvements/:id/rejeter', authorize('SUPER_ADMIN', 'DIRECTOR', 'BRANCH_MANAGER'), async (req, res, next) => {
  try {
    const mouvementId = parseInt(req.params.id);
    const userId = req.user!.userId;

    const schema = z.object({
      motif: z.string().min(1, 'Le motif est obligatoire'),
    });

    const { motif } = schema.parse(req.body);

    const mouvement = await prisma.caisseMouvement.findUnique({
      where: { id: mouvementId },
    });

    if (!mouvement) {
      throw new AppError('Mouvement non trouvé', 404);
    }

    if (mouvement.etat !== ETAT_MOUVEMENT.EN_ATTENTE) {
      throw new AppError('Ce mouvement a déjà été traité', 400);
    }

    await prisma.caisseMouvement.update({
      where: { id: mouvementId },
      data: {
        etat: ETAT_MOUVEMENT.REJETE,
        valide_par: userId,
        date_validation: new Date(),
        motif_rejet: motif,
      },
    });

    logger.info(`Mouvement rejeté: ${mouvementId} par User ${userId}, Motif: ${motif}`);

    res.json({ message: 'Mouvement rejeté' });
  } catch (error) {
    next(error);
  }
});

// ==================== BROUILLARD DE CAISSE ====================

// GET /api/caisse/brouillard - Brouillard de caisse du jour
router.get('/brouillard', async (req, res, next) => {
  try {
    const userId = req.user!.userId;
    const agenceId = req.user!.agenceId;

    if (!agenceId) {
      throw new AppError('Vous devez être assigné à une agence', 400);
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Récupérer la session du jour
    const session = await prisma.caisseSession.findFirst({
      where: {
        user_id: userId,
        id_ag: agenceId,
        date_session: today,
      },
      include: {
        decomptes: {
          orderBy: { created_at: 'asc' },
        },
        mouvements: {
          where: { etat: ETAT_MOUVEMENT.VALIDE },
          orderBy: { created_at: 'asc' },
        },
      },
    });

    if (!session) {
      return res.json({
        hasSession: false,
        message: 'Aucune session de caisse pour aujourd\'hui',
      });
    }

    // Calculer le solde actuel
    const soldeActuel = parseFloat(session.montant_ouverture.toString()) +
      parseFloat(session.total_entrees.toString()) -
      parseFloat(session.total_sorties.toString());

    // Formater les données pour le brouillard
    const brouillard = {
      date: session.date_session,
      caissier: req.user!.email,
      heure_ouverture: session.heure_ouverture,
      heure_fermeture: session.heure_fermeture,
      etat: session.etat === ETAT_SESSION.OUVERTE ? 'Ouverte' :
            session.etat === ETAT_SESSION.FERMEE ? 'Fermée' : 'Validée',

      montant_ouverture: parseFloat(session.montant_ouverture.toString()),
      total_entrees: parseFloat(session.total_entrees.toString()),
      total_sorties: parseFloat(session.total_sorties.toString()),
      solde_actuel: soldeActuel,
      montant_fermeture: session.montant_fermeture ? parseFloat(session.montant_fermeture.toString()) : null,
      ecart: session.ecart ? parseFloat(session.ecart.toString()) : null,
      nombre_operations: session.nombre_operations,

      // Décompte d'ouverture
      decompte_ouverture: session.decomptes.find(d => d.type_decompte === TYPE_DECOMPTE.OUVERTURE),

      // Décompte de fermeture
      decompte_fermeture: session.decomptes.find(d => d.type_decompte === TYPE_DECOMPTE.FERMETURE),

      // Mouvements validés du jour
      mouvements: session.mouvements.map(m => ({
        ...m,
        montant: parseFloat(m.montant.toString()),
        type_label: m.type_mouvement === TYPE_MOUVEMENT.APPROVISIONNEMENT ? 'Approvisionnement' : 'Reversement',
      })),
    };

    res.json(brouillard);
  } catch (error) {
    next(error);
  }
});

// GET /api/caisse/historique - Historique des sessions
router.get('/historique', async (req, res, next) => {
  try {
    const userId = req.user!.userId;
    const agenceId = req.user!.agenceId;
    const role = req.user!.role;

    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const dateDebut = req.query.dateDebut as string;
    const dateFin = req.query.dateFin as string;

    const where: any = {};

    // Filtre par agence/utilisateur selon le rôle
    if (role === 'TELLER') {
      where.user_id = userId;
    } else if (role === 'BRANCH_MANAGER' && agenceId) {
      where.id_ag = agenceId;
    }

    // Filtre par date
    if (dateDebut || dateFin) {
      where.date_session = {};
      if (dateDebut) where.date_session.gte = new Date(dateDebut);
      if (dateFin) where.date_session.lte = new Date(dateFin);
    }

    const [sessions, total] = await Promise.all([
      prisma.caisseSession.findMany({
        where,
        orderBy: { date_session: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.caisseSession.count({ where }),
    ]);

    // Récupérer les noms des utilisateurs
    const userIds = [...new Set(sessions.map(s => s.user_id))];
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, nom: true, prenom: true },
    });
    const userMap = new Map(users.map(u => [u.id, `${u.prenom} ${u.nom}`]));

    res.json({
      data: sessions.map(s => ({
        ...s,
        caissier_nom: userMap.get(s.user_id) || 'Inconnu',
        montant_ouverture: parseFloat(s.montant_ouverture.toString()),
        montant_fermeture: s.montant_fermeture ? parseFloat(s.montant_fermeture.toString()) : null,
        total_entrees: parseFloat(s.total_entrees.toString()),
        total_sorties: parseFloat(s.total_sorties.toString()),
        ecart: s.ecart ? parseFloat(s.ecart.toString()) : null,
        etat_label: s.etat === ETAT_SESSION.OUVERTE ? 'Ouverte' :
                    s.etat === ETAT_SESSION.FERMEE ? 'Fermée' : 'Validée',
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

// ==================== CONFIGURATION CAISSE PRINCIPALE ====================

// GET /api/caisse/principale - Configuration de la caisse principale
router.get('/principale', authorize('SUPER_ADMIN', 'DIRECTOR', 'BRANCH_MANAGER'), async (req, res, next) => {
  try {
    const agenceId = req.user!.agenceId;

    if (!agenceId) {
      throw new AppError('Vous devez être assigné à une agence', 400);
    }

    let caissePrincipale = await prisma.caissePrincipale.findUnique({
      where: { id_ag: agenceId },
    });

    // Créer si n'existe pas
    if (!caissePrincipale) {
      caissePrincipale = await prisma.caissePrincipale.create({
        data: {
          id_ag: agenceId,
          seuil_max_caissier_cdf: 5000000, // 5 millions BIF par défaut
          seuil_max_caissier_usd: 2000, // 2000 USD par défaut
        },
      });
    }

    res.json({
      ...caissePrincipale,
      solde_cdf: parseFloat(caissePrincipale.solde_cdf.toString()),
      solde_usd: parseFloat(caissePrincipale.solde_usd.toString()),
      seuil_min_cdf: caissePrincipale.seuil_min_cdf ? parseFloat(caissePrincipale.seuil_min_cdf.toString()) : null,
      seuil_max_cdf: caissePrincipale.seuil_max_cdf ? parseFloat(caissePrincipale.seuil_max_cdf.toString()) : null,
      seuil_max_caissier_cdf: caissePrincipale.seuil_max_caissier_cdf ? parseFloat(caissePrincipale.seuil_max_caissier_cdf.toString()) : null,
      seuil_min_usd: caissePrincipale.seuil_min_usd ? parseFloat(caissePrincipale.seuil_min_usd.toString()) : null,
      seuil_max_usd: caissePrincipale.seuil_max_usd ? parseFloat(caissePrincipale.seuil_max_usd.toString()) : null,
      seuil_max_caissier_usd: caissePrincipale.seuil_max_caissier_usd ? parseFloat(caissePrincipale.seuil_max_caissier_usd.toString()) : null,
    });
  } catch (error) {
    next(error);
  }
});

// PUT /api/caisse/principale - Mettre à jour la configuration
router.put('/principale', authorize('SUPER_ADMIN', 'DIRECTOR'), async (req, res, next) => {
  try {
    const agenceId = req.user!.agenceId;

    if (!agenceId) {
      throw new AppError('Vous devez être assigné à une agence', 400);
    }

    const schema = z.object({
      caissier_principal_id: z.number().optional().nullable(),
      seuil_min_cdf: z.number().optional().nullable(),
      seuil_max_cdf: z.number().optional().nullable(),
      seuil_max_caissier_cdf: z.number().optional().nullable(),
      seuil_min_usd: z.number().optional().nullable(),
      seuil_max_usd: z.number().optional().nullable(),
      seuil_max_caissier_usd: z.number().optional().nullable(),
    });

    const data = schema.parse(req.body);

    const caissePrincipale = await prisma.caissePrincipale.upsert({
      where: { id_ag: agenceId },
      update: data,
      create: {
        id_ag: agenceId,
        ...data,
      },
    });

    logger.info(`Configuration caisse principale mise à jour: Agence ${agenceId}`);

    res.json(caissePrincipale);
  } catch (error) {
    next(error);
  }
});

export default router;
