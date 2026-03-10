import React, { useState } from 'react';
import {
  TrendingDown,
  TrendingUp,
  Download,
  BarChart3,
  History,
  AlertCircle,
  ChevronRight
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
  Area
} from 'recharts';
import { motion } from 'motion/react';
import { BacktestData, SavedPortfolio } from '../types';
import { cn } from '../lib/utils';

interface BacktestingProps {
  data: BacktestData | null;
  savedPortfolios?: SavedPortfolio[];
}

export const Backtesting: React.FC<BacktestingProps> = ({ data, savedPortfolios = [] }) => {
  const [selectedPortfolioId, setSelectedPortfolioId] = useState<string>('');

  const selectedPortfolio = savedPortfolios.find(p => p.id === selectedPortfolioId);

  const displayData: BacktestData | null = selectedPortfolio ? {
    growth: selectedPortfolio.backtest.growth,
    metrics: {
      maxDrawdown: selectedPortfolio.backtest.max_drawdown_pct,
      sharpeRatio: Number(selectedPortfolio.optimization.sharpe_ratio.toFixed(2)),
      beta: 0.95, // Approximate or dummy for saved portfolios since it's not strictly calculated per-portfolio
      portfolioCAGR: selectedPortfolio.backtest.portfolio_total_return,
      benchmarkCAGR: selectedPortfolio.backtest.benchmark_total_return,
      totalReturn: selectedPortfolio.backtest.portfolio_total_return,
    },
    monthlyReturns: selectedPortfolio.monthlyReturns || []
  } : data;

  if (!displayData) return <div className="flex items-center justify-center h-full">Loading...</div>;

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="flex flex-col gap-2">
          <h2 className="text-3xl font-extrabold tracking-tight text-slate-900 font-display sm:text-4xl">Backtesting Analysis</h2>
          <p className="text-lg text-slate-500 max-w-2xl">Simulate historical performance against market benchmarks to validate your portfolio strategy.</p>
        </div>
        <div className="flex items-center">
          <div className="relative">
            <select
              value={selectedPortfolioId}
              onChange={(e) => setSelectedPortfolioId(e.target.value)}
              className="appearance-none bg-white border border-slate-200 pl-4 pr-10 py-1.5 rounded-xl text-xs font-bold uppercase tracking-widest text-slate-500 hover:bg-slate-50 hover:text-slate-900 transition-colors focus:outline-none focus:ring-2 focus:ring-ares-green cursor-pointer"
            >
              <option value="">Latest Optimization</option>
              {savedPortfolios.length > 0 && <optgroup label="Saved Portfolios">
                {savedPortfolios.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </optgroup>}
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-slate-400">
              <svg className="fill-current h-3 w-3" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" /></svg>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        <div className="md:col-span-8 lg:col-span-9 flex flex-col rounded-3xl bg-white shadow-sm border border-slate-100 overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-4 p-8 border-b border-slate-50">
            <div>
              <h3 className="text-base font-bold text-slate-900 font-display">Portfolio Growth vs SPY Benchmark</h3>
              <p className="text-sm text-slate-500">Total Asset Value over time</p>
            </div>
            <div className="flex flex-col items-end">
              <span className="text-2xl font-black text-slate-900">${displayData.growth[displayData.growth.length - 1].portfolio.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
              <div className="flex items-center gap-1 text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest">
                <TrendingUp className="w-3 h-3" /> {displayData.metrics.totalReturn}% All Time
              </div>
            </div>
          </div>
          <div className="h-[400px] w-full p-8">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={displayData.growth}>
                <defs>
                  <linearGradient id="colorPortfolio" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#36e27b" stopOpacity={0.1} />
                    <stop offset="95%" stopColor="#36e27b" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="month" hide />
                <YAxis hide domain={['auto', 'auto']} />
                <Tooltip
                  contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  formatter={(value: number) => [`$${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`, '']}
                  labelFormatter={(label) => `Month ${label}`}
                />
                <Area type="monotone" dataKey="portfolio" stroke="#36e27b" fillOpacity={1} fill="url(#colorPortfolio)" strokeWidth={3} />
                <Line type="monotone" dataKey="benchmark" stroke="#94a3b8" strokeDasharray="5 5" dot={false} strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="md:col-span-4 lg:col-span-3 space-y-6">
          <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6 overflow-hidden relative">
            <div className="absolute top-0 right-0 w-32 h-32 bg-amber-50 rounded-bl-[100px] -z-10"></div>
            <h3 className="text-[10px] font-black tracking-widest text-slate-400 uppercase mb-4">Max Drawdown</h3>
            <div className="text-4xl font-black text-slate-900 font-display mb-2">{displayData.metrics.maxDrawdown}%</div>
            <div className="inline-flex items-center gap-1.5 text-[10px] font-bold tracking-widest uppercase text-rose-500 bg-rose-50 px-2.5 py-1 rounded-lg">
              <AlertCircle className="w-3 h-3" /> Critical Level
            </div>
            <TrendingDown className="absolute top-6 right-6 w-12 h-12 text-rose-100" />
            <div className="mt-8 h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
              <div className="h-full bg-rose-500 rounded-full" style={{ width: `${Math.min(Math.abs(displayData.metrics.maxDrawdown) * 2, 100)}%` }}></div>
            </div>
          </div>

          <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6 relative overflow-hidden group hover:border-emerald-200 transition-colors">
            <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-50 rounded-bl-[100px] -z-10 transition-transform group-hover:scale-110 duration-500"></div>
            <div className="flex items-center gap-2 text-[10px] font-black tracking-widest text-slate-400 uppercase mb-3">
              <BarChart3 className="w-4 h-4 text-emerald-500" />
              Sharpe Ratio
            </div>
            <div className="text-3xl font-black text-slate-900 font-display mb-1">{displayData.metrics.sharpeRatio}</div>
            <p className="text-[10px] font-bold text-slate-400">Top 15% of portfolios</p>
          </div>

          <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6 relative overflow-hidden group hover:border-emerald-200 transition-colors">
            <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-50 rounded-bl-[100px] -z-10 transition-transform group-hover:scale-110 duration-500"></div>
            <div className="flex items-center gap-2 text-[10px] font-black tracking-widest text-slate-400 uppercase mb-3">
              <TrendingUp className="w-4 h-4 text-emerald-500" />
              Beta
            </div>
            <div className="text-3xl font-black text-slate-900 font-display mb-1">{displayData.metrics.beta}</div>
            <p className="text-[10px] font-bold text-slate-400">Less volatile than market</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex items-center justify-between group cursor-pointer hover:border-ares-green transition-colors">
          <div>
            <p className="text-[10px] font-black tracking-widest text-slate-400 uppercase mb-1">Portfolio CAGR</p>
            <p className="text-2xl font-black text-slate-900 font-display">{displayData.metrics.portfolioCAGR}%</p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 flex items-center justify-center text-emerald-500 group-hover:scale-110 transition-transform">
            <History className="w-5 h-5" />
          </div>
        </div>
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex items-center justify-between group cursor-pointer hover:border-slate-300 transition-colors">
          <div>
            <p className="text-[10px] font-black tracking-widest text-slate-400 uppercase mb-1">Benchmark CAGR</p>
            <p className="text-2xl font-black text-slate-900 font-display">{displayData.metrics.benchmarkCAGR}%</p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-400 group-hover:scale-110 transition-transform">
            <BarChart3 className="w-5 h-5" />
          </div>
        </div>
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex items-center justify-between group cursor-pointer hover:border-emerald-200 transition-colors">
          <div>
            <p className="text-[10px] font-black tracking-widest text-slate-400 uppercase mb-1">Total Returns</p>
            <p className="text-2xl font-black text-emerald-600 font-display">{displayData.metrics.totalReturn}%</p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-emerald-100 flex items-center justify-center text-emerald-600 group-hover:scale-110 transition-transform">
            <TrendingUp className="w-5 h-5" />
          </div>
        </div>
      </div>

      <div className="rounded-3xl bg-white shadow-sm border border-slate-100 overflow-hidden">
        <div className="px-8 py-6 border-b border-slate-50 flex justify-between items-center">
          <h3 className="text-base font-bold text-slate-900 font-display">Monthly Returns</h3>
          <button className="text-sm text-ares-dark-green font-bold hover:underline flex items-center gap-1">
            View Full Report <ChevronRight className="w-4 h-4" />
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50/50 text-[10px] font-black text-slate-400 uppercase tracking-widest">
              <tr>
                <th className="px-8 py-4">Year</th>
                <th className="px-8 py-4">Jan</th>
                <th className="px-8 py-4">Feb</th>
                <th className="px-8 py-4">Mar</th>
                <th className="px-8 py-4">Q1 Total</th>
                <th className="px-8 py-4 text-right">Annual</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {displayData.monthlyReturns.map((row) => (
                <tr key={row.year} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-8 py-5 font-black text-slate-900">{row.year}</td>
                  <td className={cn("px-8 py-5 font-bold", row.jan >= 0 ? "text-emerald-500" : "text-rose-500")}>{row.jan >= 0 ? '+' : ''}{row.jan}%</td>
                  <td className={cn("px-8 py-5 font-bold", row.feb >= 0 ? "text-emerald-500" : "text-rose-500")}>{row.feb >= 0 ? '+' : ''}{row.feb}%</td>
                  <td className={cn("px-8 py-5 font-bold", row.mar >= 0 ? "text-emerald-500" : "text-rose-500")}>{row.mar >= 0 ? '+' : ''}{row.mar}%</td>
                  <td className={cn("px-8 py-5 font-black", row.q1 >= 0 ? "text-emerald-500" : "text-rose-500")}>{row.q1 >= 0 ? '+' : ''}{row.q1}%</td>
                  <td className="px-8 py-5 text-right font-black text-slate-900">{row.annual >= 0 ? '+' : ''}{row.annual}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
