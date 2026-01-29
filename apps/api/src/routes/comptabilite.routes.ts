import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { authenticate, authorize } from '../middleware/auth';
import { AppError } from '../middleware/error-handler';
import { logger } from '../utils/logger';
import { Decimal } from '@prisma/client/runtime/library';

const router = Router();

// All comptabilite routes require authentication
router.use(authenticate);

// ==================== COFFRES FORTS ====================

// GET /api/comptabilite/coffres - Liste des coffres forts par agence
router.get('/coffres', authorize('SUPER_ADMIN', 'DIRECTOR', 'BRANCH_MANAGER', 'ACCOUNTANT'), async (req, res, next) => {
  try {
    const userAgenceId = req.user!.agenceId;
    const role = req.user!.role;

    // Récupérer les agences
    const agences = await prisma.agence.findMany({
      where: role === 'BRANCH_MANAGER' && userAgenceId
        ? { id_ag: userAgenceId }
        : { etat_ag: 1 },
      orderBy: { id_ag: 'asc' },
    });

    // Pour chaque agence, calculer le solde du coffre fort (compte classe 1.0.1)
    const coffresData = await Promise.all(agences.map(async (agence) => {
      // Récupérer les mouvements des comptes de coffre fort (1.0.1.*)
      const mouvements = await prisma.$queryRaw<any[]>`
        SELECT
          SUM(CASE WHEN sens = 'd' THEN montant ELSE 0 END) as total_debit,
          SUM(CASE WHEN sens = 'c' THEN montant ELSE 0 END) as total_credit
        FROM ad_mouvement
        WHERE id_ag = ${agence.id_ag}
        AND compte LIKE '1.0.1.%'
      `;

      const totalDebit = parseFloat(mouvements[0]?.total_debit || '0');
      const totalCredit = parseFloat(mouvements[0]?.total_credit || '0');
      const solde = totalDebit - totalCredit;

      // Récupérer aussi le solde de la caisse principale si existe
      const caissePrincipale = await prisma.caissePrincipale.findUnique({
        where: { id_ag: agence.id_ag },
      });

      return {
        id_ag: agence.id_ag,
        libelle: agence.libel_ag || `Agence ${agence.id_ag}`,
        solde_coffre: solde > 0 ? solde : (caissePrincipale?.solde_cdf ? parseFloat(caissePrincipale.solde_cdf.toString()) : 0),
        solde_cdf: caissePrincipale?.solde_cdf ? parseFloat(caissePrincipale.solde_cdf.toString()) : 0,
        solde_usd: caissePrincipale?.solde_usd ? parseFloat(caissePrincipale.solde_usd.toString()) : 0,
        seuil_min: caissePrincipale?.seuil_min_cdf ? parseFloat(caissePrincipale.seuil_min_cdf.toString()) : null,
        seuil_max: caissePrincipale?.seuil_max_cdf ? parseFloat(caissePrincipale.seuil_max_cdf.toString()) : null,
      };
    }));

    // Calculer le total
    const totalGeneral = coffresData.reduce((sum, c) => sum + c.solde_coffre, 0);

    res.json({
      coffres: coffresData,
      total: totalGeneral,
    });
  } catch (error) {
    next(error);
  }
});

// ==================== VIREMENTS ====================

// GET /api/comptabilite/virements - Liste des virements inter-agences
router.get('/virements', authorize('SUPER_ADMIN', 'DIRECTOR', 'BRANCH_MANAGER', 'ACCOUNTANT'), async (req, res, next) => {
  try {
    const { dateDebut, dateFin, agence, etat } = req.query;

    // Récupérer les mouvements de caisse (approvisionnements/reversements)
    const where: any = {};

    if (agence && agence !== 'all') {
      where.id_ag = parseInt(agence as string);
    }
    if (etat && etat !== 'all') {
      where.etat = parseInt(etat as string);
    }

    const mouvements = await prisma.caisseMouvement.findMany({
      where,
      orderBy: { created_at: 'desc' },
      take: 100,
    });

    // Récupérer les noms des agences
    const agenceIds = [...new Set(mouvements.map(m => m.id_ag))];
    const agences = await prisma.agence.findMany({
      where: { id_ag: { in: agenceIds } },
    });
    const agenceMap = new Map(agences.map(a => [a.id_ag, a.libel_ag]));

    // Récupérer les noms des utilisateurs
    const userIds = [...new Set([
      ...mouvements.map(m => m.demande_par),
      ...mouvements.filter(m => m.valide_par).map(m => m.valide_par!),
    ])];
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, nom: true, prenom: true },
    });
    const userMap = new Map(users.map(u => [u.id, `${u.prenom} ${u.nom}`]));

    const virementsData = mouvements.map(m => ({
      id: m.id,
      date: m.created_at,
      type: m.type_mouvement === 1 ? 'Approvisionnement' : 'Reversement',
      agence: agenceMap.get(m.id_ag) || `Agence ${m.id_ag}`,
      montant: parseFloat(m.montant.toString()),
      devise: m.devise,
      demandeur: userMap.get(m.demande_par) || 'Inconnu',
      valideur: m.valide_par ? userMap.get(m.valide_par) : null,
      etat: m.etat === 1 ? 'En attente' : m.etat === 2 ? 'Validé' : 'Rejeté',
      etat_code: m.etat,
      numero_bordereau: m.numero_bordereau,
      commentaire: m.commentaire,
    }));

    res.json({ virements: virementsData });
  } catch (error) {
    next(error);
  }
});

