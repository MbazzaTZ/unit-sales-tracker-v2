import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import { AdminDashboard } from '@/components/views/AdminDashboard';
import { TLDashboard } from '@/components/views/TLDashboard';
import { DSRDashboard } from '@/components/views/DSRDashboard';
import { GeneralDashboard } from '@/components/views/GeneralDashboard';
import { DSRStock } from '@/components/views/DSRStock';
import { DSRAddSale } from '@/components/views/DSRAddSale';
import { DSRMySales } from '@/components/views/DSRMySales';
import { AdminStockManagement } from '@/components/views/AdminStockManagement';
import { AdminTLManagement } from '@/components/views/AdminTLManagement';
import { AdminAssignStock } from '@/components/views/AdminAssignStock';
import { AdminApprovals } from '@/components/views/AdminApprovals';
import { AdminRegionManagement } from '@/components/views/AdminRegionManagement';
import { TLTeamManagement } from '@/components/views/TLTeamManagement';
import { TLDSRManagement } from '@/components/views/TLDSRManagement';
import { TLStockManagement } from '@/components/views/TLStockManagement';
import { TLSalesVerification } from '@/components/views/TLSalesVerification';
import { TLReports } from '@/components/views/TLReports';
import { Profile } from '@/components/views/Profile';
import ManagerDashboard from '@/components/views/ManagerDashboard';
import ManagerStock from '@/components/views/ManagerStock';
import ManagerSalesTeam from '@/components/views/ManagerSalesTeam';
import { useAuth } from '@/contexts/AuthContext';
import { UserRole } from '@/types/tsm';
import { Loader2 } from 'lucide-react';

const Index = () => {
  const { user, userRole, profile, loading } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState(userRole === 'dsr' ? 'dashboard' : 'general');

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

    return <GeneralDashboard />;
  };

  if (!userRole) return null;

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <Sidebar 
        role={userRole} 
        activeTab={activeTab} 
        onTabChange={setActiveTab} 
      />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header role={userRole} userName={profile?.full_name} />
        <main className="flex-1 overflow-y-auto">
          {renderContent()}
        </main>
      </div>
    </div>
  );
};

export default Index;
