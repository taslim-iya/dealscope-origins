import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Building2,
  Users,
  Kanban,
  Send,
  Globe,
  Settings,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

const NAV_ITEMS = [
  { label: 'Dashboard', icon: LayoutDashboard, path: '/' },
  { label: 'Companies', icon: Building2, path: '/companies' },
  { label: 'Clients', icon: Users, path: '/clients' },
  { label: 'Pipeline', icon: Kanban, path: '/pipeline' },
  { label: 'Outreach', icon: Send, path: '/outreach' },
  { label: 'On-Market', icon: Globe, path: '/on-market' },
  { label: 'Settings', icon: Settings, path: '/settings' },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();

  return (
    <div className="min-h-screen flex" style={{ background: '#F6F9FC', fontFamily: 'Inter, system-ui, sans-serif' }}>
      {/* Sidebar */}
      <aside
        className="sticky top-0 h-screen flex flex-col bg-white transition-all duration-200 z-40"
        style={{
          width: collapsed ? 64 : 240,
          borderRight: '1px solid #E3E8EE',
          boxShadow: '1px 0 3px rgba(0,0,0,0.03)',
        }}
      >
        {/* Logo */}
        <div className="h-16 flex items-center px-4 gap-2" style={{ borderBottom: '1px solid #E3E8EE' }}>
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
            style={{ background: '#635BFF' }}
          >
            D
          </div>
          {!collapsed && (
            <span className="text-base font-bold" style={{ color: '#0A2540' }}>
              Deal<span style={{ color: '#635BFF' }}>Scope</span>
            </span>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 py-3 px-2 space-y-1">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path ||
              (item.path !== '/' && location.pathname.startsWith(item.path));
            return (
              <Link
                key={item.path}
                to={item.path}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors"
                style={{
                  background: isActive ? '#F0EEFF' : 'transparent',
                  color: isActive ? '#635BFF' : '#596880',
                }}
                title={collapsed ? item.label : undefined}
              >
                <Icon className="h-5 w-5 flex-shrink-0" />
                {!collapsed && <span>{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        {/* Collapse toggle */}
        <div className="p-2" style={{ borderTop: '1px solid #E3E8EE' }}>
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="flex items-center justify-center w-full py-2 rounded-lg hover:bg-gray-50 transition-colors"
            style={{ color: '#596880' }}
          >
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {children}
      </div>
    </div>
  );
}
