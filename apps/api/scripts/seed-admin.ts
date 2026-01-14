import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...\n');

  // 1. Create or verify agency
  const agency = await prisma.agence.upsert({
    where: { id_ag: 1 },
    update: {},
    create: {
      id_ag: 1,
      libel_ag: 'Siège Principal',
      adresse_ag: 'Bujumbura, Burundi',
      etat_ag: 1,
    },
  });
  console.log('✅ Agence créée:', agency.libel_ag);

  // 2. Create roles
  const roles = [
    { code: 'SUPER_ADMIN', label: 'Super Administrateur', description: 'Accès complet au système', color: 'red', is_system: true },
    { code: 'DIRECTOR', label: 'Directeur', description: 'Direction générale', color: 'purple', is_system: true },
    { code: 'BRANCH_MANAGER', label: 'Chef d\'Agence', description: 'Gestion d\'une agence', color: 'blue', is_system: true },
    { code: 'CREDIT_OFFICER', label: 'Agent de Crédit', description: 'Gestion des crédits', color: 'green', is_system: true },
    { code: 'TELLER', label: 'Caissier', description: 'Opérations de caisse', color: 'orange', is_system: true },
  ];

  for (const role of roles) {
    await prisma.role.upsert({
      where: { code: role.code },
      update: {},
      create: role,
    });
    console.log('✅ Rôle créé:', role.label);
  }

  // 3. Create admin user
  const adminPassword = 'Admin@123';
  const hashedPassword = await bcrypt.hash(adminPassword, 10);

  const admin = await prisma.user.upsert({
    where: { email: 'admin@hopefund.bi' },
    update: {
      password_hash: hashedPassword,
    },
    create: {
      email: 'admin@hopefund.bi',
      password_hash: hashedPassword,
      nom: 'Administrateur',
      prenom: 'Hopefund',
      role: 'SUPER_ADMIN',
      id_ag: 1,
      is_active: true,
    },
  });
  console.log('✅ Admin créé:', admin.email);

  // 4. Create caisse principale
  await prisma.caissePrincipale.upsert({
    where: { id_ag: 1 },
    update: {},
    create: {
      id_ag: 1,
      solde_cdf: 0,
      solde_usd: 0,
    },
  });
  console.log('✅ Caisse principale créée');

  console.log('\n🎉 Database seeded successfully!');
  console.log('\n📝 Identifiants admin:');
  console.log('   Email: admin@hopefund.bi');
  console.log('   Mot de passe: Admin@123');
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
