import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // ── Limpiar en orden correcto (respetar foreign keys) ──
  await prisma.membershipGym.deleteMany({});
  await prisma.membership.deleteMany({});
  await prisma.checkIn.deleteMany({});
  await prisma.user.deleteMany({});
  await prisma.gym.deleteMany({});

  console.log('🗑️  Base de datos limpiada');

  // ── Hash único para todos los usuarios de prueba ──
  const hashedPassword = await bcrypt.hash('password123', 10);

  // Verificar que el hash funciona antes de continuar
  const verify = await bcrypt.compare('password123', hashedPassword);
  if (!verify) {
    throw new Error('❌ bcrypt no está funcionando correctamente');
  }
  console.log('✅ bcrypt funcionando correctamente');
  console.log('🔑 Hash generado:', hashedPassword.substring(0, 20) + '...');

  // ── Usuarios ──────────────────────────────────────────
  const admin = await prisma.user.create({
    data: {
      email: 'admin@gymflow.com',
      name: 'Admin User',
      password: hashedPassword,
      rut: '12345678-9',
      qrCode: 'ADMIN001',
      role: 'ADMIN',
    },
  });
  console.log(`👤 Admin creado: ${admin.email}`);

  const staff = await prisma.user.create({
    data: {
      email: 'staff@gymflow.com',
      name: 'Staff FitZone',
      password: hashedPassword,
      rut: '11111111-1',
      qrCode: 'STAFF001',
      role: 'GYM_STAFF',
    },
  });
  console.log(`👤 Staff creado: ${staff.email}`);

  const juan = await prisma.user.create({
    data: {
      email: 'juan@test.com',
      name: 'Juan Pérez',
      password: hashedPassword,
      rut: '19876543-2',
      qrCode: 'JUAN001',
      role: 'USER',
    },
  });
  console.log(`👤 Usuario creado: ${juan.email}`);

  const maria = await prisma.user.create({
    data: {
      email: 'maria@test.com',
      name: 'María González',
      password: hashedPassword,
      rut: '18765432-1',
      qrCode: 'MARIA001',
      role: 'USER',
    },
  });
  console.log(`👤 Usuario creado: ${maria.email}`);

  // ── Gimnasios ─────────────────────────────────────────
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
      chain: 'PowerGym',
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
      chain: 'FitZone',
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
      chain: 'SmartFit',
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
      chain: 'BodyTech',
    },
  });

  console.log(`🏋️  ${[gym1, gym2, gym3, gym4].length} gimnasios creados`);

  // ── Membresías ────────────────────────────────────────
  // Juan → SmartFit (acceso a gym3)
  const membershipJuan = await prisma.membership.create({
    data: {
      userId: juan.id,
      type: 'SMARTFIT',
      status: 'ACTIVE',
      startDate: new Date(),
      endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
  });
  await prisma.membershipGym.create({
    data: { membershipId: membershipJuan.id, gymId: gym3.id },
  });
  console.log(`🎫 Membresía SmartFit creada para Juan`);

  // María → FitZone (acceso a gym2)
  const membershipMaria = await prisma.membership.create({
    data: {
      userId: maria.id,
      type: 'BASIC',
      status: 'ACTIVE',
      startDate: new Date(),
      endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
  });
  await prisma.membershipGym.create({
    data: { membershipId: membershipMaria.id, gymId: gym2.id },
  });
  console.log(`🎫 Membresía Basic creada para María`);

  // ── Resumen final ─────────────────────────────────────
  console.log('\n✅ ¡Seed completado exitosamente!\n');
  console.log('═══════════════════════════════════════════');
  console.log('📋 CREDENCIALES DE PRUEBA (todas usan password123)');
  console.log('═══════════════════════════════════════════');
  console.log(`🔑 ADMIN    → admin@gymflow.com`);
  console.log(`🔑 GYM_STAFF → staff@gymflow.com`);
  console.log(`🔑 USER     → juan@test.com     (SmartFit - ${gym3.name})`);
  console.log(`🔑 USER     → maria@test.com    (Basic - ${gym2.name})`);
  console.log('═══════════════════════════════════════════');
  console.log('🔐 Password para todos: password123');
}

main()
  .catch((e) => {
    console.error('❌ Error en seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });