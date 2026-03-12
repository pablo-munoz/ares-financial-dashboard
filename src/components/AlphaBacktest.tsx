import React, { useEffect, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend } from 'recharts';
import { motion } from 'motion/react';
import { AlertCircle, Activity, BarChart3, Clock, TrendingUp } from 'lucide-react';

type BacktestSummary = {
  totalTrades: number;
  winRate: number;
  brierScore: number;
  totalPnL: number;
  sharpeRatio: number;
};

type BacktestEquityPoint = {
  date: string;
  equity: number;
};

type BacktestCalibrationBucket = {
  bucket: string;
  expected: number;
  actual: number;
  count: number;
};

type BacktestResolution = {
  slug: string;
  winningOutcome: string;
  resolved_at: number;
};

type BacktestTrade = {
  ts: number;
  price: number;
  size: number;
  notional: number;
  outcome: string | null;
  side: string | null;
  wallet: string | null;
  title?: string | null;
};

type BacktestCategoryMetric = {
  category: string;
  winRate: number;
  brierScore: number;
  count: number;
};

type BacktestResults = {
  summary: BacktestSummary;
  categoryMetrics?: BacktestCategoryMetric[];
  equityCurve: BacktestEquityPoint[];
  calibration: BacktestCalibrationBucket[];
  recentResolutions: BacktestResolution[];
};

