import React from 'react';
import {
  LayoutDashboard,
  Briefcase,
  ShieldAlert,
  TrendingUp,
  Video,
  History,
  Search,
  Zap,
  Activity,
  Bookmark,
  ClipboardList
} from 'lucide-react';
import { cn } from '../lib/utils';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (t: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab }) => (
  <aside className="w-64 bg-white border-r border-slate-200 p-6 flex flex-col h-screen sticky top-0 shrink-0">
    <div className="flex items-center gap-3 mb-10 text-ares-dark-green">
      <div className="bg-ares-green/20 p-2 rounded-lg">
        <TrendingUp className="w-6 h-6" />
      </div>
      <h1 className="text-xl font-bold text-slate-900 font-display">Ares</h1>
    </div>
    <nav className="space-y-2 flex-1">
      {[
        { id: 'dashboard', icon: LayoutDashboard, label: 'Dashboard' },
        { id: 'saved', icon: Bookmark, label: 'Saved Portfolios' },
        { id: 'portfolio', icon: Briefcase, label: 'Portfolio Builder' },
        { id: 'backtest', icon: History, label: 'Backtesting' },
        { id: 'indices', icon: Search, label: 'Indices Search' },
        { id: 'polymarket', icon: Zap, label: 'Polymarket Alpha' },
        { id: 'savedTrades', icon: ClipboardList, label: 'Strategy Tracker' },
        { id: 'veo', icon: Video, label: 'AI Video (Veo)' },
      ].map((item) => (
        <button
          key={item.id}
          onClick={() => setActiveTab(item.id)}
          className={cn(
            "w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200",
            activeTab === item.id
              ? "bg-ares-green/10 text-ares-dark-green font-bold"
              : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
          )}
        >
          <item.icon className="w-5 h-5" />
          {item.label}
        </button>
      ))}
    </nav>
    <div className="mt-auto pt-6 border-t border-slate-100">
      <div className="bg-slate-900 rounded-2xl p-4 text-white">
        <p className="text-xs text-slate-400 mb-1 font-black tracking-widest uppercase">Pro Plan</p>
        <p className="text-sm font-bold mb-3">Unlimited Optimization</p>
        <button className="w-full py-2 bg-ares-green text-slate-900 text-[10px] font-black uppercase tracking-widest rounded-lg">Upgrade</button>
      </div>
    </div>
  </aside>
);
