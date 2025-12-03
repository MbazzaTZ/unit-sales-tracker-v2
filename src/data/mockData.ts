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

// Stock prices (TZS)
export const STOCK_PRICES = {
  FS: 65000,
  DO: 25000,
  DVS: 27500,
};

export type StockType = keyof typeof STOCK_PRICES;

// DSTV Tanzania Packages (2025)
export const DSTV_PACKAGES = [
  { code: 'ACCESS', name: 'DStv Access', price: 6000, channels: 45 },
  { code: 'FAMILY', name: 'DStv Family', price: 25000, channels: 110 },
  { code: 'COMPACT', name: 'DStv Compact', price: 42000, channels: 150 },
  { code: 'COMPACT_PLUS', name: 'DStv Compact Plus', price: 75000, channels: 180 },
  { code: 'PREMIUM', name: 'DStv Premium', price: 105000, channels: 220 },
];

// Commission Rates (TZS)
export const COMMISSION_RATES = {
  FS: { upfront: 5000, activation: 3000, packageRate: 10 },
  DO: { upfront: 2000, activation: 1500, packageRate: 8 },
  DVS: { upfront: 1500, activation: 1000, packageRate: 5 },
};

// Bonus Configuration
export const BONUS_CONFIG = {
  salesThreshold: 2, // Sales needed for bonus
  bonusAmount: 10000, // TZS 10,000 per bonus
};