// POST /api/comptabilite/virements - Créer un virement inter-agences
router.post('/virements', authorize('SUPER_ADMIN', 'DIRECTOR', 'BRANCH_MANAGER'), async (req, res, next) => {
  try {
    const schema = z.object({
      type: z.enum(['coffre_banque', 'coffre_coffre', 'banque_coffre']),
      agence_source: z.number(),
      agence_dest: z.number().optional(),
      montant: z.number().positive(),
      devise: z.string().default('BIF'),
      motif: z.string().optional(),
    });

    const data = schema.parse(req.body);
    const userId = req.user!.userId;

    // Créer le virement comme un mouvement de caisse
    const virement = await prisma.caisseMouvement.create({
      data: {
        session_id: 0, // Pas de session spécifique pour les virements inter-agences
        id_ag: data.agence_source,
        type_mouvement: 2, // Reversement (sortie)
        montant: data.montant,
        devise: data.devise,
        vers_caisse_principale: data.type === 'coffre_banque',
        demande_par: userId,
        etat: 1, // En attente
        commentaire: data.motif,
      },
    });

    res.status(201).json({
      message: 'Virement créé avec succès',
      virement,
    });
  } catch (error) {
    next(error);
  }
});

// ==================== PLAN COMPTABLE ====================

// GET /api/comptabilite/plan - Plan comptable Hopefund
router.get('/plan', authorize('SUPER_ADMIN', 'DIRECTOR', 'ACCOUNTANT'), async (req, res, next) => {
  try {
    // Plan comptable basé sur le plan comptable des établissements financiers du Burundi
    const planComptable = {
      classes: [
        {
          numero: '1',
          libelle: 'TRESORERIE ET OPERATIONS INTERBANCAIRES',
          comptes: [
            {
              numero: '1.0',
              libelle: 'Caisse et valeurs assimilées',
              sousComptes: [
                { numero: '1.0.1', libelle: 'Coffres Forts', nature: 'actif' },
                { numero: '1.0.1.1', libelle: 'Coffre Fort Siège', nature: 'actif' },
                { numero: '1.0.1.2', libelle: 'Coffre Fort Makamba', nature: 'actif' },
                { numero: '1.0.1.3', libelle: 'Coffre Fort Jabe', nature: 'actif' },
                { numero: '1.0.1.4', libelle: 'Coffre Fort Kamenge', nature: 'actif' },
                { numero: '1.0.1.5', libelle: 'Coffre Fort Nyanza Lac', nature: 'actif' },
                { numero: '1.0.2', libelle: 'Caisses Guichetiers', nature: 'actif' },
              ],
            },
            {
              numero: '1.1',
              libelle: 'Comptes en banque',
              sousComptes: [
                { numero: '1.1.1', libelle: 'Banques locales', nature: 'actif' },
                { numero: '1.1.1.1', libelle: 'BRB - Compte courant', nature: 'actif' },
                { numero: '1.1.1.2', libelle: 'BANCOBU', nature: 'actif' },
                { numero: '1.1.1.3', libelle: 'BGF', nature: 'actif' },
                { numero: '1.1.2', libelle: 'Banques étrangères', nature: 'actif' },
              ],
            },
          ],
        },
        {
          numero: '2',
          libelle: 'OPERATIONS AVEC LA CLIENTELE',
          comptes: [
            {
              numero: '2.1',
              libelle: 'Crédits à la clientèle',
              sousComptes: [
                { numero: '2.1.1', libelle: 'Crédits court terme', nature: 'actif' },
                { numero: '2.1.1.1', libelle: 'Crédits CT Agriculture', nature: 'actif' },
                { numero: '2.1.1.2', libelle: 'Crédits CT Commerce', nature: 'actif' },
                { numero: '2.1.1.3', libelle: 'Crédits CT Consommation', nature: 'actif' },
                { numero: '2.1.1.4', libelle: 'Crédits CT Habitat', nature: 'actif' },
                { numero: '2.1.1.5', libelle: 'Crédits CT Élevage', nature: 'actif' },
                { numero: '2.1.1.6', libelle: 'Crédits CT Autres', nature: 'actif' },
                { numero: '2.1.2', libelle: 'Crédits moyen terme', nature: 'actif' },
                { numero: '2.1.3', libelle: 'Crédits long terme', nature: 'actif' },
                { numero: '2.1.8', libelle: 'Intérêts courus non échus', nature: 'actif' },
                { numero: '2.1.9', libelle: 'Créances en souffrance', nature: 'actif' },
              ],
            },
            {
              numero: '2.2',
              libelle: 'Dépôts de la clientèle',
              sousComptes: [
                { numero: '2.2.1', libelle: 'Dépôts à vue', nature: 'passif' },
                { numero: '2.2.1.1', libelle: 'Dépôts à vue des individus', nature: 'passif' },
                { numero: '2.2.1.2', libelle: 'Dépôts à vue des groupements', nature: 'passif' },
                { numero: '2.2.2', libelle: 'Dépôts à terme', nature: 'passif' },
                { numero: '2.2.3', libelle: 'Épargne bloquée', nature: 'passif' },
                { numero: '2.2.4', libelle: 'Plans épargne logement', nature: 'passif' },
              ],
            },
          ],
        },
        {
          numero: '3',
          libelle: 'OPERATIONS DIVERSES',
          comptes: [
            {
              numero: '3.1',
              libelle: 'Débiteurs divers',
              sousComptes: [
                { numero: '3.1.1', libelle: 'Personnel', nature: 'actif' },
                { numero: '3.1.2', libelle: 'Fournisseurs - Avances', nature: 'actif' },
              ],
            },
            {
              numero: '3.2',
              libelle: 'Créditeurs divers',
              sousComptes: [
                { numero: '3.2.1', libelle: 'Fournisseurs', nature: 'passif' },
                { numero: '3.2.2', libelle: 'État - Impôts et taxes', nature: 'passif' },
                { numero: '3.2.3', libelle: 'INSS', nature: 'passif' },
              ],
            },
            {
              numero: '3.3',
              libelle: 'Comptes de régularisation',
              sousComptes: [
                { numero: '3.3.1', libelle: 'Charges à payer', nature: 'passif' },
                { numero: '3.3.2', libelle: 'Produits à recevoir', nature: 'actif' },
                { numero: '3.3.3', libelle: 'Charges constatées d\'avance', nature: 'actif' },
                { numero: '3.3.4', libelle: 'Produits constatés d\'avance', nature: 'passif' },
              ],
            },
            {
              numero: '3.4',
              libelle: 'Comptes d\'attente',
              sousComptes: [
                { numero: '3.4.1', libelle: 'Opérations en attente d\'imputation', nature: 'actif' },
                { numero: '3.4.5', libelle: 'Manquant de caisse à justifier', nature: 'actif' },
                { numero: '3.4.6', libelle: 'Excédent de caisse à justifier', nature: 'passif' },
              ],
            },
          ],
        },
        {
          numero: '4',
          libelle: 'ACTIFS IMMOBILISES',
          comptes: [
            {
              numero: '4.1',
              libelle: 'Immobilisations incorporelles',
              sousComptes: [
                { numero: '4.1.1', libelle: 'Logiciels', nature: 'actif' },
                { numero: '4.1.9', libelle: 'Amortissements immo incorporelles', nature: 'actif' },
              ],
            },
            {
              numero: '4.2',
              libelle: 'Immobilisations corporelles',
              sousComptes: [
                { numero: '4.2.1', libelle: 'Terrains', nature: 'actif' },
                { numero: '4.2.2', libelle: 'Constructions', nature: 'actif' },
                { numero: '4.2.3', libelle: 'Matériel de transport', nature: 'actif' },
                { numero: '4.2.4', libelle: 'Matériel informatique', nature: 'actif' },
                { numero: '4.2.5', libelle: 'Mobilier de bureau', nature: 'actif' },
                { numero: '4.2.9', libelle: 'Amortissements immo corporelles', nature: 'actif' },
              ],
            },
          ],
        },
        {
          numero: '5',
          libelle: 'FONDS PROPRES ET ASSIMILES',
          comptes: [
            {
              numero: '5.1',
              libelle: 'Capital',
              sousComptes: [
                { numero: '5.1.1', libelle: 'Capital souscrit appelé versé', nature: 'passif' },
                { numero: '5.1.2', libelle: 'Capital non libéré', nature: 'passif' },
              ],
            },
            {
              numero: '5.2',
              libelle: 'Réserves',
              sousComptes: [
                { numero: '5.2.1', libelle: 'Réserve légale', nature: 'passif' },
                { numero: '5.2.2', libelle: 'Réserves statutaires', nature: 'passif' },
                { numero: '5.2.3', libelle: 'Réserves facultatives', nature: 'passif' },
              ],
            },
            {
              numero: '5.3',
              libelle: 'Report à nouveau',
              sousComptes: [
                { numero: '5.3.1', libelle: 'Report à nouveau créditeur', nature: 'passif' },
                { numero: '5.3.2', libelle: 'Report à nouveau débiteur', nature: 'passif' },
              ],
            },
            {
              numero: '5.5',
              libelle: 'Résultat',
              sousComptes: [
                { numero: '5.5.1', libelle: 'Résultat de l\'exercice', nature: 'passif' },
              ],
            },
            {
              numero: '5.9',
              libelle: 'Provisions',
              sousComptes: [
                { numero: '5.9.1', libelle: 'Provisions pour risques', nature: 'passif' },
                { numero: '5.9.2', libelle: 'Provisions pour créances douteuses', nature: 'passif' },
              ],
            },
          ],
        },
        {
          numero: '6',
          libelle: 'CHARGES',
          comptes: [
            {
              numero: '6.1',
              libelle: 'Charges d\'exploitation bancaire',
              sousComptes: [
                { numero: '6.1.1', libelle: 'Intérêts sur dépôts clients', nature: 'charge' },
                { numero: '6.1.2', libelle: 'Intérêts sur emprunts', nature: 'charge' },
              ],
            },
            {
              numero: '6.2',
              libelle: 'Charges générales d\'exploitation',
              sousComptes: [
                { numero: '6.2.1', libelle: 'Frais de personnel', nature: 'charge' },
                { numero: '6.2.1.1', libelle: 'Salaires', nature: 'charge' },
                { numero: '6.2.1.2', libelle: 'Charges sociales', nature: 'charge' },
                { numero: '6.2.2', libelle: 'Charges externes', nature: 'charge' },
                { numero: '6.2.2.1', libelle: 'Loyers', nature: 'charge' },
                { numero: '6.2.2.2', libelle: 'Entretien et réparations', nature: 'charge' },
                { numero: '6.2.2.3', libelle: 'Eau et électricité', nature: 'charge' },
                { numero: '6.2.2.4', libelle: 'Téléphone et internet', nature: 'charge' },
                { numero: '6.2.2.5', libelle: 'Carburant', nature: 'charge' },
                { numero: '6.2.3', libelle: 'Impôts et taxes', nature: 'charge' },
              ],
            },
            {
              numero: '6.3',
              libelle: 'Dotations aux amortissements et provisions',
              sousComptes: [
                { numero: '6.3.1', libelle: 'Dotations aux amortissements', nature: 'charge' },
                { numero: '6.3.2', libelle: 'Dotations aux provisions', nature: 'charge' },
              ],
            },
          ],
        },
        {
          numero: '7',
          libelle: 'PRODUITS',
          comptes: [
            {
              numero: '7.1',
              libelle: 'Produits d\'exploitation bancaire',
              sousComptes: [
                { numero: '7.1.1', libelle: 'Intérêts sur crédits', nature: 'produit' },
                { numero: '7.1.1.1', libelle: 'Intérêts crédits CT', nature: 'produit' },
                { numero: '7.1.1.2', libelle: 'Intérêts crédits MT', nature: 'produit' },
                { numero: '7.1.1.3', libelle: 'Intérêts crédits LT', nature: 'produit' },
                { numero: '7.1.2', libelle: 'Commissions', nature: 'produit' },
                { numero: '7.1.2.1', libelle: 'Frais de dossier', nature: 'produit' },
                { numero: '7.1.2.2', libelle: 'Commissions sur opérations', nature: 'produit' },
              ],
            },
            {
              numero: '7.2',
              libelle: 'Autres produits',
              sousComptes: [
                { numero: '7.2.1', libelle: 'Revenus des placements', nature: 'produit' },
                { numero: '7.2.2', libelle: 'Produits divers', nature: 'produit' },
              ],
            },
            {
              numero: '7.3',
              libelle: 'Reprises sur provisions',
              sousComptes: [
                { numero: '7.3.1', libelle: 'Reprises provisions créances', nature: 'produit' },
              ],
            },
          ],
        },
      ],
    };

    res.json(planComptable);
  } catch (error) {
    next(error);
  }
});