export const AlphaBacktest: React.FC = () => {
  const [data, setData] = useState<BacktestResults | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRun, setLastRun] = useState<Date | null>(null);
  const [selectedMarket, setSelectedMarket] = useState<BacktestResolution | null>(null);
  const [trades, setTrades] = useState<BacktestTrade[]>([]);
  const [tradesLoading, setTradesLoading] = useState(false);
  const [tradesError, setTradesError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/backtest/results');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setData(json);
      setLastRun(new Date());
    } catch (err) {
      setError('Backtest failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const loadTradesForMarket = async (resolution: BacktestResolution) => {
    setSelectedMarket(resolution);
    setTrades([]);
    setTradesError(null);
    setTradesLoading(true);
    try {
      const res = await fetch(`/api/backtest/trades?slug=${encodeURIComponent(resolution.slug)}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json() as { slug: string; trades: BacktestTrade[] };
      setTrades(json.trades ?? []);
    } catch (err) {
      setTradesError('Failed to load trades for this market.');
    } finally {
      setTradesLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center h-96">
        <Activity className="w-8 h-8 text-ares-green animate-spin" />
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="flex flex-col items-center justify-center h-96 space-y-4">
        <AlertCircle className="w-8 h-8 text-rose-500" />
        <p className="text-sm text-slate-500 font-medium">{error}</p>
        <button
          onClick={load}
          className="px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-black uppercase tracking-widest"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!data) return null;

  const { summary, equityCurve, calibration, recentResolutions } = data;

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 font-display tracking-tight mb-2">
            Alpha Backtesting Engine
          </h1>
          <p className="text-slate-500 max-w-2xl">
            Historical validation of the Polymarket Alpha model — PnL, calibration and probabilistic accuracy
            across resolved markets.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {lastRun && (
            <div className="flex items-center gap-1 text-xs font-black uppercase tracking-widest text-slate-400">
              <Clock className="w-3 h-3" />
              Last run: {lastRun.toLocaleTimeString()}
            </div>
          )}
          <button
            onClick={load}
            className="px-5 py-2.5 rounded-xl bg-ares-green text-slate-900 text-xs font-black uppercase tracking-widest shadow-md hover:bg-ares-dark-green transition"
          >
            Run Backtest
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <MetricCard
          label="Total Trades"
          value={summary.totalTrades.toLocaleString()}
          sub="Resolved predictions evaluated"
        />
        <MetricCard
          label="Win Rate"
          value={`${Math.round(summary.winRate * 100)}%`}
          sub="Directional accuracy"
        />
        <MetricCard
          label="Brier Score"
          value={summary.brierScore.toFixed(3)}
          sub="Lower is better"
        />
        <MetricCard
          label="Total PnL"
          value={`$${summary.totalPnL.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
          sub={`Sharpe ~${summary.sharpeRatio.toFixed(2)}`}
        />
      </div>

      {data.categoryMetrics && data.categoryMetrics.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {data.categoryMetrics
            .filter(c => c.count > 0)
            .sort((a, b) => b.count - a.count)
            .map((cat, i) => (
              <div key={i} className="bg-slate-50 p-5 rounded-3xl border border-slate-100 flex items-center justify-between shadow-[inset_0_2px_4px_rgba(0,0,0,0.02)]">
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{cat.category}</p>
                  <div className="flex items-baseline gap-1.5">
                    <p className="text-xl font-bold text-slate-900 font-display">{(cat.winRate * 100).toFixed(1)}%</p>
                    <p className="text-[10px] text-slate-500 font-medium tracking-wide">({cat.count} mkts)</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Brier</p>
                  <p className="text-sm font-bold text-slate-700">{cat.brierScore.toFixed(3)}</p>
                </div>
              </div>
            ))}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 rounded-3xl bg-white border border-slate-100 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-50">
            <div>
              <h2 className="text-base font-bold text-slate-900 font-display">
                Equity Curve — $10k Virtual Account
              </h2>
              <p className="text-xs text-slate-500">Kelly-sized bets with 20 bps slippage</p>
            </div>
            <div className="flex items-center gap-1 text-xs font-black uppercase tracking-widest text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg">
              <TrendingUp className="w-3 h-3" />
              Live Simulation
            </div>
          </div>
          <div className="h-[360px] p-6">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={equityCurve}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip
                  contentStyle={{
                    borderRadius: 16,
                    border: 'none',
                    boxShadow: '0 10px 15px -3px rgb(15 23 42 / 0.1)',
                    fontSize: 12,
                  }}
                  formatter={(v: any) => [`$${Number(v).toLocaleString(undefined, { maximumFractionDigits: 0 })}`, 'Equity']}
                />
                <Line
                  type="monotone"
                  dataKey="equity"
                  stroke="#22c55e"
                  strokeWidth={2.5}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-3xl bg-white border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-50 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-ares-green" />
              <h3 className="text-sm font-bold text-slate-900 font-display">
                Calibration by Probability Bucket
              </h3>
            </div>
          </div>
          <div className="h-[260px] p-6">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={calibration}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="bucket" tick={{ fontSize: 9 }} />
                <YAxis tick={{ fontSize: 10 }} domain={[0, 1]} />
                <Tooltip
                  contentStyle={{
                    borderRadius: 16,
                    border: 'none',
                    boxShadow: '0 10px 15px -3px rgb(15 23 42 / 0.1)',
                    fontSize: 12,
                  }}
                  formatter={(v: any, key: any) => [
                    `${Math.round(Number(v) * 100)}%`,
                    key === 'expected' ? 'Expected' : 'Actual',
                  ]}
                />
                <Legend wrapperStyle={{ fontSize: 10 }} />
                <Bar dataKey="expected" fill="#cbd5f5" radius={[4, 4, 0, 0]} />
                <Bar dataKey="actual" fill="#22c55e" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="rounded-3xl bg-white border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-ares-green" />
            <h3 className="text-sm font-bold text-slate-900 font-display">
              Sample of Recently Resolved Markets
            </h3>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50/50 text-[10px] font-black text-slate-400 uppercase tracking-widest">
              <tr>
                <th className="px-6 py-3">Slug</th>
                <th className="px-6 py-3">Winning Outcome</th>
                <th className="px-6 py-3">Resolved At</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {recentResolutions.map((r, idx) => (
                <tr
                  key={idx}
                  className="hover:bg-slate-50/50 transition-colors cursor-pointer"
                  onClick={() => loadTradesForMarket(r)}
                >
                  <td className="px-6 py-3 font-bold text-slate-900">{r.slug}</td>
                  <td className="px-6 py-3 text-xs font-black uppercase tracking-widest">
                    {r.winningOutcome}
                  </td>
                  <td className="px-6 py-3 text-sm text-slate-500">
                    {r.resolved_at
                      ? new Date(r.resolved_at * 1000).toLocaleDateString()
                      : '—'}
                  </td>
                </tr>
              ))}
              {recentResolutions.length === 0 && (
                <tr>
                  <td className="px-6 py-6 text-sm text-slate-500" colSpan={3}>
                    No resolved markets available yet. Use the sync scripts or wait for the
                    background sync to populate history.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="border-t border-slate-50 px-6 py-5 bg-slate-50/40">
          <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
            {selectedMarket
              ? `Trades for ${selectedMarket.slug}`
              : 'Select a market above to inspect underlying trades'}
          </h4>

          {!selectedMarket && (
            <p className="text-xs text-slate-500">
              Click any resolved market row to load the trades that fed into the backtest simulation.
            </p>
          )}

          {selectedMarket && (
            <>
              {tradesLoading && (
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <Activity className="w-4 h-4 animate-spin text-ares-green" />
                  Loading trades…
                </div>
              )}
              {tradesError && !tradesLoading && (
                <div className="flex items-center gap-2 text-xs text-rose-500">
                  <AlertCircle className="w-4 h-4" />
                  {tradesError}
                </div>
              )}
              {!tradesLoading && !tradesError && trades.length === 0 && (
                <p className="text-xs text-slate-500">
                  No trades found in the local snapshot for this market yet.
                </p>
              )}
              {!tradesLoading && !tradesError && trades.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                      <tr>
                        <th className="px-4 py-2">Time</th>
                        <th className="px-4 py-2">Wallet</th>
                        <th className="px-4 py-2">Side</th>
                        <th className="px-4 py-2">Outcome</th>
                        <th className="px-4 py-2 text-right">Price</th>
                        <th className="px-4 py-2 text-right">Size</th>
                        <th className="px-4 py-2 text-right">Notional</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {trades.slice(0, 120).map((t, idx) => (
                        <tr key={idx} className="hover:bg-white">
                          <td className="px-4 py-2 text-slate-500">
                            {t.ts ? new Date(t.ts * 1000).toLocaleString() : '—'}
                          </td>
                          <td className="px-4 py-2 font-mono text-[11px] text-slate-600">
                            {t.wallet ?? 'unknown'}
                          </td>
                          <td className="px-4 py-2 text-slate-700">{t.side ?? '—'}</td>
                          <td className="px-4 py-2 text-slate-700">{t.outcome ?? '—'}</td>
                          <td className="px-4 py-2 text-right text-slate-700">
                            {t.price.toFixed(3)}
                          </td>
                          <td className="px-4 py-2 text-right text-slate-700">
                            {t.size.toFixed(2)}
                          </td>
                          <td className="px-4 py-2 text-right font-bold text-slate-900">
                            ${t.notional.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

interface MetricCardProps {
  label: string;
  value: string;
  sub?: string;
}

const MetricCard: React.FC<MetricCardProps> = ({ label, value, sub }) => (
  <motion.div
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm"
  >
    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
      {label}
    </p>
    <p className="text-2xl font-black text-slate-900 font-display mb-1">{value}</p>
    {sub && <p className="text-xs text-slate-500 font-medium">{sub}</p>}
  </motion.div>
);

