import { NavLink, Outlet } from 'react-router-dom';
import {
  Home,
  Video,
  BookOpen,
  PenTool,
  BarChart3,
  Settings,
} from 'lucide-react';

const navItems = [
  { to: '/', icon: Home, label: '홈' },
  { to: '/videos', icon: Video, label: '영상' },
  { to: '/vocabulary', icon: BookOpen, label: '단어장' },
  { to: '/study', icon: PenTool, label: '학습' },
  { to: '/stats', icon: BarChart3, label: '통계' },
];

export default function Layout() {
  return (
    <div className="flex h-dvh">
      {/* Sidebar - desktop */}
      <nav className="hidden md:flex flex-col w-56 bg-surface border-r border-border shrink-0">
        <div className="px-5 py-6">
          <h1 className="text-lg font-bold text-accent tracking-tight">
            English Lab
          </h1>
          <p className="text-xs text-text-muted mt-0.5">뉴스 영상 영어 학습</p>
        </div>
        <div className="flex-1 px-3 space-y-1">
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                  isActive
                    ? 'bg-accent/15 text-accent font-medium'
                    : 'text-text-muted hover:bg-surface-hover hover:text-text'
                }`
              }
            >
              <Icon size={18} />
              {label}
            </NavLink>
          ))}
        </div>
        <div className="px-3 pb-4">
          <NavLink
            to="/settings"
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                isActive
                  ? 'bg-accent/15 text-accent font-medium'
                  : 'text-text-muted hover:bg-surface-hover hover:text-text'
              }`
            }
          >
            <Settings size={18} />
            설정
          </NavLink>
        </div>
      </nav>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>

      {/* Bottom tab bar - mobile */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-surface border-t border-border flex z-50">
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `flex-1 flex flex-col items-center gap-1 py-2.5 text-[10px] transition-colors ${
                isActive ? 'text-accent' : 'text-text-muted'
              }`
            }
          >
            <Icon size={20} />
            {label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
