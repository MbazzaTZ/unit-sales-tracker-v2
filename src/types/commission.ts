// Commission calculation types and utilities

export type DSRTier = 'KURUTA' | 'CHUMA' | 'SHABA' | 'FEDHA' | 'DHAHABU' | 'TANZANITE';

export type CommissionStatus = 'eligible' | 'pending-approval' | 'not-eligible';

export interface CommissionBreakdown {
  upfrontCommission: number;
  activationCommission: number;
  packageCommission: number;
  bonusCommission: number;
  totalCommission: number;
}

export interface SaleCommission {
  saleId: string;
  status: CommissionStatus;
  reason?: string;
  breakdown: CommissionBreakdown;
}

// Upfront commission rates
export const UPFRONT_COMMISSION = {
  DO: 2000,
  FS: 5000,
  DVS: 0 // DVS doesn't get upfront commission
};

// Activation commission rate
export const ACTIVATION_COMMISSION = 1500;

// Package commission rates
export const PACKAGE_COMMISSION = {
  PREMIUM: 65000,
  'COMPACT PLUS': 35000,
  COMPACT: 17000,
  SHANGWE: 6000,
  ACCESS: 2750,
  BOMBA: 2750
};

// Bonus tiers based on monthly sales count
export const BONUS_TIERS = [
  { tier: 'KURUTA', minSales: 3, maxSales: 4, bonus: 30000 },
  { tier: 'CHUMA', minSales: 1, maxSales: 4, bonus: 0 }, // More than 1 month working
  { tier: 'SHABA', minSales: 5, maxSales: 9, bonus: 50000 },
  { tier: 'SHABA', minSales: 10, maxSales: 14, bonus: 115000 },
  { tier: 'FEDHA', minSales: 15, maxSales: 19, bonus: 200000 },
  { tier: 'FEDHA', minSales: 20, maxSales: 24, bonus: 300000 },
  { tier: 'DHAHABU', minSales: 20, maxSales: 24, bonus: 425000 },
  { tier: 'DHAHABU', minSales: 25, maxSales: 44, bonus: 675000 },
  { tier: 'TANZANITE', minSales: 20, maxSales: 24, bonus: 1000000 }
];

/**
 * Calculate commission for a single sale
 */
export function calculateSaleCommission(
  saleType: 'FS' | 'DO' | 'DVS',
  packageName: string | null,
  paymentStatus: 'paid' | 'unpaid',
  adminApproved: boolean | null,
  stockId: string | null
): SaleCommission {
  const breakdown: CommissionBreakdown = {
    upfrontCommission: 0,
    activationCommission: 0,
    packageCommission: 0,
    bonusCommission: 0,
    totalCommission: 0
  };

  // Check eligibility
  let status: CommissionStatus = 'pending-approval';
  let reason: string | undefined;

  // DVS: Only check if admin approved (unpaid is OK for DVS)
  if (saleType === 'DVS') {
    if (adminApproved === null) {
      status = 'pending-approval';
      reason = 'Awaiting admin approval';
    } else if (adminApproved === false) {
      status = 'not-eligible';
      reason = 'Admin rejected';
    } else {
      status = 'eligible';
    }
  } else {
    // FS/DO: Check both payment status and admin approval
    if (paymentStatus === 'unpaid') {
      status = 'not-eligible';
      reason = 'Stock unpaid';
    } else if (adminApproved === null) {
      status = 'pending-approval';
      reason = 'Awaiting admin approval';
    } else if (adminApproved === false) {
      status = 'not-eligible';
      reason = 'Admin rejected';
    } else if (!packageName) {
      status = 'not-eligible';
      reason = 'No package selected';
    } else {
      status = 'eligible';
    }
  }

  // Only calculate commission if eligible
  if (status === 'eligible') {
    // 1. Upfront commission
    breakdown.upfrontCommission = UPFRONT_COMMISSION[saleType] || 0;

    // 2. Activation commission
    breakdown.activationCommission = ACTIVATION_COMMISSION;

    // 3. Package commission
    if (packageName) {
      const packageKey = packageName.toUpperCase();
      breakdown.packageCommission = PACKAGE_COMMISSION[packageKey as keyof typeof PACKAGE_COMMISSION] || 0;
    }

    // Note: Bonus commission is calculated separately based on monthly total sales
    breakdown.totalCommission = 
      breakdown.upfrontCommission + 
      breakdown.activationCommission + 
      breakdown.packageCommission;
  }

  return {
    saleId: '',
    status,
    reason,
    breakdown
  };
}

/**
 * Calculate bonus commission based on DSR tier and monthly sales count
 */
export function calculateBonusCommission(
  tier: DSRTier,
  monthlySalesCount: number
): number {
  const matchingTier = BONUS_TIERS.find(
    t => t.tier === tier && 
    monthlySalesCount >= t.minSales && 
    monthlySalesCount <= t.maxSales
  );

  return matchingTier ? matchingTier.bonus : 0;
}

/**
 * Get DSR tier based on sales performance and tenure
 */
export function getDSRTier(
  monthlySalesCount: number,
  monthsWorking: number
): DSRTier {
  if (monthlySalesCount >= 20 && monthsWorking >= 6) return 'TANZANITE';
  if (monthlySalesCount >= 25) return 'DHAHABU';
  if (monthlySalesCount >= 20) return 'DHAHABU';
  if (monthlySalesCount >= 15) return 'FEDHA';
  if (monthlySalesCount >= 10) return 'SHABA';
  if (monthlySalesCount >= 5) return 'SHABA';
  if (monthsWorking > 1) return 'CHUMA';
  return 'KURUTA';
}
