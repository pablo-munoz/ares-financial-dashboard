import React from 'react';
import {
  TrendingUp,
  Download,
  Sliders,
  Loader2
} from 'lucide-react';
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  ZAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  LineChart,
  Line,
  AreaChart,
  Area
} from 'recharts';
import { motion } from 'motion/react';
import { FrontierData, SavedPortfolio } from '../types';
import { cn } from '../lib/utils';

interface EfficientFrontierProps {
  data: FrontierData | null;
  savedPortfolios: SavedPortfolio[];
}

export const EfficientFrontier: React.FC<EfficientFrontierProps> = ({ data, savedPortfolios }) => {
  const [selectedSavedId, setSelectedSavedId] = React.useState<string>('current');
  const [localFrontierData, setLocalFrontierData] = React.useState<FrontierData | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);

  React.useEffect(() => {
    if (selectedSavedId === 'current') {
      setLocalFrontierData(data);
      return;
    }

    const saved = savedPortfolios.find(p => p.id === selectedSavedId);
    if (!saved) return;

    setIsLoading(true);
    fetch('/api/efficient-frontier', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        weights: saved.optimization.weights,
        investment: saved.investment || 100000
      })
    })
      .then(res => res.json())
      .then(result => {
        if (result.success) {
          setLocalFrontierData(result.data);
        }
      })
      .catch(console.error)
      .finally(() => setIsLoading(false));
  }, [selectedSavedId, data, savedPortfolios]);

  const displayData = localFrontierData || data;

  if (!displayData) return <div className="flex items-center justify-center h-full">Loading...</div>;

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <div className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 font-display tracking-tight mb-2">Portfolio Optimization</h1>
          <p className="text-slate-500 max-w-2xl">
            Visualizing risk-return trade-offs. The curve represents the set of optimal portfolios that offer the highest expected return for a defined level of risk.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="relative">
            <select
              value={selectedSavedId}
              onChange={(e) => setSelectedSavedId(e.target.value)}
              className="appearance-none bg-white border border-slate-200 pl-4 pr-10 py-2 rounded-xl text-sm font-medium text-slate-900 hover:bg-slate-50 transition-colors flex items-center gap-2 focus:outline-none focus:ring-2 focus:ring-ares-green cursor-pointer"
            >
              <option value="current">Dashboard Portfolio</option>
              {savedPortfolios.length > 0 && <optgroup label="Saved Portfolios">
                {savedPortfolios.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </optgroup>}
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-slate-400">
              <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" /></svg>
            </div>
          </div>
          <button className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-900 hover:bg-slate-50 transition-colors flex items-center gap-2">
            <Download className="w-4 h-4" /> Export Data
          </button>
          <button className="px-4 py-2 bg-ares-green text-white rounded-xl text-sm font-bold hover:bg-ares-dark-green transition-colors shadow-lg shadow-ares-green/20 flex items-center gap-2">
            <Sliders className="w-4 h-4" /> Rebalance
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 relative">
        {isLoading && (
          <div className="absolute inset-0 z-50 bg-white/50 backdrop-blur-sm rounded-3xl flex items-center justify-center">
            <Loader2 className="w-8 h-8 text-ares-green animate-spin" />
          </div>
        )}
        <div className="lg:col-span-2 bg-white rounded-3xl border border-slate-100 p-8 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
            <h3 className="text-lg font-bold text-slate-900 font-display">Interactive Frontier Scatter</h3>
            <div className="flex flex-wrap items-center gap-x-6 gap-y-3 text-[10px] font-black tracking-widest uppercase text-slate-400">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-slate-300"></span>
                <span>Theoretical Mix</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-ares-green"></span>
                <span className="text-ares-dark-green font-bold">Active Portfolio</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                <span>Max Sharpe</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-cyan-500"></span>
                <span>Min Volatility</span>
              </div>
            </div>
          </div>

          <div className="h-[400px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis
                  type="number"
                  dataKey="risk"
                  name="Risk"
                  unit="%"
                  label={{ value: 'RISK (VOLATILITY %)', position: 'bottom', offset: 0, fontSize: 10, fontWeight: 800 }}
                  tick={{ fontSize: 10 }}
                />
                <YAxis
                  type="number"
                  dataKey="return"
                  name="Return"
                  unit="%"
                  label={{ value: 'EXPECTED RETURN (%)', angle: -90, position: 'left', fontSize: 10, fontWeight: 800 }}
                  tick={{ fontSize: 10 }}
                />
                <Tooltip cursor={{ strokeDasharray: '3 3' }} />
                <Scatter name="Portfolios" data={displayData.scatter.filter(d => d.type === 'scatter')} fill="#94a3b8" opacity={0.4}>
                  {displayData.scatter.filter(d => d.type === 'scatter').map((entry, index) => (
                    <Cell key={`cell-${index}`} fill="#cbd5e1" />
                  ))}
                </Scatter>
                <Scatter name="Active Portfolio" data={displayData.scatter.filter(d => d.type === 'current_portfolio')} fill="#36e27b">
                  <Cell fill="#36e27b" stroke="#36e27b" strokeWidth={15} strokeOpacity={0.4} />
                </Scatter>
                <Scatter name="Max Sharpe" data={[displayData.maxSharpe]} fill="#f59e0b">
                  <Cell fill="#f59e0b" stroke="#f59e0b" strokeWidth={10} strokeOpacity={0.2} />
                </Scatter>
                <Scatter name="Min Volatility" data={[displayData.minVol]} fill="#06b6d4">
                  <Cell fill="#06b6d4" stroke="#06b6d4" strokeWidth={10} strokeOpacity={0.2} />
                </Scatter>
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white rounded-3xl border border-slate-100 p-8 shadow-sm">
          <div className="space-y-4">
            <div className="p-5 rounded-2xl bg-ares-green/5 border border-ares-green/20 relative overflow-hidden group hover:border-ares-green/50 transition-colors shadow-sm">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-2 h-2 rounded-full bg-ares-green"></div>
                <p className="text-[10px] font-black text-ares-dark-green uppercase tracking-widest">Active Portfolio Ratio</p>
              </div>
              <p className="text-3xl font-black text-slate-900">{displayData.currentPortfolio.ratio.toFixed(2)}</p>
              <div className="flex justify-between mt-3 text-xs">
                <span className="text-slate-500">Return: <span className="text-emerald-500 font-bold">+{displayData.currentPortfolio.return}%</span></span>
                <span className="text-slate-500">Risk: <span className="text-slate-700 font-bold">{displayData.currentPortfolio.risk}%</span></span>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 relative overflow-hidden group hover:border-amber-200 transition-colors">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-2 h-2 rounded-full bg-amber-500"></div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Max Sharpe Ratio</p>
              </div>
              <p className="text-2xl font-black text-slate-900">{displayData.maxSharpe.ratio.toFixed(2)}</p>
              <div className="flex justify-between mt-3 text-[11px]">
                <span className="text-slate-500">Return: <span className="text-emerald-500 font-bold">+{displayData.maxSharpe.return}%</span></span>
                <span className="text-slate-500">Risk: <span className="text-rose-500 font-bold">{displayData.maxSharpe.risk}%</span></span>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 relative overflow-hidden group hover:border-cyan-200 transition-colors">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-2 h-2 rounded-full bg-cyan-500"></div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Min Volatility</p>
              </div>
              <p className="text-2xl font-black text-slate-900">{displayData.minVol.ratio.toFixed(2)}</p>
              <div className="flex justify-between mt-3 text-[11px]">
                <span className="text-slate-500">Return: <span className="text-emerald-500 font-bold">+{displayData.minVol.return}%</span></span>
                <span className="text-slate-500">Risk: <span className="text-slate-700 font-bold">{displayData.minVol.risk}%</span></span>
              </div>
            </div>

            <div className="pt-6 border-t border-slate-100">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Allocations (Max Sharpe)</p>
              <div className="space-y-4">
                {displayData.allocations.map((alloc, i) => (
                  <div key={alloc.name}>
                    <div className="flex justify-between text-xs mb-1.5">
                      <span className="font-bold text-slate-700">{alloc.name}</span>
                      <span className="font-black text-slate-900">{alloc.value}%</span>
                    </div>
                    <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${alloc.value}%` }}
                        className={cn(
                          "h-full rounded-full",
                          i === 0 ? "bg-ares-green" : i === 1 ? "bg-indigo-400" : i === 2 ? "bg-blue-300" : "bg-slate-300"
                        )}
                      ></motion.div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-slate-100 p-8 shadow-sm">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h3 className="text-lg font-bold text-slate-900 font-display">Efficient Frontier Trend</h3>
            <p className="text-sm text-slate-500">Historical movement of the efficient frontier curve over the last 12 months.</p>
          </div>
          <div className="flex bg-slate-50 p-1 rounded-xl">
            {['1M', '3M', '6M', '1Y'].map(t => (
              <button key={t} className={cn(
                "px-4 py-1.5 text-[10px] font-black rounded-lg transition-all",
                t === '1M' ? "bg-white text-slate-900 shadow-sm" : "text-slate-400 hover:text-slate-600"
              )}>{t}</button>
            ))}
          </div>
        </div>
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={Array.from({ length: 12 }, (_, i) => ({ name: i, value: 10 + Math.random() * 5 }))}>
              <defs>
                <linearGradient id="colorVal" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#36e27b" stopOpacity={0.1} />
                  <stop offset="95%" stopColor="#36e27b" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="name" hide />
              <YAxis hide />
              <Area type="monotone" dataKey="value" stroke="#36e27b" fillOpacity={1} fill="url(#colorVal)" strokeWidth={3} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};
