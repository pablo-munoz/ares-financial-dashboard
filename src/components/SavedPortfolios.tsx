import React from 'react';
import { Bookmark, Trash2, TrendingUp, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import {
    AreaChart,
    Area,
    ResponsiveContainer,
} from 'recharts';
import { Asset, SavedPortfolio } from '../types';
import { cn } from '../lib/utils';

interface SavedPortfoliosProps {
    portfolios: SavedPortfolio[];
    assets: Asset[];
    onDelete: (id: string) => void;
    onNavigateDashboard: () => void;
}

export const SavedPortfolios: React.FC<SavedPortfoliosProps> = ({
    portfolios,
    assets,
    onDelete,
    onNavigateDashboard,
}) => {
    const formatCurrency = (v: number) =>
        `$${v.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

    const formatDate = (iso: string) => {
        const d = new Date(iso);
        return d.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    return (
        <div className="space-y-8 animate-in fade-in duration-700">
            <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-extrabold text-slate-900 font-display tracking-tight mb-2">
                        Saved Portfolios
                    </h1>
                    <p className="text-slate-500">
                        Browse and compare your previously generated portfolio compositions.
                    </p>
                </div>
                <div className="flex items-center gap-2 text-xs font-black tracking-widest uppercase text-slate-400">
                    <Bookmark className="w-4 h-4" />
                    {portfolios.length} Saved
                </div>
            </header>

            {portfolios.length === 0 ? (
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white rounded-3xl border border-slate-100 p-16 shadow-sm flex flex-col items-center justify-center text-center"
                >
                    <div className="p-4 bg-slate-100 rounded-2xl mb-6">
                        <Bookmark className="w-10 h-10 text-slate-400" />
                    </div>
                    <h3 className="text-xl font-bold text-slate-900 mb-2 font-display">
                        No Saved Portfolios Yet
                    </h3>
                    <p className="text-slate-500 max-w-md mb-8">
                        Generate a portfolio from the Dashboard, then click the{' '}
                        <strong>"Save Portfolio"</strong> button to keep it here for future
                        reference.
                    </p>
                    <button
                        onClick={onNavigateDashboard}
                        className="px-6 py-3 bg-ares-green text-white rounded-2xl font-bold shadow-lg shadow-ares-green/20 flex items-center gap-2 hover:scale-[1.02] active:scale-[0.98] transition-all"
                    >
                        Go to Dashboard <ChevronRight className="w-5 h-5" />
                    </button>
                </motion.div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                    <AnimatePresence>
                        {portfolios.map((p, i) => {
                            const topHoldings = Object.entries(p.optimization.weights)
                                .sort(([, a], [, b]) => (b as number) - (a as number))
                                .slice(0, 5);

                            const finalValue =
                                p.backtest.growth[p.backtest.growth.length - 1]?.portfolio ?? 0;

                            // Calculate live value using exact entry prices
                            let liveValue = 0;
                            const investmentAmount = p.investment || 100000; // Fallback for legacy portfolios
                            Object.entries(p.optimization.weights).forEach(([ticker, weight]) => {
                                const initialDollars = (weight as number) * investmentAmount;
                                const entryPrice = p.entryPrices?.[ticker] || 1; // Fallback to avoid div by 0 if missing
                                const shares = initialDollars / entryPrice;

                                const liveAsset = assets.find(a => a.id === ticker);
                                const currentPrice = liveAsset ? liveAsset.price : entryPrice;

                                liveValue += shares * currentPrice;
                            });

                            const isProfit = liveValue >= investmentAmount;
                            const pnlAbs = Math.abs(liveValue - investmentAmount);
                            const pnlPct = (pnlAbs / investmentAmount) * 100;

                            return (
                                <motion.div
                                    key={p.id}
                                    layout
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, scale: 0.95 }}
                                    transition={{ delay: i * 0.05 }}
                                    className="bg-white rounded-3xl border border-slate-100 p-6 shadow-sm hover:shadow-md transition-shadow flex flex-col"
                                >
                                    {/* Header */}
                                    <div className="flex items-start justify-between mb-4">
                                        <div className="flex-1 min-w-0">
                                            <h3 className="text-base font-bold text-slate-900 truncate font-display">
                                                {p.name}
                                            </h3>
                                            <p className="text-[10px] text-slate-400 font-bold mt-1">
                                                {formatDate(p.savedAt)}
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span
                                                className={cn(
                                                    'px-2 py-1 text-[9px] font-black rounded-full uppercase tracking-widest',
                                                    p.optimization.strategy === 'Aggressive'
                                                        ? 'bg-rose-50 text-rose-600'
                                                        : p.optimization.strategy === 'Balanced'
                                                            ? 'bg-amber-50 text-amber-600'
                                                            : 'bg-emerald-50 text-emerald-600'
                                                )}
                                            >
                                                {p.optimization.strategy}
                                            </span>
                                            <button
                                                onClick={() => onDelete(p.id)}
                                                className="p-1.5 rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-500 transition-colors"
                                                title="Delete portfolio"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>

                                    {/* Mini Sparkline */}
                                    <div className="h-24 w-full mb-4 rounded-xl overflow-hidden bg-slate-50">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <AreaChart data={p.backtest.growth}>
                                                <defs>
                                                    <linearGradient
                                                        id={`grad-${p.id}`}
                                                        x1="0"
                                                        y1="0"
                                                        x2="0"
                                                        y2="1"
                                                    >
                                                        <stop
                                                            offset="5%"
                                                            stopColor="#36e27b"
                                                            stopOpacity={0.15}
                                                        />
                                                        <stop
                                                            offset="95%"
                                                            stopColor="#36e27b"
                                                            stopOpacity={0}
                                                        />
                                                    </linearGradient>
                                                </defs>
                                                <Area
                                                    type="monotone"
                                                    dataKey="portfolio"
                                                    stroke="#36e27b"
                                                    strokeWidth={2}
                                                    fill={`url(#grad-${p.id})`}
                                                />
                                            </AreaChart>
                                        </ResponsiveContainer>
                                    </div>

                                    {/* Key Metrics */}
                                    <div className="grid grid-cols-3 gap-3 mb-4">
                                        <div className="bg-slate-50 rounded-xl p-3 text-center">
                                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">
                                                Return
                                            </p>
                                            <p className="text-sm font-black text-emerald-500">
                                                {(p.optimization.expected_return * 100).toFixed(1)}%
                                            </p>
                                        </div>
                                        <div className="bg-slate-50 rounded-xl p-3 text-center">
                                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">
                                                Vol
                                            </p>
                                            <p className="text-sm font-black text-slate-900">
                                                {(p.optimization.volatility * 100).toFixed(1)}%
                                            </p>
                                        </div>
                                        <div className="bg-slate-50 rounded-xl p-3 text-center">
                                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">
                                                Sharpe
                                            </p>
                                            <p className="text-sm font-black text-indigo-500">
                                                {p.optimization.sharpe_ratio}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Final Value */}
                                    <div className="flex items-center justify-between px-1 mb-2">
                                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                            Projected Final Value
                                        </span>
                                        <span className="text-sm font-black text-slate-900">
                                            {formatCurrency(finalValue)}
                                        </span>
                                    </div>

                                    {/* Current Live Value */}
                                    <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 mb-5 flex items-center justify-between">
                                        <div>
                                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">
                                                Live Value
                                            </span>
                                            <span className="text-xl font-bold text-slate-900 font-display">
                                                {formatCurrency(liveValue)}
                                            </span>
                                        </div>
                                        <div className={cn(
                                            "text-right",
                                            isProfit ? "text-ares-green" : "text-rose-500"
                                        )}>
                                            <span className="text-[10px] font-black uppercase tracking-widest block mb-1">
                                                All-Time P&L
                                            </span>
                                            <div className="text-sm font-bold flex items-center justify-end gap-1">
                                                {isProfit ? '+' : '-'}{formatCurrency(pnlAbs)}
                                                <span className="text-xs">({isProfit ? '+' : '-'}{pnlPct.toFixed(2)}%)</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Top Holdings */}
                                    <div className="space-y-2 mt-auto">
                                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                                            Top Holdings
                                        </p>
                                        {topHoldings.map(([ticker, weight], j) => (
                                            <div key={ticker} className="flex items-center gap-2">
                                                <span className="text-[11px] font-bold text-slate-700 w-12 shrink-0">
                                                    {ticker}
                                                </span>
                                                <div className="flex-1 bg-slate-100 h-1.5 rounded-full overflow-hidden">
                                                    <div
                                                        className={cn(
                                                            'h-full rounded-full transition-all',
                                                            j === 0
                                                                ? 'bg-ares-green'
                                                                : j === 1
                                                                    ? 'bg-indigo-400'
                                                                    : j === 2
                                                                        ? 'bg-blue-300'
                                                                        : 'bg-slate-300'
                                                        )}
                                                        style={{ width: `${(weight as number) * 100}%` }}
                                                    />
                                                </div>
                                                <span className="text-[11px] font-black text-slate-900 w-10 text-right">
                                                    {((weight as number) * 100).toFixed(0)}%
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </motion.div>
                            );
                        })}
                    </AnimatePresence>
                </div>
            )}
        </div>
    );
};