// ==================== BALANCE COMPTABLE ====================

// GET /api/comptabilite/balance - Balance des comptes
router.get('/balance', authorize('SUPER_ADMIN', 'DIRECTOR', 'ACCOUNTANT'), async (req, res, next) => {
  try {
    const { dateDebut, dateFin, agence } = req.query;

    // Construire la requête pour agréger les mouvements par compte
    let whereClause = '';
    const params: any[] = [];

    if (agence && agence !== 'all') {
      whereClause += ' AND id_ag = $1';
      params.push(parseInt(agence as string));
    }
    if (dateDebut) {
      whereClause += ` AND date_valeur >= $${params.length + 1}`;
      params.push(new Date(dateDebut as string));
    }
    if (dateFin) {
      whereClause += ` AND date_valeur <= $${params.length + 1}`;
      params.push(new Date(dateFin as string));
    }

    // Récupérer les soldes par compte
    const query = `
      SELECT
        compte as numero_compte,
        SUM(CASE WHEN sens = 'd' THEN montant ELSE 0 END) as total_debit,
        SUM(CASE WHEN sens = 'c' THEN montant ELSE 0 END) as total_credit
      FROM ad_mouvement
      WHERE compte IS NOT NULL ${whereClause}
      GROUP BY compte
      ORDER BY compte
    `;

    const mouvements = await prisma.$queryRawUnsafe<any[]>(query, ...params);

    // Mapper les libellés du plan comptable
    const planLibelles: Record<string, string> = {
      '1.0.1.1': 'COFFRE FORT SIEGE',
      '1.0.1.2': 'COFFRE FORT MAKAMBA',
      '1.0.1.3': 'COFFRE FORT JABE',
      '1.0.1.4': 'COFFRE FORT KAMENGE',
      '1.0.1.5': 'COFFRE FORT NYANZA LAC',
      '1.1.1.1': 'B.R.B N° 1150/007',
      '1.1.1.3.2.3': 'BGF 800/001/50/12005/2/62',
      '2.1.1.1': 'Crédits CT Agriculture',
      '2.1.1.2': 'Crédits CT Commerce',
      '2.1.1.6': 'Crédits CT Autres',
      '2.2.1.1': 'Dépôts à vue des individus',
      '2.2.1.2': 'Dépôts à vue des groupements',
      '5.5.1': 'Capital libéré',
      '7.1.1': 'Intérêts sur crédits',
      '7.1.2.1': 'Frais de dossier',
    };

    const balanceData = mouvements.map(m => {
      const totalDebit = parseFloat(m.total_debit || '0');
      const totalCredit = parseFloat(m.total_credit || '0');
      const solde = totalDebit - totalCredit;

      return {
        numero_compte: m.numero_compte,
        libelle: planLibelles[m.numero_compte] || m.numero_compte,
        solde_debut_debit: 0, // À calculer si date début spécifiée
        solde_debut_credit: 0,
        mouvement_debit: totalDebit,
        mouvement_credit: totalCredit,
        solde_fin_debit: solde > 0 ? solde : 0,
        solde_fin_credit: solde < 0 ? Math.abs(solde) : 0,
      };
    });

    res.json({ data: balanceData });
  } catch (error) {
    next(error);
  }
});

