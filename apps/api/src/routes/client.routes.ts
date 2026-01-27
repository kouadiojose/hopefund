import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { authenticate, authorize } from '../middleware/auth';
import { AppError } from '../middleware/error-handler';
import { config } from '../config';
import { logger } from '../utils/logger';
import { Decimal } from '@prisma/client/runtime/library';

const router = Router();

// DEBUG: Search for specific client (temporary - remove after debugging)
router.get('/debug-search', async (req, res) => {
  try {
    const search = req.query.q as string || 'Marc Kagisye';
    const searchTerms = search.trim().split(/\s+/).filter(t => t.length > 0);

    // Use raw SQL to search - avoids TypeScript issues with Prisma mode
    const term1 = searchTerms[0] || '';
    const term2 = searchTerms[1] || '';

    const rawResults = await prisma.$queryRawUnsafe(`
      SELECT id_client, id_ag, pp_nom, pp_prenom, pm_raison_sociale, etat, statut_juridique
      FROM ad_cli
      WHERE LOWER(pp_nom) LIKE LOWER($1)
         OR LOWER(pp_prenom) LIKE LOWER($1)
         OR LOWER(pp_nom) LIKE LOWER($2)
         OR LOWER(pp_prenom) LIKE LOWER($2)
         OR LOWER(pm_raison_sociale) LIKE LOWER($1)
         OR LOWER(pm_raison_sociale) LIKE LOWER($2)
      ORDER BY id_client DESC
      LIMIT 100
    `, `%${term1}%`, `%${term2}%`) as any[];

    // Get total client count
    const totalClients = await prisma.client.count();

    res.json({
      search,
      searchTerms,
      results: rawResults,
      totalFound: rawResults.length,
      totalClientsInDb: totalClients,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message, stack: error.stack });
  }
});

