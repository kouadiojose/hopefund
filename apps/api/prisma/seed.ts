import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Créer un utilisateur administrateur
  const hashedPassword = await bcrypt.hash('Admin123!', 12);

  const admin = await prisma.user.upsert({
    where: { email: 'admin@hopefund.com' },
    update: {},
    create: {
      email: 'admin@hopefund.com',
      password_hash: hashedPassword,
      nom: 'Administrateur',
      prenom: 'Hopefund',
      role: 'DIRECTION',
      is_active: true,
    },
  });

  console.log('✅ Admin user created:', admin.email);

  // Créer une agence par défaut si elle n'existe pas
  const agence = await prisma.agence.upsert({
    where: { id_ag: 1 },
    update: {},
    create: {
      id_ag: 1,
      libel_ag: 'Siège Social Hopefund',
      sigle_ag: 'SIEGE',
      adresse_ag: 'Kinshasa, RDC',
      tel_ag: '+243 000 000 000',
      email_ag: 'contact@hopefund.com',
      etat_ag: 1,
    },
  });

  console.log('✅ Default agency created:', agence.libel_ag);

  console.log('🎉 Seeding completed!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
