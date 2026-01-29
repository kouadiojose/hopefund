/**
 * Routes de validation des données
 * Endpoints pour vérifier la cohérence des données comptables et de caisse
 */

import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate, authorize } from '../middleware/auth';
import { logger } from '../utils/logger';

const router = Router();

// Toutes les routes de validation nécessitent l'authentification
router.use(authenticate);

interface ValidationResult {
  test: string;
  status: 'success' | 'warning' | 'error';
  message: string;
  details?: any;
}

// GET /api/validation/comptabilite - Validation des données comptables
router.get('/comptabilite', authorize('SUPER_ADMIN', 'DIRECTOR', 'ACCOUNTANT'), async (req, res, next) => {
  try {
    const results: ValidationResult[] = [];

    // 1. Vérifier l'équilibre global débit/crédit
    const equilibreGlobal = await prisma.$queryRaw<any[]>`
      SELECT
        SUM(CASE WHEN sens = 'd' THEN montant ELSE 0 END)::numeric as total_debit,
        SUM(CASE WHEN sens = 'c' THEN montant ELSE 0 END)::numeric as total_credit
      FROM ad_mouvement
      WHERE compte IS NOT NULL
    `;

    const totalDebit = parseFloat(equilibreGlobal[0]?.total_debit || '0');
    const totalCredit = parseFloat(equilibreGlobal[0]?.total_credit || '0');
    const ecartGlobal = Math.abs(totalDebit - totalCredit);

    results.push({
      test: 'Équilibre global débit/crédit',
      status: ecartGlobal < 1 ? 'success' : 'error',
      message: ecartGlobal < 1
        ? `Équilibré: Débit=${totalDebit.toLocaleString()}, Crédit=${totalCredit.toLocaleString()}`
        : `Déséquilibré: Écart de ${ecartGlobal.toLocaleString()} BIF`,
      details: { totalDebit, totalCredit, ecart: ecartGlobal },
    });

    // 2. Vérifier l'équilibre par écriture
    const ecrituresDesequilibrees = await prisma.$queryRaw<any[]>`
      SELECT
        id_ag,
        id_ecriture,
        SUM(CASE WHEN sens = 'd' THEN montant ELSE 0 END)::numeric as total_debit,
        SUM(CASE WHEN sens = 'c' THEN montant ELSE 0 END)::numeric as total_credit,
        ABS(SUM(CASE WHEN sens = 'd' THEN montant ELSE 0 END) -
            SUM(CASE WHEN sens = 'c' THEN montant ELSE 0 END))::numeric as ecart
      FROM ad_mouvement
      WHERE compte IS NOT NULL AND id_ecriture IS NOT NULL
      GROUP BY id_ag, id_ecriture
      HAVING ABS(SUM(CASE WHEN sens = 'd' THEN montant ELSE 0 END) -
                 SUM(CASE WHEN sens = 'c' THEN montant ELSE 0 END)) > 0.01
      ORDER BY ecart DESC
      LIMIT 10
    `;

    results.push({
      test: 'Écritures équilibrées',
      status: ecrituresDesequilibrees.length === 0 ? 'success' : 'error',
      message: ecrituresDesequilibrees.length === 0
        ? 'Toutes les écritures sont équilibrées'
        : `${ecrituresDesequilibrees.length} écriture(s) déséquilibrée(s)`,
      details: ecrituresDesequilibrees,
    });

    // 3. Vérifier les montants positifs
    const montantsNegatifs = await prisma.$queryRaw<any[]>`
      SELECT COUNT(*)::int as count
      FROM ad_mouvement
      WHERE montant < 0
    `;

    results.push({
      test: 'Montants positifs',
      status: parseInt(montantsNegatifs[0]?.count || '0') === 0 ? 'success' : 'error',
      message: parseInt(montantsNegatifs[0]?.count || '0') === 0
        ? 'Tous les montants sont positifs'
        : `${montantsNegatifs[0]?.count} montant(s) négatif(s)`,
    });

    // 4. Vérifier les sens valides
    const sensInvalides = await prisma.$queryRaw<any[]>`
      SELECT COUNT(*)::int as count
      FROM ad_mouvement
      WHERE sens NOT IN ('d', 'c')
    `;

    results.push({
      test: 'Sens valides (d/c)',
      status: parseInt(sensInvalides[0]?.count || '0') === 0 ? 'success' : 'error',
      message: parseInt(sensInvalides[0]?.count || '0') === 0
        ? 'Tous les sens sont valides'
        : `${sensInvalides[0]?.count} sens invalide(s)`,
    });

    // 5. Résumé statistique
    const stats = await prisma.$queryRaw<any[]>`
      SELECT
        COUNT(*)::int as total_mouvements,
        COUNT(DISTINCT id_ecriture)::int as nb_ecritures,
        COUNT(DISTINCT compte)::int as nb_comptes,
        COUNT(DISTINCT id_ag)::int as nb_agences,
        MIN(date_valeur) as premiere_date,
        MAX(date_valeur) as derniere_date
      FROM ad_mouvement
      WHERE compte IS NOT NULL
    `;

    const nbSuccess = results.filter(r => r.status === 'success').length;
    const nbErrors = results.filter(r => r.status === 'error').length;

    res.json({
      validationDate: new Date(),
      summary: {
        total: results.length,
        success: nbSuccess,
        errors: nbErrors,
        status: nbErrors === 0 ? 'success' : 'error',
      },
      statistics: stats[0],
      results,
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/validation/caisse - Validation des données de caisse
router.get('/caisse', authorize('SUPER_ADMIN', 'DIRECTOR', 'BRANCH_MANAGER'), async (req, res, next) => {
  try {
    const results: ValidationResult[] = [];

    // 1. Sessions avec utilisateur et agence valides
    const sessionsInvalides = await prisma.$queryRaw<any[]>`
      SELECT COUNT(*)::int as count
      FROM app_caisse_sessions s
      LEFT JOIN app_users u ON s.user_id = u.id
      LEFT JOIN ad_agc a ON s.id_ag = a.id_ag
      WHERE u.id IS NULL OR a.id_ag IS NULL
    `;

    results.push({
      test: 'Sessions avec références valides',
      status: parseInt(sessionsInvalides[0]?.count || '0') === 0 ? 'success' : 'error',
      message: parseInt(sessionsInvalides[0]?.count || '0') === 0
        ? 'Toutes les sessions ont des références valides'
        : `${sessionsInvalides[0]?.count} session(s) avec références invalides`,
    });

    // 2. États de session valides
    const etatsInvalides = await prisma.$queryRaw<any[]>`
      SELECT COUNT(*)::int as count
      FROM app_caisse_sessions
      WHERE etat NOT IN (1, 2, 3)
    `;

    results.push({
      test: 'États de session valides',
      status: parseInt(etatsInvalides[0]?.count || '0') === 0 ? 'success' : 'error',
      message: parseInt(etatsInvalides[0]?.count || '0') === 0
        ? 'Tous les états de session sont valides'
        : `${etatsInvalides[0]?.count} état(s) invalide(s)`,
    });

    // 3. Cohérence des montants de session
    const sessionsIncoherentes = await prisma.$queryRaw<any[]>`
      SELECT
        id,
        montant_ouverture::numeric,
        total_entrees::numeric,
        total_sorties::numeric,
        montant_fermeture::numeric,
        ecart::numeric
      FROM app_caisse_sessions
      WHERE etat IN (2, 3) AND montant_fermeture IS NOT NULL
    `;

    let nbIncoherences = 0;
    const detailsIncoherences: any[] = [];
    sessionsIncoherentes.forEach((s: any) => {
      const ouverture = parseFloat(s.montant_ouverture || '0');
      const entrees = parseFloat(s.total_entrees || '0');
      const sorties = parseFloat(s.total_sorties || '0');
      const fermeture = parseFloat(s.montant_fermeture || '0');
      const ecart = parseFloat(s.ecart || '0');

      const soldeTheorique = ouverture + entrees - sorties;
      const ecartCalcule = fermeture - soldeTheorique;

      if (Math.abs(ecart - ecartCalcule) > 0.01) {
        nbIncoherences++;
        detailsIncoherences.push({
          session_id: s.id,
          ecart_enregistre: ecart,
          ecart_calcule: ecartCalcule,
        });
      }
    });

    results.push({
      test: 'Cohérence des écarts de caisse',
      status: nbIncoherences === 0 ? 'success' : 'error',
      message: nbIncoherences === 0
        ? `${sessionsIncoherentes.length} session(s) fermée(s) vérifiée(s) avec succès`
        : `${nbIncoherences} session(s) avec écart incohérent`,
      details: nbIncoherences > 0 ? detailsIncoherences : undefined,
    });

    // 4. Doublons de sessions ouvertes
    const doublons = await prisma.$queryRaw<any[]>`
      SELECT user_id, id_ag, date_session, COUNT(*)::int as nb_sessions
      FROM app_caisse_sessions
      WHERE etat = 1
      GROUP BY user_id, id_ag, date_session
      HAVING COUNT(*) > 1
    `;

    results.push({
      test: 'Unicité des sessions ouvertes',
      status: doublons.length === 0 ? 'success' : 'warning',
      message: doublons.length === 0
        ? 'Pas de doublons de sessions ouvertes'
        : `${doublons.length} doublon(s) détecté(s)`,
      details: doublons.length > 0 ? doublons : undefined,
    });

    // 5. Mouvements validés sans valideur
    const mouvementsSansValideur = await prisma.$queryRaw<any[]>`
      SELECT COUNT(*)::int as count
      FROM app_caisse_mouvements
      WHERE etat IN (2, 3) AND valide_par IS NULL
    `;

    results.push({
      test: 'Mouvements validés avec valideur',
      status: parseInt(mouvementsSansValideur[0]?.count || '0') === 0 ? 'success' : 'error',
      message: parseInt(mouvementsSansValideur[0]?.count || '0') === 0
        ? 'Tous les mouvements validés ont un valideur'
        : `${mouvementsSansValideur[0]?.count} mouvement(s) sans valideur`,
    });

    // 6. Statistiques de caisse
    const statsCaisse = await prisma.$queryRaw<any[]>`
      SELECT
        COUNT(*)::int as total_sessions,
        SUM(CASE WHEN etat = 1 THEN 1 ELSE 0 END)::int as sessions_ouvertes,
        SUM(CASE WHEN etat = 2 THEN 1 ELSE 0 END)::int as sessions_fermees,
        SUM(CASE WHEN etat = 3 THEN 1 ELSE 0 END)::int as sessions_validees
      FROM app_caisse_sessions
    `;

    const statsMouvements = await prisma.$queryRaw<any[]>`
      SELECT
        COUNT(*)::int as total_mouvements,
        SUM(CASE WHEN etat = 1 THEN 1 ELSE 0 END)::int as en_attente,
        SUM(CASE WHEN etat = 2 THEN 1 ELSE 0 END)::int as valides,
        SUM(CASE WHEN etat = 3 THEN 1 ELSE 0 END)::int as rejetes
      FROM app_caisse_mouvements
    `;

    const nbSuccess = results.filter(r => r.status === 'success').length;
    const nbErrors = results.filter(r => r.status === 'error').length;

    res.json({
      validationDate: new Date(),
      summary: {
        total: results.length,
        success: nbSuccess,
        errors: nbErrors,
        status: nbErrors === 0 ? 'success' : 'error',
      },
      statistics: {
        sessions: statsCaisse[0],
        mouvements: statsMouvements[0],
      },
      results,
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/validation/utilisateurs - Validation des données utilisateurs
router.get('/utilisateurs', authorize('SUPER_ADMIN', 'DIRECTOR'), async (req, res, next) => {
  try {
    const results: ValidationResult[] = [];

    const rolesValides = [
      'SUPER_ADMIN',
      'DIRECTOR',
      'BRANCH_MANAGER',
      'ACCOUNTANT',
      'LOAN_OFFICER',
      'TELLER',
      'CUSTOMER',
    ];

    // 1. Rôles valides
    const usersRolesInvalides = await prisma.user.count({
      where: {
        role: { notIn: rolesValides },
      },
    });

    results.push({
      test: 'Rôles valides',
      status: usersRolesInvalides === 0 ? 'success' : 'error',
      message: usersRolesInvalides === 0
        ? 'Tous les utilisateurs ont des rôles valides'
        : `${usersRolesInvalides} utilisateur(s) avec rôle invalide`,
    });

    // 2. Emails uniques
    const doublonsEmail = await prisma.$queryRaw<any[]>`
      SELECT email, COUNT(*)::int as count
      FROM "User"
      GROUP BY email
      HAVING COUNT(*) > 1
    `;

    results.push({
      test: 'Emails uniques',
      status: doublonsEmail.length === 0 ? 'success' : 'error',
      message: doublonsEmail.length === 0
        ? 'Tous les emails sont uniques'
        : `${doublonsEmail.length} email(s) en doublon`,
      details: doublonsEmail.length > 0 ? doublonsEmail : undefined,
    });

    // 3. Utilisateurs opérationnels avec agence
    const rolesAvecAgence = ['BRANCH_MANAGER', 'TELLER', 'LOAN_OFFICER'];
    const usersSansAgence = await prisma.user.count({
      where: {
        role: { in: rolesAvecAgence },
        is_active: true,
        id_ag: null,
      },
    });

    results.push({
      test: 'Utilisateurs opérationnels avec agence',
      status: usersSansAgence === 0 ? 'success' : 'warning',
      message: usersSansAgence === 0
        ? 'Tous les utilisateurs opérationnels ont une agence'
        : `${usersSansAgence} utilisateur(s) opérationnel(s) sans agence`,
    });

    // 4. Au moins un SUPER_ADMIN actif
    const superAdmins = await prisma.user.count({
      where: {
        role: 'SUPER_ADMIN',
        is_active: true,
      },
    });

    results.push({
      test: 'Super admin actif',
      status: superAdmins >= 1 ? 'success' : 'error',
      message: superAdmins >= 1
        ? `${superAdmins} super admin(s) actif(s)`
        : 'Aucun super admin actif!',
    });

    // 5. Distribution par rôle
    const distribution = await prisma.$queryRaw<any[]>`
      SELECT
        role,
        COUNT(*)::int as total,
        SUM(CASE WHEN "is_active" = true THEN 1 ELSE 0 END)::int as actifs
      FROM app_users
      GROUP BY role
      ORDER BY total DESC
    `;

    // Statistiques
    const totalUsers = await prisma.user.count();
    const activeUsers = await prisma.user.count({ where: { is_active: true } });

    const nbSuccess = results.filter(r => r.status === 'success').length;
    const nbErrors = results.filter(r => r.status === 'error').length;

    res.json({
      validationDate: new Date(),
      summary: {
        total: results.length,
        success: nbSuccess,
        errors: nbErrors,
        status: nbErrors === 0 ? 'success' : 'error',
      },
      statistics: {
        totalUsers,
        activeUsers,
        distribution,
      },
      results,
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/validation/all - Validation complète
router.get('/all', authorize('SUPER_ADMIN', 'DIRECTOR'), async (req, res, next) => {
  try {
    // Comptabilité
    const equilibreGlobal = await prisma.$queryRaw<any[]>`
      SELECT
        SUM(CASE WHEN sens = 'd' THEN montant ELSE 0 END)::numeric as total_debit,
        SUM(CASE WHEN sens = 'c' THEN montant ELSE 0 END)::numeric as total_credit
      FROM ad_mouvement
      WHERE compte IS NOT NULL
    `;

    const totalDebit = parseFloat(equilibreGlobal[0]?.total_debit || '0');
    const totalCredit = parseFloat(equilibreGlobal[0]?.total_credit || '0');
    const comptabiliteOk = Math.abs(totalDebit - totalCredit) < 1;

    // Caisse
    const sessionsOk = await prisma.$queryRaw<any[]>`
      SELECT COUNT(*)::int as count
      FROM app_caisse_sessions s
      LEFT JOIN app_users u ON s.user_id = u.id
      WHERE u.id IS NULL
    `;
    const caisseOk = parseInt(sessionsOk[0]?.count || '0') === 0;

    // Utilisateurs
    const superAdmins = await prisma.user.count({
      where: { role: 'SUPER_ADMIN', is_active: true },
    });
    const utilisateursOk = superAdmins >= 1;

    // Résultat global
    const globalOk = comptabiliteOk && caisseOk && utilisateursOk;

    res.json({
      validationDate: new Date(),
      status: globalOk ? 'success' : 'error',
      modules: {
        comptabilite: {
          status: comptabiliteOk ? 'success' : 'error',
          equilibreGlobal: { totalDebit, totalCredit, ecart: Math.abs(totalDebit - totalCredit) },
        },
        caisse: {
          status: caisseOk ? 'success' : 'error',
          message: caisseOk ? 'Toutes les sessions sont valides' : 'Sessions invalides détectées',
        },
        utilisateurs: {
          status: utilisateursOk ? 'success' : 'error',
          superAdmins,
        },
      },
    });
  } catch (error) {
    next(error);
  }
});

export default router;
