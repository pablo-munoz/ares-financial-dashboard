import React, { useState } from 'react';
import { Trash2, TrendingUp, ArrowUpRight, Zap, HelpCircle, Wallet, User } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { SavedAlphaTrade, SavedWallet } from '../types';
import { cn } from '../lib/utils';

interface SavedTradesProps {
    trades: SavedAlphaTrade[];
    wallets: SavedWallet[];
    onDeleteTrade: (id: string) => void;
    onDeleteWallet: (id: string) => void;
    onNavigatePolymarket: () => void;
}

export const SavedTrades: React.FC<SavedTradesProps> = ({
    trades,
    wallets,
    onDeleteTrade,
    onDeleteWallet,
    onNavigatePolymarket,
}) => {
    const [activeView, setActiveView] = useState<'trades' | 'wallets'>('trades');

    const formatCurrency = (value: number) =>
        `$${value.toLocaleString(undefined, { maximumFractionDigits: 2, minimumFractionDigits: 2 })}`;

    const renderEmptyState = (type: 'trades' | 'wallets') => (
        <div className="flex flex-col items-center justify-center h-[50vh] gap-6">
            <div className="p-6 bg-slate-50 rounded-full">
                {type === 'trades' ? (
                    <Zap className="w-12 h-12 text-slate-300" />
                ) : (
                    <Wallet className="w-12 h-12 text-slate-300" />
                )}
            </div>
            <div className="text-center">
                <h2 className="text-2xl font-extrabold text-slate-900 font-display mb-2">
                    No Saved {type === 'trades' ? 'Trades' : 'Wallets'}
                </h2>
                <p className="text-slate-500 max-w-sm">
                    Head to the Polymarket Alpha page and save {type === 'trades' ? 'signals' : 'insiders or whales'} you want to track.
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

    return (
        <div className="space-y-8 animate-in fade-in duration-700">
            <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div>
                    <h1 className="text-3xl font-extrabold text-slate-900 font-display tracking-tight mb-2">Saved Items</h1>
                    <p className="text-slate-500">Track your bookmarked Alpha Signals and smart money wallets.</p>
                </div>

                {/* Toggle Group */}
                <div className="flex bg-slate-100 p-1 rounded-2xl shrink-0">
                    <button
                        onClick={() => setActiveView('trades')}
                        className={cn(
                            "px-6 py-2.5 text-xs font-black uppercase tracking-widest rounded-xl transition-all flex items-center gap-2",
                            activeView === 'trades' ? "bg-white text-slate-900 shadow-sm" : "text-slate-400 hover:text-slate-600"
                        )}
                    >
                        <Zap className="w-4 h-4" />
                        Trades ({trades.length})
                    </button>
                    <button
                        onClick={() => setActiveView('wallets')}
                        className={cn(
                            "px-6 py-2.5 text-xs font-black uppercase tracking-widest rounded-xl transition-all flex items-center gap-2",
                            activeView === 'wallets' ? "bg-white text-slate-900 shadow-sm" : "text-slate-400 hover:text-slate-600"
                        )}
                    >
                        <Wallet className="w-4 h-4" />
                        Wallets ({wallets.length})
                    </button>
                </div>
            </header>

            <AnimatePresence mode="wait">
                <motion.div
                    key={activeView}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.2 }}
                >
                    {activeView === 'trades' && (
                        trades.length === 0 ? renderEmptyState('trades') : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {trades.map((trade, i) => (
                                    <motion.div
                                        key={trade.id}
                                        initial={{ opacity: 0, scale: 0.95 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        transition={{ delay: i * 0.05 }}
                                        className="bg-white rounded-3xl border border-slate-100 shadow-sm hover:shadow-xl transition-all p-6 flex flex-col"
                                    >
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
                                                    onClick={() => onDeleteTrade(trade.id)}
                                                    className="p-1.5 bg-slate-50 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 transition-colors"
                                                    title="Delete trade"
                                                >
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                        </div>

                                        <h3 className="font-bold text-slate-900 mb-1 line-clamp-2 min-h-[3rem]">
                                            {trade.signal.marketName}
                                        </h3>
                                        <p className="text-[10px] text-slate-400 font-semibold mb-4">
                                            Saved {new Date(trade.savedAt).toLocaleDateString()}, {new Date(trade.savedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </p>

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
                                    </motion.div>
                                ))}
                            </div>
                        )
                    )}

                    {activeView === 'wallets' && (
                        wallets.length === 0 ? renderEmptyState('wallets') : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {wallets.map((wallet, i) => (
                                    <motion.div
                                        key={wallet.id}
                                        initial={{ opacity: 0, scale: 0.95 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        transition={{ delay: i * 0.05 }}
                                        className="bg-white rounded-3xl border border-slate-100 shadow-sm hover:shadow-xl transition-all p-6 flex flex-col"
                                    >
                                        <div className="flex justify-between items-start mb-4">
                                            <span className={cn(
                                                "px-3 py-1 text-[10px] font-black rounded-full uppercase tracking-widest flex items-center gap-1.5",
                                                wallet.source === 'insider'
                                                    ? "bg-rose-50 text-rose-600"
                                                    : "bg-blue-50 text-blue-600"
                                            )}>
                                                {wallet.source === 'insider' ? <User className="w-3 h-3" /> : <TrendingUp className="w-3 h-3" />}
                                                {wallet.source}
                                            </span>
                                            <div className="flex items-center gap-1">
                                                <a
                                                    href={`https://polymarket.com/profile/${wallet.address}`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="p-1.5 bg-slate-50 rounded-lg hover:bg-ares-green/10 transition-colors"
                                                    title="View Profile"
                                                >
                                                    <ArrowUpRight className="w-3.5 h-3.5 text-slate-400 hover:text-ares-green" />
                                                </a>
                                                <button
                                                    onClick={() => onDeleteWallet(wallet.id)}
                                                    className="p-1.5 bg-slate-50 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 transition-colors"
                                                    title="Delete wallet"
                                                >
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                        </div>

                                        <div className="flex-1">
                                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Wallet Address</p>
                                            <h3 className="font-mono font-bold text-slate-900 break-all mb-4">
                                                {wallet.address}
                                            </h3>

                                            {wallet.notes && (
                                                <div className="p-3 bg-slate-50 rounded-xl mb-4">
                                                    <p className="text-xs font-semibold text-slate-600">
                                                        "{wallet.notes}"
                                                    </p>
                                                </div>
                                            )}
                                        </div>

                                        <div className="mt-auto pt-4 border-t border-slate-50 text-[10px] text-slate-400 font-semibold flex items-center justify-between">
                                            <span>Saved on {new Date(wallet.savedAt).toLocaleDateString()}</span>
                                            <span>{new Date(wallet.savedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                        </div>
                                    </motion.div>
                                ))}
                            </div>
                        )
                    )}
                </motion.div>
            </AnimatePresence>
        </div>
    );
};
