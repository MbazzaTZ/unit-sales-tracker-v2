import { dashboardMetrics, regions } from '@/data/mockData';
import { MetricCard } from '@/components/dashboard/MetricCard';
import { RegionCard } from '@/components/dashboard/RegionCard';
import { SalesChart } from '@/components/dashboard/SalesChart';
import { StockFlowChart } from '@/components/dashboard/StockFlowChart';
import { TLPerformanceTable } from '@/components/dashboard/TLPerformanceTable';
import { TopTeams } from '@/components/dashboard/TopTeams';
import { DSRLeaderboard } from '@/components/dashboard/DSRLeaderboard';
import { AlertsPanel } from '@/components/dashboard/AlertsPanel';
import { ActionPanel } from '@/components/dashboard/ActionPanel';
import { 
  Package, 
  PackageCheck, 
  ShoppingCart, 
  CheckCircle, 
  AlertCircle, 
  Users 
} from 'lucide-react';

export function AdminDashboard() {
  return (
    <div className="p-6 space-y-6 overflow-y-auto">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Operations Dashboard</h1>
          <p className="text-muted-foreground">Overview of sales, stock, and team performance</p>
        </div>
        <div className="text-right">
          <p className="text-sm text-muted-foreground">Last updated</p>
          <p className="text-sm font-medium text-foreground">
            {new Date().toLocaleString()}
          </p>
        </div>
      </div>

      {/* KPI Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <MetricCard 
          title="Total Stock" 
          value={dashboardMetrics.totalStock} 
          icon={Package}
          variant="default"
        />
        <MetricCard 
          title="Stock In Hand" 
          value={dashboardMetrics.stockInHand} 
          icon={PackageCheck}
          variant="info"
        />
        <MetricCard 
          title="Total Sales" 
          value={dashboardMetrics.totalSales} 
          icon={ShoppingCart}
          trend={{ value: 12, isPositive: true }}
        />
        <MetricCard 
          title="Paid Sales" 
          value={dashboardMetrics.paidSales} 
          icon={CheckCircle}
          variant="success"
        />
        <MetricCard 
          title="Unpaid Sales" 
          value={dashboardMetrics.unpaidSales} 
          icon={AlertCircle}
          variant="danger"
        />
        <MetricCard 
          title="TLs / Teams / DSRs" 
          value={`${dashboardMetrics.totalTLs} / ${dashboardMetrics.totalTeams} / ${dashboardMetrics.totalDSRs}`} 
          icon={Users}
        />
      </div>

      {/* Regional Performance */}
      <div>
        <h2 className="text-lg font-semibold text-foreground mb-4">Regional Performance</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {regions.map((region, index) => (
            <RegionCard 
              key={region.id} 
              region={region} 
              className={`animation-delay-${index * 100}`}
            />
          ))}
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <SalesChart />
        </div>
        <StockFlowChart />
      </div>

      {/* TL Performance Table */}
      <TLPerformanceTable />

      {/* Bottom Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <TopTeams />
        <div className="lg:col-span-2">
          <DSRLeaderboard />
        </div>
      </div>

      {/* Alerts and Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <AlertsPanel />
        </div>
        <ActionPanel />
      </div>
    </div>
  );
}
