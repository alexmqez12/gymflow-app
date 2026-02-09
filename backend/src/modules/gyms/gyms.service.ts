import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class GymsService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    const gyms = await this.prisma.gym.findMany({
      where: { isActive: true },
      include: {
        _count: {
          select: {
            checkins: {
              where: {
                checkedOut: null,
              },
            },
          },
        },
      },
    });

    return gyms.map(gym => ({
      ...gym,
      currentCapacity: gym._count.checkins,
      availableSpots: gym.maxCapacity - gym._count.checkins,
      occupancyPercentage: Math.round((gym._count.checkins / gym.maxCapacity) * 100),
    }));
  }

  async findOne(id: string) {
    const gym = await this.prisma.gym.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            checkins: {
              where: {
                checkedOut: null,
              },
            },
          },
        },
      },
    });

    if (!gym) {
      throw new NotFoundException(`Gym with ID ${id} not found`);
    }

    return {
      ...gym,
      currentCapacity: gym._count.checkins,
      availableSpots: gym.maxCapacity - gym._count.checkins,
      occupancyPercentage: Math.round((gym._count.checkins / gym.maxCapacity) * 100),
    };
  }
}