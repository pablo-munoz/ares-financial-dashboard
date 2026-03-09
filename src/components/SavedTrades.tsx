import React from 'react';
import { Trash2, TrendingUp, ArrowUpRight, Zap, HelpCircle } from 'lucide-react';
import { motion } from 'motion/react';
import { SavedAlphaTrade } from '../types';
import { cn } from '../lib/utils';

interface SavedTradesProps {
    trades: SavedAlphaTrade[];
    onDelete: (id: string) => void;
    onNavigatePolymarket: () => void;
}

export const SavedTrades: React.FC<SavedTradesProps> = ({
    trades,
    onDelete,
    onNavigatePolymarket,
}) => {
    const formatCurrency = (value: number) =>
        `$${value.toLocaleString(undefined, { maximumFractionDigits: 2, minimumFractionDigits: 2 })}`;

    if (trades.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-[60vh] gap-6">
                <div className="p-6 bg-slate-50 rounded-full">
                    <Zap className="w-12 h-12 text-slate-300" />
                </div>
                <div className="text-center">
                    <h2 className="text-2xl font-extrabold text-slate-900 font-display mb-2">No Saved Trades</h2>
                    <p className="text-slate-500 max-w-sm">
                        Head to the Polymarket Alpha page and save signals you want to track.
                    </p>
                </div>
                <button
                    onClick={onNavigatePolymarket}
                    className="px-6 py-3 bg-ares-green text-white font-bold rounded-xl shadow-lg shadow-ares-green/20 hover:bg-ares-dark-green transition-colors"
                >
                    Open Polymarket Alpha
                </button>
            </div>
        );
    }

    return (
        <div className="space-y-8 animate-in fade-in duration-700">
            <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-extrabold text-slate-900 font-display tracking-tight mb-2">Saved Trades</h1>
                    <p className="text-slate-500">Your bookmarked Alpha Signal trades from Polymarket.</p>
                </div>
                <span className="text-xs font-black tracking-widest uppercase text-slate-400">
                    📋 {trades.length} saved
                </span>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {trades.map((trade, i) => (
                    <motion.div
                        key={trade.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.05 }}
                        className="bg-white rounded-3xl border border-slate-100 shadow-sm hover:shadow-xl transition-all p-6 flex flex-col"
                    >
                        {/* Header */}
                        <div className="flex justify-between items-start mb-3">
                            <span className="px-3 py-1 bg-emerald-50 text-emerald-600 text-[10px] font-black rounded-full uppercase tracking-widest">
                                EV+ {trade.signal.ev}%
                            </span>
                            <div className="flex items-center gap-1">
                                <a
                                    href={`https://polymarket.com/event/${trade.signal.eventSlug ?? trade.signal.id}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="p-1.5 bg-slate-50 rounded-lg hover:bg-ares-green/10 transition-colors"
                                    title="Open on Polymarket"
                                >
                                    <ArrowUpRight className="w-3.5 h-3.5 text-slate-400 hover:text-ares-green" />
                                </a>
                                <button
                                    onClick={() => onDelete(trade.id)}
                                    className="p-1.5 bg-slate-50 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 transition-colors"
                                    title="Delete trade"
                                >
                                    <Trash2 className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        </div>

                        {/* Market Name */}
                        <h3 className="font-bold text-slate-900 mb-1 line-clamp-2 min-h-[3rem]">
                            {trade.signal.marketName}
                        </h3>
                        <p className="text-[10px] text-slate-400 font-semibold mb-4">
                            Saved {new Date(trade.savedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}, {new Date(trade.savedAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                        </p>

                        {/* Metrics Grid */}
                        <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-50">
                            <div>
                                <div className="flex items-center gap-1.5 mb-1 text-slate-400">
                                    <p className="text-[10px] font-black tracking-widest uppercase">Fair Value</p>
                                    <HelpCircle className="w-3 h-3 text-slate-300" />
                                </div>
                                <p className="text-lg font-black text-ares-green">
                                    {(trade.signal.fairValue * 100).toFixed(1)}%
                                </p>
                            </div>
                            <div>
                                <div className="flex items-center gap-1.5 mb-1 text-slate-400">
                                    <p className="text-[10px] font-black tracking-widest uppercase">Market Price</p>
                                    <HelpCircle className="w-3 h-3 text-slate-300" />
                                </div>
                                <p className="text-lg font-black text-slate-900">
                                    {(trade.signal.marketPrice * 100).toFixed(1)}%
                                </p>
                            </div>
                        </div>

                        {/* Stake Info */}
                        <div className="mt-4 p-3 bg-slate-900 rounded-2xl flex items-center justify-between">
                            <div>
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-0.5">
                                    Kelly Stake
                                </span>
                                <span className="text-white font-black text-sm">
                                    {trade.signal.kellyStake.toFixed(1)}%
                                </span>
                            </div>
                            <div className="text-right">
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-0.5">
                                    Amount
                                </span>
                                <span className="text-ares-green font-black text-sm">
                                    {formatCurrency(trade.stakeAmount)}
                                </span>
                            </div>
                        </div>

                        {/* Bankroll at time of save */}
                        <div className="mt-3 text-center">
                            <span className="text-[10px] text-slate-400 font-semibold">
                                Bankroll at save: {formatCurrency(trade.bankroll)}
                            </span>
                        </div>
                    </motion.div>
                ))}
            </div>
        </div>
    );
};
