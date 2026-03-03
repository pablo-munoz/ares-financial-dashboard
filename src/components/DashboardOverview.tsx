import React, { useState } from 'react';
import { 
  TrendingUp, 
  DollarSign, 
  Percent, 
  Calculator,
  Loader2,
  CheckCircle2,
  ChevronRight,
  PieChart as PieChartIcon,
  Activity
} from 'lucide-react';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { motion, AnimatePresence } from 'motion/react';
import { Asset } from '../types';
import { cn } from '../lib/utils';

interface DashboardOverviewProps {
  assets: Asset[];
  onNavigateAlphaBacktest?: () => void;
}

export const DashboardOverview: React.FC<DashboardOverviewProps> = ({ assets, onNavigateAlphaBacktest }) => {
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [optimizationResult, setOptimizationResult] = useState<any>(null);
  const [engineMode, setEngineMode] = useState<'manual' | 'auto'>('manual');
  const [formData, setFormData] = useState({
    tickers: ['AAPL', 'MSFT', 'GOOGL', 'AMZN'],
    investment: 100000,
    risk_tolerance: 0.5,
    time_horizon_years: 5,
    monthly_contribution: 500,
    num_holdings: 5,
  });

  const handleOptimize = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsOptimizing(true);
    try {
      const endpoint =
        engineMode === 'manual'
          ? '/api/portfolio/optimize'
          : '/api/portfolio/recommend';

      const body =
        engineMode === 'manual'
          ? formData
          : {
              investment: formData.investment,
              risk_tolerance: formData.risk_tolerance,
              time_horizon_years: formData.time_horizon_years,
              monthly_contribution: formData.monthly_contribution,
              num_holdings: formData.num_holdings,
            };

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const result = await response.json();
      if (result.success) {
        setOptimizationResult(result.data);
      }
    } catch (error) {
      console.error('Optimization failed:', error);
    } finally {
      setIsOptimizing(false);
    }
  };

  const COLORS = ['#36e27b', '#818cf8', '#60a5fa', '#fbbf24', '#f87171'];

  const allocationDetails = optimizationResult
    ? (() => {
        const weightsEntries = Object.entries(
          optimizationResult.optimization.weights || {}
        ) as [string, number][];

        const rows = weightsEntries.map(([ticker, weight]) => {
          const asset = assets.find((a) => a.id === ticker);
          const price = asset?.price ?? null;
          const targetDollars = weight * formData.investment;
          const shares = price ? Math.floor(targetDollars / price) : null;
          const investedDollars =
            price && shares !== null ? shares * price : null;

          return {
            ticker,
            name: asset?.name ?? ticker,
            weight,
            price,
            targetDollars,
            shares,
            investedDollars,
          };
        });

        const totalInvested = rows.reduce(
          (sum, r) => sum + (r.investedDollars ?? 0),
          0
        );
        const leftoverCash = formData.investment - totalInvested;

        return { rows, totalInvested, leftoverCash };
      })()
    : null;

  const formatCurrency = (value: number | null | undefined) =>
    value != null
      ? `$${value.toLocaleString(undefined, {
          maximumFractionDigits: 2,
          minimumFractionDigits: 2,
        })}`
      : '—';

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 font-display tracking-tight mb-2">Market Intelligence</h1>
          <p className="text-slate-500">Real-time overview of your portfolio performance and market trends.</p>
        </div>
        <div className="flex items-center gap-2 text-xs font-black tracking-widest uppercase text-slate-400">
          <span className="w-2 h-2 rounded-full bg-ares-green animate-pulse"></span>
          Live Market Feed
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { label: 'Total Portfolio Value', value: '$1,248,500', change: '+12.5%', icon: DollarSign, color: 'bg-ares-green' },
          { label: 'Daily P&L', value: '+$14,230', change: '+1.2%', icon: TrendingUp, color: 'bg-indigo-500' },
          { label: 'Market Volatility', value: '14.2%', change: '-0.8%', icon: Percent, color: 'bg-amber-500' },
          { label: 'Risk Score', value: '68/100', change: 'Stable', icon: CheckCircle2, color: 'bg-cyan-500' },
        ].map((stat, i) => (
          <motion.div 
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow"
          >
            <div className="flex items-center justify-between mb-4">
              <div className={cn("p-2 rounded-xl text-white", stat.color)}>
                <stat.icon className="w-5 h-5" />
              </div>
              <span className={cn(
                "text-xs font-bold px-2 py-1 rounded-lg",
                stat.change.startsWith('+') ? "bg-emerald-50 text-emerald-600" : "bg-slate-50 text-slate-600"
              )}>
                {stat.change}
              </span>
            </div>
            <p className="text-sm font-medium text-slate-500 mb-1">{stat.label}</p>
            <p className="text-2xl font-black text-slate-900 font-display">{stat.value}</p>
          </motion.div>
        ))}
      </div>

      {/* Alpha Backtest teaser card */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1 bg-white rounded-3xl border border-slate-100 p-6 shadow-sm flex flex-col justify-between">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-ares-green/10 rounded-xl">
              <Activity className="w-5 h-5 text-ares-green" />
            </div>
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                Polymarket Model
              </p>
              <h3 className="text-lg font-bold text-slate-900 font-display">
                Alpha Backtesting Engine
              </h3>
            </div>
          </div>
          <p className="text-sm text-slate-500 mb-4">
            See how the insider-informed Polymarket alpha model would have performed historically —
            equity curve, calibration, and virtual PnL on a $10k account.
          </p>
          <button
            type="button"
            onClick={onNavigateAlphaBacktest}
            className="inline-flex items-center justify-between w-full px-4 py-3 rounded-2xl bg-slate-900 text-white text-xs font-black uppercase tracking-widest hover:bg-slate-800 transition"
          >
            Open Alpha Backtest
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Portfolio Engine Form */}
        <div className="bg-white rounded-3xl border border-slate-100 p-8 shadow-sm">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-ares-green/10 rounded-xl">
              <Calculator className="w-5 h-5 text-ares-green" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 font-display">Portfolio Engine</h3>
          </div>

          <form onSubmit={handleOptimize} className="space-y-5">
            <div className="flex gap-2 mb-2">
              <button
                type="button"
                onClick={() => setEngineMode('manual')}
                className={cn(
                  'flex-1 px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border',
                  engineMode === 'manual'
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'bg-slate-50 text-slate-500 border-slate-100'
                )}
              >
                I choose tickers
              </button>
              <button
                type="button"
                onClick={() => setEngineMode('auto')}
                className={cn(
                  'flex-1 px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border',
                  engineMode === 'auto'
                    ? 'bg-ares-green text-slate-900 border-ares-green'
                    : 'bg-slate-50 text-slate-500 border-slate-100'
                )}
              >
                Suggest for me
              </button>
            </div>

            {engineMode === 'manual' && (
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  Tickers (Comma separated)
                </label>
                <input
                  type="text"
                  value={formData.tickers.join(', ')}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      tickers: e.target.value
                        .split(',')
                        .map((t) => t.trim().toUpperCase())
                        .filter(Boolean),
                    })
                  }
                  className="w-full px-4 py-3 rounded-xl border border-slate-100 bg-slate-50 focus:ring-2 focus:ring-ares-green outline-none text-sm font-bold"
                  placeholder="AAPL, MSFT, GOOGL..."
                />
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Investment ($)</label>
                <input 
                  type="number" 
                  value={formData.investment}
                  onChange={(e) => setFormData({...formData, investment: parseInt(e.target.value)})}
                  className="w-full px-4 py-3 rounded-xl border border-slate-100 bg-slate-50 focus:ring-2 focus:ring-ares-green outline-none text-sm font-bold"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Monthly ($)</label>
                <input 
                  type="number" 
                  value={formData.monthly_contribution}
                  onChange={(e) => setFormData({...formData, monthly_contribution: parseInt(e.target.value)})}
                  className="w-full px-4 py-3 rounded-xl border border-slate-100 bg-slate-50 focus:ring-2 focus:ring-ares-green outline-none text-sm font-bold"
                />
              </div>
            </div>

            {engineMode === 'auto' && (
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  Number of Holdings
                </label>
                <input
                  type="number"
                  min={2}
                  max={assets.length}
                  value={formData.num_holdings}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      num_holdings: parseInt(e.target.value) || 2,
                    })
                  }
                  className="w-full px-4 py-3 rounded-xl border border-slate-100 bg-slate-50 focus:ring-2 focus:ring-ares-green outline-none text-sm font-bold"
                />
              </div>
            )}

            <div className="space-y-2">
              <div className="flex justify-between">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Risk Tolerance</label>
                <span className="text-[10px] font-black text-ares-green uppercase">{Math.round(formData.risk_tolerance * 100)}%</span>
              </div>
              <input 
                type="range" 
                min="0" 
                max="1" 
                step="0.1"
                value={formData.risk_tolerance}
                onChange={(e) => setFormData({...formData, risk_tolerance: parseFloat(e.target.value)})}
                className="w-full accent-ares-green h-1.5 bg-slate-100 rounded-lg appearance-none cursor-pointer"
              />
              <div className="flex justify-between text-[8px] font-bold text-slate-400 uppercase">
                <span>Conservative</span>
                <span>Aggressive</span>
              </div>
            </div>

            <button 
              type="submit"
              disabled={isOptimizing}
              className="w-full py-4 bg-slate-900 text-white rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-slate-800 transition-all disabled:opacity-50 shadow-xl shadow-slate-900/10"
            >
              {isOptimizing ? <Loader2 className="w-5 h-5 animate-spin" /> : <Calculator className="w-5 h-5" />}
              Generate Portfolio
            </button>
          </form>
        </div>

        {/* Results or Chart */}
        <div className="lg:col-span-2 space-y-8">
          <AnimatePresence mode="wait">
            {optimizationResult ? (
              <motion.div 
                key="results"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="grid grid-cols-1 md:grid-cols-2 gap-6"
              >
                <div className="bg-white rounded-3xl border border-slate-100 p-8 shadow-sm">
                  <h3 className="text-lg font-bold text-slate-900 mb-6 font-display flex items-center gap-2">
                    <PieChartIcon className="w-5 h-5 text-ares-green" /> Optimized Weights
                  </h3>
                  <div className="h-48">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={Object.entries(optimizationResult.optimization.weights).map(([name, value]) => ({ name, value }))}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={80}
                          paddingAngle={5}
                          dataKey="value"
                        >
                          {Object.entries(optimizationResult.optimization.weights).map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-2">
                    {Object.entries(optimizationResult.optimization.weights).map(([name, value], i) => (
                      <div key={name} className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }}></div>
                        <span className="text-xs font-bold text-slate-700">{name}: {(value as number * 100).toFixed(0)}%</span>
                      </div>
                    ))}
                  </div>
                  {allocationDetails && (
                    <div className="mt-6 pt-4 border-t border-slate-100">
                      <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3">
                        Money Allocation
                      </h4>
                      <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                        {allocationDetails.rows.map((row) => (
                          <div key={row.ticker} className="flex items-center justify-between text-xs">
                            <div className="flex flex-col">
                              <span className="font-bold text-slate-800">{row.ticker}</span>
                              <span className="text-[10px] text-slate-400">{row.name}</span>
                            </div>
                            <div className="text-right space-y-0.5">
                              <div className="text-[10px] text-slate-400">
                                Weight <span className="font-bold text-slate-700">{(row.weight * 100).toFixed(1)}%</span>
                              </div>
                              <div className="text-[10px] text-slate-400">
                                Amount <span className="font-bold text-slate-700">{formatCurrency(row.investedDollars ?? row.targetDollars)}</span>
                              </div>
                              {row.shares !== null && row.price && (
                                <div className="text-[10px] text-slate-400">
                                  Shares <span className="font-bold text-slate-700">{row.shares}</span> @{' '}
                                  <span className="font-bold text-slate-700">{formatCurrency(row.price)}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className="mt-3 flex justify-between text-[10px] font-black text-slate-500 uppercase tracking-widest">
                        <span>Invested</span>
                        <span>{formatCurrency(allocationDetails.totalInvested)}</span>
                      </div>
                      <div className="flex justify-between text-[10px] font-black uppercase tracking-widest">
                        <span className={cn("text-slate-500")}>Leftover Cash</span>
                        <span className={cn(allocationDetails.leftoverCash >= 0 ? "text-emerald-600" : "text-rose-500")}>
                          {formatCurrency(allocationDetails.leftoverCash)}
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                <div className="bg-white rounded-3xl border border-slate-100 p-8 shadow-sm flex flex-col justify-between">
                  <div>
                    <h3 className="text-lg font-bold text-slate-900 mb-6 font-display">Performance Forecast</h3>
                    <div className="space-y-4">
                      <div className="flex justify-between items-end">
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Expected Return</span>
                        <span className="text-2xl font-black text-emerald-500">{(optimizationResult.optimization.expected_return * 100).toFixed(1)}%</span>
                      </div>
                      <div className="flex justify-between items-end">
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Annual Volatility</span>
                        <span className="text-2xl font-black text-slate-900">{(optimizationResult.optimization.volatility * 100).toFixed(1)}%</span>
                      </div>
                      <div className="flex justify-between items-end">
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Sharpe Ratio</span>
                        <span className="text-2xl font-black text-indigo-500">{optimizationResult.optimization.sharpe_ratio}</span>
                      </div>
                    </div>
                  </div>
                  <div className="mt-6 pt-6 border-t border-slate-50">
                    <div className="flex items-center justify-between">
                      <span className="px-3 py-1 bg-slate-900 text-white text-[10px] font-black rounded-full uppercase tracking-widest">
                        {optimizationResult.optimization.strategy} Strategy
                      </span>
                      <button className="text-ares-green text-xs font-bold flex items-center gap-1 hover:underline">
                        View Details <ChevronRight className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                </div>

                <div className="md:col-span-2 bg-white rounded-3xl border border-slate-100 p-8 shadow-sm">
                  <h3 className="text-lg font-bold text-slate-900 mb-6 font-display">Growth Projection</h3>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={optimizationResult.backtest.growth}>
                        <defs>
                          <linearGradient id="colorPort" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#36e27b" stopOpacity={0.1}/>
                            <stop offset="95%" stopColor="#36e27b" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="month" hide />
                        <YAxis hide />
                        <Tooltip 
                          contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                          formatter={(value: number) => [`$${value.toLocaleString()}`, 'Value']}
                        />
                        <Area type="monotone" dataKey="portfolio" stroke="#36e27b" strokeWidth={3} fillOpacity={1} fill="url(#colorPort)" />
                        <Line type="monotone" dataKey="benchmark" stroke="#cbd5e1" strokeWidth={2} strokeDasharray="5 5" dot={false} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </motion.div>
            ) : (
              <motion.div 
                key="placeholder"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="bg-white rounded-3xl border border-slate-100 p-8 shadow-sm h-full flex flex-col"
              >
                <h3 className="text-lg font-bold text-slate-900 mb-8 font-display">Market Performance History</h3>
                <div className="flex-1 min-h-[400px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={assets.slice(0, 5).map(a => ({ name: a.name, price: a.price }))}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#94a3b8' }} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#94a3b8' }} />
                      <Tooltip 
                        contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="price" 
                        stroke="#36e27b" 
                        strokeWidth={4} 
                        dot={{ r: 4, fill: '#36e27b', strokeWidth: 2, stroke: '#fff' }}
                        activeDot={{ r: 6, strokeWidth: 0 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};
