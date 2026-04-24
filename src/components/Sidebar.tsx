'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Brain,
  ListOrdered,
  TrendingUp,
  RotateCcw,
  BookmarkCheck,
  Settings,
  Zap,
} from 'lucide-react';

const navItems = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/mentor', label: 'AI Mentor', icon: Brain },
  { href: '/ladder', label: 'Practice Ladder', icon: ListOrdered },
  { href: '/progress', label: 'Progress', icon: TrendingUp },
  { href: '/review', label: 'Review Queue', icon: RotateCcw },
  { href: '/ladder/saved', label: 'Saved Ladders', icon: BookmarkCheck },
  { href: '/settings', label: 'Settings', icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="sidebar" id="sidebar">
      <div className="sidebar-header">
        <div className="sidebar-logo">
          <Zap size={18} />
        </div>
        <span className="sidebar-title">CF Coach</span>
      </div>

      <nav className="sidebar-nav">
        {navItems.map((item) => {
          const isActive = pathname === item.href ||
            (item.href !== '/' && pathname.startsWith(item.href));
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`nav-item ${isActive ? 'active' : ''}`}
            >
              <Icon size={20} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="sidebar-footer">
        <div className="text-xs text-muted" style={{ lineHeight: 1.5 }}>
          <div className="font-semibold" style={{ color: 'var(--text-secondary)' }}>
            ZeoDraxyl
          </div>
          <div>Specialist • 1522</div>
        </div>
      </div>
    </aside>
  );
}
