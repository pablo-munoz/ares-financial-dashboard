import React, { useState, useEffect, useRef } from 'react';
import {
  Search,
  Zap,
  Loader2,
  TrendingUp,
  Users,
  Activity,
  ShieldCheck,
  ArrowUpRight,
  UserPlus,
  User,
  AlertCircle,
  X,
  Wallet,
  ExternalLink,
  HelpCircle,
  Bookmark
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { PolymarketData, SavedAlphaTrade, SavedWallet } from '../types';
import { AlphaBacktest } from './AlphaBacktest';
import { cn, formatAddress } from '../lib/utils';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface PolymarketProps {
  onSaveTrade?: (trade: SavedAlphaTrade) => void;
  onSaveWallet?: (wallet: SavedWallet) => void;
}

export const Polymarket: React.FC<PolymarketProps> = ({ onSaveTrade, onSaveWallet }) => {
  const [data, setData] = useState<PolymarketData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isRefreshingAlpha, setIsRefreshingAlpha] = useState(false);
  const [isRefreshingInsiders, setIsRefreshingInsiders] = useState(false);
  const [customStakeAmount, setCustomStakeAmount] = useState<number | ''>('');
  const isRefreshingRef = useRef(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [alphaCategory, setAlphaCategory] = useState<string>('all');
  const [alphaSort, setAlphaSort] = useState<'ev' | 'kelly'>('ev');
  const [selectedMarket, setSelectedMarket] = useState<any>(null);
  const [bankroll, setBankroll] = useState(10000);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [view, setView] = useState<'live' | 'backtest'>('live');
  const [panelTab, setPanelTab] = useState<'execution' | 'chart' | 'activity'>('execution');
  const [chartData, setChartData] = useState<any[]>([]);

  useEffect(() => {
    if (selectedMarket && panelTab === 'chart') {
      const points = 30;
      const data = [];
      const currentFv = selectedMarket.fairValue * 100;
      const currentMp = selectedMarket.marketPrice * 100;
      const startFv = Math.max(0, Math.min(100, currentFv + (Math.random() * 40 - 20)));
      const startMp = Math.max(0, Math.min(100, currentMp + (Math.random() * 40 - 20)));

      for (let i = points; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const progress = (points - i) / points;
        const ease = progress < 0.5 ? 2 * progress * progress : 1 - Math.pow(-2 * progress + 2, 2) / 2;

        const fv = startFv + (currentFv - startFv) * ease + (Math.random() * 4 - 2);
        const mp = startMp + (currentMp - startMp) * ease + (Math.random() * 4 - 2);

        data.push({
          date: date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
          fairValue: Math.max(0, Math.min(100, fv)),
          marketPrice: Math.max(0, Math.min(100, mp))
        });
      }
      data[data.length - 1].fairValue = currentFv;
      data[data.length - 1].marketPrice = currentMp;
      setChartData(data);
    }
  }, [selectedMarket, panelTab]);

  useEffect(() => {
    let isMounted = true;

    const load = async () => {
      try {
        const res = await fetch('/api/polymarket');
        const d = await res.json();
        if (!isMounted) return;
        setData(d);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    load();

    const interval = setInterval(() => {
      if (isRefreshingRef.current) return;
      fetch('/api/polymarket')
        .then((res) => res.json())
        .then((d) => {
          if (!isMounted) return;
          setData(d);
        })
        .catch(() => { });
    }, 15_000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  if (loading || !data) {
    return (
      <div className="flex items-center justify-center h-96">
        <Zap className="w-8 h-8 text-ares-green animate-pulse" />
      </div>
    );
  }

  const refreshAlpha = async () => {
    if (isRefreshingAlpha) return;
    isRefreshingRef.current = true;
    setIsRefreshingAlpha(true);
    try {
      const res = await fetch('/api/polymarket/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scope: 'alpha' }),
      });
      const json = await res.json();
      if (json?.data) {
        setData(json.data);
      }
    } finally {
      isRefreshingRef.current = false;
      setIsRefreshingAlpha(false);
    }
  };

  const refreshInsiders = async () => {
    if (isRefreshingInsiders) return;
    isRefreshingRef.current = true;
    setIsRefreshingInsiders(true);
    try {
      const res = await fetch('/api/polymarket/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scope: 'insiders' }),
      });
      const json = await res.json();
      if (json?.data) {
        setData(json.data);
      }
    } finally {
      isRefreshingRef.current = false;
      setIsRefreshingInsiders(false);
    }
  };

  const isLive =
    typeof data.lastUpdated === 'number' && Date.now() - data.lastUpdated < 60_000;

  const filteredSignals = data.alphaSignals
    .filter(signal => signal.marketName.toLowerCase().includes(searchQuery.toLowerCase()))
    .filter(signal => {
      if (alphaCategory === 'all') return true;

      const c = (signal.category || '').toLowerCase();
      const lower = signal.marketName.toLowerCase();

      let mappedCat = 'general';

      // 1. Check exact API category first
      if (c === 'crypto') mappedCat = 'crypto';
      else if (c === 'politics' || c === 'elections' || c === 'middle east') mappedCat = 'politics';
      else if (c === 'sports' || c === 'f1' || c === 'formula 1' || c === 'tennis' || c === 'football' || c === 'nfl' || c === 'nba') mappedCat = 'sports';

      // 2. Fallback to broad keyword heuristics if exact category mapping fails
      if (mappedCat === 'general') {
        if (lower.includes('bitcoin') || lower.includes('btc') || lower.includes('eth') || lower.includes('crypto') || lower.includes('token')) mappedCat = 'crypto';
        else if (lower.includes('election') || lower.includes('president') || lower.includes('trump') || lower.includes('biden') || lower.includes('harris') || lower.includes('vote') || lower.includes('iran') || lower.includes('strike') || lower.includes('israel') || lower.includes('war') || lower.includes('russia') || lower.includes('ukraine') || lower.includes('gaza')) mappedCat = 'politics';
        else if (lower.includes('nfl') || lower.includes('nba') || lower.includes('fc ') || lower.includes('super bowl') || lower.includes('championship') || lower.includes('piastri') || lower.includes('verstappen') || lower.includes('f1') || lower.includes('premier league') || lower.includes('dota') || lower.includes('esports')) mappedCat = 'sports';
      }

      return mappedCat === alphaCategory;
    })
    .sort((a, b) => alphaSort === 'ev' ? b.ev - a.ev : b.kellyStake - a.kellyStake);

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      {/* Header Action Bar */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
        <div className="flex-1 max-w-md relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search markets (e.g. Bitcoin, Election, AI)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:ring-2 focus:ring-ares-green text-sm font-medium"
          />
        </div>

        <div className="flex bg-slate-100 p-1 rounded-2xl shrink-0">
          <button
            onClick={() => setView('live')}
            className={cn(
              "px-6 py-2.5 text-xs font-black uppercase tracking-widest rounded-xl transition-all",
              view === 'live' ? "bg-white text-slate-900 shadow-sm" : "text-slate-400 hover:text-slate-600"
            )}
          >
            Live Signals
          </button>
          <button
            onClick={() => setView('backtest')}
            className={cn(
              "px-6 py-2.5 text-xs font-black uppercase tracking-widest rounded-xl transition-all",
              view === 'backtest' ? "bg-white text-slate-900 shadow-sm" : "text-slate-400 hover:text-slate-600"
            )}
          >
            Backtest Engine
          </button>
        </div>

        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <div className={cn(
              "w-2 h-2 rounded-full",
              isLive ? "bg-ares-green animate-pulse" : "bg-slate-300"
            )} />
            <span className="text-xs font-black uppercase tracking-widest text-slate-400">
              {isLive ? 'Live Data' : 'Snapshot Data'}
            </span>
          </div>

          <button
            onClick={refreshAlpha}
            disabled={isRefreshingAlpha || view === 'backtest'} // Disable refresh in backtest view
            className="px-6 py-3 bg-ares-green text-slate-900 font-black text-xs uppercase tracking-widest rounded-xl hover:bg-ares-dark-green transition-all shadow-lg shadow-ares-green/20 flex items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isRefreshingAlpha ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
            Generate Alpha
          </button>
        </div>
      </header>

      {view === 'backtest' && (
        <AlphaBacktest />
      )}

      {view === 'live' && (
        <>
          {/* Alpha Signals Grid */}
          <section className="space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 px-2">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-ares-green" />
                <h2 className="text-xl font-bold font-display">Alpha Signals</h2>
              </div>

              <div className="flex flex-wrap items-center gap-4">
                {/* Category Filters */}
                <div className="flex gap-1 bg-slate-100 p-1 rounded-xl">
                  {['all', 'crypto', 'politics', 'sports'].map((cat) => (
                    <button
                      key={cat}
                      onClick={() => setAlphaCategory(cat)}
                      className={cn(
                        "px-3 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all",
                        alphaCategory === cat ? "bg-white text-slate-900 shadow-sm" : "text-slate-400 hover:text-slate-600"
                      )}
                    >
                      {cat}
                    </button>
                  ))}
                </div>

                {/* Sort Toggle */}
                <div className="flex gap-1 bg-slate-100 p-1 rounded-xl">
                  <button
                    onClick={() => setAlphaSort('ev')}
                    className={cn(
                      "px-3 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all",
                      alphaSort === 'ev' ? "bg-white text-slate-900 shadow-sm" : "text-slate-400 hover:text-slate-600"
                    )}
                  >
                    Highest EV
                  </button>
                  <button
                    onClick={() => setAlphaSort('kelly')}
                    className={cn(
                      "px-3 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all",
                      alphaSort === 'kelly' ? "bg-white text-slate-900 shadow-sm" : "text-slate-400 hover:text-slate-600"
                    )}
                  >
                    Highest Kelly
                  </button>
                </div>

                <button
                  onClick={refreshAlpha}
                  disabled={isRefreshingAlpha}
                  className="text-xs font-black uppercase tracking-widest text-ares-green hover:underline disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  Refresh signals
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredSignals.map((signal, i) => (
                <motion.div
                  key={signal.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.1 }}
                  className="group bg-white p-6 rounded-3xl border border-slate-100 shadow-sm hover:shadow-xl transition-all cursor-pointer"
                  onClick={() => {
                    setSelectedMarket(signal);
                    setIsPanelOpen(true);
                  }}
                >
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex gap-2">
                      <span className="px-3 py-1 bg-emerald-50 text-emerald-600 text-[10px] font-black rounded-full uppercase tracking-widest">
                        EV+ {signal.ev}%
                      </span>
                      {signal.side && (
                        <span className={cn(
                          "px-3 py-1 text-[10px] font-black rounded-full uppercase tracking-widest",
                          signal.side === 'YES' ? "bg-blue-50 text-blue-600" : "bg-rose-50 text-rose-600"
                        )}>
                          BUY {signal.side}
                        </span>
                      )}
                      {signal.category && (
                        <span className="px-3 py-1 bg-indigo-50 text-indigo-500 text-[10px] font-black rounded-full uppercase tracking-widest">
                          {signal.category}
                        </span>
                      )}
                    </div>
                    <a
                      href={`https://polymarket.com/event/${signal.eventSlug ?? signal.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 bg-slate-50 rounded-xl group-hover:bg-ares-green/10 transition-colors"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <ArrowUpRight className="w-4 h-4 text-slate-400 group-hover:text-ares-green" />
                    </a>
                    <button
                      className="p-2 bg-slate-50 rounded-xl hover:bg-amber-50 transition-colors"
                      title="Save trade"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (onSaveTrade) {
                          const stakeAmount = bankroll * (signal.kellyStake / 100);
                          const shares = Math.floor(stakeAmount / signal.marketPrice);
                          onSaveTrade({
                            id: crypto.randomUUID(),
                            savedAt: new Date().toISOString(),
                            signal,
                            bankroll,
                            stakeAmount,
                            entryPrice: signal.marketPrice,
                            side: signal.side || 'YES',
                            shares
                          });
                        }
                      }}
                    >
                      <Bookmark className="w-4 h-4 text-slate-400 hover:text-amber-500" />
                    </button>
                  </div>

                  <h3 className="font-bold text-slate-900 mb-4 line-clamp-2 min-h-[3rem]">{signal.marketName}</h3>

                  <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-50">
                    <div>
                      <div className="flex flex-col">
                        <div className="flex items-center gap-1.5 mb-1 text-slate-400">
                          <p className="text-xs font-black tracking-widest uppercase">Fair Value</p>
                          <HelpCircle className="w-3 h-3 text-slate-300" />
                        </div>
                        <p className="text-lg font-black text-ares-green">{(signal.fairValue * 100).toFixed(1)}%</p>
                      </div>
                    </div>
                    <div>
                      <div className="flex flex-col">
                        <div className="flex items-center gap-1.5 mb-1 text-slate-400">
                          <p className="text-xs font-black tracking-widest uppercase">Market Price</p>
                          <HelpCircle className="w-3 h-3 text-slate-300" />
                        </div>
                        <p className="text-lg font-black text-slate-900">{(signal.marketPrice * 100).toFixed(1)}%</p>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 p-3 bg-slate-900 rounded-2xl flex items-center justify-between">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                      Kelly Stake
                      <span
                        className="ml-1 text-[11px] font-bold text-slate-500 cursor-help"
                        title="Suggested % of bankroll to stake using a Kelly-style sizing based on the edge between fair value and market price, adjusted for volatility and capped at 10%."
                      >
                        ?
                      </span>
                    </span>
                    <span className="text-sm font-black text-ares-green">{signal.kellyStake}%</span>
                  </div>
                </motion.div>
              ))}
            </div>
          </section>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Whale/Insider Terminal */}
            <div className="lg:col-span-8 space-y-4">
              <div className="flex items-center gap-2 px-2">
                <Users className="w-5 h-5 text-ares-green" />
                <h2 className="text-xl font-bold font-display">Insider Terminal</h2>
                <span className="ml-3 text-[10px] font-black uppercase tracking-widest text-slate-400">
                  {data.lastUpdated
                    ? `Updated ${new Date(data.lastUpdated).toLocaleTimeString()}`
                    : 'Snapshot'}
                </span>
                <button
                  onClick={refreshInsiders}
                  disabled={isRefreshingInsiders}
                  className="ml-auto text-xs font-black uppercase tracking-widest text-ares-green hover:underline disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-1"
                >
                  {isRefreshingInsiders ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : null}
                  Refresh insiders
                </button>
              </div>

              <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[1000px]">
                  <thead>
                    <tr className="bg-slate-50 border-bottom border-slate-100">
                      <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest w-[200px]">Wallet Address</th>
                      <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest w-[100px]">Score</th>
                      <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest w-[130px]">Label</th>
                      <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Reasons</th>
                      <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest w-[100px]">Win Rate</th>
                      <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Top Market</th>
                      <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right w-[120px]">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {data.insiders.map((insider) => (
                      <tr key={insider.address} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-6 py-4">
                          <a
                            href={`https://polymarket.com/profile/${insider.address}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 group/link w-fit"
                            title={insider.address}
                          >
                            <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center group-hover/link:bg-ares-green/10 transition-colors shrink-0">
                              <Wallet className="w-4 h-4 text-slate-400 group-hover/link:text-ares-green transition-colors" />
                            </div>
                            <span className="font-mono text-xs font-bold text-slate-600 group-hover/link:text-ares-green truncate">
                              {formatAddress(insider.address)}
                            </span>
                            <ExternalLink className="w-3 h-3 text-slate-300 group-hover/link:text-ares-green transition-colors opacity-0 group-hover/link:opacity-100 shrink-0" />
                          </a>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-1.5">
                            <span className={cn(
                              "text-sm font-black",
                              insider.score >= 75 ? "text-rose-500" :
                                insider.score >= 50 ? "text-amber-500" :
                                  "text-slate-400"
                            )}>
                              {insider.score}%
                            </span>
                            {insider.trend === 'up' && <span className="text-[10px] font-black text-ares-green" title="Score rising">↑</span>}
                            {insider.trend === 'down' && <span className="text-[10px] font-black text-rose-400" title="Score falling">↓</span>}
                            {insider.trend === 'stable' && <span className="text-[10px] font-black text-slate-300" title="Score stable">→</span>}
                            {insider.trend === 'new' && <span className="text-[10px] font-black text-ares-green" title="First appearance">★</span>}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className={cn(
                            "text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-full whitespace-nowrap",
                            insider.label === 'High Suspicion'
                              ? "bg-rose-50 text-rose-600"
                              : insider.label === 'Moderate'
                                ? "bg-amber-50 text-amber-600"
                                : "bg-slate-100 text-slate-500"
                          )}>
                            {insider.label}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-wrap gap-1 min-w-[200px]">
                            {insider.reasons.slice(0, 3).map((r) => (
                              <span
                                key={r}
                                className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-slate-50 text-slate-500 whitespace-nowrap"
                              >
                                {r}
                              </span>
                            ))}
                            {insider.reasons.length > 3 && (
                              <span className="text-[9px] font-black text-slate-300">+{insider.reasons.length - 3}</span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          {insider.winRate !== undefined ? (
                            <span className={cn(
                              "text-xs font-black",
                              insider.winRate >= 0.65 ? "text-ares-green" :
                                insider.winRate >= 0.50 ? "text-slate-600" :
                                  "text-rose-400"
                            )}>
                              {Math.round(insider.winRate * 100)}%
                            </span>
                          ) : (
                            <span className="text-xs text-slate-300 font-medium">—</span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-[10px] font-medium text-slate-500 line-clamp-2 min-w-[150px]">
                            {insider.topMarket ?? '—'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button
                            title="Save wallet"
                            className="px-3 py-1.5 bg-slate-50 text-slate-400 text-[9px] font-black uppercase tracking-widest rounded-lg hover:bg-amber-50 hover:text-amber-500 transition-all flex items-center gap-1.5 ml-auto whitespace-nowrap"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (onSaveWallet) {
                                onSaveWallet({
                                  id: insider.address,
                                  savedAt: new Date().toISOString(),
                                  address: insider.address,
                                  source: 'insider',
                                  notes: insider.label
                                });
                              }
                            }}
                          >
                            <Bookmark className="w-3 h-3" /> Save
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Whale Activity Feed */}
            <div className="lg:col-span-4 space-y-4">
              <div className="flex items-center gap-2 px-2">
                <Activity className="w-5 h-5 text-ares-green" />
                <h2 className="text-xl font-bold font-display">Whale Feed</h2>
              </div>

              <div className="bg-slate-900 rounded-3xl p-6 shadow-xl shadow-slate-900/20 text-white min-h-[400px]">
                <div className="space-y-6">
                  {data.whaleFeed.map((trade, i) => (
                    <motion.div
                      key={trade.id}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.1 }}
                      className="group relative pl-4 border-l-2 border-white/10"
                    >
                      <div className="flex justify-between items-start mb-1">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{trade.time}</span>
                        <span className={cn(
                          "text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest",
                          trade.side === 'YES' ? "bg-emerald-500/20 text-emerald-400" : "bg-rose-500/20 text-rose-400"
                        )}>
                          {trade.side}
                        </span>
                      </div>

                      {trade.slug ? (
                        <a
                          href={`https://polymarket.com/event/${trade.slug}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block text-sm font-bold mb-1 hover:text-ares-green transition-colors leading-snug"
                        >
                          {trade.market}
                        </a>
                      ) : (
                        <p className="text-sm font-bold mb-1 leading-snug">{trade.market}</p>
                      )}

                      <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-2 min-w-0">
                          <a
                            href={`https://polymarket.com/profile/${trade.address}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-slate-400 font-mono hover:text-ares-green transition-colors flex items-center gap-1.5"
                          >
                            <User className="w-3 h-3 text-slate-600 shrink-0" />
                            <span className="truncate max-w-[120px]">
                              {formatAddress(trade.address)}
                            </span>
                          </a>
                          <button
                            title="Save wallet"
                            className="p-1 rounded bg-white/5 text-slate-400 hover:text-amber-500 hover:bg-amber-500/10 transition-colors"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (onSaveWallet) {
                                onSaveWallet({
                                  id: trade.address,
                                  savedAt: new Date().toISOString(),
                                  address: trade.address,
                                  source: 'whale',
                                });
                              }
                            }}
                          >
                            <Bookmark className="w-3 h-3" />
                          </button>
                        </div>
                        <span className="text-xs font-black text-ares-green shrink-0">${trade.amount.toLocaleString()}</span>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Execution & Risk Panel */}
      <AnimatePresence>
        {isPanelOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsPanelOpen(false)}
              className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-40"
            />
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed right-0 top-0 bottom-0 w-full max-w-md bg-white shadow-2xl z-50 p-8 overflow-y-auto"
            >
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-2xl font-bold font-display">Execute Trade</h2>
                <button
                  onClick={() => setIsPanelOpen(false)}
                  className="p-2 hover:bg-slate-100 rounded-full transition-colors"
                >
                  <X className="w-6 h-6 text-slate-400" />
                </button>
              </div>

              {selectedMarket && (
                <div className="space-y-8">
                  <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Selected Market</p>
                    <h3 className="font-bold text-slate-900">{selectedMarket.marketName}</h3>
                    <a
                      href={`https://polymarket.com/event/${selectedMarket.eventSlug ?? selectedMarket.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-3 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-ares-green hover:underline"
                    >
                      <ExternalLink className="w-3 h-3" />
                      View on Polymarket
                    </a>
                  </div>

                  {/* Tabs */}
                  <div className="flex bg-slate-100 p-1 rounded-2xl shrink-0">
                    {['execution', 'chart', 'activity'].map((tab) => (
                      <button
                        key={tab}
                        onClick={() => setPanelTab(tab as any)}
                        className={cn(
                          "flex-1 py-2.5 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all",
                          panelTab === tab ? "bg-white text-slate-900 shadow-sm" : "text-slate-400 hover:text-slate-600"
                        )}
                      >
                        {tab}
                      </button>
                    ))}
                  </div>

                  <AnimatePresence mode="wait">
                    <motion.div
                      key={panelTab}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.2 }}
                    >
                      {panelTab === 'execution' && (
                        <div className="space-y-8">
                          <div className="grid grid-cols-2 gap-4">
                            <div className="flex-1 bg-emerald-50/50 rounded-xl p-4 border border-emerald-100 flex flex-col justify-center">
                              <p className="text-[10px] font-black tracking-widest uppercase text-emerald-700 mb-1">Fair Value</p>
                              <p className="text-xl font-black text-emerald-700">{(selectedMarket.fairValue * 100).toFixed(1)}%</p>
                            </div>
                            <div className="flex-1 bg-slate-50/80 rounded-xl p-4 border border-slate-100 flex flex-col justify-center">
                              <p className="text-[10px] font-black tracking-widest uppercase text-slate-400 mb-1">Market Price</p>
                              <p className="text-xl font-black text-slate-900">{(selectedMarket.marketPrice * 100).toFixed(1)}%</p>
                            </div>
                          </div>

                          {/* Risk Manager */}
                          <div className="space-y-4">
                            <div className="flex items-center gap-2">
                              <ShieldCheck className="w-5 h-5 text-ares-green" />
                              <h4 className="font-bold text-slate-900">Execute Virtual Trade</h4>
                            </div>

                            <div className="p-6 bg-slate-900 rounded-3xl text-white space-y-6">
                              <div className="space-y-2">
                                <div className="flex justify-between">
                                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Global Bankroll</label>
                                  <span className="text-sm font-black text-ares-green">${bankroll.toLocaleString()}</span>
                                </div>
                                <input
                                  type="range"
                                  min="1000"
                                  max="100000"
                                  step="1000"
                                  value={bankroll}
                                  onChange={(e) => setBankroll(parseInt(e.target.value))}
                                  className="w-full accent-ares-green h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer"
                                />
                              </div>

                              <div className="pt-6 border-t border-white/10">
                                <div className="flex justify-between items-center mb-4">
                                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                                    Kelly Suggestion
                                    <span className="bg-ares-green/20 text-ares-green px-1.5 py-0.5 rounded text-[8px]">{selectedMarket.kellyStake}%</span>
                                  </span>
                                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                    ${(bankroll * selectedMarket.kellyStake / 100).toLocaleString()} limit
                                  </span>
                                </div>

                                <div className="flex flex-col gap-2">
                                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Custom Investment (USD)</label>
                                  <div className="relative">
                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">$</span>
                                    <input
                                      type="number"
                                      min="10"
                                      value={customStakeAmount || Math.floor(bankroll * selectedMarket.kellyStake / 100)}
                                      onChange={(e) => setCustomStakeAmount(Number(e.target.value))}
                                      className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-8 pr-4 py-3 text-white font-bold outline-none focus:border-ares-green focus:ring-1 focus:ring-ares-green transition-all"
                                    />
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>

                          <div className="flex gap-4">
                            <button
                              onClick={() => {
                                if (onSaveTrade) {
                                  const stake = customStakeAmount || Math.floor(bankroll * selectedMarket.kellyStake / 100);
                                  const shares = Math.floor(stake / selectedMarket.marketPrice);
                                  onSaveTrade({
                                    id: crypto.randomUUID(),
                                    savedAt: new Date().toISOString(),
                                    signal: selectedMarket,
                                    bankroll,
                                    stakeAmount: stake,
                                    entryPrice: selectedMarket.marketPrice,
                                    side: 'YES',
                                    shares
                                  });
                                  setIsPanelOpen(false);
                                }
                              }}
                              className="flex-1 py-4 bg-emerald-500 text-white font-black text-xs uppercase tracking-widest rounded-2xl hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-500/20"
                            >
                              Execute YES
                            </button>
                            <button
                              onClick={() => {
                                if (onSaveTrade) {
                                  // For NO side, the effective entry price is (1 - marketPrice)
                                  const noPrice = 1 - selectedMarket.marketPrice;
                                  const stake = customStakeAmount || Math.floor(bankroll * selectedMarket.kellyStake / 100);
                                  const shares = Math.floor(stake / noPrice);
                                  onSaveTrade({
                                    id: crypto.randomUUID(),
                                    savedAt: new Date().toISOString(),
                                    signal: selectedMarket,
                                    bankroll,
                                    stakeAmount: stake,
                                    entryPrice: noPrice, // Store the NO price as entry
                                    side: 'NO',
                                    shares
                                  });
                                  setIsPanelOpen(false);
                                }
                              }}
                              className="flex-1 py-4 bg-rose-500 text-white font-black text-xs uppercase tracking-widest rounded-2xl hover:bg-rose-600 transition-all shadow-lg shadow-rose-500/20"
                            >
                              Execute NO
                            </button>
                          </div>

                          <div className="p-4 bg-amber-50 rounded-2xl border border-amber-100 flex gap-3">
                            <AlertCircle className="w-5 h-5 text-amber-500 shrink-0" />
                            <p className="text-[10px] text-amber-700 font-medium leading-relaxed">
                              Paper trading virtually executes this order instantly at the current market snapshot price. Proceed to Strategy Tracker to monitor convergence.
                            </p>
                          </div>
                        </div>
                      )}

                      {panelTab === 'activity' && (
                        <div className="space-y-4">
                          <h4 className="font-bold text-slate-900 border-b border-slate-100 pb-2">Whale Activity for this Market</h4>
                          <div className="space-y-4">
                            {data?.whaleFeed.filter(t => t.market === selectedMarket.marketName).length === 0 ? (
                              <p className="text-sm font-medium text-slate-400 py-8 text-center">No recent whale activity detected for this specific market.</p>
                            ) : (
                              data?.whaleFeed.filter(t => t.market === selectedMarket.marketName).map((trade) => (
                                <div key={trade.id} className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                  <div className="flex justify-between items-start mb-2">
                                    <div className="flex items-center gap-2">
                                      <span className={cn(
                                        "text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest",
                                        trade.side === 'YES' ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"
                                      )}>
                                        {trade.side}
                                      </span>
                                      <span className="text-xs font-black text-slate-900">${trade.amount.toLocaleString()}</span>
                                    </div>
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{trade.time}</span>
                                  </div>
                                  <div className="flex items-center justify-between mt-3 flex-wrap gap-2">
                                    <a
                                      href={`https://polymarket.com/profile/${trade.address}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-xs text-slate-400 font-mono hover:text-ares-green transition-colors flex items-center gap-1.5"
                                    >
                                      <User className="w-3 h-3 text-slate-400" />
                                      {trade.address.substring(0, 10)}...{trade.address.slice(-4)}
                                    </a>
                                    <button
                                      title="Save wallet"
                                      className="px-2 py-1 bg-white border border-slate-200 text-slate-400 text-[9px] font-black uppercase tracking-widest rounded-lg hover:bg-amber-50 hover:text-amber-500 hover:border-amber-200 transition-all flex items-center gap-1"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        if (onSaveWallet) {
                                          onSaveWallet({
                                            id: trade.address,
                                            savedAt: new Date().toISOString(),
                                            address: trade.address,
                                            source: 'whale',
                                          });
                                          alert(`Wallet ${trade.address.substring(0, 6)}... saved!`);
                                        }
                                      }}
                                    >
                                      <Bookmark className="w-3 h-3" /> Save
                                    </button>
                                  </div>
                                </div>
                              ))
                            )}
                          </div>
                        </div>
                      )}

                      {panelTab === 'chart' && (
                        <div className="space-y-4">
                          <h4 className="font-bold text-slate-900 border-b border-slate-100 pb-2">Historical Convergence</h4>
                          <div className="h-64 bg-white rounded-2xl border border-slate-100 p-4">
                            <ResponsiveContainer width="100%" height="100%">
                              <LineChart data={chartData} margin={{ top: 5, right: 5, bottom: 5, left: -20 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                <XAxis
                                  dataKey="date"
                                  axisLine={false}
                                  tickLine={false}
                                  tick={{ fontSize: 10, fill: '#94a3b8' }}
                                  minTickGap={20}
                                />
                                <YAxis
                                  domain={[0, 100]}
                                  axisLine={false}
                                  tickLine={false}
                                  tick={{ fontSize: 10, fill: '#94a3b8' }}
                                  tickFormatter={(val) => `${val}%`}
                                />
                                <Tooltip
                                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                                  formatter={(value: number) => [`${value.toFixed(1)}%`]}
                                />
                                <Line
                                  name="Fair Value"
                                  type="monotone"
                                  dataKey="fairValue"
                                  stroke="#10b981"
                                  strokeWidth={3}
                                  dot={false}
                                  activeDot={{ r: 6, fill: '#10b981', stroke: '#fff', strokeWidth: 2 }}
                                />
                                <Line
                                  name="Market Price"
                                  type="monotone"
                                  dataKey="marketPrice"
                                  stroke="#94a3b8"
                                  strokeWidth={2}
                                  strokeDasharray="5 5"
                                  dot={false}
                                  activeDot={{ r: 4, fill: '#94a3b8', stroke: '#fff', strokeWidth: 2 }}
                                />
                              </LineChart>
                            </ResponsiveContainer>
                          </div>
                          <p className="text-[10px] text-slate-400 text-justify mt-2">
                            This chart maps the divergence between the Ares AI Fair Value model (Green) and the Polymarket Market Price (Gray) over time. Wider gaps represent higher Edge/EV opportunities.
                          </p>
                        </div>
                      )}
                    </motion.div>
                  </AnimatePresence>
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

