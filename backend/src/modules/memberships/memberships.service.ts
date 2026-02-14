import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class MembershipsService {
  constructor(private prisma: PrismaService) {}

  async getUserMembership(userId: string) {
    const membership = await this.prisma.membership.findFirst({
      where: { userId },
      include: {
        gyms: {
          include: {
            gym: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    return membership; // null si no tiene, sin lanzar error
  }

  async getGymsForUser(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        membership: {
          include: {
            gyms: {
              include: { gym: true },
            },
          },
        },
      },
    });

    if (!user) throw new NotFoundException('Usuario no encontrado');

    // Admin ve todos los gyms
    if (user.role === 'ADMIN') {
      return this.prisma.gym.findMany({ where: { isActive: true } });
    }

    if (!user.membership) {
      throw new NotFoundException('No tienes membresía activa');
    }

    return user.membership.gyms.map(mg => mg.gym);
  }

  async validateGymAccess(userId: string, gymId: string): Promise<boolean> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        membership: {
          include: {
            gyms: true,
          },
        },
      },
    });

    if (!user) return false;
    if (user.role === 'ADMIN') return true;
    if (!user.membership || user.membership.status !== 'ACTIVE') return false;

    // Verificar si la membresía no está vencida
    if (new Date() > user.membership.endDate) return false;

    return user.membership.gyms.some(mg => mg.gymId === gymId);
  }

  async validateRutMembership(rut: string, gymId: string) {
    // Buscar si el RUT ya está registrado
    const existingUser = await this.prisma.user.findUnique({
      where: { rut },
      include: {
        membership: {
          include: {
            gyms: {
              include: { gym: true },
            },
          },
        },
      },
    });

    if (existingUser) {
      return {
        exists: true,
        hasAccount: true,
        message: 'Este RUT ya tiene una cuenta registrada',
      };
    }

    // Buscar si el gym existe
    const gym = await this.prisma.gym.findUnique({
      where: { id: gymId },
    });

    if (!gym) {
      return {
        exists: false,
        hasAccount: false,
        gymFound: false,
        message: 'Gimnasio no encontrado',
      };
    }

    // Por ahora validamos que el gym existe
    // En producción esto consultaría la BD del gimnasio
    return {
      exists: false,
      hasAccount: false,
      gymFound: true,
      gymName: gym.name,
      gymChain: gym.chain,
      message: 'RUT válido para registro',
    };
  }
}