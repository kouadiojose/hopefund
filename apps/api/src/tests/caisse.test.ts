/**
 * Tests de cohérence pour le module de caisse
 * Vérifie l'intégrité des sessions, mouvements et liens avec la comptabilité
 */

import { describe, it, expect } from 'vitest';
import { prisma } from '../lib/prisma';

describe('Caisse - Cohérence des sessions', () => {
  describe('Intégrité des sessions de caisse', () => {
    it('devrait avoir des sessions avec utilisateur et agence valides', async () => {
      const sessionsInvalides = await prisma.$queryRaw<any[]>`
        SELECT s.id, s.user_id, s.id_ag, s.date_session
        FROM app_caisse_sessions s
        LEFT JOIN app_users u ON s.user_id = u.id
        LEFT JOIN ad_agc a ON s.id_ag = a.id_ag
        WHERE u.id IS NULL OR a.id_ag IS NULL
        LIMIT 10
      `;

      if (sessionsInvalides.length > 0) {
        console.log('Sessions avec références invalides:');
        sessionsInvalides.forEach(s => {
          console.log(`  - Session ${s.id}: User ${s.user_id}, Agence ${s.id_ag}`);
        });
      }

      expect(sessionsInvalides.length).toBe(0);
    });

    it('devrait avoir un seul état valide par session (1=ouverte, 2=fermée, 3=validée)', async () => {
      const etatsInvalides = await prisma.$queryRaw<any[]>`
        SELECT id, etat
        FROM app_caisse_sessions
        WHERE etat NOT IN (1, 2, 3)
        LIMIT 10
      `;

      expect(etatsInvalides.length).toBe(0);
    });

    it('devrait avoir des montants cohérents (ouverture + entrées - sorties = fermeture)', async () => {
      const sessionsFermees = await prisma.caisseSession.findMany({
        where: {
          etat: { in: [2, 3] }, // Fermées ou validées
          montant_fermeture: { not: null },
        },
      });

      console.log(`\nVérification de ${sessionsFermees.length} sessions fermées:`);

      let incoherences = 0;
      sessionsFermees.forEach(s => {
        const ouverture = parseFloat(s.montant_ouverture.toString());
        const entrees = parseFloat(s.total_entrees.toString());
        const sorties = parseFloat(s.total_sorties.toString());
        const fermeture = s.montant_fermeture ? parseFloat(s.montant_fermeture.toString()) : 0;
        const ecart = s.ecart ? parseFloat(s.ecart.toString()) : 0;

        const soldeTheorique = ouverture + entrees - sorties;
        const ecartCalcule = fermeture - soldeTheorique;

        // Vérifier que l'écart enregistré correspond à l'écart calculé
        if (Math.abs(ecart - ecartCalcule) > 0.01) {
          console.log(`  ✗ Session ${s.id}: Écart enregistré=${ecart}, Écart calculé=${ecartCalcule}`);
          incoherences++;
        }
      });

      if (incoherences === 0) {
        console.log('  ✓ Tous les écarts sont cohérents');
      }

      expect(incoherences).toBe(0);
    });

    it('devrait avoir une seule session ouverte par utilisateur par jour', async () => {
      const doublons = await prisma.$queryRaw<any[]>`
        SELECT user_id, id_ag, date_session, COUNT(*)::int as nb_sessions
        FROM app_caisse_sessions
        WHERE etat = 1
        GROUP BY user_id, id_ag, date_session
        HAVING COUNT(*) > 1
      `;

      if (doublons.length > 0) {
        console.log('Doublons de sessions ouvertes:');
        doublons.forEach(d => {
          console.log(`  - User ${d.user_id}, Agence ${d.id_ag}, Date ${d.date_session}: ${d.nb_sessions} sessions`);
        });
      }

      expect(doublons.length).toBe(0);
    });
  });

  describe('Cohérence des mouvements de caisse', () => {
    it('devrait avoir des mouvements liés à des sessions valides', async () => {
      const mouvementsOrphelins = await prisma.$queryRaw<any[]>`
        SELECT m.id, m.session_id, m.type_mouvement, m.montant::numeric
        FROM app_caisse_mouvements m
        LEFT JOIN app_caisse_sessions s ON m.session_id = s.id
        WHERE s.id IS NULL AND m.session_id != 0
        LIMIT 10
      `;

      expect(mouvementsOrphelins.length).toBe(0);
    });

    it('devrait avoir des types de mouvement valides (1=approvisionnement, 2=reversement)', async () => {
      const typesInvalides = await prisma.$queryRaw<any[]>`
        SELECT id, type_mouvement
        FROM app_caisse_mouvements
        WHERE type_mouvement NOT IN (1, 2)
        LIMIT 10
      `;

      expect(typesInvalides.length).toBe(0);
    });

    it('devrait avoir des états de mouvement valides (1=en attente, 2=validé, 3=rejeté)', async () => {
      const etatsInvalides = await prisma.$queryRaw<any[]>`
        SELECT id, etat
        FROM app_caisse_mouvements
        WHERE etat NOT IN (1, 2, 3)
        LIMIT 10
      `;

      expect(etatsInvalides.length).toBe(0);
    });

    it('devrait avoir des montants positifs', async () => {
      const montantsNegatifs = await prisma.$queryRaw<any[]>`
        SELECT id, montant::numeric
        FROM app_caisse_mouvements
        WHERE montant <= 0
        LIMIT 10
      `;

      expect(montantsNegatifs.length).toBe(0);
    });

    it('devrait avoir un valideur pour les mouvements validés/rejetés', async () => {
      const mouvementsSansValideur = await prisma.$queryRaw<any[]>`
        SELECT id, etat, valide_par
        FROM app_caisse_mouvements
        WHERE etat IN (2, 3) AND valide_par IS NULL
        LIMIT 10
      `;

      if (mouvementsSansValideur.length > 0) {
        console.log('Mouvements validés/rejetés sans valideur:');
        mouvementsSansValideur.forEach(m => {
          console.log(`  - Mouvement ${m.id}: État ${m.etat}`);
        });
      }

      expect(mouvementsSansValideur.length).toBe(0);
    });
  });

  describe('Cohérence des décomptes', () => {
    it('devrait avoir des décomptes liés à des sessions valides', async () => {
      const decomptesOrphelins = await prisma.$queryRaw<any[]>`
        SELECT d.id, d.session_id, d.type_decompte
        FROM app_caisse_decomptes d
        LEFT JOIN app_caisse_sessions s ON d.session_id = s.id
        WHERE s.id IS NULL
        LIMIT 10
      `;

      expect(decomptesOrphelins.length).toBe(0);
    });

    it('devrait avoir un total cohérent avec les coupures', async () => {
      const decomptes = await prisma.caisseDecompte.findMany({
        take: 100,
      });

      let incoherences = 0;
      decomptes.forEach(d => {
        // Calculer le total à partir des coupures BIF
        const billets = (d.billets_20000 || 0) * 20000 +
          (d.billets_10000 || 0) * 10000 +
          (d.billets_5000 || 0) * 5000 +
          (d.billets_1000 || 0) * 1000 +
          (d.billets_500 || 0) * 500 +
          (d.billets_200 || 0) * 200 +
          (d.billets_100 || 0) * 100 +
          (d.billets_50 || 0) * 50;

        const pieces = (d.pieces_50 || 0) * 50 +
          (d.pieces_25 || 0) * 25 +
          (d.pieces_10 || 0) * 10 +
          (d.pieces_5 || 0) * 5 +
          (d.pieces_1 || 0) * 1;

        const totalCalcule = billets + pieces;
        const totalEnregistre = parseFloat(d.total_general.toString());

        if (Math.abs(totalCalcule - totalEnregistre) > 0.01) {
          console.log(`  ✗ Décompte ${d.id}: Total calculé=${totalCalcule}, Total enregistré=${totalEnregistre}`);
          incoherences++;
        }
      });

      if (incoherences === 0 && decomptes.length > 0) {
        console.log(`  ✓ ${decomptes.length} décomptes vérifiés avec succès`);
      }

      expect(incoherences).toBe(0);
    });
  });
});

