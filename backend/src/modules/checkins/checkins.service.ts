import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCheckInDto } from './dto';

@Injectable()
export class CheckinsService {
  constructor(private prisma: PrismaService) {}

  async checkIn(createCheckInDto: CreateCheckInDto) {
    const { gymId, userId } = createCheckInDto;

    // Verificar si el gimnasio existe y tiene capacidad
    const gym = await this.prisma.gym.findUnique({
      where: { id: gymId },
      include: {
        _count: {
          select: {
            checkins: {
              where: { checkedOut: null },
            },
          },
        },
      },
    });

    if (!gym) {
      throw new NotFoundException('Gimnasio no encontrado');
    }

    if (!gym.isActive) {
      throw new BadRequestException('El gimnasio no está activo');
    }

    if (gym._count.checkins >= gym.maxCapacity) {
      throw new BadRequestException('El gimnasio está en capacidad máxima');
    }

    // Verificar si el usuario ya tiene un check-in activo en este gym
    if (userId) {
      const activeCheckin = await this.prisma.checkIn.findFirst({
        where: {
          gymId,
          userId,
          checkedOut: null,
        },
      });

      if (activeCheckin) {
        throw new BadRequestException('Ya tienes un check-in activo en este gimnasio');
      }
    }

    // Crear el check-in
    const checkin = await this.prisma.checkIn.create({
      data: {
        gymId,
        userId,
      },
      include: {
        gym: {
          select: {
            id: true,
            name: true,
            maxCapacity: true,
          },
        },
        user: userId ? {
          select: {
            id: true,
            name: true,
            email: true,
          },
        } : false,
      },
    });

    return checkin;
  }

  async checkOut(id: string) {
    const checkin = await this.prisma.checkIn.findUnique({
      where: { id },
      include: {
        gym: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!checkin) {
      throw new NotFoundException('Check-in no encontrado');
    }

    if (checkin.checkedOut) {
      throw new BadRequestException('Ya se realizó el check-out');
    }

    const updatedCheckin = await this.prisma.checkIn.update({
      where: { id },
      data: {
        checkedOut: new Date(),
      },
      include: {
        gym: {
          select: {
            id: true,
            name: true,
          },
        },
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    return updatedCheckin;
  }

  async findActiveByGym(gymId: string) {
    return this.prisma.checkIn.findMany({
      where: {
        gymId,
        checkedOut: null,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: {
        checkedIn: 'desc',
      },
    });
  }

  async getCurrentCapacity(gymId: string) {
    const count = await this.prisma.checkIn.count({
      where: {
        gymId,
        checkedOut: null,
      },
    });

    const gym = await this.prisma.gym.findUnique({
      where: { id: gymId },
      select: {
        maxCapacity: true,
        name: true,
      },
    });

    if (!gym) {
      throw new NotFoundException('Gimnasio no encontrado');
    }

    return {
      gymId,
      gymName: gym.name,
      current: count,
      max: gym.maxCapacity,
      available: gym.maxCapacity - count,
      percentage: Math.round((count / gym.maxCapacity) * 100),
    };
  }

  async getMyActiveCheckins(userId: string) {
    return this.prisma.checkIn.findMany({
      where: {
        userId,
        checkedOut: null,
      },
      include: {
        gym: {
          select: {
            id: true,
            name: true,
            address: true,
            maxCapacity: true,
          },
        },
      },
      orderBy: {
        checkedIn: 'desc',
      },
    });
  }
}