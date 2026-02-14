export interface StaffDashboardData {
  gym: {
    id: string;
    name: string;
    maxCapacity: number;
    currentCapacity: number;
    occupancyPercentage: number;
  };
  activeUsers: {
    id: string;
    name: string;
    rut: string;
    membershipType: string;
    checkedInAt: string;
    minutesInside: number;
  }[];
  todayActivity: {
    id: string;
    userName: string;
    type: 'entry' | 'exit';
    time: string;
    membershipType: string;
  }[];
  stats: {
    totalVisitsToday: number;
    currentInside: number;
    peakToday: number;
    peakHour: string;
    avgTimeInside: number;
  };
  hourlyToday: {
    hour: number;
    label: string;
    count: number;
    percentage: number;
  }[];
  alerts: {
    type: 'warning' | 'critical' | 'info';
    message: string;
  }[];
}