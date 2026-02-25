import React from 'react';
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
import { BacktestData } from '../types';
import { cn } from '../lib/utils';

interface BacktestingProps {
  data: BacktestData | null;
}

export const Backtesting: React.FC<BacktestingProps> = ({ data }) => {
  if (!data) return <div className="flex items-center justify-center h-full">Loading...</div>;

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <div className="flex flex-col gap-2">
        <h2 className="text-3xl font-extrabold tracking-tight text-slate-900 font-display sm:text-4xl">Backtesting Analysis</h2>
        <p className="text-lg text-slate-500 max-w-2xl">Simulate historical performance against market benchmarks to validate your portfolio strategy.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        <div className="md:col-span-8 lg:col-span-9 flex flex-col rounded-3xl bg-white shadow-sm border border-slate-100 overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-4 p-8 border-b border-slate-50">
            <div>
              <h3 className="text-base font-bold text-slate-900 font-display">Portfolio Growth vs SPY Benchmark</h3>
              <p className="text-sm text-slate-500">Total Asset Value over time</p>
            </div>
            <div className="flex flex-col items-end">
              <span className="text-2xl font-black text-slate-900">${data.growth[data.growth.length-1].portfolio.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
              <div className="flex items-center gap-1 text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest">
                <TrendingUp className="w-3 h-3" /> {data.metrics.totalReturn}% All Time
              </div>
            </div>
          </div>
          <div className="h-[400px] w-full p-8">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.growth}>
                <defs>
                  <linearGradient id="colorPortfolio" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#36e27b" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#36e27b" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="month" hide />
                <YAxis hide domain={['auto', 'auto']} />
                <Tooltip 
                  contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  formatter={(value: number) => [`$${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`, '']}
                />
                <Area type="monotone" dataKey="portfolio" stroke="#36e27b" fillOpacity={1} fill="url(#colorPortfolio)" strokeWidth={3} />
                <Line type="monotone" dataKey="benchmark" stroke="#94a3b8" strokeDasharray="5 5" dot={false} strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="md:col-span-4 lg:col-span-3 flex flex-col gap-6">
          <div className="flex flex-col gap-3 rounded-3xl bg-white p-8 shadow-sm border border-rose-100 relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
              <TrendingDown className="w-16 h-16 text-rose-500" />
            </div>
            <p className="text-xs font-black text-slate-400 uppercase tracking-widest relative z-10">Max Drawdown</p>
            <h4 className="text-4xl font-black text-slate-900 relative z-10">{data.metrics.maxDrawdown}%</h4>
            <div className="inline-flex items-center gap-1 text-rose-600 bg-rose-50 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest w-fit relative z-10">
              <AlertCircle className="w-3 h-3" /> Critical Level
            </div>
            <div className="h-1.5 w-full bg-slate-100 rounded-full mt-4 relative z-10">
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: '65%' }}
                className="h-full bg-rose-500 rounded-full"
              ></motion.div>
            </div>
          </div>

          <div className="flex flex-col gap-1 rounded-3xl bg-white p-6 shadow-sm border border-slate-100">
            <div className="flex items-center gap-2 text-slate-500 mb-2">
              <BarChart3 className="w-4 h-4 text-ares-green" />
              <p className="text-xs font-black uppercase tracking-widest">Sharpe Ratio</p>
            </div>
            <h4 className="text-2xl font-black text-slate-900">{data.metrics.sharpeRatio}</h4>
            <p className="text-[10px] text-slate-400 font-bold">Top 15% of portfolios</p>
          </div>

          <div className="flex flex-col gap-1 rounded-3xl bg-white p-6 shadow-sm border border-slate-100">
            <div className="flex items-center gap-2 text-slate-500 mb-2">
              <TrendingUp className="w-4 h-4 text-ares-green" />
              <p className="text-xs font-black uppercase tracking-widest">Beta</p>
            </div>
            <h4 className="text-2xl font-black text-slate-900">{data.metrics.beta}</h4>
            <p className="text-[10px] text-slate-400 font-bold">Less volatile than market</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[
          { label: 'Portfolio CAGR', value: `${data.metrics.portfolioCAGR}%`, icon: History, diff: '+5.2%', sub: 'vs Benchmark' },
          { label: 'Benchmark CAGR', value: `${data.metrics.benchmarkCAGR}%`, icon: BarChart3, diff: '+1.1%', sub: 'vs S&P 500 Historical' },
          { label: 'Total Returns', value: `${data.metrics.totalReturn}%`, icon: TrendingUp, diff: '+12.8%', sub: 'Year over Year' },
        ].map((item, i) => (
          <div key={i} className="rounded-3xl bg-white p-8 shadow-sm border border-slate-100 flex flex-col justify-between">
            <div className="flex items-start justify-between">
              <div className="flex flex-col gap-1">
                <p className="text-xs font-black text-slate-400 uppercase tracking-widest">{item.label}</p>
                <h4 className="text-3xl font-black text-slate-900">{item.value}</h4>
              </div>
              <div className="h-12 w-12 rounded-2xl bg-ares-green/10 flex items-center justify-center text-ares-dark-green">
                <item.icon className="w-6 h-6" />
              </div>
            </div>
            <div className="mt-6 flex items-center gap-2">
              <span className="flex items-center text-emerald-600 text-sm font-black">
                <TrendingUp className="w-4 h-4 mr-1" /> {item.diff}
              </span>
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{item.sub}</span>
            </div>
          </div>
        ))}
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
              {data.monthlyReturns.map((row) => (
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