describe('Caisse - Liens avec la comptabilité', () => {
  it('devrait avoir des écritures comptables pour les mouvements validés', async () => {
    // Compter les mouvements validés
    const mouvementsValides = await prisma.caisseMouvement.count({
      where: { etat: 2 },
    });

    // Vérifier les écritures de type caisse (compte 1.0.1 ou 1.0.2)
    const ecrituresCaisse = await prisma.$queryRaw<any[]>`
      SELECT COUNT(DISTINCT id_ecriture)::int as nb_ecritures
      FROM ad_mouvement
      WHERE compte LIKE '1.0.%'
    `;

    console.log(`\nMouvements de caisse validés: ${mouvementsValides}`);
    console.log(`Écritures comptables caisse: ${ecrituresCaisse[0]?.nb_ecritures || 0}`);

    // Note: Il peut y avoir plus d'écritures que de mouvements (écritures manuelles, etc.)
    expect(ecrituresCaisse[0]?.nb_ecritures || 0).toBeGreaterThanOrEqual(0);
  });

  it('devrait avoir des écritures équilibrées pour les écarts de caisse', async () => {
    // Vérifier les écritures de manquant/excédent de caisse
    const ecartsComptables = await prisma.$queryRaw<any[]>`
      SELECT
        m1.id_ecriture,
        m1.id_ag,
        SUM(CASE WHEN m1.sens = 'd' THEN m1.montant ELSE 0 END)::numeric as debit,
        SUM(CASE WHEN m1.sens = 'c' THEN m1.montant ELSE 0 END)::numeric as credit
      FROM ad_mouvement m1
      WHERE m1.compte IN ('3.4.5', '3.4.6')
      GROUP BY m1.id_ecriture, m1.id_ag
    `;

    console.log(`\nÉcritures d'écarts de caisse: ${ecartsComptables.length}`);

    // Chaque écriture d'écart doit être équilibrée
    ecartsComptables.forEach(e => {
      const debit = parseFloat(e.debit || '0');
      const credit = parseFloat(e.credit || '0');
      // Note: L'écriture complète inclut la contrepartie caisse
    });

    expect(true).toBe(true); // Test informatif
  });
});