// ==================== GRAND LIVRE ====================

// GET /api/comptabilite/grand-livre - Détail des mouvements par compte
router.get('/grand-livre', authorize('SUPER_ADMIN', 'DIRECTOR', 'ACCOUNTANT'), async (req, res, next) => {
  try {
    const { dateDebut, dateFin, compte, agence } = req.query;

    // Construire la clause WHERE
    const conditions: string[] = ['compte IS NOT NULL'];
    const params: any[] = [];
    let paramIndex = 1;

    if (compte) {
      conditions.push(`compte LIKE $${paramIndex}`);
      params.push(`${compte}%`);
      paramIndex++;
    }
    if (agence && agence !== 'all') {
      conditions.push(`id_ag = $${paramIndex}`);
      params.push(parseInt(agence as string));
      paramIndex++;
    }
    if (dateDebut) {
      conditions.push(`date_valeur >= $${paramIndex}`);
      params.push(new Date(dateDebut as string));
      paramIndex++;
    }
    if (dateFin) {
      conditions.push(`date_valeur <= $${paramIndex}`);
      params.push(new Date(dateFin as string));
      paramIndex++;
    }

    // Récupérer les comptes distincts
    const comptesQuery = `
      SELECT DISTINCT compte
      FROM ad_mouvement
      WHERE ${conditions.join(' AND ')}
      ORDER BY compte
      LIMIT 20
    `;
    const comptes = await prisma.$queryRawUnsafe<any[]>(comptesQuery, ...params);

    // Pour chaque compte, récupérer les écritures
    const grandLivre = await Promise.all(comptes.map(async (c) => {
      const ecrituresQuery = `
        SELECT
          id_mouvement,
          date_valeur as date,
          id_ecriture as piece,
          montant,
          sens,
          devise
        FROM ad_mouvement
        WHERE compte = $1
        ${agence && agence !== 'all' ? `AND id_ag = $2` : ''}
        ${dateDebut ? `AND date_valeur >= $${agence && agence !== 'all' ? 3 : 2}` : ''}
        ${dateFin ? `AND date_valeur <= $${agence && agence !== 'all' ? (dateDebut ? 4 : 3) : (dateDebut ? 3 : 2)}` : ''}
        ORDER BY date_valeur, id_mouvement
        LIMIT 100
      `;

      const ecrituresParams: any[] = [c.compte];
      if (agence && agence !== 'all') ecrituresParams.push(parseInt(agence as string));
      if (dateDebut) ecrituresParams.push(new Date(dateDebut as string));
      if (dateFin) ecrituresParams.push(new Date(dateFin as string));

      const ecritures = await prisma.$queryRawUnsafe<any[]>(ecrituresQuery, ...ecrituresParams);

      // Calculer le solde progressif
      let solde = 0;
      const ecrituresWithSolde = ecritures.map(e => {
        const montant = parseFloat(e.montant || '0');
        if (e.sens === 'd') {
          solde += montant;
        } else {
          solde -= montant;
        }
        return {
          date: e.date,
          piece: e.piece ? `ECR-${e.piece}` : '-',
          libelle: 'Mouvement comptable',
          debit: e.sens === 'd' ? montant : 0,
          credit: e.sens === 'c' ? montant : 0,
          solde: solde,
        };
      });

      const planLibelles: Record<string, string> = {
        '1.0.1.1': 'COFFRE FORT SIEGE',
        '1.0.1.2': 'COFFRE FORT MAKAMBA',
        '2.1.1.6': 'Crédits CT Autres',
        '2.2.1.1': 'Dépôts à vue des individus',
      };

      return {
        numero_compte: c.compte,
        libelle_compte: planLibelles[c.compte] || c.compte,
        solde_initial: 0,
        ecritures: ecrituresWithSolde,
        solde_final: solde,
      };
    }));

    res.json({ data: grandLivre });
  } catch (error) {
    next(error);
  }
});

