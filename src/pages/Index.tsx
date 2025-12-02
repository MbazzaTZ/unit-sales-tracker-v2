import { useState } from 'react';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import { AdminDashboard } from '@/components/views/AdminDashboard';
import { TLDashboard } from '@/components/views/TLDashboard';
import { DSRDashboard } from '@/components/views/DSRDashboard';
import { DSRStock } from '@/components/views/DSRStock';
import { UserRole } from '@/types/tsm';

const Index = () => {
  const [role, setRole] = useState<UserRole>('admin');
  const [activeTab, setActiveTab] = useState('dashboard');

  const handleRoleChange = (newRole: UserRole) => {
    setRole(newRole);
    setActiveTab('dashboard');
  };

  const renderContent = () => {
    if (role === 'admin') {
      switch (activeTab) {
        case 'dashboard':
          return <AdminDashboard />;
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
