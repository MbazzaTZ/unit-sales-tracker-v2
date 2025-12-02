import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import { AdminDashboard } from '@/components/views/AdminDashboard';
import { TLDashboard } from '@/components/views/TLDashboard';
import { DSRDashboard } from '@/components/views/DSRDashboard';
import { DSRStock } from '@/components/views/DSRStock';
import { AdminStockManagement } from '@/components/views/AdminStockManagement';
import { AdminTLManagement } from '@/components/views/AdminTLManagement';
import { AdminAssignStock } from '@/components/views/AdminAssignStock';
import { AdminApprovals } from '@/components/views/AdminApprovals';
import { useAuth } from '@/contexts/AuthContext';
import { UserRole } from '@/types/tsm';
import { Loader2 } from 'lucide-react';

const Index = () => {
  const { user, userRole, loading } = useAuth();
  const navigate = useNavigate();
  const [role, setRole] = useState<UserRole>('admin');
  const [activeTab, setActiveTab] = useState('dashboard');

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    if (userRole) {
      setRole(userRole);
    }
  }, [userRole]);

  const handleRoleChange = (newRole: UserRole) => {
    setRole(newRole);
    setActiveTab('dashboard');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) return null;

  const renderContent = () => {
    if (role === 'admin') {
      switch (activeTab) {
        case 'dashboard':
          return <AdminDashboard />;
        case 'stock':
          return <AdminStockManagement />;
        case 'assign':
          return <AdminAssignStock />;
        case 'tls':
          return <AdminTLManagement />;
        case 'approvals':
          return <AdminApprovals />;
        default:
          return <AdminDashboard />;
      }
    }

    if (role === 'tl') {
      switch (activeTab) {
        case 'dashboard':
          return <TLDashboard onNavigate={setActiveTab} />;
        default:
          return <TLDashboard onNavigate={setActiveTab} />;
      }
    }

    if (role === 'dsr') {
      switch (activeTab) {
        case 'dashboard':
          return <DSRDashboard onNavigate={setActiveTab} />;
        case 'stock':
          return <DSRStock />;
        default:
          return <DSRDashboard onNavigate={setActiveTab} />;
      }
    }

    return <AdminDashboard />;
  };

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <Sidebar 
        role={role} 
        activeTab={activeTab} 
        onTabChange={setActiveTab} 
      />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header role={role} onRoleChange={handleRoleChange} />
        <main className="flex-1 overflow-y-auto">
          {renderContent()}
        </main>
      </div>
    </div>
  );
};

export default Index;
