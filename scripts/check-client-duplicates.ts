/**
 * Script to check for potential duplicate clients and missing data
 * Run with: npx ts-node scripts/check-client-duplicates.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkClientDuplicates() {
  console.log('=== Vérification des doublons et données manquantes ===\n');

  // 1. Check for Claver Karakura specifically
  console.log('1. Recherche de "Claver Karakura" dans la base...\n');

  const claverClients = await prisma.client.findMany({
    where: {
      OR: [
        { pp_nom: { contains: 'Karakura', mode: 'insensitive' } },
        { pp_prenom: { contains: 'Claver', mode: 'insensitive' } },
        { pp_nom: { contains: 'Claver', mode: 'insensitive' } },
        { pp_prenom: { contains: 'Karakura', mode: 'insensitive' } },
      ]
    },
    include: {
      comptes: true,
      dossiers_credit: true,
    }
  });

  console.log(`Trouvé ${claverClients.length} client(s) correspondant à "Claver" ou "Karakura":\n`);

  for (const client of claverClients) {
    console.log(`  Client #${client.id_client}:`);
    console.log(`    Nom: ${client.pp_prenom || ''} ${client.pp_nom || ''}`);
    console.log(`    Agence: ${client.id_ag}`);
    console.log(`    Statut: ${client.etat === 1 ? 'Actif' : client.etat === 2 ? 'Inactif' : `Autre (${client.etat})`}`);
    console.log(`    Date adhésion: ${client.date_adh}`);
    console.log(`    Téléphone: ${client.num_tel || client.num_port || 'N/A'}`);
    console.log(`    Comptes: ${client.comptes.length}`);
    console.log(`    Crédits: ${client.dossiers_credit.length}`);

    if (client.comptes.length > 0) {
      console.log(`    Détail comptes:`);
      for (const compte of client.comptes) {
        console.log(`      - Compte #${compte.id_cpte}: ${compte.num_complet_cpte} - Solde: ${compte.solde} - État: ${compte.etat_cpte}`);
      }
    }

    if (client.dossiers_credit.length > 0) {
      console.log(`    Détail crédits:`);
      for (const credit of client.dossiers_credit) {
        console.log(`      - Crédit #${credit.id_doss}: Montant: ${credit.cre_mnt_octr} - État: ${credit.cre_etat}`);
      }
    }
    console.log('');
  }

  // 2. Find potential duplicates by name similarity
  console.log('\n2. Recherche de doublons potentiels (même nom/prénom)...\n');

  const duplicates = await prisma.$queryRaw`
    SELECT
      pp_nom,
      pp_prenom,
      COUNT(*) as count,
      STRING_AGG(id_client::text, ', ') as client_ids
    FROM ad_cli
    WHERE pp_nom IS NOT NULL AND pp_prenom IS NOT NULL
    GROUP BY pp_nom, pp_prenom
    HAVING COUNT(*) > 1
    ORDER BY COUNT(*) DESC
    LIMIT 50
  ` as any[];

  console.log(`Trouvé ${duplicates.length} groupes de clients avec le même nom/prénom:\n`);

  for (const dup of duplicates.slice(0, 20)) {
    console.log(`  ${dup.pp_prenom} ${dup.pp_nom}: ${dup.count} enregistrements (IDs: ${dup.client_ids})`);
  }

  // 3. Check for orphan accounts (accounts without valid client link)
  console.log('\n\n3. Vérification des comptes orphelins...\n');

  const orphanAccounts = await prisma.$queryRaw`
    SELECT c.id_cpte, c.id_titulaire, c.num_complet_cpte, c.solde
    FROM ad_cpt c
    LEFT JOIN ad_cli cl ON c.id_titulaire = cl.id_client AND c.id_ag = cl.id_ag
    WHERE cl.id_client IS NULL
    LIMIT 20
  ` as any[];

  console.log(`Trouvé ${orphanAccounts.length} comptes sans client valide:\n`);
  for (const acc of orphanAccounts) {
    console.log(`  Compte #${acc.id_cpte} (titulaire: ${acc.id_titulaire}): ${acc.num_complet_cpte} - Solde: ${acc.solde}`);
  }

  // 4. Check for orphan credits
  console.log('\n\n4. Vérification des crédits orphelins...\n');

  const orphanCredits = await prisma.$queryRaw`
    SELECT d.id_doss, d.id_client, d.cre_mnt_octr, d.cre_etat
    FROM ad_dcr d
    LEFT JOIN ad_cli cl ON d.id_client = cl.id_client AND d.id_ag = cl.id_ag
    WHERE cl.id_client IS NULL
    LIMIT 20
  ` as any[];

  console.log(`Trouvé ${orphanCredits.length} crédits sans client valide:\n`);
  for (const cred of orphanCredits) {
    console.log(`  Crédit #${cred.id_doss} (client: ${cred.id_client}): Montant: ${cred.cre_mnt_octr} - État: ${cred.cre_etat}`);
  }

  // 5. Summary statistics
  console.log('\n\n5. Statistiques globales...\n');

  const [totalClients, totalAccounts, totalCredits, inactiveClients] = await Promise.all([
    prisma.client.count(),
    prisma.compte.count(),
    prisma.dossierCredit.count(),
    prisma.client.count({ where: { etat: { not: 1 } } }),
  ]);

  console.log(`  Total clients: ${totalClients}`);
  console.log(`  Clients inactifs (etat != 1): ${inactiveClients}`);
  console.log(`  Total comptes: ${totalAccounts}`);
  console.log(`  Total crédits: ${totalCredits}`);

  // 6. Check client #4051 specifically
  console.log('\n\n6. Détail complet du client #4051...\n');

  const client4051 = await prisma.client.findUnique({
    where: { id_client: 4051 },
    include: {
      comptes: true,
      dossiers_credit: {
        include: {
          echeances: true,
          garanties: true,
        }
      },
    }
  });

  if (client4051) {
    console.log(`  Client #4051: ${client4051.pp_prenom} ${client4051.pp_nom}`);
    console.log(`  Agence: ${client4051.id_ag}`);
    console.log(`  État: ${client4051.etat}`);
    console.log(`  Comptes: ${client4051.comptes.length}`);
    console.log(`  Crédits: ${client4051.dossiers_credit.length}`);

    // Check if there are accounts or credits with id_titulaire/id_client = 4051 but different id_ag
    const accountsAllAgencies = await prisma.compte.findMany({
      where: { id_titulaire: 4051 }
    });
    console.log(`  Comptes (toutes agences): ${accountsAllAgencies.length}`);

    const creditsAllAgencies = await prisma.dossierCredit.findMany({
      where: { id_client: 4051 }
    });
    console.log(`  Crédits (toutes agences): ${creditsAllAgencies.length}`);
  } else {
    console.log('  Client #4051 non trouvé');
  }

  await prisma.$disconnect();
}

checkClientDuplicates().catch(console.error);
