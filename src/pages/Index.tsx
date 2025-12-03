import { useState, useEffect, lazy, Suspense } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import { useAuth } from '@/contexts/AuthContext';
import { UserRole } from '@/types/tsm';
import { Loader2 } from 'lucide-react';

// Lazy load heavy components for better initial load performance
const AdminDashboard = lazy(() => import('@/components/views/AdminDashboard').then(m => ({ default: m.AdminDashboard })));
const TLDashboard = lazy(() => import('@/components/views/TLDashboard').then(m => ({ default: m.TLDashboard })));
const DSRDashboard = lazy(() => import('@/components/views/DSRDashboard').then(m => ({ default: m.DSRDashboard })));
const GeneralDashboard = lazy(() => import('@/components/views/GeneralDashboard').then(m => ({ default: m.GeneralDashboard })));
const DSRStock = lazy(() => import('@/components/views/DSRStock').then(m => ({ default: m.DSRStock })));
const DSRAddSale = lazy(() => import('@/components/views/DSRAddSale').then(m => ({ default: m.DSRAddSale })));
const DSRMySales = lazy(() => import('@/components/views/DSRMySales').then(m => ({ default: m.DSRMySales })));
const DSRCommission = lazy(() => import('@/components/views/DSRCommission').then(m => ({ default: m.DSRCommission })));
const AdminStockManagement = lazy(() => import('@/components/views/AdminStockManagement').then(m => ({ default: m.AdminStockManagement })));
const AdminTLManagement = lazy(() => import('@/components/views/AdminTLManagement').then(m => ({ default: m.AdminTLManagement })));
const AdminManagerManagement = lazy(() => import('@/components/views/AdminManagerManagement').then(m => ({ default: m.AdminManagerManagement })));
const AdminAssignStock = lazy(() => import('@/components/views/AdminAssignStock').then(m => ({ default: m.AdminAssignStock })));
const AdminApprovals = lazy(() => import('@/components/views/AdminApprovals').then(m => ({ default: m.AdminApprovals })));
const AdminRegionManagement = lazy(() => import('@/components/views/AdminRegionManagement').then(m => ({ default: m.AdminRegionManagement })));
const AdminDEManagement = lazy(() => import('@/components/views/AdminDEManagement').then(m => ({ default: m.AdminDEManagement })));
const TLTeamManagement = lazy(() => import('@/components/views/TLTeamManagement').then(m => ({ default: m.TLTeamManagement })));
const TLDSRManagement = lazy(() => import('@/components/views/TLDSRManagement').then(m => ({ default: m.TLDSRManagement })));
const TLStockManagement = lazy(() => import('@/components/views/TLStockManagement').then(m => ({ default: m.TLStockManagement })));
const TLSalesVerification = lazy(() => import('@/components/views/TLSalesVerification').then(m => ({ default: m.TLSalesVerification })));
const TLReports = lazy(() => import('@/components/views/TLReports').then(m => ({ default: m.TLReports })));
const Profile = lazy(() => import('@/components/views/Profile').then(m => ({ default: m.GeneralDashboard })));
const ManagerDashboard = lazy(() => import('@/components/views/ManagerDashboard'));
const ManagerStock = lazy(() => import('@/components/views/ManagerStock'));
const ManagerSalesTeam = lazy(() => import('@/components/views/ManagerSalesTeam'));
const DEDashboard = lazy(() => import('@/components/views/DEDashboard').then(m => ({ default: m.DEDashboard })));
const DEAgents = lazy(() => import('@/components/views/DEAgents').then(m => ({ default: m.DEAgents })));
const DEAgentSales = lazy(() => import('@/components/views/DEAgentSales').then(m => ({ default: m.DEAgentSales })));
const DESalesReport = lazy(() => import('@/components/views/DESalesReport').then(m => ({ default: m.DESalesReport })));

