import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const hash = async (pwd: string) => bcrypt.hash(pwd, 10);

  // Verificar que el hash funciona
  const testHash = await hash('password123');
  console.log('Hash generado:', testHash);
  const isValid = await bcrypt.compare('password123', testHash);
  console.log('Verificación bcrypt:', isValid ? '✅ OK' : '❌ FALLO');

  if (!isValid) {
    console.error('bcrypt no funciona correctamente');
    return;
  }

  // Crear usuarios de prueba
  const users = [
    {
      email: 'juan@test.com',
      password: await hash('password123'),
      name: 'Juan Pérez',
      rut: '19876543-2',
      qrCode: 'JUAN001',
      role: 'USER' as const,
    },
    {
      email: 'maria@test.com',
      password: await hash('password123'),
      name: 'María González',
      rut: '18765432-1',
      qrCode: 'MARIA001',
      role: 'USER' as const,
    },
    {
      email: 'staff@gymflow.com',
      password: await hash('password123'),
      name: 'Staff FitZone',
      rut: '11111111-1',
      qrCode: 'STAFF001',
      role: 'GYM_STAFF' as const,
    },
  ];

  for (const userData of users) {
    const user = await prisma.user.upsert({
      where: { email: userData.email },
      update: {
        password: userData.password,
        role: userData.role,
      },
      create: userData,
    });
    console.log(`✅ Usuario creado/actualizado: ${user.email} (role: ${user.role})`);

    // Verificar que se guardó bien
    const saved = await prisma.user.findUnique({ where: { id: user.id } });
    const verify = await bcrypt.compare('password123', saved!.password);
    console.log(`   Hash guardado válido: ${verify ? '✅' : '❌'}`);
    console.log(`   Hash en BD: ${saved!.password.substring(0, 20)}...`);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());