// ==================== JOURNAL COMPTABLE ====================

// GET /api/comptabilite/journal - Écritures comptables
router.get('/journal', authorize('SUPER_ADMIN', 'DIRECTOR', 'ACCOUNTANT'), async (req, res, next) => {
  try {
    const { dateDebut, dateFin, journal, agence } = req.query;

    // Récupérer les écritures groupées par id_ecriture
    const conditions: string[] = ['id_ecriture IS NOT NULL'];
    const params: any[] = [];
    let paramIndex = 1;

    if (agence && agence !== 'all') {
      conditions.push(`id_ag = $${paramIndex}`);
      params.push(parseInt(agence as string));
      paramIndex++;
    }
    if (dateDebut) {
      conditions.push(`date_valeur >= $${paramIndex}`);
      params.push(new Date(dateDebut as string));
      paramIndex++;
    }
    if (dateFin) {
      conditions.push(`date_valeur <= $${paramIndex}`);
      params.push(new Date(dateFin as string));
      paramIndex++;
    }

    // Récupérer les écritures uniques
    const ecrituresQuery = `
      SELECT DISTINCT id_ecriture, date_valeur, id_ag
      FROM ad_mouvement
      WHERE ${conditions.join(' AND ')}
      ORDER BY date_valeur DESC, id_ecriture DESC
      LIMIT 50
    `;
    const ecrituresIds = await prisma.$queryRawUnsafe<any[]>(ecrituresQuery, ...params);

    // Pour chaque écriture, récupérer ses lignes
    const ecritures = await Promise.all(ecrituresIds.map(async (e) => {
      const lignesQuery = `
        SELECT compte, sens, montant, devise
        FROM ad_mouvement
        WHERE id_ecriture = $1 AND id_ag = $2
        ORDER BY sens DESC, compte
      `;
      const lignes = await prisma.$queryRawUnsafe<any[]>(lignesQuery, e.id_ecriture, e.id_ag);

      const planLibelles: Record<string, string> = {
        '1.0.1.1': 'COFFRE FORT SIEGE',
        '2.1.1.6': 'Crédits CT Autres',
        '2.2.1.1': 'Dépôts à vue des individus',
        '7.1.1': 'Intérêts sur crédits',
      };

      let totalDebit = 0;
      let totalCredit = 0;
      const lignesFormatees = lignes.map(l => {
        const montant = parseFloat(l.montant || '0');
        if (l.sens === 'd') totalDebit += montant;
        else totalCredit += montant;

        return {
          numero_compte: l.compte,
          libelle_compte: planLibelles[l.compte] || l.compte,
          debit: l.sens === 'd' ? montant : 0,
          credit: l.sens === 'c' ? montant : 0,
        };
      });

      // Déterminer le type de journal
      const firstCompte = lignes[0]?.compte || '';
      let journalType = 'OD';
      if (firstCompte.startsWith('1.0')) journalType = 'CA';
      else if (firstCompte.startsWith('1.1')) journalType = 'BQ';
      else if (firstCompte.startsWith('2.1')) journalType = 'CR';

      return {
        id: e.id_ecriture,
        date: e.date_valeur,
        numero_piece: `${journalType}-${e.id_ecriture}`,
        libelle: `Écriture comptable #${e.id_ecriture}`,
        journal: journalType,
        lignes: lignesFormatees,
        total_debit: totalDebit,
        total_credit: totalCredit,
        statut: 'valide',
      };
    }));

    res.json({ data: ecritures });
  } catch (error) {
    next(error);
  }
});

// POST /api/comptabilite/journal - Créer une écriture comptable
router.post('/journal', authorize('SUPER_ADMIN', 'DIRECTOR', 'ACCOUNTANT'), async (req, res, next) => {
  try {
    const schema = z.object({
      date: z.string(),
      libelle: z.string(),
      journal: z.string(),
      lignes: z.array(z.object({
        compte: z.string(),
        debit: z.number().min(0),
        credit: z.number().min(0),
      })),
    });

    const data = schema.parse(req.body);
    const agenceId = req.user!.agenceId || 1;

    // Vérifier l'équilibre débit/crédit
    const totalDebit = data.lignes.reduce((sum, l) => sum + l.debit, 0);
    const totalCredit = data.lignes.reduce((sum, l) => sum + l.credit, 0);

    if (Math.abs(totalDebit - totalCredit) > 0.01) {
      throw new AppError('L\'écriture n\'est pas équilibrée (débit ≠ crédit)', 400);
    }

    // Générer un nouvel id_ecriture
    const maxEcriture = await prisma.$queryRaw<any[]>`
      SELECT COALESCE(MAX(id_ecriture), 0) + 1 as next_id FROM ad_mouvement WHERE id_ag = ${agenceId}
    `;
    const newEcritureId = maxEcriture[0]?.next_id || 1;

    // Créer les mouvements
    await prisma.$transaction(async (tx) => {
      for (const ligne of data.lignes) {
        if (ligne.debit > 0) {
          await tx.$executeRaw`
            INSERT INTO ad_mouvement (id_ag, id_ecriture, compte, sens, montant, devise, date_valeur)
            VALUES (${agenceId}, ${newEcritureId}, ${ligne.compte}, 'd', ${ligne.debit}, 'BIF', ${new Date(data.date)})
          `;
        }
        if (ligne.credit > 0) {
          await tx.$executeRaw`
            INSERT INTO ad_mouvement (id_ag, id_ecriture, compte, sens, montant, devise, date_valeur)
            VALUES (${agenceId}, ${newEcritureId}, ${ligne.compte}, 'c', ${ligne.credit}, 'BIF', ${new Date(data.date)})
          `;
        }
      }
    });

    logger.info(`Écriture comptable créée: #${newEcritureId} par User ${req.user!.userId}`);

    res.status(201).json({
      message: 'Écriture comptable créée avec succès',
      id_ecriture: newEcritureId,
    });
  } catch (error) {
    next(error);
  }
});

// ==================== DEPENSES ET REVENUS ====================

// GET /api/comptabilite/depenses-revenus - Suivi des dépenses et revenus
router.get('/depenses-revenus', authorize('SUPER_ADMIN', 'DIRECTOR', 'ACCOUNTANT'), async (req, res, next) => {
  try {
    const { dateDebut, dateFin, agence, type } = req.query;

    // Construire la requête
    const conditions: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    // Filtrer par classe (6=Charges, 7=Produits)
    if (type === 'depenses') {
      conditions.push(`compte LIKE '6.%'`);
    } else if (type === 'revenus') {
      conditions.push(`compte LIKE '7.%'`);
    } else {
      conditions.push(`(compte LIKE '6.%' OR compte LIKE '7.%')`);
    }

    if (agence && agence !== 'all') {
      conditions.push(`id_ag = $${paramIndex}`);
      params.push(parseInt(agence as string));
      paramIndex++;
    }
    if (dateDebut) {
      conditions.push(`date_valeur >= $${paramIndex}`);
      params.push(new Date(dateDebut as string));
      paramIndex++;
    }
    if (dateFin) {
      conditions.push(`date_valeur <= $${paramIndex}`);
      params.push(new Date(dateFin as string));
      paramIndex++;
    }

    const query = `
      SELECT
        compte,
        SUM(CASE WHEN sens = 'd' THEN montant ELSE 0 END) as total_debit,
        SUM(CASE WHEN sens = 'c' THEN montant ELSE 0 END) as total_credit,
        COUNT(*) as nb_operations
      FROM ad_mouvement
      WHERE ${conditions.join(' AND ')}
      GROUP BY compte
      ORDER BY compte
    `;

    const mouvements = await prisma.$queryRawUnsafe<any[]>(query, ...params);

    const planLibelles: Record<string, string> = {
      '6.2.1.1': 'Salaires',
      '6.2.1.2': 'Charges sociales',
      '6.2.2.1': 'Loyers',
      '6.2.2.3': 'Eau et électricité',
      '6.2.2.4': 'Téléphone et internet',
      '6.2.2.5': 'Carburant',
      '7.1.1': 'Intérêts sur crédits',
      '7.1.2.1': 'Frais de dossier',
      '7.1.2.2': 'Commissions sur opérations',
    };

    const depenses: any[] = [];
    const revenus: any[] = [];

    mouvements.forEach(m => {
      const item = {
        compte: m.compte,
        libelle: planLibelles[m.compte] || m.compte,
        montant: parseFloat(m.total_debit || '0') - parseFloat(m.total_credit || '0'),
        nb_operations: parseInt(m.nb_operations),
      };

      if (m.compte.startsWith('6.')) {
        depenses.push({ ...item, montant: Math.abs(item.montant) });
      } else {
        revenus.push({ ...item, montant: Math.abs(item.montant) });
      }
    });

    const totalDepenses = depenses.reduce((sum, d) => sum + d.montant, 0);
    const totalRevenus = revenus.reduce((sum, r) => sum + r.montant, 0);

    res.json({
      depenses,
      revenus,
      totalDepenses,
      totalRevenus,
      resultat: totalRevenus - totalDepenses,
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/comptabilite/depense - Enregistrer une dépense
router.post('/depense', authorize('SUPER_ADMIN', 'DIRECTOR', 'ACCOUNTANT'), async (req, res, next) => {
  try {
    const schema = z.object({
      date: z.string(),
      compte_charge: z.string(),
      compte_tresorerie: z.string(),
      montant: z.number().positive(),
      libelle: z.string(),
      beneficiaire: z.string().optional(),
    });

    const data = schema.parse(req.body);
    const agenceId = req.user!.agenceId || 1;

    // Générer un nouvel id_ecriture
    const maxEcriture = await prisma.$queryRaw<any[]>`
      SELECT COALESCE(MAX(id_ecriture), 0) + 1 as next_id FROM ad_mouvement WHERE id_ag = ${agenceId}
    `;
    const newEcritureId = maxEcriture[0]?.next_id || 1;

    // Créer l'écriture: Débit compte charge, Crédit compte trésorerie
    await prisma.$transaction(async (tx) => {
      // Débit du compte de charge
      await tx.$executeRaw`
        INSERT INTO ad_mouvement (id_ag, id_ecriture, compte, sens, montant, devise, date_valeur)
        VALUES (${agenceId}, ${newEcritureId}, ${data.compte_charge}, 'd', ${data.montant}, 'BIF', ${new Date(data.date)})
      `;
      // Crédit du compte de trésorerie
      await tx.$executeRaw`
        INSERT INTO ad_mouvement (id_ag, id_ecriture, compte, sens, montant, devise, date_valeur)
        VALUES (${agenceId}, ${newEcritureId}, ${data.compte_tresorerie}, 'c', ${data.montant}, 'BIF', ${new Date(data.date)})
      `;
    });

    logger.info(`Dépense enregistrée: ${data.montant} BIF sur ${data.compte_charge} par User ${req.user!.userId}`);

    res.status(201).json({
      message: 'Dépense enregistrée avec succès',
      id_ecriture: newEcritureId,
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/comptabilite/revenu - Enregistrer un revenu
router.post('/revenu', authorize('SUPER_ADMIN', 'DIRECTOR', 'ACCOUNTANT'), async (req, res, next) => {
  try {
    const schema = z.object({
      date: z.string(),
      compte_produit: z.string(),
      compte_tresorerie: z.string(),
      montant: z.number().positive(),
      libelle: z.string(),
      source: z.string().optional(),
    });

    const data = schema.parse(req.body);
    const agenceId = req.user!.agenceId || 1;

    // Générer un nouvel id_ecriture
    const maxEcriture = await prisma.$queryRaw<any[]>`
      SELECT COALESCE(MAX(id_ecriture), 0) + 1 as next_id FROM ad_mouvement WHERE id_ag = ${agenceId}
    `;
    const newEcritureId = maxEcriture[0]?.next_id || 1;

    // Créer l'écriture: Débit compte trésorerie, Crédit compte produit
    await prisma.$transaction(async (tx) => {
      // Débit du compte de trésorerie
      await tx.$executeRaw`
        INSERT INTO ad_mouvement (id_ag, id_ecriture, compte, sens, montant, devise, date_valeur)
        VALUES (${agenceId}, ${newEcritureId}, ${data.compte_tresorerie}, 'd', ${data.montant}, 'BIF', ${new Date(data.date)})
      `;
      // Crédit du compte de produit
      await tx.$executeRaw`
        INSERT INTO ad_mouvement (id_ag, id_ecriture, compte, sens, montant, devise, date_valeur)
        VALUES (${agenceId}, ${newEcritureId}, ${data.compte_produit}, 'c', ${data.montant}, 'BIF', ${new Date(data.date)})
      `;
    });

    logger.info(`Revenu enregistré: ${data.montant} BIF sur ${data.compte_produit} par User ${req.user!.userId}`);

    res.status(201).json({
      message: 'Revenu enregistré avec succès',
      id_ecriture: newEcritureId,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
