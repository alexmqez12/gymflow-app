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

    return gyms.map(gym => {
      const currentCapacity = gym._count.checkins;
      const maxCapacity = gym.maxCapacity ?? 0;

      const occupancyPercentage =
        maxCapacity > 0
          ? Math.round((currentCapacity / maxCapacity) * 100)
          : 0;

      return {
        ...gym,
        currentCapacity,
        availableSpots: Math.max(maxCapacity - currentCapacity, 0),
        occupancyPercentage,
      };
    });
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

  const currentCapacity = gym._count.checkins;
  const maxCapacity = gym.maxCapacity ?? 0;

  const occupancyPercentage =
    maxCapacity > 0
      ? Math.round((currentCapacity / maxCapacity) * 100)
      : 0;

  return {
    ...gym,
    currentCapacity,
    availableSpots: Math.max(maxCapacity - currentCapacity, 0),
    occupancyPercentage,
  };
}

  async getHourlyStats(gymId: string) {
    const gym = await this.prisma.gym.findUnique({
      where: { id: gymId },
    });

    if (!gym) throw new NotFoundException('Gimnasio no encontrado');

    // Obtener inicio y fin del día actual
    const now = new Date();
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(now);
    endOfDay.setHours(23, 59, 59, 999);

    // Obtener todos los check-ins de hoy
    const checkins = await this.prisma.checkIn.findMany({
      where: {
        gymId,
        checkedIn: {
          gte: startOfDay,
          lte: endOfDay,
        },
      },
      select: {
        checkedIn: true,
        checkedOut: true,
      },
    });

    // Calcular ocupación por hora
    const hourlyData: Array<{ hour: number; label: string; count: number; percentage: number }> = [];

    for (let hour = 0; hour <= now.getHours(); hour++) {
      const hourStart = new Date(startOfDay);
      hourStart.setHours(hour, 0, 0, 0);
      const hourEnd = new Date(startOfDay);
      hourEnd.setHours(hour, 59, 59, 999);

      // Contar cuántas personas estaban dentro durante esa hora
      const count = checkins.filter(c => {
        const checkedIn = new Date(c.checkedIn);
        const checkedOut = c.checkedOut ? new Date(c.checkedOut) : now;
        return checkedIn <= hourEnd && checkedOut >= hourStart;
      }).length;

      hourlyData.push({
        hour,
        label: `${hour.toString().padStart(2, '0')}:00`,
        count,
        percentage: Math.round((count / gym.maxCapacity) * 100),
      });
    }

    // Calcular estadísticas del día
    const counts = hourlyData.map(h => h.count);
    const peakHour = hourlyData.reduce((max, h) => h.count > max.count ? h : max, hourlyData[0]);
    const avgOccupancy = counts.length > 0
      ? Math.round(counts.reduce((a, b) => a + b, 0) / counts.length)
      : 0;

    // Capacidad actual
    const currentCount = await this.prisma.checkIn.count({
      where: { gymId, checkedOut: null },
    });

    return {
      gymId,
      gymName: gym.name,
      maxCapacity: gym.maxCapacity,
      currentCapacity: currentCount,
      occupancyPercentage: Math.round((currentCount / gym.maxCapacity) * 100),
      hourlyData,
      stats: {
        peakHour: peakHour?.label || 'N/A',
        peakCount: peakHour?.count || 0,
        avgOccupancy,
        totalVisits: checkins.length,
      },
    };
  }

  async getPredictiveStats(gymId: string) {
    const gym = await this.prisma.gym.findUnique({ where: { id: gymId } });
    if (!gym) throw new NotFoundException('Gimnasio no encontrado');

    const now = new Date();
    const currentHour = now.getHours();

    // ── Histórico 7 días ──────────────────────────────────
    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const historicalCheckins = await this.prisma.checkIn.findMany({
      where: { gymId, checkedIn: { gte: sevenDaysAgo } },
      select: { checkedIn: true, checkedOut: true },
    });

    const hasRealData = historicalCheckins.length > 20;

    // ── Patrón base típico gimnasio ───────────────────────
    const basePattern: Record<number, number> = {
      0: 2,  1: 1,  2: 1,  3: 1,  4: 2,  5: 5,
      6: 15, 7: 35, 8: 55, 9: 65, 10: 60, 11: 55,
      12: 50, 13: 45, 14: 40, 15: 45, 16: 55,
      17: 75, 18: 85, 19: 80, 20: 65, 21: 45,
      22: 25, 23: 10,
    };

    const baseValue = (h: number) =>
      Math.round((basePattern[h] / 100) * gym.maxCapacity);

    // ── Promedio histórico por hora (últimos 7 días) ──────
    const weeklyHourlyAvg: Record<number, number[]> = {};
    for (let h = 0; h < 24; h++) weeklyHourlyAvg[h] = [];

    for (let dayOffset = 1; dayOffset <= 7; dayOffset++) {
      const dayStart = new Date(now);
      dayStart.setDate(dayStart.getDate() - dayOffset);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(dayStart);
      dayEnd.setHours(23, 59, 59, 999);

      const dayCheckins = historicalCheckins.filter(c => {
        const ci = new Date(c.checkedIn);
        return ci >= dayStart && ci <= dayEnd;
      });

      for (let h = 0; h < 24; h++) {
        const hStart = new Date(dayStart);
        hStart.setHours(h, 0, 0, 0);
        const hEnd = new Date(dayStart);
        hEnd.setHours(h, 59, 59, 999);

        const count = dayCheckins.filter(c => {
          const ci = new Date(c.checkedIn);
          const co = c.checkedOut ? new Date(c.checkedOut) : new Date();
          return ci <= hEnd && co >= hStart;
        }).length;

        weeklyHourlyAvg[h].push(count);
      }
    }

    // ── Checkins de hoy ───────────────────────────────────
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);

    const todayCheckins = await this.prisma.checkIn.findMany({
      where: { gymId, checkedIn: { gte: startOfDay } },
      select: { checkedIn: true, checkedOut: true },
    });

    const todayHourly: Record<number, number> = {};
    for (let h = 0; h <= currentHour; h++) {
      const hStart = new Date(startOfDay);
      hStart.setHours(h, 0, 0, 0);
      const hEnd = new Date(startOfDay);
      hEnd.setHours(h, 59, 59, 999);

      todayHourly[h] = todayCheckins.filter(c => {
        const ci = new Date(c.checkedIn);
        const co = c.checkedOut ? new Date(c.checkedOut) : now;
        return ci <= hEnd && co >= hStart;
      }).length;
    }

    // ── Checkins de ayer ──────────────────────────────────
    const startOfYesterday = new Date(now);
    startOfYesterday.setDate(startOfYesterday.getDate() - 1);
    startOfYesterday.setHours(0, 0, 0, 0);
    const endOfYesterday = new Date(startOfYesterday);
    endOfYesterday.setHours(23, 59, 59, 999);

    const yesterdayCheckins = historicalCheckins.filter(c => {
      const ci = new Date(c.checkedIn);
      return ci >= startOfYesterday && ci <= endOfYesterday;
    });

    const yesterdayHourly: Record<number, number> = {};
    for (let h = 0; h < 24; h++) {
      const hStart = new Date(startOfYesterday);
      hStart.setHours(h, 0, 0, 0);
      const hEnd = new Date(startOfYesterday);
      hEnd.setHours(h, 59, 59, 999);

      yesterdayHourly[h] = yesterdayCheckins.filter(c => {
        const ci = new Date(c.checkedIn);
        const co = c.checkedOut ? new Date(c.checkedOut) : endOfYesterday;
        return ci <= hEnd && co >= hStart;
      }).length;
    }

    // ── Construir día completo (real + predicción) ────────
    const getSmartValue = (h: number): number => {
      const weekAvg = weeklyHourlyAvg[h]?.length > 0
        ? weeklyHourlyAvg[h].reduce((a, b) => a + b, 0) / weeklyHourlyAvg[h].length
        : null;

      const base = baseValue(h);

      if (hasRealData && weekAvg !== null) {
        return Math.round(weekAvg * 0.65 + base * 0.35);
      }
      return base;
    };

    type HourData = {
      hour: number;
      label: string;
      today: number | null;
      yesterday: number;
      weekAvg: number;
      prediction: number | null;
      isPrediction: boolean;
      isCurrentHour: boolean;
    };

    const fullDay: HourData[] = Array.from({ length: 24 }, (_, h) => {
      const variation = Math.floor(Math.random() * 2);
      if (h <= currentHour) {
        return {
          hour: h,
          label: `${h.toString().padStart(2, '0')}:00`,
          today: todayHourly[h] ?? 0,
          yesterday: yesterdayHourly[h] ?? 0,
          weekAvg: weeklyHourlyAvg[h]?.length > 0
            ? Math.round(weeklyHourlyAvg[h].reduce((a, b) => a + b, 0) / weeklyHourlyAvg[h].length)
            : getSmartValue(h),
          prediction: null,
          isPrediction: false,
          isCurrentHour: h === currentHour,
        };
      }
      return {
        hour: h,
        label: `${h.toString().padStart(2, '0')}:00`,
        today: null,
        yesterday: yesterdayHourly[h] ?? 0,
        weekAvg: weeklyHourlyAvg[h]?.length > 0
          ? Math.round(weeklyHourlyAvg[h].reduce((a, b) => a + b, 0) / weeklyHourlyAvg[h].length)
          : getSmartValue(h),
        prediction: Math.max(0, getSmartValue(h) + variation),
        isPrediction: true,
        isCurrentHour: false,
      };
    });

    // ── Próximas 3 horas ──────────────────────────────────
    const nextThreeHours = [1, 2, 3].map(offset => {
      const h = (currentHour + offset) % 24;
      const val = getSmartValue(h);
      return {
        hour: h,
        label: `${h.toString().padStart(2, '0')}:00`,
        value: val,
        percentage: Math.round((val / gym.maxCapacity) * 100),
        offset,
      };
    });

    // ── Mejor hora para ir ────────────────────────────────
    const usableHours = fullDay.filter(h => h.hour >= 6 && h.hour <= 22);
    const bestHourData = usableHours.length > 0
      ? usableHours.reduce<HourData>((min, h) => {
          const val = h.today !== null ? h.today : (h.prediction ?? h.weekAvg);
          const minVal = min.today !== null ? min.today : (min.prediction ?? min.weekAvg);
          return val < minVal ? h : min;
        }, usableHours[0]!)
      : usableHours[0] || fullDay[6]!;

    const bestValue = bestHourData.today !== null
      ? bestHourData.today
      : (bestHourData.prediction ?? bestHourData.weekAvg);

    // ── Tendencia ─────────────────────────────────────────
    const currentVal = todayHourly[currentHour] ?? 0;
    const prevVal = currentHour >= 1 ? (todayHourly[currentHour - 1] ?? 0) : 0;
    const trend = currentVal - prevVal;

    // ── Comparativa con ayer a la misma hora ─────────────
    const yesterdayNow = yesterdayHourly[currentHour] ?? 0;
    const vsYesterday = currentVal - yesterdayNow;

    // ── Aforo actual ──────────────────────────────────────
    const currentCapacity = await this.prisma.checkIn.count({
      where: { gymId, checkedOut: null },
    });

    return {
      gymId,
      gymName: gym.name,
      maxCapacity: gym.maxCapacity,
      currentCapacity,
      hasRealData,
      fullDay,
      nextThreeHours,
      insights: {
        bestHour: bestHourData.label,
        bestHourValue: bestValue,
        bestHourPercentage: Math.round((bestValue / gym.maxCapacity) * 100),
        trend: trend > 2 ? 'rising' : trend < -2 ? 'falling' : 'stable',
        trendValue: Math.abs(trend),
        vsYesterday,
        vsYesterdayPct: yesterdayNow > 0
          ? Math.round(((currentVal - yesterdayNow) / yesterdayNow) * 100)
          : 0,
        nextHourPrediction: nextThreeHours[0]?.value ?? 0,
        nextHourPercentage: nextThreeHours[0]?.percentage ?? 0,
      },
    };
  }

  async getGymsForUser(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        membership: {
          include: {
            gyms: {
              include: {
                gym: { select: { id: true, chain: true } },
              },
            },
          },
        },
      },
    });

    if (!user) throw new NotFoundException('Usuario no encontrado');

    // ADMIN y GYM_STAFF ven todos
    if (user.role === 'ADMIN' || user.role === 'GYM_STAFF') {
      return this.prisma.gym.findMany({
        where: { isActive: true },
        orderBy: { name: 'asc' },
      });
    }

    // Sin membresía → array vacío
    if (!user.membership || user.membership.status !== 'ACTIVE') {
      return [];
    }

    // Obtener IDs y cadenas de la membresía
    const membershipGymIds = user.membership.gyms.map(mg => mg.gymId);
    const membershipChains = user.membership.gyms
      .map(mg => mg.gym.chain)
      .filter(Boolean) as string[];

    // Ver gyms directos + gyms de la misma cadena
    return this.prisma.gym.findMany({
      where: {
        isActive: true,
        OR: [
          { id: { in: membershipGymIds } },
          ...(membershipChains.length > 0
            ? [{ chain: { in: membershipChains } }]
            : []),
        ],
      },
      orderBy: { name: 'asc' },
    });
  }
}
