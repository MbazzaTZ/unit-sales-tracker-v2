import { 
  DashboardMetrics, 
  Region, 
  TeamLeader, 
  Team, 
  DSR, 
  Stock, 
  Sale, 
  Alert 
} from '@/types/tsm';

// Empty initial data - to be populated from Supabase database
export const dashboardMetrics: DashboardMetrics = {
  totalStock: 0,
  stockInHand: 0,
  totalSales: 0,
  paidSales: 0,
  unpaidSales: 0,
  totalTLs: 0,
  totalTeams: 0,
  totalDSRs: 0,
};

export const regions: Region[] = [];

export const teamLeaders: TeamLeader[] = [];

export const topTeams: Team[] = [];

export const dsrLeaderboard: DSR[] = [];

export const alerts: Alert[] = [];

export const salesTrendData = [];

export const stockFlowData = [];
