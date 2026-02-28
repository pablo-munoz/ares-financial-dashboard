import React, { useState } from 'react';
import { 
  Search, 
  TrendingUp, 
  TrendingDown, 
  Star, 
  Share2, 
  ArrowRight,
  BrainCircuit,
  Globe
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
import { IndexData } from '../types';
import { cn } from '../lib/utils';

interface IndicesSearchProps {
  indices: IndexData[];
}

export const IndicesSearch: React.FC<IndicesSearchProps> = ({ indices }) => {
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState(indices[0]?.id || '');
  const [activeCategory, setActiveCategory] = useState<'ALL' | 'AMERICAS' | 'EMEA' | 'APAC' | 'COMMODITIES'>('ALL');

  const filtered = indices.filter(idx => {
    const term = search.toLowerCase();
    const matchesSearch = 
      idx.name.toLowerCase().includes(term) || 
      idx.id.toLowerCase().includes(term);

    const matchesCategory =
      activeCategory === 'ALL'
        ? true
        : activeCategory === 'AMERICAS'
          ? idx.region === 'US' || idx.region === 'Americas'
          : activeCategory === 'EMEA'
            ? idx.region === 'EMEA' || idx.region === 'Europe' || idx.region === 'UK'
            : activeCategory === 'APAC'
              ? idx.region === 'Asia Pacific'
              : idx.region === 'Commodities';

    return matchesSearch && matchesCategory;
  });

  const selectedIndex = filtered.find(idx => idx.id === selectedId) || filtered[0] || indices[0];

  return (
    <div className="flex flex-col h-full animate-in fade-in duration-500">
      <header className="w-full mb-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 font-display">Global Indices Search</h1>
          <div className="flex items-center gap-2 px-4 py-1.5 bg-emerald-50 rounded-full">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="text-[10px] font-black text-emerald-700 uppercase tracking-widest">Market Open</span>
          </div>
        </div>
        <div className="relative w-full max-w-3xl">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-6 h-6" />
          <input 
            type="text" 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="block w-full pl-14 pr-6 py-5 rounded-2xl border-none ring-1 ring-slate-200 bg-white text-slate-900 placeholder-slate-400 focus:ring-2 focus:ring-ares-green shadow-sm text-lg transition-all"
            placeholder="Search for any index (e.g., MSCI World, NASDAQ-100, S&P 500)..."
          />
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden gap-8">
        <div className="flex flex-col flex-1 h-full overflow-hidden">
          <div className="mb-8 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="p-6 rounded-3xl bg-white border border-slate-100 shadow-sm flex flex-col justify-between relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                <BrainCircuit className="w-16 h-16 text-ares-green" />
              </div>
              <div>
                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">AI Sentiment Analysis</h3>
                <p className="text-2xl font-black text-slate-900 font-display">Bullish Trend</p>
              </div>
              <div className="mt-6">
                <div className="flex justify-between text-xs mb-2">
                  <span className="font-bold text-slate-600">Confidence Score</span>
                  <span className="text-ares-dark-green font-black">78/100</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: '78%' }}
                    className="bg-ares-green h-full rounded-full"
                  ></motion.div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="p-5 rounded-3xl bg-emerald-50 border border-emerald-100 flex flex-col justify-center">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Advancing</span>
                <span className="text-3xl font-black text-emerald-600 font-display">1,240</span>
                <span className="text-[10px] text-emerald-600 font-bold flex items-center mt-1">
                  <TrendingUp className="w-3 h-3 mr-1" /> +2.4%
                </span>
              </div>
              <div className="p-5 rounded-3xl bg-rose-50 border border-rose-100 flex flex-col justify-center">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Declining</span>
                <span className="text-3xl font-black text-rose-600 font-display">412</span>
                <span className="text-[10px] text-rose-600 font-bold flex items-center mt-1">
                  <TrendingDown className="w-3 h-3 mr-1" /> -0.8%
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-2 scrollbar-hide">
            {[
              { id: 'ALL', label: 'All Indices' },
              { id: 'AMERICAS', label: 'Americas' },
              { id: 'EMEA', label: 'EMEA' },
              { id: 'APAC', label: 'Asia Pacific' },
              { id: 'COMMODITIES', label: 'Commodities' },
            ].map((cat) => (
              <button 
                key={cat.id}
                onClick={() => setActiveCategory(cat.id as any)}
                className={cn(
                  "px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all whitespace-nowrap",
                  activeCategory === cat.id ? "bg-ares-green text-white shadow-lg shadow-ares-green/20" : "bg-white border border-slate-200 text-slate-500 hover:bg-slate-50"
                )}
              >
                {cat.label}
              </button>
            ))}
          </div>

          <div className="bg-white rounded-3xl border border-slate-100 shadow-sm flex-1 overflow-y-auto">
            <table className="w-full text-left border-collapse">
              <thead className="bg-slate-50/50 sticky top-0 z-10 backdrop-blur-md">
                <tr>
                  <th className="py-5 px-8 text-[10px] font-black text-slate-400 uppercase tracking-widest">Index Name</th>
                  <th className="py-5 px-8 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Price</th>
                  <th className="py-5 px-8 text-[10px] font-black text-slate-400 uppercase tracking-widest hidden sm:table-cell">Trend (24h)</th>
                  <th className="py-5 px-8 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Change</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filtered.map((idx) => (
                  <tr 
                    key={idx.id}
                    onClick={() => setSelectedId(idx.id)}
                    className={cn(
                      "cursor-pointer transition-all border-l-4",
                      selectedId === idx.id ? "bg-ares-green/5 border-ares-green" : "hover:bg-slate-50/50 border-transparent"
                    )}
                  >
                    <td className="py-5 px-8">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center font-black text-xs text-slate-400">
                          {idx.region.substring(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <div className="font-bold text-slate-900">{idx.name}</div>
                          <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{idx.id}</div>
                        </div>
                      </div>
                    </td>
                    <td className="py-5 px-8 text-right font-mono font-bold text-slate-900">
                      {idx.price.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-5 px-8 hidden sm:table-cell w-32">
                      <div className="h-8 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={Array.from({ length: 10 }, (_, i) => ({ v: Math.random() }))}>
                            <Line type="monotone" dataKey="v" stroke={idx.change >= 0 ? "#10b981" : "#f43f5e"} strokeWidth={2} dot={false} />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </td>
                    <td className="py-5 px-8 text-right">
                      <span className={cn(
                        "inline-flex items-center px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest",
                        idx.change >= 0 ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"
                      )}>
                        {idx.change >= 0 ? '+' : ''}{idx.change}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {selectedIndex && (
          <div className="hidden xl:flex w-[400px] flex-col shrink-0">
            <div className="bg-white rounded-3xl shadow-xl border border-slate-100 h-full flex flex-col overflow-hidden">
              <div className="p-8 border-b border-slate-50">
                <div className="flex justify-between items-start mb-6">
                  <div className="bg-slate-100 p-4 rounded-2xl">
                    <Globe className="w-6 h-6 text-slate-400" />
                  </div>
                  <div className="flex gap-2">
                    <button className="p-2 text-slate-400 hover:text-ares-green transition-colors">
                      <Star className="w-5 h-5" />
                    </button>
                    <button className="p-2 text-slate-400 hover:text-ares-green transition-colors">
                      <Share2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>
                <h2 className="text-3xl font-black text-slate-900 font-display">{selectedIndex.name}</h2>
                <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-6">{selectedIndex.id} • Global Index</p>
                <div className="flex items-end gap-3">
                  <span className="text-5xl font-black tracking-tighter text-slate-900">{selectedIndex.price.toLocaleString()}</span>
                  <div className={cn(
                    "flex items-center gap-1 mb-2 px-3 py-1 rounded-xl text-xs font-black uppercase tracking-widest",
                    selectedIndex.change >= 0 ? "text-emerald-600 bg-emerald-50" : "text-rose-600 bg-rose-50"
                  )}>
                    {selectedIndex.change >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                    <span>{selectedIndex.change}%</span>
                  </div>
                </div>
                <p className="text-[10px] text-slate-400 font-bold mt-4">Last updated: 2 mins ago</p>
              </div>

              <div className="flex-1 p-8 flex flex-col">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="font-black text-xs uppercase tracking-widest text-slate-400">Performance</h3>
                  <div className="flex bg-slate-50 rounded-xl p-1">
                    {['1D', '1W', '1M', '1Y'].map(t => (
                      <button key={t} className={cn(
                        "px-3 py-1 text-[10px] font-black rounded-lg transition-all",
                        t === '1W' ? "bg-white text-ares-dark-green shadow-sm" : "text-slate-400 hover:text-slate-600"
                      )}>{t}</button>
                    ))}
                  </div>
                </div>

                <div className="relative w-full h-48 mb-8">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={Array.from({ length: 20 }, (_, i) => ({ v: 30 + Math.random() * 20 }))}>
                      <defs>
                        <linearGradient id="colorIdx" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#36e27b" stopOpacity={0.2}/>
                          <stop offset="95%" stopColor="#36e27b" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <Area type="monotone" dataKey="v" stroke="#36e27b" fillOpacity={1} fill="url(#colorIdx)" strokeWidth={3} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {[
                    { label: 'YTD Return', value: '+24.8%', color: 'text-emerald-600' },
                    { label: '5Y CAGR', value: '12.4%', color: 'text-slate-900' },
                    { label: 'Volatility', value: '14.2%', color: 'text-amber-500' },
                    { label: 'P/E Ratio', value: '26.5x', color: 'text-slate-900' },
                  ].map(stat => (
                    <div key={stat.label} className="p-4 bg-slate-50 rounded-2xl">
                      <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mb-1">{stat.label}</p>
                      <p className={cn("text-lg font-black", stat.color)}>{stat.value}</p>
                    </div>
                  ))}
                </div>

                <button className="mt-auto w-full py-4 bg-slate-900 hover:bg-slate-800 text-white font-black uppercase tracking-widest text-xs rounded-2xl transition-all flex items-center justify-center gap-2">
                  Analyze Composition <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
