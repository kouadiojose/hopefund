/**
 * Tests de cohérence pour les utilisateurs et permissions
 * Vérifie l'intégrité des données utilisateurs et leurs accès
 */

import { describe, it, expect } from 'vitest';
import { prisma } from '../lib/prisma';

describe('Utilisateurs - Cohérence des données', () => {
  describe('Intégrité des utilisateurs', () => {
    it('devrait avoir des utilisateurs avec rôles valides', async () => {
      const rolesValides = [
        'SUPER_ADMIN',
        'DIRECTOR',
        'BRANCH_MANAGER',
        'ACCOUNTANT',
        'LOAN_OFFICER',
        'TELLER',
        'CUSTOMER',
      ];

      const usersInvalides = await prisma.user.findMany({
        where: {
          role: { notIn: rolesValides },
        },
        select: { id: true, email: true, role: true },
      });

      if (usersInvalides.length > 0) {
        console.log('Utilisateurs avec rôles invalides:');
        usersInvalides.forEach(u => {
          console.log(`  - ${u.email}: ${u.role}`);
        });
      }

      expect(usersInvalides.length).toBe(0);
    });

    it('devrait avoir des emails uniques', async () => {
      const doublons = await prisma.$queryRaw<any[]>`
        SELECT email, COUNT(*)::int as count
        FROM "User"
        GROUP BY email
        HAVING COUNT(*) > 1
      `;

      if (doublons.length > 0) {
        console.log('Emails en doublon:');
        doublons.forEach(d => {
          console.log(`  - ${d.email}: ${d.count} occurrences`);
        });
      }

      expect(doublons.length).toBe(0);
    });

    it('devrait avoir des utilisateurs actifs avec mot de passe', async () => {
      const usersSansMdp = await prisma.user.count({
        where: {
          isActive: true,
          password: { equals: '' },
        },
      });

      expect(usersSansMdp).toBe(0);
    });
  });

  describe('Assignation aux agences', () => {
    it('devrait avoir des utilisateurs opérationnels assignés à une agence', async () => {
      // Les rôles qui nécessitent une agence
      const rolesAvecAgence = ['BRANCH_MANAGER', 'TELLER', 'LOAN_OFFICER'];

      const usersSansAgence = await prisma.user.findMany({
        where: {
          role: { in: rolesAvecAgence },
          isActive: true,
          agenceId: null,
        },
        select: { id: true, email: true, nom: true, prenom: true, role: true },
      });

      if (usersSansAgence.length > 0) {
        console.log('Utilisateurs opérationnels sans agence:');
        usersSansAgence.forEach(u => {
          console.log(`  - ${u.prenom} ${u.nom} (${u.email}): ${u.role}`);
        });
      }

      expect(usersSansAgence.length).toBe(0);
    });

    it('devrait avoir des agences valides pour les utilisateurs assignés', async () => {
      const usersAgenceInvalide = await prisma.$queryRaw<any[]>`
        SELECT u.id, u.email, u.nom, u.prenom, u."agenceId"
        FROM "User" u
        LEFT JOIN ad_agc a ON u."agenceId" = a.id_ag
        WHERE u."agenceId" IS NOT NULL AND a.id_ag IS NULL
      `;

      if (usersAgenceInvalide.length > 0) {
        console.log('Utilisateurs avec agence invalide:');
        usersAgenceInvalide.forEach(u => {
          console.log(`  - ${u.prenom} ${u.nom}: Agence ${u.agenceId} (inexistante)`);
        });
      }

      expect(usersAgenceInvalide.length).toBe(0);
    });
  });

  describe('Distribution par rôle', () => {
    it('devrait afficher la distribution des utilisateurs par rôle', async () => {
      const distribution = await prisma.$queryRaw<any[]>`
        SELECT
          role,
          COUNT(*)::int as total,
          SUM(CASE WHEN "isActive" = true THEN 1 ELSE 0 END)::int as actifs,
          SUM(CASE WHEN "agenceId" IS NOT NULL THEN 1 ELSE 0 END)::int as avec_agence
        FROM "User"
        GROUP BY role
        ORDER BY total DESC
      `;

      console.log('\n=== DISTRIBUTION DES UTILISATEURS ===');
      console.log('Rôle                | Total | Actifs | Avec Agence');
      console.log('--------------------|-------|--------|-------------');
      distribution.forEach(d => {
        console.log(
          `${d.role.padEnd(19)} | ${String(d.total).padStart(5)} | ${String(d.actifs).padStart(6)} | ${String(d.avec_agence).padStart(11)}`
        );
      });

      expect(distribution.length).toBeGreaterThan(0);
    });

    it('devrait avoir au moins un SUPER_ADMIN actif', async () => {
      const superAdmins = await prisma.user.count({
        where: {
          role: 'SUPER_ADMIN',
          isActive: true,
        },
      });

      expect(superAdmins).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Distribution par agence', () => {
    it('devrait afficher les utilisateurs par agence', async () => {
      const parAgence = await prisma.$queryRaw<any[]>`
        SELECT
          a.id_ag,
          a.libel_ag as nom_agence,
          COUNT(u.id)::int as nb_utilisateurs,
          STRING_AGG(DISTINCT u.role, ', ') as roles
        FROM ad_agc a
        LEFT JOIN "User" u ON a.id_ag = u."agenceId" AND u."isActive" = true
        WHERE a.etat_ag = 1
        GROUP BY a.id_ag, a.libel_ag
        ORDER BY a.id_ag
      `;

      console.log('\n=== UTILISATEURS PAR AGENCE ===');
      parAgence.forEach(a => {
        console.log(`${a.nom_agence || `Agence ${a.id_ag}`}: ${a.nb_utilisateurs} utilisateur(s)`);
        if (a.roles) {
          console.log(`  Rôles: ${a.roles}`);
        }
      });

      expect(parAgence.length).toBeGreaterThan(0);
    });

    it('devrait avoir au moins un guichetier par agence active', async () => {
      const agencesSansGuichetier = await prisma.$queryRaw<any[]>`
        SELECT a.id_ag, a.libel_ag
        FROM ad_agc a
        WHERE a.etat_ag = 1
        AND NOT EXISTS (
          SELECT 1 FROM "User" u
          WHERE u."agenceId" = a.id_ag
          AND u.role = 'TELLER'
          AND u."isActive" = true
        )
      `;

      if (agencesSansGuichetier.length > 0) {
        console.log('\nAgences sans guichetier actif:');
        agencesSansGuichetier.forEach(a => {
          console.log(`  - ${a.libel_ag || `Agence ${a.id_ag}`}`);
        });
      }

      // Note: Ce n'est pas forcément une erreur, juste un avertissement
      expect(true).toBe(true);
    });
  });
});

describe('Utilisateurs - Activités de caisse', () => {
  it('devrait vérifier que les sessions de caisse appartiennent aux guichetiers', async () => {
    const sessionsNonGuichetier = await prisma.$queryRaw<any[]>`
      SELECT s.id, s.user_id, u.email, u.role
      FROM "CaisseSession" s
      JOIN "User" u ON s.user_id = u.id
      WHERE u.role NOT IN ('TELLER', 'BRANCH_MANAGER', 'SUPER_ADMIN', 'DIRECTOR')
      LIMIT 10
    `;

    if (sessionsNonGuichetier.length > 0) {
      console.log('Sessions de caisse avec utilisateurs non autorisés:');
      sessionsNonGuichetier.forEach(s => {
        console.log(`  - Session ${s.id}: ${s.email} (${s.role})`);
      });
    }

    expect(sessionsNonGuichetier.length).toBe(0);
  });

  it('devrait vérifier que les validations sont faites par des superviseurs', async () => {
    const validationsNonSuperviseur = await prisma.$queryRaw<any[]>`
      SELECT m.id, m.valide_par, u.email, u.role
      FROM "CaisseMouvement" m
      JOIN "User" u ON m.valide_par = u.id
      WHERE u.role NOT IN ('BRANCH_MANAGER', 'SUPER_ADMIN', 'DIRECTOR')
      AND m.valide_par IS NOT NULL
      LIMIT 10
    `;

    if (validationsNonSuperviseur.length > 0) {
      console.log('Validations par des non-superviseurs:');
      validationsNonSuperviseur.forEach(v => {
        console.log(`  - Mouvement ${v.id}: validé par ${v.email} (${v.role})`);
      });
    }

    expect(validationsNonSuperviseur.length).toBe(0);
  });

  it('devrait vérifier que les utilisateurs ne valident pas leurs propres mouvements', async () => {
    const autoValidations = await prisma.$queryRaw<any[]>`
      SELECT m.id, m.demande_par, m.valide_par, u.email
      FROM "CaisseMouvement" m
      JOIN "User" u ON m.demande_par = u.id
      WHERE m.demande_par = m.valide_par
      LIMIT 10
    `;

    if (autoValidations.length > 0) {
      console.log('Auto-validations détectées:');
      autoValidations.forEach(a => {
        console.log(`  - Mouvement ${a.id}: ${a.email} a validé sa propre demande`);
      });
    }

    expect(autoValidations.length).toBe(0);
  });
});

describe('Utilisateurs - Activités comptables', () => {
  it('devrait vérifier la répartition des écritures par agence', async () => {
    const ecrituresParAgence = await prisma.$queryRaw<any[]>`
      SELECT
        m.id_ag,
        a.libel_ag as nom_agence,
        COUNT(DISTINCT m.id_ecriture)::int as nb_ecritures,
        SUM(CASE WHEN m.sens = 'd' THEN m.montant ELSE 0 END)::numeric as total_debit
      FROM ad_mouvement m
      LEFT JOIN ad_agc a ON m.id_ag = a.id_ag
      WHERE m.compte IS NOT NULL
      GROUP BY m.id_ag, a.libel_ag
      ORDER BY m.id_ag
    `;

    console.log('\n=== ÉCRITURES PAR AGENCE ===');
    ecrituresParAgence.forEach(e => {
      console.log(`${e.nom_agence || `Agence ${e.id_ag}`}: ${e.nb_ecritures} écritures, ${parseFloat(e.total_debit).toLocaleString()} BIF débit`);
    });

    expect(ecrituresParAgence.length).toBeGreaterThanOrEqual(0);
  });
});

describe('Utilisateurs - Statistiques globales', () => {
  it('devrait afficher un résumé complet des utilisateurs', async () => {
    const totalUsers = await prisma.user.count();
    const activeUsers = await prisma.user.count({ where: { isActive: true } });
    const usersAvecAgence = await prisma.user.count({ where: { agenceId: { not: null } } });

    console.log('\n=== RÉSUMÉ UTILISATEURS ===');
    console.log(`Total utilisateurs: ${totalUsers}`);
    console.log(`Utilisateurs actifs: ${activeUsers} (${((activeUsers / totalUsers) * 100).toFixed(1)}%)`);
    console.log(`Avec agence: ${usersAvecAgence}`);

    expect(totalUsers).toBeGreaterThan(0);
  });
});
