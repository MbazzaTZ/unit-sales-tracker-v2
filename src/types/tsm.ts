export type UserRole = 'admin' | 'tl' | 'dsr';

export type PaymentStatus = 'paid' | 'unpaid';
export type StockStatus = 'in-hand' | 'sold-paid' | 'sold-unpaid' | 'assigned' | 'unassigned';
export type SaleType = 'FS' | 'DO';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  region?: string;
  teamId?: string;
  tlId?: string;
  avatar?: string;
}

export interface Region {
  id: string;
  name: string;
  code: string;
  tlCount: number;
  teamCount: number;
  dsrCount: number;
  stockInHand: number;
  paidSales: number;
  unpaidSales: number;
  target: number;
  achieved: number;
}

export interface TeamLeader {
  id: string;
  name: string;
  region: string;
  regionCode: string;
  teams: number;
  dsrs: number;
  target: number;
  achieved: number;
  unpaidSales: number;
  stockInHand: number;
  performanceStatus: 'good' | 'average' | 'weak';
}

export interface Team {
  id: string;
  name: string;
  captainId: string;
  captainName: string;
  tlId: string;
  region: string;
  totalSales: number;
  paidSales: number;
  unpaidSales: number;
  stockLeft: number;
  dsrCount: number;
}

export interface DSR {
  id: string;
  name: string;
  teamId: string;
  teamName: string;
  tlId: string;
  region: string;
  totalSales: number;
  paidSales: number;
  unpaidSales: number;
  stockInHand: number;
  riskStatus: 'low' | 'medium' | 'high';
  rank?: number;
}

export interface Stock {
  id: string;
  type: string;
  batch: string;
  status: StockStatus;
  assignedTo?: string;
  assignedToType?: 'tl' | 'team' | 'dsr';
  assignedBy?: string;
  dateAssigned?: string;
  dateCreated: string;
  region?: string;
}

export interface Sale {
  id: string;
  stockId: string;
  dsrId: string;
  dsrName: string;
  teamId: string;
  teamName: string;
  tlId: string;
  region: string;
  smartCardNumber: string;
  snNumber: string;
  paymentStatus: PaymentStatus;
  saleType: SaleType;
  packageOption: 'no-package' | 'with-package';
  dstvPackage?: string;
  dateCreated: string;
  tlVerified: boolean;
  adminApproved: boolean;
}

export interface Alert {
  id: string;
  type: 'high-unpaid' | 'low-performance' | 'stock-ageing' | 'misallocated';
  message: string;
  severity: 'warning' | 'critical';
  entityId?: string;
  entityType?: string;
  dateCreated: string;
}

export interface DashboardMetrics {
  totalStock: number;
  stockInHand: number;
  totalSales: number;
  paidSales: number;
  unpaidSales: number;
  totalTLs: number;
  totalTeams: number;
  totalDSRs: number;
}