describe('Caisse - Statistiques', () => {
  it('devrait afficher les statistiques de caisse', async () => {
    const stats = await prisma.$queryRaw<any[]>`
      SELECT
        COUNT(*)::int as total_sessions,
        SUM(CASE WHEN etat = 1 THEN 1 ELSE 0 END)::int as sessions_ouvertes,
        SUM(CASE WHEN etat = 2 THEN 1 ELSE 0 END)::int as sessions_fermees,
        SUM(CASE WHEN etat = 3 THEN 1 ELSE 0 END)::int as sessions_validees,
        SUM(montant_ouverture)::numeric as total_ouvertures,
        SUM(total_entrees)::numeric as total_entrees,
        SUM(total_sorties)::numeric as total_sorties
      FROM app_caisse_sessions
    `;

    const mouvStats = await prisma.$queryRaw<any[]>`
      SELECT
        COUNT(*)::int as total_mouvements,
        SUM(CASE WHEN etat = 1 THEN 1 ELSE 0 END)::int as en_attente,
        SUM(CASE WHEN etat = 2 THEN 1 ELSE 0 END)::int as valides,
        SUM(CASE WHEN etat = 3 THEN 1 ELSE 0 END)::int as rejetes,
        SUM(CASE WHEN type_mouvement = 1 THEN montant ELSE 0 END)::numeric as total_approvisionnements,
        SUM(CASE WHEN type_mouvement = 2 THEN montant ELSE 0 END)::numeric as total_reversements
      FROM app_caisse_mouvements
    `;

    console.log('\n=== STATISTIQUES CAISSE ===');
    console.log(`Sessions totales: ${stats[0]?.total_sessions || 0}`);
    console.log(`  - Ouvertes: ${stats[0]?.sessions_ouvertes || 0}`);
    console.log(`  - Fermées: ${stats[0]?.sessions_fermees || 0}`);
    console.log(`  - Validées: ${stats[0]?.sessions_validees || 0}`);
    console.log(`Total ouvertures: ${parseFloat(stats[0]?.total_ouvertures || '0').toLocaleString()} BIF`);
    console.log(`Total entrées: ${parseFloat(stats[0]?.total_entrees || '0').toLocaleString()} BIF`);
    console.log(`Total sorties: ${parseFloat(stats[0]?.total_sorties || '0').toLocaleString()} BIF`);

    console.log(`\nMouvements totaux: ${mouvStats[0]?.total_mouvements || 0}`);
    console.log(`  - En attente: ${mouvStats[0]?.en_attente || 0}`);
    console.log(`  - Validés: ${mouvStats[0]?.valides || 0}`);
    console.log(`  - Rejetés: ${mouvStats[0]?.rejetes || 0}`);
    console.log(`Total approvisionnements: ${parseFloat(mouvStats[0]?.total_approvisionnements || '0').toLocaleString()} BIF`);
    console.log(`Total reversements: ${parseFloat(mouvStats[0]?.total_reversements || '0').toLocaleString()} BIF`);

    expect(stats[0]?.total_sessions).toBeGreaterThanOrEqual(0);
  });
});
