import React, { useState, useRef } from 'react';
import { Trash2, TrendingUp, ArrowUpRight, Zap, HelpCircle, Wallet, User, Download, Upload, Edit2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { SavedAlphaTrade, SavedWallet } from '../types';
import { cn } from '../lib/utils';

interface SavedTradesProps {
    trades: SavedAlphaTrade[];
    wallets: SavedWallet[];
    onDeleteTrade: (id: string) => void;
    onDeleteWallet: (id: string) => void;
    onUpdateTrade?: (trade: SavedAlphaTrade) => void;
    onNavigatePolymarket: () => void;
    onExport?: () => void;
    onImport?: (data: any) => void;
}

export const SavedTrades: React.FC<SavedTradesProps> = ({
    trades,
    wallets,
    onDeleteTrade,
    onDeleteWallet,
    onUpdateTrade,
    onNavigatePolymarket,
    onExport,
    onImport
}) => {
    const [activeView, setActiveView] = useState<'trades' | 'wallets'>('trades');
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [editingTradeId, setEditingTradeId] = useState<string | null>(null);
    const [editForm, setEditForm] = useState<{ side: 'YES' | 'NO', shares: number, entryPrice: number }>({ side: 'YES', shares: 0, entryPrice: 0 });
    const [liveData, setLiveData] = useState<Record<string, { price: number, closed: boolean, resolvedOutcome: string | null }>>({});

    React.useEffect(() => {
        if (trades.length === 0) return;

        const fetchLiveTracker = async () => {
            try {
                const slugs = trades.map(t => t.signal.id).filter(Boolean);
                const res = await fetch('/api/polymarket/tracker', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ slugs })
                });
                if (res.ok) {
                    const data = await res.json();
                    const liveMap: Record<string, any> = {};
                    data.forEach((d: any) => {
                        liveMap[d.slug] = d;
                    });
                    setLiveData(liveMap);
                }
            } catch (err) {
                console.error("Failed to fetch live tracker data", err);
            }
        };

        fetchLiveTracker();
        const interval = setInterval(fetchLiveTracker, 10000);
        return () => clearInterval(interval);
    }, [trades]);

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !onImport) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const json = JSON.parse(event.target?.result as string);
                onImport(json);
                // Clear input to allow re-uploading the same file
                if (fileInputRef.current) fileInputRef.current.value = '';
            } catch (err) {
                console.error("Error parsing JSON file", err);
                alert("Invalid JSON file uploaded.");
            }
        };
        reader.readAsText(file);
    };

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
                    <h1 className="text-3xl font-extrabold text-slate-900 font-display tracking-tight mb-2">Strategy Tracker</h1>
                    <p className="text-slate-500">Paper trade your bookmarked Alpha Signals against live market logic.</p>
                </div>

                <div className="flex items-center gap-4">
                    {/* Actions */}
                    <div className="flex items-center gap-2">
                        <input
                            type="file"
                            accept=".json"
                            ref={fileInputRef}
                            style={{ display: 'none' }}
                            onChange={handleFileUpload}
                        />
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            className="p-2.5 text-slate-400 hover:text-ares-green hover:bg-ares-green/10 rounded-xl transition-all"
                            title="Import Trades & Wallets"
                        >
                            <Upload className="w-4 h-4" />
                        </button>
                        <button
                            onClick={onExport}
                            className="p-2.5 text-slate-400 hover:text-ares-green hover:bg-ares-green/10 rounded-xl transition-all"
                            title="Export Trades & Wallets"
                        >
                            <Download className="w-4 h-4" />
                        </button>
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
                                {trades.map((trade, i) => {
                                    const isEditing = editingTradeId === trade.id;
                                    const hasPosition = trade.shares !== undefined && trade.shares > 0;

                                    const slug = trade.signal.id;
                                    const liveInf = liveData[slug];
                                    const isClosed = liveInf?.closed;

                                    // Price definitions
                                    const entryPrice = trade.entryPrice ?? trade.signal.marketPrice;
                                    const fairValue = trade.signal.fairValue;
                                    const livePrice = liveInf?.price ?? trade.signal.marketPrice;

                                    let unrealizedPnL = 0;
                                    let roi = 0;

                                    if (hasPosition && trade.side) {
                                        const costBasis = trade.shares! * entryPrice;
                                        const currentValue = trade.shares! * livePrice;
                                        unrealizedPnL = currentValue - costBasis;
                                        roi = (costBasis > 0) ? (unrealizedPnL / costBasis) * 100 : 0;
                                    }

                                    // Visualizer Progress Bar Math
                                    const minP = Math.min(entryPrice, livePrice, fairValue);
                                    const maxP = Math.max(entryPrice, livePrice, fairValue);
                                    const range = Math.max(0.01, maxP - minP); // avoid div by 0

                                    const getPos = (p: number) => ((p - minP) / range) * 100;

                                    const entryPos = getPos(entryPrice);
                                    const livePos = getPos(livePrice);
                                    const fairPos = getPos(fairValue);

                                    // Determines if market moved towards fair value
                                    const edgeIsWorking = (fairValue > entryPrice && livePrice > entryPrice) ||
                                        (fairValue < entryPrice && livePrice < entryPrice);

                                    return (
                                        <motion.div
                                            key={trade.id}
                                            initial={{ opacity: 0, scale: 0.95 }}
                                            animate={{ opacity: 1, scale: 1 }}
                                            transition={{ delay: i * 0.05 }}
                                            className={cn("bg-white rounded-3xl border border-slate-100 shadow-sm hover:shadow-xl transition-all p-6 flex flex-col relative overflow-hidden", isClosed && "opacity-80")}
                                        >
                                            {isClosed && (
                                                <div className="absolute inset-0 z-10 bg-slate-50/50 backdrop-blur-[2px] pointer-events-none flex items-center justify-center">
                                                    <div className={cn(
                                                        "px-6 py-2 rounded-2xl font-black text-2xl uppercase tracking-[0.2em] transform -rotate-12 shadow-xl border-4",
                                                        liveInf.resolvedOutcome === 'SPLIT' ? "text-amber-500 bg-amber-50 border-amber-200" :
                                                            liveInf.resolvedOutcome === trade.side ? "text-emerald-500 bg-emerald-50 border-emerald-200" :
                                                                "text-rose-500 bg-rose-50 border-rose-200"
                                                    )}>
                                                        {liveInf.resolvedOutcome === 'SPLIT' ? "PUSH" :
                                                            liveInf.resolvedOutcome === trade.side ? "WON" : "LOST"}
                                                    </div>
                                                </div>
                                            )}

                                            <div className="flex justify-between items-start mb-3">
                                                <div className="flex gap-2">
                                                    <span className="px-3 py-1 bg-slate-100 text-slate-600 text-[10px] font-black rounded-full uppercase tracking-widest">
                                                        EDGE {(Math.abs(fairValue - entryPrice) * 100).toFixed(1)}%
                                                    </span>
                                                    {trade.side && (
                                                        <span className={cn(
                                                            "px-3 py-1 text-[10px] font-black rounded-full uppercase tracking-widest",
                                                            trade.side === 'YES' ? "bg-blue-50 text-blue-600" : "bg-rose-50 text-rose-600"
                                                        )}>
                                                            {trade.side}
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-1 z-20">
                                                    <a
                                                        href={`https://polymarket.com/event/${trade.signal.eventSlug ?? trade.signal.id}`}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="p-1.5 bg-slate-50 rounded-lg hover:bg-ares-green/10 transition-colors pointer-events-auto"
                                                        title="Open on Polymarket"
                                                    >
                                                        <ArrowUpRight className="w-3.5 h-3.5 text-slate-400 hover:text-ares-green" />
                                                    </a>
                                                    <button
                                                        onClick={() => onDeleteTrade(trade.id)}
                                                        className="p-1.5 bg-slate-50 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 transition-colors pointer-events-auto"
                                                        title="Delete trade"
                                                    >
                                                        <Trash2 className="w-3.5 h-3.5" />
                                                    </button>
                                                </div>
                                            </div>

                                            <h3 className="font-bold text-slate-900 mb-1 line-clamp-2 min-h-[3rem]">
                                                {trade.signal.marketName}
                                            </h3>
                                            <p className="text-[10px] text-slate-400 font-semibold mb-6 flex justify-between">
                                                <span>Saved {new Date(trade.savedAt).toLocaleDateString()}</span>
                                                <span className="flex items-center gap-1">
                                                    <div className={cn("w-1.5 h-1.5 rounded-full", isClosed ? "bg-slate-300" : "bg-ares-green animate-pulse")} />
                                                    {isClosed ? 'Resolved' : 'Live'}
                                                </span>
                                            </p>

                                            {/* Edge Visualizer */}
                                            <div className="mb-6">
                                                <div className="h-1.5 bg-slate-100 rounded-full relative w-full mb-8">
                                                    {/* Track connection from entry to live */}
                                                    <div
                                                        className={cn("absolute h-full rounded-full transition-all duration-1000", edgeIsWorking ? "bg-emerald-400" : "bg-rose-400")}
                                                        style={{
                                                            left: `${Math.min(entryPos, livePos)}%`,
                                                            width: `${Math.abs(livePos - entryPos)}%`
                                                        }}
                                                    />

                                                    {/* Nodes */}
                                                    <div className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-slate-400 rounded-full outline outline-4 outline-white shadow-sm transition-all duration-1000" style={{ left: `calc(${entryPos}% - 6px)` }}>
                                                        <div className="absolute top-4 left-1/2 -translate-x-1/2 text-[9px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">Entry {(entryPrice * 100).toFixed(1)}</div>
                                                    </div>

                                                    <div className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-indigo-500 rounded-full outline outline-4 outline-white shadow-sm transition-all duration-1000" style={{ left: `calc(${fairPos}% - 6px)` }}>
                                                        <div className="absolute top-4 left-1/2 -translate-x-1/2 text-[9px] font-black text-indigo-500 uppercase tracking-widest whitespace-nowrap">Fair {(fairValue * 100).toFixed(1)}</div>
                                                    </div>

                                                    <div className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-slate-900 rounded-full outline outline-4 outline-white shadow-md z-10 transition-all duration-1000" style={{ left: `calc(${livePos}% - 8px)` }}>
                                                        <div className={cn("absolute -top-6 left-1/2 -translate-x-1/2 text-[10px] font-black uppercase tracking-widest whitespace-nowrap px-2 py-0.5 rounded-md text-white", edgeIsWorking ? "bg-emerald-500" : "bg-rose-500")}>{(livePrice * 100).toFixed(1)}</div>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* PqL Metrics */}
                                            {hasPosition && (
                                                <div className="mt-auto p-4 bg-slate-900 rounded-2xl flex items-center justify-between">
                                                    <div>
                                                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">
                                                            {isClosed ? 'Realized PnL' : 'Unrealized'}
                                                        </span>
                                                        <span className={cn("text-lg font-black", unrealizedPnL >= 0 ? "text-emerald-400" : "text-rose-400")}>
                                                            {unrealizedPnL >= 0 ? '+' : ''}{formatCurrency(unrealizedPnL)}
                                                        </span>
                                                    </div>
                                                    <div className="text-right">
                                                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">
                                                            ROI
                                                        </span>
                                                        <span className={cn("text-lg font-black", roi >= 0 ? "text-emerald-400" : "text-rose-400")}>
                                                            {roi >= 0 ? '+' : ''}{roi.toFixed(1)}%
                                                        </span>
                                                    </div>
                                                </div>
                                            )}
                                        </motion.div>
                                    );
                                })}
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
