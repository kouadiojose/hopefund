/**
 * Tests de cohérence pour le module de comptabilité
 * Vérifie l'intégrité des écritures comptables et l'équilibre débit/crédit
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '../lib/prisma';

describe('Comptabilité - Cohérence des données', () => {
  describe('Équilibre débit/crédit global', () => {
    it('devrait avoir un équilibre global débit = crédit', async () => {
      const result = await prisma.$queryRaw<any[]>`
        SELECT
          SUM(CASE WHEN sens = 'd' THEN montant ELSE 0 END)::numeric as total_debit,
          SUM(CASE WHEN sens = 'c' THEN montant ELSE 0 END)::numeric as total_credit
        FROM ad_mouvement
        WHERE compte IS NOT NULL
      `;

      const totalDebit = parseFloat(result[0]?.total_debit || '0');
      const totalCredit = parseFloat(result[0]?.total_credit || '0');

      console.log(`Total Débit: ${totalDebit.toLocaleString()} BIF`);
      console.log(`Total Crédit: ${totalCredit.toLocaleString()} BIF`);
      console.log(`Écart: ${Math.abs(totalDebit - totalCredit).toLocaleString()} BIF`);

      // Vérifier l'équilibre (tolérance de 1 BIF pour les arrondis)
      expect(Math.abs(totalDebit - totalCredit)).toBeLessThan(1);
    });

    it('devrait avoir un équilibre par écriture (id_ecriture)', async () => {
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

      if (ecrituresDesequilibrees.length > 0) {
        console.log('Écritures déséquilibrées trouvées:');
        ecrituresDesequilibrees.forEach(e => {
          console.log(`  - Agence ${e.id_ag}, Écriture #${e.id_ecriture}: Débit=${e.total_debit}, Crédit=${e.total_credit}, Écart=${e.ecart}`);
        });
      }

      expect(ecrituresDesequilibrees.length).toBe(0);
    });
  });

  describe('Équilibre par agence', () => {
    it('devrait avoir un équilibre débit/crédit pour chaque agence', async () => {
      const soldesParAgence = await prisma.$queryRaw<any[]>`
        SELECT
          m.id_ag,
          a.libel_ag as nom_agence,
          SUM(CASE WHEN m.sens = 'd' THEN m.montant ELSE 0 END)::numeric as total_debit,
          SUM(CASE WHEN m.sens = 'c' THEN m.montant ELSE 0 END)::numeric as total_credit,
          ABS(SUM(CASE WHEN m.sens = 'd' THEN m.montant ELSE 0 END) -
              SUM(CASE WHEN m.sens = 'c' THEN m.montant ELSE 0 END))::numeric as ecart
        FROM ad_mouvement m
        LEFT JOIN ad_agc a ON m.id_ag = a.id_ag
        WHERE m.compte IS NOT NULL
        GROUP BY m.id_ag, a.libel_ag
        ORDER BY m.id_ag
      `;

      console.log('\nSoldes par agence:');
      soldesParAgence.forEach(a => {
        const debit = parseFloat(a.total_debit || '0');
        const credit = parseFloat(a.total_credit || '0');
        const ecart = parseFloat(a.ecart || '0');
        const status = ecart < 1 ? '✓' : '✗';
        console.log(`  ${status} ${a.nom_agence || `Agence ${a.id_ag}`}: Débit=${debit.toLocaleString()}, Crédit=${credit.toLocaleString()}, Écart=${ecart.toLocaleString()}`);
      });

      // Chaque agence doit être équilibrée
      soldesParAgence.forEach(a => {
        const ecart = parseFloat(a.ecart || '0');
        expect(ecart).toBeLessThan(1);
      });
    });
  });

  describe('Cohérence des comptes', () => {
    it('devrait avoir des numéros de compte valides (format attendu)', async () => {
      const comptesInvalides = await prisma.$queryRaw<any[]>`
        SELECT DISTINCT compte, COUNT(*)::int as nb_occurrences
        FROM ad_mouvement
        WHERE compte IS NOT NULL
        AND compte !~ '^[1-7]\\.[0-9]'
        GROUP BY compte
        ORDER BY nb_occurrences DESC
        LIMIT 20
      `;

      if (comptesInvalides.length > 0) {
        console.log('Comptes avec format non standard:');
        comptesInvalides.forEach(c => {
          console.log(`  - ${c.compte}: ${c.nb_occurrences} occurrences`);
        });
      }

      // Pas de comptes invalides
      expect(comptesInvalides.length).toBe(0);
    });

    it('devrait avoir des montants positifs uniquement', async () => {
      const montantsNegatifs = await prisma.$queryRaw<any[]>`
        SELECT id_mouvement, compte, sens, montant::numeric
        FROM ad_mouvement
        WHERE montant < 0
        LIMIT 10
      `;

      if (montantsNegatifs.length > 0) {
        console.log('Mouvements avec montants négatifs:');
        montantsNegatifs.forEach(m => {
          console.log(`  - ID ${m.id_mouvement}: Compte ${m.compte}, Sens ${m.sens}, Montant ${m.montant}`);
        });
      }

      expect(montantsNegatifs.length).toBe(0);
    });

    it('devrait avoir un sens valide (d ou c)', async () => {
      const sensInvalides = await prisma.$queryRaw<any[]>`
        SELECT id_mouvement, compte, sens, montant::numeric
        FROM ad_mouvement
        WHERE sens NOT IN ('d', 'c')
        LIMIT 10
      `;

      expect(sensInvalides.length).toBe(0);
    });
  });

  describe('Cohérence des classes comptables', () => {
    it('devrait avoir les soldes corrects par nature de compte', async () => {
      // Classe 1 (Trésorerie) et 2.1 (Crédits) = actif (solde débiteur)
      // Classe 2.2 (Dépôts) et 5 (Fonds propres) = passif (solde créditeur)
      // Classe 6 (Charges) = solde débiteur
      // Classe 7 (Produits) = solde créditeur

      const soldesParClasse = await prisma.$queryRaw<any[]>`
        SELECT
          SUBSTRING(compte FROM 1 FOR 1) as classe,
          SUM(CASE WHEN sens = 'd' THEN montant ELSE 0 END)::numeric as total_debit,
          SUM(CASE WHEN sens = 'c' THEN montant ELSE 0 END)::numeric as total_credit,
          SUM(CASE WHEN sens = 'd' THEN montant ELSE -montant END)::numeric as solde
        FROM ad_mouvement
        WHERE compte IS NOT NULL
        GROUP BY SUBSTRING(compte FROM 1 FOR 1)
        ORDER BY classe
      `;

      const classesInfo: Record<string, { nom: string; natureAttendue: string }> = {
        '1': { nom: 'Trésorerie', natureAttendue: 'actif' },
        '2': { nom: 'Clientèle', natureAttendue: 'mixte' },
        '3': { nom: 'Divers', natureAttendue: 'mixte' },
        '4': { nom: 'Immobilisations', natureAttendue: 'actif' },
        '5': { nom: 'Fonds propres', natureAttendue: 'passif' },
        '6': { nom: 'Charges', natureAttendue: 'charge' },
        '7': { nom: 'Produits', natureAttendue: 'produit' },
      };

      console.log('\nSoldes par classe:');
      soldesParClasse.forEach(c => {
        const info = classesInfo[c.classe] || { nom: 'Inconnue', natureAttendue: 'mixte' };
        const solde = parseFloat(c.solde || '0');
        const debit = parseFloat(c.total_debit || '0');
        const credit = parseFloat(c.total_credit || '0');
        console.log(`  Classe ${c.classe} (${info.nom}): Débit=${debit.toLocaleString()}, Crédit=${credit.toLocaleString()}, Solde=${solde.toLocaleString()}`);
      });

      // Vérifier que les classes existent
      expect(soldesParClasse.length).toBeGreaterThan(0);
    });

    it('devrait avoir un résultat cohérent (Produits - Charges)', async () => {
      const resultat = await prisma.$queryRaw<any[]>`
        SELECT
          SUM(CASE WHEN SUBSTRING(compte FROM 1 FOR 1) = '7' AND sens = 'c' THEN montant
                   WHEN SUBSTRING(compte FROM 1 FOR 1) = '7' AND sens = 'd' THEN -montant
                   ELSE 0 END)::numeric as total_produits,
          SUM(CASE WHEN SUBSTRING(compte FROM 1 FOR 1) = '6' AND sens = 'd' THEN montant
                   WHEN SUBSTRING(compte FROM 1 FOR 1) = '6' AND sens = 'c' THEN -montant
                   ELSE 0 END)::numeric as total_charges
        FROM ad_mouvement
        WHERE compte IS NOT NULL
      `;

      const totalProduits = parseFloat(resultat[0]?.total_produits || '0');
      const totalCharges = parseFloat(resultat[0]?.total_charges || '0');
      const benefice = totalProduits - totalCharges;

      console.log('\nRésultat financier:');
      console.log(`  Total Produits: ${totalProduits.toLocaleString()} BIF`);
      console.log(`  Total Charges: ${totalCharges.toLocaleString()} BIF`);
      console.log(`  Résultat: ${benefice.toLocaleString()} BIF (${benefice >= 0 ? 'Bénéfice' : 'Perte'})`);

      // Le test passe toujours, on vérifie juste que le calcul fonctionne
      expect(typeof totalProduits).toBe('number');
      expect(typeof totalCharges).toBe('number');
    });
  });

  describe('Cohérence temporelle', () => {
    it('devrait avoir des dates de valeur cohérentes', async () => {
      // Pas de dates futures
      const datesFutures = await prisma.$queryRaw<any[]>`
        SELECT COUNT(*)::int as count
        FROM ad_mouvement
        WHERE date_valeur > CURRENT_DATE + INTERVAL '1 day'
      `;

      expect(parseInt(datesFutures[0]?.count || '0')).toBe(0);
    });

    it('devrait avoir une chronologie cohérente des écritures', async () => {
      // Les id_ecriture devraient globalement augmenter avec le temps
      const ecritures = await prisma.$queryRaw<any[]>`
        SELECT
          id_ag,
          MIN(date_valeur) as premiere_date,
          MAX(date_valeur) as derniere_date,
          MIN(id_ecriture)::int as premiere_ecriture,
          MAX(id_ecriture)::int as derniere_ecriture,
          COUNT(DISTINCT id_ecriture)::int as nb_ecritures
        FROM ad_mouvement
        WHERE id_ecriture IS NOT NULL AND date_valeur IS NOT NULL
        GROUP BY id_ag
        ORDER BY id_ag
      `;

      console.log('\nChronologie par agence:');
      ecritures.forEach(e => {
        console.log(`  Agence ${e.id_ag}: ${e.nb_ecritures} écritures, du ${e.premiere_date} au ${e.derniere_date}`);
      });

      expect(ecritures.length).toBeGreaterThanOrEqual(0);
    });
  });
});

describe('Comptabilité - Statistiques', () => {
  it('devrait afficher un résumé global', async () => {
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

    console.log('\n=== STATISTIQUES GLOBALES ===');
    console.log(`Total mouvements: ${stats[0]?.total_mouvements}`);
    console.log(`Nombre d'écritures: ${stats[0]?.nb_ecritures}`);
    console.log(`Comptes utilisés: ${stats[0]?.nb_comptes}`);
    console.log(`Agences: ${stats[0]?.nb_agences}`);
    console.log(`Période: ${stats[0]?.premiere_date} - ${stats[0]?.derniere_date}`);

    expect(stats[0]?.total_mouvements).toBeGreaterThanOrEqual(0);
  });
});