// DEBUG: Investigate if a client was deleted (temporary)
router.get('/debug-deleted', async (req, res) => {
  try {
    const search = req.query.q as string || 'Marc Kagisye';
    const searchTerms = search.trim().split(/\s+/).filter(t => t.length > 0);

    // Helper to convert BigInt to Number for JSON serialization
    const serializeResult = (obj: any): any => {
      return JSON.parse(JSON.stringify(obj, (_, value) =>
        typeof value === 'bigint' ? Number(value) : value
      ));
    };

    // Search ALL clients including inactive ones (etat != 1)
    const allMatchingClients = await prisma.$queryRawUnsafe(`
      SELECT id_client, id_ag, pp_nom, pp_prenom, pm_raison_sociale, etat, statut_juridique,
             date_creation, date_modif,
             CASE etat
               WHEN 1 THEN 'Actif'
               WHEN 2 THEN 'Inactif'
               WHEN 3 THEN 'Bloqué'
               WHEN 4 THEN 'Supprimé'
               WHEN 5 THEN 'Décédé'
               ELSE 'État ' || COALESCE(etat::text, 'NULL')
             END as etat_label
      FROM ad_cli
      WHERE LOWER(pp_nom) LIKE LOWER($1)
         OR LOWER(pp_prenom) LIKE LOWER($1)
         OR LOWER(pp_nom) LIKE LOWER($2)
         OR LOWER(pp_prenom) LIKE LOWER($2)
         OR LOWER(pm_raison_sociale) LIKE LOWER($1)
         OR LOWER(pm_raison_sociale) LIKE LOWER($2)
      ORDER BY etat ASC, id_client DESC
      LIMIT 100
    `, `%${searchTerms[0] || ''}%`, `%${searchTerms[1] || ''}%`) as any[];

    // Count clients by etat (state)
    const clientsByState = await prisma.$queryRaw`
      SELECT etat, COUNT(*)::int as count
      FROM ad_cli
      GROUP BY etat
      ORDER BY etat
    ` as any[];

    // List all clients with "Kagisye" in name (exact)
    const kagisyeClients = await prisma.$queryRaw`
      SELECT id_client, pp_nom, pp_prenom, etat, date_creation,
             CASE etat
               WHEN 1 THEN 'Actif'
               WHEN 2 THEN 'Inactif'
               WHEN 3 THEN 'Bloqué'
               WHEN 4 THEN 'Supprimé'
               WHEN 5 THEN 'Décédé'
               ELSE 'État ' || COALESCE(etat::text, 'NULL')
             END as etat_label
      FROM ad_cli
      WHERE LOWER(pp_nom) LIKE LOWER('%Kagisye%')
         OR LOWER(pp_prenom) LIKE LOWER('%Kagisye%')
      ORDER BY etat ASC, id_client DESC
    ` as any[];

    // Summary
    const inactiveCount = allMatchingClients.filter((c: any) => c.etat !== 1).length;
    const activeCount = allMatchingClients.filter((c: any) => c.etat === 1).length;

    res.json(serializeResult({
      search,
      timestamp: new Date().toISOString(),
      summary: {
        totalMatching: allMatchingClients.length,
        activeClients: activeCount,
        inactiveOrDeletedClients: inactiveCount,
        message: inactiveCount > 0
          ? `⚠️ Trouvé ${inactiveCount} client(s) inactif(s) ou supprimé(s) correspondant à "${search}"`
          : `Aucun client inactif trouvé pour "${search}"`,
      },
      allMatchingClients,
      kagisyeClients,
      clientsByState,
    }));
  } catch (error: any) {
    res.status(500).json({ error: error.message, stack: error.stack });
  }
});

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
router.get('/', authorize('SUPER_ADMIN', 'DIRECTOR', 'BRANCH_MANAGER', 'CREDIT_OFFICER', 'TELLER', 'DIRECTOR'), async (req, res, next) => {
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

    // Build search conditions first
    const searchConditions: any[] = [];
    if (search) {
      // Split search into words to allow searching "Darlene MANIRAMBONA"
      // to match pp_prenom="Darlene" AND pp_nom="MANIRAMBONA"
      const searchTerms = search.trim().split(/\s+/).filter(t => t.length > 0);

      // Add conditions for each individual term
      for (const term of searchTerms) {
        searchConditions.push(
          { pp_nom: { contains: term, mode: 'insensitive' } },
          { pp_prenom: { contains: term, mode: 'insensitive' } },
          { pm_raison_sociale: { contains: term, mode: 'insensitive' } },
        );
      }

      // Also search in phone, email with full search string
      searchConditions.push(
        { num_tel: { contains: search } },
        { num_port: { contains: search } },
        { email: { contains: search, mode: 'insensitive' } },
      );

      // Allow search by client ID if the search is numeric
      const searchAsNumber = parseInt(search, 10);
      if (!isNaN(searchAsNumber)) {
        searchConditions.push({ id_client: searchAsNumber });
      }
    }

    // Filter by agency for non-admin users, but allow cross-agency search when searching
    // This allows finding clients that may have loans in the user's agency but belong to another agency
    if (agencyId && !['SUPER_ADMIN', 'DIRECTOR'].includes(req.user!.role)) {
      if (search) {
        // When searching, show results from user's agency OR matching clients from any agency
        where.OR = [
          // Clients from user's agency matching search
          { id_ag: agencyId, OR: searchConditions },
          // Clients from any agency that have loans in user's agency and match search
          {
            dossiers_credit: { some: { id_ag: agencyId } },
            OR: searchConditions,
          },
        ];
      } else {
        // Without search, only show clients from user's agency
        where.id_ag = agencyId;
      }
    } else if (search) {
      // Admin/Director: just apply search conditions
      where.OR = searchConditions;
    }

    // Filter by state - only if a valid number was provided
    if (etat !== undefined && !isNaN(etat)) {
      where.etat = etat;
    }

    // Debug logging
    logger.info(`Client search: search="${search}", etat=${etat}, role=${req.user!.role}, agencyId=${agencyId}, whereHasOR=${!!where.OR}, whereHasEtat=${where.etat !== undefined}`);

    // Check if search is a numeric value (potential exact ID match)
    const searchAsNumber = search ? parseInt(search, 10) : NaN;
    const isNumericSearch = !isNaN(searchAsNumber);

    // For numeric searches on page 1, check for exact ID match first
    let exactMatch: any = null;
    if (isNumericSearch && page === 1) {
      exactMatch = await prisma.client.findUnique({
        where: { id_client: searchAsNumber },
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
      });

      // Check if exact match passes filters (etat filter)
      if (exactMatch && etat !== undefined && !isNaN(etat) && exactMatch.etat !== etat) {
        exactMatch = null;
      }

      if (exactMatch) {
        logger.info(`Found exact ID match for client ${searchAsNumber}`);
      }
    }

    // Build the main query, excluding exact match if found
    const mainWhere = exactMatch
      ? { ...where, id_client: { not: exactMatch.id_client } }
      : where;

    // For search queries, use raw SQL to order by relevance
    let clients: any[];
    let total: number;

    if (search && search.trim().length > 0) {
      const searchTerms = search.trim().split(/\s+/).filter(t => t.length > 0);
      const searchLower = search.toLowerCase();

      // First get total count of matching clients
      total = await prisma.client.count({ where: mainWhere });

      // Get matching clients - no arbitrary limit, just get what we need for pagination
      // But first fetch more to allow for relevance sorting
      const fetchLimit = Math.min(total, 2000); // Fetch up to 2000 for relevance sorting

      const allMatches = await prisma.client.findMany({
        where: mainWhere,
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
        take: fetchLimit,
      });

      // Score and sort by relevance
      const scoredClients = allMatches.map((c: any) => {
        let score = 0;
        const nom = (c.pp_nom || '').toLowerCase();
        const prenom = (c.pp_prenom || '').toLowerCase();
        const raisonSociale = (c.pm_raison_sociale || '').toLowerCase();
        const fullName = `${prenom} ${nom}`.trim();
        const fullNameReverse = `${nom} ${prenom}`.trim();

        // Exact full name match (highest priority)
        if (fullName === searchLower || fullNameReverse === searchLower) {
          score += 1000;
        }

        // Check if ALL terms match (bonus for matching all terms)
        let allTermsMatch = true;
        for (const term of searchTerms) {
          const termLower = term.toLowerCase();
          const termMatches = nom.includes(termLower) || prenom.includes(termLower) || raisonSociale.includes(termLower);
          if (!termMatches) allTermsMatch = false;

          if (nom === termLower) score += 100;
          if (prenom === termLower) score += 100;
          if (raisonSociale === termLower) score += 100;

          // Starts with
          if (nom.startsWith(termLower)) score += 50;
          if (prenom.startsWith(termLower)) score += 50;
          if (raisonSociale.startsWith(termLower)) score += 50;

          // Contains
          if (nom.includes(termLower)) score += 10;
          if (prenom.includes(termLower)) score += 10;
          if (raisonSociale.includes(termLower)) score += 10;
        }

        // Big bonus if all search terms are present
        if (allTermsMatch && searchTerms.length > 1) {
          score += 500;
        }

        // Bonus for active clients with accounts/credits
        if (c.comptes.length > 0) score += 5;
        if (c.dossiers_credit.length > 0) score += 5;
        if (c.etat === 1) score += 3; // Active client

        return { ...c, _relevanceScore: score };
      });

      // Sort by relevance score (descending), then by ID (for consistency)
      scoredClients.sort((a, b) => {
        if (b._relevanceScore !== a._relevanceScore) {
          return b._relevanceScore - a._relevanceScore;
        }
        return b.id_client - a.id_client;
      });

      // Apply pagination to sorted results
      const startIndex = (page - 1) * limit;
      clients = scoredClients.slice(startIndex, startIndex + limit);

      // Update total to reflect actual matches (scoredClients length might be less than total due to fetchLimit)
      total = scoredClients.length;
    } else {
      // No search - use standard pagination
      [clients, total] = await Promise.all([
        prisma.client.findMany({
          where: mainWhere,
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
    }

    // For search with relevance, exact ID match is already handled
    // For no search, combine exact match first on page 1
    const sortedClients = (!search && exactMatch && page === 1)
      ? [exactMatch, ...clients]
      : clients;

    res.json({
      data: sortedClients.map((c: any) => {
        const totalSolde = c.comptes.reduce((sum: number, cpt: any) => sum + toNumber(cpt.solde), 0);
        const comptesActifs = c.comptes.filter((cpt: any) => cpt.etat_cpte === 1).length;
        const creditsEnCours = c.dossiers_credit.filter((d: any) => [5, 6, 8].includes(d.cre_etat || 0)).length;
        const totalCredits = c.dossiers_credit.reduce((sum: number, d: any) => sum + toNumber(d.cre_mnt_octr), 0);

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
    let comptes: any[] = [];
    try {
      comptes = await prisma.compte.findMany({
        where: { id_titulaire: clientId },
        orderBy: { date_creation: 'desc' },
      });
      logger.info(`Found ${comptes.length} accounts for client ${clientId}`);
    } catch (err) {
      logger.error('Error fetching accounts:', err);
      comptes = [];
    }

    // Fetch movements for each account (recherche par id_cpte OU num_cpte)
    const comptesWithMovements = await Promise.all(
      comptes.map(async (compte: any) => {
        try {
          // Rechercher par id_cpte OU num_cpte (car les données peuvent utiliser l'un ou l'autre)
          const whereConditions: any[] = [
            { cpte_interne_cli: compte.id_cpte },
          ];
          if (compte.num_cpte) {
            whereConditions.push({ cpte_interne_cli: compte.num_cpte });
          }

          const mouvements = await prisma.mouvement.findMany({
            where: { OR: whereConditions },
            take: 10,
            orderBy: { date_valeur: 'desc' },
          });
          return { ...compte, mouvements };
        } catch (err) {
          logger.error(`Error fetching movements for account ${compte.id_cpte}:`, err);
          return { ...compte, mouvements: [] };
        }
      })
    );

    // Fetch credits separately
    let dossiers_credit: any[] = [];
    try {
      dossiers_credit = await prisma.dossierCredit.findMany({
        where: { id_client: clientId },
        orderBy: { date_creation: 'desc' },
      });
      logger.info(`Found ${dossiers_credit.length} credits for client ${clientId}`);
    } catch (err) {
      logger.error('Error fetching credits:', err);
      dossiers_credit = [];
    }

    // Fetch paiements (from ad_sre) and garanties for each credit
    const creditsWithDetails = await Promise.all(
      dossiers_credit.map(async (dossier: any) => {
        try {
          // Récupérer les paiements depuis ad_sre (historique réel des remboursements)
          const paiements = await prisma.$queryRawUnsafe(`
            SELECT id_ech, num_remb, date_remb, mnt_remb_cap, mnt_remb_int, mnt_remb_pen, mnt_remb_gar, annul_remb, date_creation
            FROM ad_sre
            WHERE id_doss = $1
            ORDER BY date_remb ASC, num_remb ASC
          `, dossier.id_doss) as any[];

          const garanties = await prisma.garantie.findMany({
            where: { id_doss: dossier.id_doss },
          });

          // Convertir les paiements en format echeances pour compatibilité
          const echeances = paiements.map((p: any, index: number) => ({
            id_ech: p.id_ech,
            num_ech: p.num_remb || (index + 1),
            date_ech: p.date_remb,
            date_paiement: p.date_remb,
            mnt_capital: Number(p.mnt_remb_cap || 0),
            mnt_int: Number(p.mnt_remb_int || 0),
            mnt_paye: Number(p.mnt_remb_cap || 0) + Number(p.mnt_remb_int || 0) + Number(p.mnt_remb_pen || 0),
            mnt_penalite: Number(p.mnt_remb_pen || 0),
            solde_capital: 0,
            solde_int: 0,
            etat: p.annul_remb ? 3 : 2, // 2 = payé, 3 = annulé
          }));

          return { ...dossier, echeances, paiements, garanties };
        } catch (err) {
          logger.error(`Error fetching details for credit ${dossier.id_doss}:`, err);
          return { ...dossier, echeances: [], paiements: [], garanties: [] };
        }
      })
    );

    // Calculer les statistiques
    const totalSolde = comptesWithMovements.reduce((sum: number, c: any) => sum + toNumber(c.solde), 0);
    const totalBloques = comptesWithMovements.reduce((sum: number, c: any) => sum + toNumber(c.mnt_bloq), 0);
    const soldeDisponible = totalSolde - totalBloques;

    const creditsEnCours = creditsWithDetails.filter((d: any) => [5, 6, 8].includes(d.cre_etat || 0));
    const totalCapitalRestant = creditsEnCours.reduce((sum: number, d: any) => {
      const echeancesNonPayees = (d.echeances || []).filter((e: any) => e.etat !== 2);
      return sum + echeancesNonPayees.reduce((s: number, e: any) => s + toNumber(e.solde_capital), 0);
    }, 0);

    // Échéances en retard
    const today = new Date();
    const echeancesEnRetard = creditsWithDetails.flatMap((d: any) =>
      (d.echeances || []).filter((e: any) =>
        e.etat !== 2 && e.date_ech && new Date(e.date_ech) < today
      )
    );
    const montantEnRetard = echeancesEnRetard.reduce((sum: number, e: any) =>
      sum + toNumber(e.solde_capital) + toNumber(e.solde_int), 0
    );

    // Prochaines échéances
    const prochainesEcheances = creditsWithDetails.flatMap((d: any) =>
      (d.echeances || [])
        .filter((e: any) => e.etat !== 2 && e.date_ech && new Date(e.date_ech) >= today)
        .map((e: any) => ({
          ...e,
          id_doss: d.id_doss,
          montant_total: toNumber(e.mnt_capital) + toNumber(e.mnt_int),
        }))
    ).sort((a: any, b: any) => new Date(a.date_ech!).getTime() - new Date(b.date_ech!).getTime())
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
        comptes_actifs: comptesWithMovements.filter((c: any) => c.etat_cpte === 1).length,
        nombre_credits: creditsWithDetails.length,
        credits_en_cours: creditsEnCours.length,
        capital_restant: totalCapitalRestant,
        montant_en_retard: montantEnRetard,
        echeances_en_retard: echeancesEnRetard.length,
      },

      // Comptes avec dernières transactions
      comptes: comptesWithMovements.map((c: any) => ({
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
        dernieres_transactions: (c.mouvements || []).map((m: any) => ({
          id: m.id_mouvement,
          date: m.date_valeur,
          sens: m.sens,
          montant: toNumber(m.montant),
          devise: m.devise,
          compte_comptable: m.compte,
        })),
      })),

      // Crédits avec échéancier
      credits: creditsWithDetails.map((d: any) => {
        const echeancesNonPayees = (d.echeances || []).filter((e: any) => e.etat !== 2);
        const capitalRestant = echeancesNonPayees.reduce((s: number, e: any) => s + toNumber(e.solde_capital), 0);
        const interetsRestants = echeancesNonPayees.reduce((s: number, e: any) => s + toNumber(e.solde_int), 0);
        const echeancesEnRetardCredit = (d.echeances || []).filter((e: any) =>
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
          echeances_payees: (d.echeances || []).filter((e: any) => e.etat === 2).length,
          echeances_restantes: echeancesNonPayees.length,
          echeances_en_retard: echeancesEnRetardCredit.length,
          montant_en_retard: echeancesEnRetardCredit.reduce((s: number, e: any) =>
            s + toNumber(e.solde_capital) + toNumber(e.solde_int), 0
          ),

          // Garanties
          garanties: (d.garanties || []).map((g: any) => ({
            id: g.id_gar,
            type: g.type_gar,
            description: g.description,
            valeur: toNumber(g.valeur_estimee),
            date_evaluation: g.date_evaluation,
          })),

          // Échéancier complet (historique des paiements depuis ad_sre)
          echeancier: (d.echeances || []).map((e: any) => ({
            num_ech: e.num_ech || e.id_ech,
            date_ech: e.date_ech,
            mnt_capital: toNumber(e.mnt_capital),
            mnt_interet: toNumber(e.mnt_int),
            mnt_penalite: toNumber(e.mnt_penalite || 0),
            montant_total: toNumber(e.mnt_capital) + toNumber(e.mnt_int) + toNumber(e.mnt_penalite || 0),
            solde_capital: toNumber(e.solde_capital),
            solde_interet: toNumber(e.solde_int),
            solde_total: toNumber(e.solde_capital) + toNumber(e.solde_int),
            date_paiement: e.date_paiement,
            mnt_paye: toNumber(e.mnt_paye),
            etat: e.etat,
            etat_label: e.etat === 2 ? 'Payé' : e.etat === 3 ? 'Annulé' : 'En attente',
            en_retard: false, // Les paiements effectués ne sont pas en retard
          })),

          // Paiements détaillés (données brutes de ad_sre)
          paiements: (d.paiements || []).map((p: any) => ({
            num_remb: p.num_remb,
            date_remb: p.date_remb,
            mnt_remb_cap: toNumber(p.mnt_remb_cap),
            mnt_remb_int: toNumber(p.mnt_remb_int),
            mnt_remb_pen: toNumber(p.mnt_remb_pen),
            mnt_remb_gar: toNumber(p.mnt_remb_gar),
            total: toNumber(p.mnt_remb_cap) + toNumber(p.mnt_remb_int) + toNumber(p.mnt_remb_pen),
            annule: p.annul_remb === 1,
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
          orderBy: { date_valeur: 'desc' },
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
        date: m.date_valeur,
        sens: m.sens,
        montant: toNumber(m.montant),
        devise: m.devise,
        compte_comptable: m.compte,
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
          orderBy: { date_ech: 'asc' },
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
          num_ech: e.id_ech,
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

// GET /api/clients/:id/transactions - Historique complet des transactions (tous comptes)
router.get('/:id/transactions', async (req, res, next) => {
  try {
    const clientId = parseInt(req.params.id);
    const page = parseInt(req.query.page as string) || 1;
    const all = req.query.all === 'true';
    const limit = all ? 10000 : Math.min(
      parseInt(req.query.limit as string) || 50,
      500
    );

    // Récupérer tous les comptes du client avec id_cpte ET num_cpte
    const comptes = await prisma.compte.findMany({
      where: { id_titulaire: clientId },
      select: { id_cpte: true, num_cpte: true, num_complet_cpte: true },
    });

    if (comptes.length === 0) {
      return res.json({
        data: [],
        pagination: { page: 1, limit, total: 0, totalPages: 0 },
      });
    }

    // Créer une liste de tous les IDs possibles (id_cpte et num_cpte)
    const allPossibleIds: number[] = [];
    const accountMap = new Map<number, string>();

    comptes.forEach(c => {
      allPossibleIds.push(c.id_cpte);
      accountMap.set(c.id_cpte, c.num_complet_cpte || 'N/A');
      if (c.num_cpte && c.num_cpte !== c.id_cpte) {
        allPossibleIds.push(c.num_cpte);
        accountMap.set(c.num_cpte, c.num_complet_cpte || 'N/A');
      }
    });

    const offset = all ? 0 : (page - 1) * limit;
    const actualLimit = all ? 10000 : limit;

    // Get transactions from ad_mouvement
    const [mouvements, total] = await Promise.all([
      prisma.mouvement.findMany({
        where: { cpte_interne_cli: { in: allPossibleIds } },
        skip: offset,
        take: actualLimit,
        orderBy: { date_valeur: 'desc' },
      }),
      prisma.mouvement.count({
        where: { cpte_interne_cli: { in: allPossibleIds } },
      }),
    ]);

    // Try to get ecriture details for transactions that have id_ecriture
    const ecritureIds = mouvements
      .filter(m => m.id_ecriture != null)
      .map(m => m.id_ecriture!);

    let ecrituresMap = new Map<number, any>();

    if (ecritureIds.length > 0) {
      try {
        // First, discover which columns exist in ad_ecriture
        const columnsResult = await prisma.$queryRaw`
          SELECT column_name FROM information_schema.columns
          WHERE table_name = 'ad_ecriture'
        ` as any[];

        const availableColumns = new Set(columnsResult.map((c: any) => c.column_name));

        // Build select clause based on available columns
        const selectCols = ['id_ecriture'];
        if (availableColumns.has('date_ecriture')) selectCols.push('date_ecriture');
        if (availableColumns.has('libelle')) selectCols.push('libelle');
        if (availableColumns.has('ref_externe')) selectCols.push('ref_externe');
        if (availableColumns.has('info')) selectCols.push('info');
        if (availableColumns.has('communication')) selectCols.push('communication');
        if (availableColumns.has('type_ope')) selectCols.push('type_ope');

        const ecritures = await prisma.$queryRawUnsafe(`
          SELECT ${selectCols.join(', ')}
          FROM ad_ecriture
          WHERE id_ecriture IN (${ecritureIds.join(',')})
        `) as any[];

        ecritures.forEach((e: any) => {
          ecrituresMap.set(e.id_ecriture, e);
        });
      } catch (ecritureError) {
        // If the query fails, just continue without ecriture details
        console.log('Could not fetch ecriture details:', ecritureError);
      }
    }

    // Format transactions with ecriture details if available
    const formattedTransactions = mouvements.map(t => {
      const ecriture = t.id_ecriture ? ecrituresMap.get(t.id_ecriture) : null;

      return {
        id_mouvement: t.id_mouvement,
        date_mvt: ecriture?.date_ecriture || t.date_valeur,
        date_valeur: t.date_valeur,
        compte_id: t.cpte_interne_cli,
        compte_numero: accountMap.get(t.cpte_interne_cli!) || 'N/A',
        sens: t.sens,
        montant: toNumber(t.montant),
        devise: t.devise,
        compte_comptable: t.compte,
        id_ecriture: t.id_ecriture,
        // Informations de l'écriture (commentaire/note) si disponibles
        libelle: ecriture?.libelle || null,
        ref_externe: ecriture?.ref_externe || null,
        info: ecriture?.info || null,
        communication: ecriture?.communication || null,
        type_ope: ecriture?.type_ope || null,
      };
    });

    res.json({
      data: formattedTransactions,
      pagination: {
        page: all ? 1 : page,
        limit: all ? total : limit,
        total,
        totalPages: all ? 1 : Math.ceil(total / limit),
      },
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/clients/:id/credit-history - Historique complet des crédits et paiements
router.get('/:id/credit-history', async (req, res, next) => {
  try {
    const clientId = parseInt(req.params.id);
    const today = new Date();

    const credits = await prisma.dossierCredit.findMany({
      where: { id_client: clientId },
      include: {
        echeances: {
          orderBy: { date_ech: 'asc' },
        },
        garanties: true,
      },
      orderBy: { date_creation: 'desc' },
    });

    const result = credits.map(credit => {
      const echeances = credit.echeances || [];
      const echeancesPayees = echeances.filter(e => e.etat === 2);
      const echeancesEnRetard = echeances.filter(e =>
        e.etat !== 2 && e.date_ech && new Date(e.date_ech) < today
      );
      const echeancesAVenir = echeances.filter(e =>
        e.etat !== 2 && e.date_ech && new Date(e.date_ech) >= today
      );

      const totalPaye = echeancesPayees.reduce((sum, e) =>
        sum + toNumber(e.mnt_paye), 0
      );
      const totalDu = echeances.reduce((sum, e) =>
        sum + toNumber(e.mnt_capital) + toNumber(e.mnt_int), 0
      );
      const totalEnRetard = echeancesEnRetard.reduce((sum, e) =>
        sum + toNumber(e.solde_capital) + toNumber(e.solde_int), 0
      );
      const totalRestant = echeances.filter(e => e.etat !== 2).reduce((sum, e) =>
        sum + toNumber(e.solde_capital) + toNumber(e.solde_int), 0
      );

      return {
        id_doss: credit.id_doss,
        date_demande: credit.date_dem,
        date_deblocage: credit.cre_date_debloc,
        montant_octroye: toNumber(credit.cre_mnt_octr),
        duree_mois: credit.duree_mois,
        taux_interet: credit.tx_interet_lcr,
        etat: credit.cre_etat,
        etat_label: getCreditStatusLabel(credit.cre_etat),
        objet: credit.obj_dem,

        // Résumé financier
        resume: {
          total_du: totalDu,
          total_paye: totalPaye,
          total_restant: totalRestant,
          total_en_retard: totalEnRetard,
          pourcentage_rembourse: totalDu > 0 ? Math.round((totalPaye / totalDu) * 100) : 0,
        },

        // Statistiques des échéances
        stats_echeances: {
          total: echeances.length,
          payees: echeancesPayees.length,
          en_retard: echeancesEnRetard.length,
          a_venir: echeancesAVenir.length,
          jours_retard_max: echeancesEnRetard.length > 0
            ? Math.max(...echeancesEnRetard.map(e =>
                Math.floor((today.getTime() - new Date(e.date_ech!).getTime()) / (1000 * 60 * 60 * 24))
              ))
            : 0,
        },

        // Échéancier complet avec détails de paiement
        echeancier: echeances.map(e => {
          const dateEch = e.date_ech ? new Date(e.date_ech) : null;
          const joursRetard = e.etat !== 2 && dateEch && dateEch < today
            ? Math.floor((today.getTime() - dateEch.getTime()) / (1000 * 60 * 60 * 24))
            : 0;

          return {
            num_ech: e.id_ech,
            date_ech: e.date_ech,
            mnt_capital: toNumber(e.mnt_capital),
            mnt_interet: toNumber(e.mnt_int),
            montant_total: toNumber(e.mnt_capital) + toNumber(e.mnt_int),
            solde_capital: toNumber(e.solde_capital),
            solde_interet: toNumber(e.solde_int),
            solde_total: toNumber(e.solde_capital) + toNumber(e.solde_int),
            mnt_paye: toNumber(e.mnt_paye),
            date_paiement: e.date_paiement,
            etat: e.etat,
            etat_label: e.etat === 2 ? 'Payé' : (joursRetard > 0 ? `En retard (${joursRetard}j)` : 'À payer'),
            en_retard: joursRetard > 0,
            jours_retard: joursRetard,
          };
        }),

        // Garanties
        garanties: (credit.garanties || []).map(g => ({
          id: g.id_gar,
          type: g.type_gar,
          description: g.description,
          valeur: toNumber(g.valeur_estimee),
        })),
      };
    });

    res.json(result);
  } catch (error) {
    next(error);
  }
});

// GET /api/clients/:id/payment-regularity - Score de régularité de paiement
router.get('/:id/payment-regularity', authorize('SUPER_ADMIN', 'DIRECTOR', 'BRANCH_MANAGER', 'CREDIT_OFFICER', 'TELLER'), async (req, res, next) => {
  try {
    const clientId = parseInt(req.params.id);

    // Get all credits with their schedules
    const credits = await prisma.dossierCredit.findMany({
      where: { id_client: clientId },
      include: {
        echeances: {
          orderBy: { date_ech: 'asc' },
        },
      },
    });

    if (credits.length === 0) {
      return res.json({
        has_credit_history: false,
        message: 'Aucun historique de crédit pour ce client',
        score_regularite: null,
        recommandation: 'Nouveau client - pas d\'historique',
      });
    }

    // Analyze all payments
    const today = new Date();
    let totalEcheances = 0;
    let echeancesPayees = 0;
    let echeancesEnRetard = 0;
    let echeancesPayeesATremp = 0;
    let echeancesPayeesEnRetard = 0;
    let totalJoursRetard = 0;
    let maxJoursRetard = 0;
    let dernierPaiement: Date | null = null;
    let montantTotalDu = 0;
    let montantTotalPaye = 0;

    const creditAnalysis = credits.map(credit => {
      const echeances = credit.echeances || [];
      let creditEcheancesPayees = 0;
      let creditEcheancesEnRetard = 0;
      let creditPayeesATemps = 0;
      let creditMaxRetard = 0;

      echeances.forEach(e => {
        const dateEch = e.date_ech ? new Date(e.date_ech) : null;
        const datePaiement = e.date_paiement ? new Date(e.date_paiement) : null;
        const soldeRestant = Number(e.solde_capital || 0) + Number(e.solde_int || 0);
        const montantDu = Number(e.mnt_capital || 0) + Number(e.mnt_int || 0);
        const montantPaye = Number(e.mnt_paye || 0);

        // Only count past-due or paid echeances
        if (dateEch && dateEch <= today) {
          totalEcheances++;
          montantTotalDu += montantDu;
          montantTotalPaye += montantPaye;

          if (e.etat === 2 || soldeRestant === 0) {
            // Paid
            echeancesPayees++;
            creditEcheancesPayees++;

            if (datePaiement) {
              if (!dernierPaiement || datePaiement > dernierPaiement) {
                dernierPaiement = datePaiement;
              }

              // Check if paid on time (within 5 days of due date)
              const joursRetard = Math.floor((datePaiement.getTime() - dateEch.getTime()) / (1000 * 60 * 60 * 24));
              if (joursRetard <= 5) {
                echeancesPayeesATremp++;
                creditPayeesATemps++;
              } else {
                echeancesPayeesEnRetard++;
                totalJoursRetard += joursRetard;
                if (joursRetard > maxJoursRetard) maxJoursRetard = joursRetard;
                if (joursRetard > creditMaxRetard) creditMaxRetard = joursRetard;
              }
            } else {
              // Paid but no payment date recorded - assume on time
              echeancesPayeesATremp++;
              creditPayeesATemps++;
            }
          } else if (soldeRestant > 0 && dateEch < today) {
            // Overdue
            echeancesEnRetard++;
            creditEcheancesEnRetard++;
            const joursRetard = Math.floor((today.getTime() - dateEch.getTime()) / (1000 * 60 * 60 * 24));
            totalJoursRetard += joursRetard;
            if (joursRetard > maxJoursRetard) maxJoursRetard = joursRetard;
            if (joursRetard > creditMaxRetard) creditMaxRetard = joursRetard;
          }
        }
      });

      const etatLabels: Record<number, string> = {
        1: 'En analyse', 2: 'Approuvé', 3: 'Att. décaissement',
        5: 'Actif', 7: 'Soldé', 8: 'En retard', 9: 'Rejeté', 10: 'Soldé',
      };

      return {
        id_doss: credit.id_doss,
        montant: Number(credit.cre_mnt_octr || credit.mnt_dem || 0),
        etat: credit.cre_etat || credit.etat,
        etat_label: etatLabels[credit.cre_etat || credit.etat || 0] || 'Inconnu',
        date_debut: credit.cre_date_debloc || credit.cre_date_approb,
        total_echeances: echeances.length,
        echeances_payees: creditEcheancesPayees,
        echeances_en_retard: creditEcheancesEnRetard,
        payees_a_temps: creditPayeesATemps,
        max_jours_retard: creditMaxRetard,
      };
    });

    // Calculate regularity score (0-100)
    let scoreRegularite = 100;
    if (totalEcheances > 0) {
      // Base score: % of payments made on time
      const tauxPaiementATemps = totalEcheances > 0 ? (echeancesPayeesATremp / totalEcheances) * 100 : 0;

      // Penalty for overdue payments
      const penaliteRetards = Math.min(50, echeancesEnRetard * 10);

      // Penalty for late payments (average days late)
      const moyenneJoursRetard = (echeancesPayeesEnRetard + echeancesEnRetard) > 0
        ? totalJoursRetard / (echeancesPayeesEnRetard + echeancesEnRetard)
        : 0;
      const penaliteMoyenneRetard = Math.min(20, moyenneJoursRetard / 3);

      scoreRegularite = Math.max(0, Math.round(tauxPaiementATemps - penaliteRetards - penaliteMoyenneRetard));
    }

    // Determine recommendation
    let recommandation = '';
    let niveauRisque = '';
    if (scoreRegularite >= 80) {
      recommandation = 'Excellent payeur - Éligible pour un nouveau crédit';
      niveauRisque = 'faible';
    } else if (scoreRegularite >= 60) {
      recommandation = 'Bon payeur avec quelques retards - Éligible sous conditions';
      niveauRisque = 'moyen';
    } else if (scoreRegularite >= 40) {
      recommandation = 'Payeur irrégulier - Crédit risqué, garanties supplémentaires requises';
      niveauRisque = 'eleve';
    } else {
      recommandation = 'Mauvais payeur - Crédit non recommandé';
      niveauRisque = 'critique';
    }

    // Check for current overdue
    if (echeancesEnRetard > 0) {
      recommandation = `ATTENTION: ${echeancesEnRetard} échéance(s) actuellement en retard. ` + recommandation;
    }

    res.json({
      has_credit_history: true,
      score_regularite: scoreRegularite,
      niveau_risque: niveauRisque,
      recommandation,
      statistiques: {
        total_credits: credits.length,
        credits_soldes: credits.filter(c => c.cre_etat === 7 || c.cre_etat === 10).length,
        credits_actifs: credits.filter(c => c.cre_etat === 5 || c.cre_etat === 8).length,
        total_echeances: totalEcheances,
        echeances_payees: echeancesPayees,
        echeances_payees_a_temps: echeancesPayeesATremp,
        echeances_payees_en_retard: echeancesPayeesEnRetard,
        echeances_en_retard_actuel: echeancesEnRetard,
        pourcentage_paiement_a_temps: totalEcheances > 0 ? Math.round((echeancesPayeesATremp / totalEcheances) * 100) : 0,
        max_jours_retard: maxJoursRetard,
        moyenne_jours_retard: (echeancesPayeesEnRetard + echeancesEnRetard) > 0
          ? Math.round(totalJoursRetard / (echeancesPayeesEnRetard + echeancesEnRetard))
          : 0,
        montant_total_du: montantTotalDu,
        montant_total_paye: montantTotalPaye,
        dernier_paiement: dernierPaiement,
      },
      credits: creditAnalysis,
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/clients - Créer un client
router.post('/', authorize('SUPER_ADMIN', 'DIRECTOR', 'BRANCH_MANAGER', 'CREDIT_OFFICER', 'TELLER'), async (req, res, next) => {
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