// Loading fallback component
const ComponentLoader = () => (
  <div className="flex items-center justify-center h-full min-h-[400px]">
    <Loader2 className="h-8 w-8 animate-spin text-primary" />
  </div>
);

const Index = () => {
  const { user, userRole, profile, loading } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState(userRole === 'dsr' ? 'dashboard' : 'general');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    if (userRole === 'dsr') {
      setActiveTab('dashboard');
    } else if (userRole === 'admin' || userRole === 'tl') {
      setActiveTab('general');
    } else if (userRole === 'de') {
      setActiveTab('dashboard');
    }
  }, [userRole]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) return null;

  const renderContent = () => {
    if (!userRole) return null;

    if (userRole === 'admin') {
      switch (activeTab) {
        case 'general':
          return <GeneralDashboard />;
        case 'dashboard':
          return <AdminDashboard />;
        case 'regions':
          return <AdminRegionManagement />;
        case 'stock':
          return <AdminStockManagement />;
        case 'assign':
          return <AdminAssignStock />;
        case 'tls':
          return <AdminTLManagement />;
        case 'managers':
          return <AdminManagerManagement />;
        case 'des':
          return <AdminDEManagement />;
        case 'approvals':
          return <AdminApprovals />;
        case 'profile':
          return <Profile />;
        default:
          return <GeneralDashboard />;
      }
    }

    if (userRole === 'tl') {
      switch (activeTab) {
        case 'general':
          return <GeneralDashboard />;
        case 'dashboard':
          return <TLDashboard onNavigate={setActiveTab} />;
        case 'teams':
          return <TLTeamManagement />;
        case 'dsrs':
          return <TLDSRManagement />;
        case 'stock':
          return <TLStockManagement />;
        case 'verification':
          return <TLSalesVerification />;
        case 'reports':
          return <TLReports />;
        case 'profile':
          return <Profile />;
        default:
          return <TLDashboard onNavigate={setActiveTab} />;
      }
    }

    if (userRole === 'dsr') {
      switch (activeTab) {
        case 'dashboard':
          return <DSRDashboard onNavigate={setActiveTab} />;
        case 'stock':
          return <DSRStock onNavigate={setActiveTab} />;
        case 'add-sale':
          return <DSRAddSale onNavigate={setActiveTab} />;
        case 'my-sales':
          return <DSRMySales onNavigate={setActiveTab} />;
        case 'commission':
          return <DSRCommission onNavigate={setActiveTab} />;
        case 'profile':
          return <Profile />;
        default:
          return <DSRDashboard onNavigate={setActiveTab} />;
      }
    }

    if (userRole === 'manager') {
      switch (activeTab) {
        case 'dashboard':
          return <ManagerDashboard />;
        case 'stock':
          return <ManagerStock />;
        case 'sales-team':
          return <ManagerSalesTeam />;
        case 'profile':
          return <Profile />;
        default:
          return <ManagerDashboard />;
      }
    }

    if (userRole === 'de') {
      switch (activeTab) {
        case 'dashboard':
          return <DEDashboard />;
        case 'agents':
          return <DEAgents />;
        case 'sales':
          return <DEAgentSales />;
        case 'reports':
          return <DESalesReport />;
        case 'profile':
          return <Profile />;
        default:
          return <DEDashboard />;
      }
    }

    return <GeneralDashboard />;
  };

  if (!userRole) return null;

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <Sidebar 
        role={userRole} 
        activeTab={activeTab} 
        onTabChange={setActiveTab}
        isMobileOpen={isMobileMenuOpen}
        onMobileClose={() => setIsMobileMenuOpen(false)}
      />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header 
          role={userRole} 
          userName={profile?.full_name}
          onMobileMenuToggle={() => setIsMobileMenuOpen(true)}
        />
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          <Suspense fallback={<ComponentLoader />}>
            {renderContent()}
          </Suspense>
        </main>
      </div>
    </div>
  );
};

export default Index;
