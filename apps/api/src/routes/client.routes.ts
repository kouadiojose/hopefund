import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { authenticate, authorize } from '../middleware/auth';
import { AppError } from '../middleware/error-handler';
import { config } from '../config';
import { logger } from '../utils/logger';
import { Decimal } from '@prisma/client/runtime/library';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Helper: Convert Decimal to number
const toNumber = (val: Decimal | null | undefined): number => {
  if (!val) return 0;
  return parseFloat(val.toString());
};

// Helper: Get credit status label
const getCreditStatusLabel = (etat: number | null): string => {
  const statuses: Record<number, string> = {
    1: 'Demande',
    2: 'En analyse',
    3: 'Approuvé',
    4: 'Rejeté',
    5: 'Débloqué',
    6: 'En cours',
    7: 'Soldé',
    8: 'En retard',
    9: 'Contentieux',
  };
  return statuses[etat || 0] || 'Inconnu';
};

// Helper: Get account status label
const getAccountStatusLabel = (etat: number | null): string => {
  const statuses: Record<number, string> = {
    1: 'Actif',
    2: 'Bloqué',
    3: 'Dormant',
    4: 'Clôturé',
  };
  return statuses[etat || 0] || 'Inconnu';
};

// GET /api/clients - Liste des clients avec résumé
router.get('/', authorize('SUPER_ADMIN', 'DIRECTOR', 'BRANCH_MANAGER', 'CREDIT_OFFICER', 'TELLER'), async (req, res, next) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(
      parseInt(req.query.limit as string) || config.defaultPageSize,
      config.maxPageSize
    );
    const search = req.query.search as string;
    const agencyId = req.user?.agenceId;
    const etat = req.query.etat ? parseInt(req.query.etat as string) : undefined;

    const where: any = {};

    // Filter by agency for non-admin users
    if (agencyId && !['SUPER_ADMIN', 'DIRECTOR'].includes(req.user!.role)) {
      where.id_ag = agencyId;
    }

    // Filter by state
    if (etat !== undefined) {
      where.etat = etat;
    }

    // Search by name, phone, or ID
    if (search) {
      where.OR = [
        { pp_nom: { contains: search, mode: 'insensitive' } },
        { pp_prenom: { contains: search, mode: 'insensitive' } },
        { pm_raison_sociale: { contains: search, mode: 'insensitive' } },
        { num_tel: { contains: search } },
        { num_port: { contains: search } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [clients, total] = await Promise.all([
      prisma.client.findMany({
        where,
        include: {
          comptes: {
            select: {
              id_cpte: true,
              solde: true,
              etat_cpte: true,
            },
          },
          dossiers_credit: {
            select: {
              id_doss: true,
              cre_mnt_octr: true,
              cre_etat: true,
            },
          },
        },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { date_creation: 'desc' },
      }),
      prisma.client.count({ where }),
    ]);

    res.json({
      data: clients.map(c => {
        const totalSolde = c.comptes.reduce((sum, cpt) => sum + toNumber(cpt.solde), 0);
        const comptesActifs = c.comptes.filter(cpt => cpt.etat_cpte === 1).length;
        const creditsEnCours = c.dossiers_credit.filter(d => [5, 6, 8].includes(d.cre_etat || 0)).length;
        const totalCredits = c.dossiers_credit.reduce((sum, d) => sum + toNumber(d.cre_mnt_octr), 0);

        return {
          id_client: c.id_client,
          id_ag: c.id_ag,
          statut_juridique: c.statut_juridique,
          nom_complet: c.statut_juridique === 1
            ? `${c.pp_prenom || ''} ${c.pp_nom || ''}`.trim()
            : c.pm_raison_sociale || c.gi_nom || 'N/A',
          pp_nom: c.pp_nom,
          pp_prenom: c.pp_prenom,
          pp_sexe: c.pp_sexe,
          pm_raison_sociale: c.pm_raison_sociale,
          num_tel: c.num_tel || c.num_port,
          email: c.email,
          etat: c.etat,
          date_adh: c.date_adh,
          // Résumé
          nombre_comptes: c.comptes.length,
          comptes_actifs: comptesActifs,
          total_solde: totalSolde,
          nombre_credits: c.dossiers_credit.length,
          credits_en_cours: creditsEnCours,
          total_credits: totalCredits,
        };
      }),
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

// GET /api/clients/:id - Détail complet du client
router.get('/:id', async (req, res, next) => {
  try {
    const clientId = parseInt(req.params.id);

    if (isNaN(clientId)) {
      throw new AppError('Invalid client ID', 400);
    }

    logger.info(`Fetching client details for ID: ${clientId}`);

    const client = await prisma.client.findUnique({
      where: { id_client: clientId },
    });

    if (!client) {
      throw new AppError('Client not found', 404);
    }

    // Check agency access
    if (req.user!.agenceId &&
        !['SUPER_ADMIN', 'DIRECTOR'].includes(req.user!.role) &&
        client.id_ag !== req.user!.agenceId) {
      throw new AppError('Access denied', 403);
    }

    // Fetch accounts separately to avoid relation issues
    const comptes = await prisma.compte.findMany({
      where: { id_titulaire: clientId },
      orderBy: { date_creation: 'desc' },
    });

    // Fetch movements for each account
    const comptesWithMovements = await Promise.all(
      comptes.map(async (compte) => {
        const mouvements = await prisma.mouvement.findMany({
          where: { cpte_interne_cli: compte.id_cpte },
          take: 5,
          orderBy: { date_mvt: 'desc' },
        });
        return { ...compte, mouvements };
      })
    );

    // Fetch credits separately
    const dossiers_credit = await prisma.dossierCredit.findMany({
      where: { id_client: clientId },
      orderBy: { date_creation: 'desc' },
    });

    // Fetch echeances and garanties for each credit
    const creditsWithDetails = await Promise.all(
      dossiers_credit.map(async (dossier) => {
        const [echeances, garanties] = await Promise.all([
          prisma.echeance.findMany({
            where: { id_doss: dossier.id_doss },
            orderBy: { num_ech: 'asc' },
          }),
          prisma.garantie.findMany({
            where: { id_doss: dossier.id_doss },
          }),
        ]);
        return { ...dossier, echeances, garanties };
      })
    );

    // Calculer les statistiques
    const totalSolde = comptesWithMovements.reduce((sum, c) => sum + toNumber(c.solde), 0);
    const totalBloques = comptesWithMovements.reduce((sum, c) => sum + toNumber(c.mnt_bloq), 0);
    const soldeDisponible = totalSolde - totalBloques;

    const creditsEnCours = creditsWithDetails.filter(d => [5, 6, 8].includes(d.cre_etat || 0));
    const totalCapitalRestant = creditsEnCours.reduce((sum, d) => {
      const echeancesNonPayees = d.echeances.filter(e => e.etat !== 2);
      return sum + echeancesNonPayees.reduce((s, e) => s + toNumber(e.solde_capital), 0);
    }, 0);

    // Échéances en retard
    const today = new Date();
    const echeancesEnRetard = creditsWithDetails.flatMap(d =>
      d.echeances.filter(e =>
        e.etat !== 2 && e.date_ech && new Date(e.date_ech) < today
      )
    );
    const montantEnRetard = echeancesEnRetard.reduce((sum, e) =>
      sum + toNumber(e.solde_capital) + toNumber(e.solde_int), 0
    );

    // Prochaines échéances
    const prochainesEcheances = creditsWithDetails.flatMap(d =>
      d.echeances
        .filter(e => e.etat !== 2 && e.date_ech && new Date(e.date_ech) >= today)
        .map(e => ({
          ...e,
          id_doss: d.id_doss,
          montant_total: toNumber(e.mnt_capital) + toNumber(e.mnt_int),
        }))
    ).sort((a, b) => new Date(a.date_ech!).getTime() - new Date(b.date_ech!).getTime())
    .slice(0, 5);

    res.json({
      // Informations personnelles
      id_client: client.id_client,
      id_ag: client.id_ag,
      statut_juridique: client.statut_juridique,
      nom_complet: client.statut_juridique === 1
        ? `${client.pp_prenom || ''} ${client.pp_nom || ''}`.trim()
        : client.pm_raison_sociale || client.gi_nom || 'N/A',

      // Personne physique
      pp_nom: client.pp_nom,
      pp_prenom: client.pp_prenom,
      pp_date_naissance: client.pp_date_naissance,
      pp_lieu_naissance: client.pp_lieu_naissance,
      pp_sexe: client.pp_sexe,
      pp_etat_civil: client.pp_etat_civil,
      pp_nationalite: client.pp_nationalite,
      pp_type_piece_id: client.pp_type_piece_id,
      pp_nm_piece_id: client.pp_nm_piece_id,
      pp_employeur: client.pp_employeur,
      pp_fonction: client.pp_fonction,
      pp_revenu: toNumber(client.pp_revenu),

      // Personne morale
      pm_raison_sociale: client.pm_raison_sociale,
      pm_abreviation: client.pm_abreviation,
      pm_nature_juridique: client.pm_nature_juridique,
      pm_numero_reg_nat: client.pm_numero_reg_nat,
      pm_date_constitution: client.pm_date_constitution,

      // Contact
      adresse: client.adresse,
      code_postal: client.code_postal,
      ville: client.ville,
      num_tel: client.num_tel,
      num_port: client.num_port,
      email: client.email,

      // État
      etat: client.etat,
      date_adh: client.date_adh,
      date_creation: client.date_creation,

      // Statistiques financières
      statistiques: {
        total_solde: totalSolde,
        total_bloques: totalBloques,
        solde_disponible: soldeDisponible,
        nombre_comptes: comptesWithMovements.length,
        comptes_actifs: comptesWithMovements.filter(c => c.etat_cpte === 1).length,
        nombre_credits: creditsWithDetails.length,
        credits_en_cours: creditsEnCours.length,
        capital_restant: totalCapitalRestant,
        montant_en_retard: montantEnRetard,
        echeances_en_retard: echeancesEnRetard.length,
      },

      // Comptes avec dernières transactions
      comptes: comptesWithMovements.map(c => ({
        id_cpte: c.id_cpte,
        num_complet_cpte: c.num_complet_cpte,
        intitule_compte: c.intitule_compte,
        solde: toNumber(c.solde),
        mnt_bloq: toNumber(c.mnt_bloq),
        solde_disponible: toNumber(c.solde) - toNumber(c.mnt_bloq),
        devise: c.devise || 'BIF',
        etat_cpte: c.etat_cpte,
        etat_label: getAccountStatusLabel(c.etat_cpte),
        date_ouvert: c.date_ouvert,
        tx_interet_cpte: c.tx_interet_cpte,
        dernieres_transactions: c.mouvements.map(m => ({
          id: m.id_mouvement,
          date: m.date_mvt,
          type: m.type_mvt,
          sens: m.sens,
          montant: toNumber(m.montant),
          libelle: m.libel_mvt,
          solde_apres: toNumber(m.solde_apres),
        })),
      })),

      // Crédits avec échéancier
      credits: creditsWithDetails.map(d => {
        const echeancesNonPayees = d.echeances.filter(e => e.etat !== 2);
        const capitalRestant = echeancesNonPayees.reduce((s, e) => s + toNumber(e.solde_capital), 0);
        const interetsRestants = echeancesNonPayees.reduce((s, e) => s + toNumber(e.solde_int), 0);
        const echeancesEnRetardCredit = d.echeances.filter(e =>
          e.etat !== 2 && e.date_ech && new Date(e.date_ech) < today
        );

        return {
          id_doss: d.id_doss,
          date_demande: d.date_dem,
          montant_demande: toNumber(d.mnt_dem),
          montant_octroye: toNumber(d.cre_mnt_octr),
          date_approbation: d.cre_date_approb,
          date_deblocage: d.cre_date_debloc,
          duree_mois: d.duree_mois,
          taux_interet: d.tx_interet_lcr,
          delai_grace: d.delai_grac,
          etat: d.cre_etat,
          etat_label: getCreditStatusLabel(d.cre_etat),
          objet: d.obj_dem,
          detail_objet: d.detail_obj_dem,

          // Frais
          frais_dossier: toNumber(d.mnt_frais_doss),
          commission: toNumber(d.mnt_commission),
          assurance: toNumber(d.mnt_assurance),

          // État actuel
          capital_restant: capitalRestant,
          interets_restants: interetsRestants,
          total_restant: capitalRestant + interetsRestants,
          echeances_payees: d.echeances.filter(e => e.etat === 2).length,
          echeances_restantes: echeancesNonPayees.length,
          echeances_en_retard: echeancesEnRetardCredit.length,
          montant_en_retard: echeancesEnRetardCredit.reduce((s, e) =>
            s + toNumber(e.solde_capital) + toNumber(e.solde_int), 0
          ),

          // Garanties
          garanties: d.garanties.map(g => ({
            id: g.id_gar,
            type: g.type_gar,
            description: g.description,
            valeur: toNumber(g.valeur_estimee),
            date_evaluation: g.date_evaluation,
          })),

          // Échéancier complet
          echeancier: d.echeances.map(e => ({
            num_ech: e.num_ech,
            date_ech: e.date_ech,
            mnt_capital: toNumber(e.mnt_capital),
            mnt_interet: toNumber(e.mnt_int),
            montant_total: toNumber(e.mnt_capital) + toNumber(e.mnt_int),
            solde_capital: toNumber(e.solde_capital),
            solde_interet: toNumber(e.solde_int),
            solde_total: toNumber(e.solde_capital) + toNumber(e.solde_int),
            date_paiement: e.date_paiement,
            mnt_paye: toNumber(e.mnt_paye),
            etat: e.etat,
            etat_label: e.etat === 2 ? 'Payé' : (e.date_ech && new Date(e.date_ech) < today ? 'En retard' : 'À payer'),
            en_retard: e.etat !== 2 && e.date_ech && new Date(e.date_ech) < today,
          })),
        };
      }),

      // Prochaines échéances à payer
      prochaines_echeances: prochainesEcheances,
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/clients/:id/accounts - Comptes détaillés du client
router.get('/:id/accounts', async (req, res, next) => {
  try {
    const clientId = parseInt(req.params.id);

    const accounts = await prisma.compte.findMany({
      where: { id_titulaire: clientId },
      include: {
        mouvements: {
          take: 20,
          orderBy: { date_mvt: 'desc' },
        },
      },
      orderBy: { date_creation: 'desc' },
    });

    res.json(accounts.map(c => ({
      id_cpte: c.id_cpte,
      num_complet_cpte: c.num_complet_cpte,
      intitule_compte: c.intitule_compte,
      solde: toNumber(c.solde),
      mnt_bloq: toNumber(c.mnt_bloq),
      solde_disponible: toNumber(c.solde) - toNumber(c.mnt_bloq),
      devise: c.devise || 'BIF',
      etat_cpte: c.etat_cpte,
      etat_label: getAccountStatusLabel(c.etat_cpte),
      date_ouvert: c.date_ouvert,
      tx_interet_cpte: c.tx_interet_cpte,
      transactions: c.mouvements.map(m => ({
        id: m.id_mouvement,
        date: m.date_mvt,
        type: m.type_mvt,
        sens: m.sens,
        montant: toNumber(m.montant),
        libelle: m.libel_mvt,
        solde_avant: toNumber(m.solde_avant),
        solde_apres: toNumber(m.solde_apres),
      })),
    })));
  } catch (error) {
    next(error);
  }
});

// GET /api/clients/:id/loans - Prêts détaillés du client
router.get('/:id/loans', async (req, res, next) => {
  try {
    const clientId = parseInt(req.params.id);

    const loans = await prisma.dossierCredit.findMany({
      where: { id_client: clientId },
      include: {
        echeances: {
          orderBy: { num_ech: 'asc' },
        },
        garanties: true,
      },
      orderBy: { date_creation: 'desc' },
    });

    const today = new Date();

    res.json(loans.map(d => {
      const echeancesNonPayees = d.echeances.filter(e => e.etat !== 2);
      const capitalRestant = echeancesNonPayees.reduce((s, e) => s + toNumber(e.solde_capital), 0);
      const interetsRestants = echeancesNonPayees.reduce((s, e) => s + toNumber(e.solde_int), 0);

      return {
        id_doss: d.id_doss,
        date_demande: d.date_dem,
        montant_demande: toNumber(d.mnt_dem),
        montant_octroye: toNumber(d.cre_mnt_octr),
        date_deblocage: d.cre_date_debloc,
        duree_mois: d.duree_mois,
        taux_interet: d.tx_interet_lcr,
        etat: d.cre_etat,
        etat_label: getCreditStatusLabel(d.cre_etat),
        capital_restant: capitalRestant,
        interets_restants: interetsRestants,
        total_restant: capitalRestant + interetsRestants,
        garanties: d.garanties.map(g => ({
          type: g.type_gar,
          description: g.description,
          valeur: toNumber(g.valeur_estimee),
        })),
        echeancier: d.echeances.map(e => ({
          num_ech: e.num_ech,
          date_ech: e.date_ech,
          mnt_capital: toNumber(e.mnt_capital),
          mnt_interet: toNumber(e.mnt_int),
          montant_total: toNumber(e.mnt_capital) + toNumber(e.mnt_int),
          solde_capital: toNumber(e.solde_capital),
          solde_interet: toNumber(e.solde_int),
          etat: e.etat,
          en_retard: e.etat !== 2 && e.date_ech && new Date(e.date_ech) < today,
        })),
      };
    }));
  } catch (error) {
    next(error);
  }
});

// POST /api/clients - Créer un client
router.post('/', authorize('SUPER_ADMIN', 'DIRECTOR', 'BRANCH_MANAGER', 'CREDIT_OFFICER'), async (req, res, next) => {
  try {
    const schema = z.object({
      statut_juridique: z.number().min(1).max(3),
      // Personne physique
      pp_nom: z.string().optional(),
      pp_prenom: z.string().optional(),
      pp_date_naissance: z.string().optional(),
      pp_lieu_naissance: z.string().optional(),
      pp_sexe: z.number().optional(),
      pp_nationalite: z.number().optional(),
      pp_type_piece_id: z.number().optional(),
      pp_nm_piece_id: z.string().optional(),
      pp_etat_civil: z.number().optional(),
      pp_employeur: z.string().optional(),
      pp_fonction: z.string().optional(),
      pp_revenu: z.number().optional(),
      // Personne morale
      pm_raison_sociale: z.string().optional(),
      pm_abreviation: z.string().optional(),
      pm_nature_juridique: z.string().optional(),
      pm_numero_reg_nat: z.string().optional(),
      pm_date_constitution: z.string().optional(),
      // Contact
      adresse: z.string().optional(),
      code_postal: z.string().optional(),
      ville: z.string().optional(),
      num_tel: z.string().optional(),
      num_port: z.string().optional(),
      email: z.string().email().optional().nullable(),
    });

    const data = schema.parse(req.body);

    const client = await prisma.client.create({
      data: {
        ...data,
        id_ag: req.user!.agenceId || 1,
        pp_date_naissance: data.pp_date_naissance ? new Date(data.pp_date_naissance) : null,
        pm_date_constitution: data.pm_date_constitution ? new Date(data.pm_date_constitution) : null,
        etat: 1, // Actif
        date_adh: new Date(),
        utilis_crea: req.user!.userId,
      },
    });

    // Audit log (with error handling)
    try {
      await prisma.auditLog.create({
        data: {
          user_id: req.user!.userId,
          action: 'CREATE',
          entity: 'Client',
          entity_id: client.id_client.toString(),
          new_values: data,
          ip_address: req.ip || null,
        },
      });
    } catch (err) {
      logger.warn('Could not log audit - table may not exist');
    }

    res.status(201).json(client);
  } catch (error) {
    next(error);
  }
});

// PUT /api/clients/:id - Modifier un client
router.put('/:id', authorize('SUPER_ADMIN', 'DIRECTOR', 'BRANCH_MANAGER', 'CREDIT_OFFICER'), async (req, res, next) => {
  try {
    const clientId = parseInt(req.params.id);

    const schema = z.object({
      pp_nom: z.string().optional(),
      pp_prenom: z.string().optional(),
      pp_date_naissance: z.string().optional(),
      pp_lieu_naissance: z.string().optional(),
      pp_sexe: z.number().optional(),
      pp_etat_civil: z.number().optional(),
      pp_employeur: z.string().optional(),
      pp_fonction: z.string().optional(),
      pp_revenu: z.number().optional(),
      pm_raison_sociale: z.string().optional(),
      adresse: z.string().optional(),
      ville: z.string().optional(),
      num_tel: z.string().optional(),
      num_port: z.string().optional(),
      email: z.string().email().optional().nullable(),
      etat: z.number().optional(),
    });

    const data = schema.parse(req.body);

    const existingClient = await prisma.client.findUnique({
      where: { id_client: clientId },
    });

    if (!existingClient) {
      throw new AppError('Client not found', 404);
    }

    const client = await prisma.client.update({
      where: { id_client: clientId },
      data: {
        ...data,
        pp_date_naissance: data.pp_date_naissance ? new Date(data.pp_date_naissance) : undefined,
        date_modif: new Date(),
        utilis_modif: req.user!.userId,
      },
    });

    // Audit log (with error handling)
    try {
      await prisma.auditLog.create({
        data: {
          user_id: req.user!.userId,
          action: 'UPDATE',
          entity: 'Client',
          entity_id: client.id_client.toString(),
          old_values: existingClient,
          new_values: data,
          ip_address: req.ip || null,
        },
      });
    } catch (err) {
      logger.warn('Could not log audit - table may not exist');
    }

    res.json(client);
  } catch (error) {
    next(error);
  }
});

export default router;
