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
  ExternalLink
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { PolymarketData } from '../types';
import { cn } from '../lib/utils';

export const Polymarket: React.FC = () => {
  const [data, setData] = useState<PolymarketData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isRefreshingAlpha, setIsRefreshingAlpha] = useState(false);
  const [isRefreshingInsiders, setIsRefreshingInsiders] = useState(false);
  const isRefreshingRef = useRef(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMarket, setSelectedMarket] = useState<any>(null);
  const [bankroll, setBankroll] = useState(10000);
  const [isPanelOpen, setIsPanelOpen] = useState(false);

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

  const filteredSignals = data.alphaSignals.filter(signal =>
    signal.marketName.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
            disabled={isRefreshingAlpha}
            className="px-6 py-3 bg-ares-green text-slate-900 font-black text-xs uppercase tracking-widest rounded-xl hover:bg-ares-dark-green transition-all shadow-lg shadow-ares-green/20 flex items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isRefreshingAlpha ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
            Generate Alpha
          </button>
        </div>
      </header>

      {/* Alpha Signals Grid */}
      <section className="space-y-4">
        <div className="flex items-center gap-2 px-2">
          <TrendingUp className="w-5 h-5 text-ares-green" />
          <h2 className="text-xl font-bold font-display">Alpha Signals</h2>
          <button
            onClick={refreshAlpha}
            disabled={isRefreshingAlpha}
            className="ml-auto text-xs font-black uppercase tracking-widest text-ares-green hover:underline disabled:opacity-60 disabled:cursor-not-allowed"
          >
            Refresh signals
          </button>
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
                <span className="px-3 py-1 bg-emerald-50 text-emerald-600 text-[10px] font-black rounded-full uppercase tracking-widest">
                  EV+ {signal.ev}%
                </span>
                <div className="p-2 bg-slate-50 rounded-xl group-hover:bg-ares-green/10 transition-colors">
                  <ArrowUpRight className="w-4 h-4 text-slate-400 group-hover:text-ares-green" />
                </div>
              </div>

              <h3 className="font-bold text-slate-900 mb-4 line-clamp-2 min-h-[3rem]">{signal.marketName}</h3>

              <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-50">
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
                    Fair Value
                    <span
                      className="ml-1 text-[11px] font-bold text-slate-300 cursor-help"
                      title="Model-implied probability based on longer-term price action and aggregated trade flow."
                    >
                      ?
                    </span>
                  </p>
                  <p className="text-lg font-black text-ares-green">{(signal.fairValue * 100).toFixed(0)}%</p>
                </div>
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
                    Market Price
                    <span
                      className="ml-1 text-[11px] font-bold text-slate-300 cursor-help"
                      title="Recent trade-implied probability from Polymarket (short-term VWAP)."
                    >
                      ?
                    </span>
                  </p>
                  <p className="text-lg font-black text-slate-900">{(signal.marketPrice * 100).toFixed(0)}%</p>
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
                        <span className="font-mono text-xs font-bold text-slate-600 group-hover/link:text-ares-green truncate max-w-[120px]">
                          {insider.address}
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
                      <button className="px-3 py-1.5 bg-slate-900 text-white text-[9px] font-black uppercase tracking-widest rounded-lg hover:bg-slate-800 transition-all flex items-center gap-1.5 ml-auto whitespace-nowrap">
                        <UserPlus className="w-2.5 h-2.5" /> Follow
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

                  <div className="flex items-center justify-between">
                    <a
                      href={`https://polymarket.com/profile/${trade.address}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-slate-400 font-mono hover:text-ares-green transition-colors flex items-center gap-1.5"
                    >
                      <User className="w-3 h-3 text-slate-600" />
                      {trade.address}
                    </a>
                    <span className="text-xs font-black text-ares-green">${trade.amount.toLocaleString()}</span>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </div>

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
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-100">
                      <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-1">Fair Value</p>
                      <p className="text-xl font-black text-emerald-700">{(selectedMarket.fairValue * 100).toFixed(0)}%</p>
                    </div>
                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Market Price</p>
                      <p className="text-xl font-black text-slate-900">{(selectedMarket.marketPrice * 100).toFixed(0)}%</p>
                    </div>
                  </div>

                  {/* Risk Manager */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="w-5 h-5 text-ares-green" />
                      <h4 className="font-bold text-slate-900">Risk Manager</h4>
                    </div>

                    <div className="p-6 bg-slate-900 rounded-3xl text-white space-y-6">
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Bankroll</label>
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
                          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Kelly Suggestion</span>
                          <span className="text-xl font-black text-ares-green">{selectedMarket.kellyStake}%</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Recommended Stake</span>
                          <span className="text-2xl font-black text-white">
                            ${(bankroll * selectedMarket.kellyStake / 100).toLocaleString()}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-4">
                    <button className="flex-1 py-4 bg-emerald-500 text-white font-black text-xs uppercase tracking-widest rounded-2xl hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-500/20">
                      Buy YES
                    </button>
                    <button className="flex-1 py-4 bg-rose-500 text-white font-black text-xs uppercase tracking-widest rounded-2xl hover:bg-rose-600 transition-all shadow-lg shadow-rose-500/20">
                      Buy NO
                    </button>
                  </div>

                  <div className="p-4 bg-amber-50 rounded-2xl border border-amber-100 flex gap-3">
                    <AlertCircle className="w-5 h-5 text-amber-500 shrink-0" />
                    <p className="text-[10px] text-amber-700 font-medium leading-relaxed">
                      Trading on prediction markets involves high risk. Ensure you have verified the market resolution conditions before executing.
                    </p>
                  </div>
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

