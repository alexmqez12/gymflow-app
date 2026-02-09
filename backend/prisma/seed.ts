import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  const user1 = await prisma.user.upsert({
    where: { email: 'admin@gymflow.com' },
    update: {},
    create: {
      email: 'admin@gymflow.com',
      name: 'Admin User',
      password: 'password123',
      role: 'ADMIN',
    },
  });

  const gym1 = await prisma.gym.create({
    data: {
      name: 'PowerGym Las Condes',
      address: 'Av. Apoquindo 4800, Las Condes',
      latitude: -33.4172,
      longitude: -70.5476,
      maxCapacity: 80,
      description: 'Gimnasio premium con equipamiento de última generación',
      features: ['Pesas', 'Cardio', 'Clases Grupales', 'Sauna'],
      rating: 4.5,
    },
  });

  const gym2 = await prisma.gym.create({
    data: {
      name: 'FitZone Providencia',
      address: 'Av. Providencia 2100, Providencia',
      latitude: -33.4257,
      longitude: -70.6161,
      maxCapacity: 90,
      description: 'Espacio amplio con clases de yoga y spinning',
      features: ['Pesas', 'Yoga', 'Spinning', 'Pilates'],
      rating: 4.7,
    },
  });

  const gym3 = await prisma.gym.create({
    data: {
      name: 'SmartFit Vitacura',
      address: 'Av. Vitacura 5600, Vitacura',
      latitude: -33.3948,
      longitude: -70.5735,
      maxCapacity: 100,
      description: 'Gimnasio 24/7 con excelentes instalaciones',
      features: ['24/7', 'Pesas', 'Cardio', 'Funcional'],
      rating: 4.3,
    },
  });

  const gym4 = await prisma.gym.create({
    data: {
      name: 'BodyTech Costanera',
      address: 'Av. Costanera 8700, Vitacura',
      latitude: -33.3996,
      longitude: -70.5356,
      maxCapacity: 85,
      description: 'Gimnasio premium con piscina y spa',
      features: ['Premium', 'Piscina', 'Spa', 'Personal Trainer'],
      rating: 4.8,
    },
  });

  await prisma.checkIn.create({
    data: {
      gymId: gym1.id,
      userId: user1.id,
    },
  });

  console.log('✅ Database seeded successfully!');
  console.log('📊 Created: 1 user, 4 gyms, 1 check-in');
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });