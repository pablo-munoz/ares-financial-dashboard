import React, { useState } from 'react';
import { Search, TrendingUp, CheckCircle2, ArrowRight } from 'lucide-react';
import { motion } from 'motion/react';
import { Asset } from '../types';
import { cn } from '../lib/utils';

interface AssetSelectionProps {
  assets: Asset[];
  selectedAssets: string[];
  toggleAsset: (id: string) => void;
}

export const AssetSelection: React.FC<AssetSelectionProps> = ({ assets, selectedAssets, toggleAsset }) => {
  const [search, setSearch] = useState('');
  const filtered = assets.filter(a => a.id.toLowerCase().includes(search.toLowerCase()) || a.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="flex flex-col lg:flex-row gap-8 h-full overflow-hidden animate-in slide-in-from-bottom-4 duration-500">
      <div className="flex-1 overflow-y-auto pr-4">
        <h2 className="text-3xl font-bold mb-2 font-display">Select Assets for Optimization</h2>
        <p className="text-slate-500 mb-8">Choose from over 5,000 global equities to build your model.</p>

        <div className="flex gap-4 mb-8 sticky top-0 bg-[#f6f8f7] py-2 z-10">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 text-slate-400 w-5 h-5" />
            <input 
              type="text" 
              placeholder="Search assets..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-ares-green transition-all"
            />
          </div>
          <div className="flex gap-2">
            <button className="px-4 py-2 bg-ares-green text-white rounded-xl font-bold shadow-sm">All Assets</button>
            <button className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50">Technology</button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 pb-10">
          {filtered.map((asset) => {
            const isSelected = selectedAssets.includes(asset.id);
            return (
              <motion.div 
                layout
                key={asset.id}
                onClick={() => toggleAsset(asset.id)}
                className={cn(
                  "bg-white p-6 rounded-2xl border-2 transition-all cursor-pointer group relative",
                  isSelected ? "border-ares-green shadow-md" : "border-transparent shadow-sm hover:border-slate-200"
                )}
              >
                {isSelected && (
                  <div className="absolute top-4 right-4 text-ares-green">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                )}
                <div className="flex items-center gap-4 mb-4">
                  <div className="p-3 bg-slate-100 rounded-xl group-hover:bg-ares-green/10 transition-colors">
                    <TrendingUp className="w-6 h-6 text-slate-600 group-hover:text-ares-dark-green" />
                  </div>
                  <div>
                    <h4 className="font-bold">{asset.id}</h4>
                    <p className="text-xs text-slate-500">{asset.name}</p>
                  </div>
                </div>
                <div className="flex justify-between items-end">
                  <div>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Price</p>
                    <p className="font-bold">${asset.price.toFixed(2)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Change</p>
                    <p className={cn("font-bold", asset.change >= 0 ? "text-emerald-500" : "text-rose-500")}>
                      {asset.change >= 0 ? '+' : ''}{asset.change.toFixed(1)}%
                    </p>
                  </div>
                </div>
                <button className={cn(
                  "w-full mt-4 py-2 font-bold rounded-lg transition-all",
                  isSelected 
                    ? "bg-ares-green/10 text-ares-dark-green" 
                    : "bg-slate-50 text-slate-400 group-hover:bg-ares-green group-hover:text-white"
                )}>
                  {isSelected ? 'Selected' : 'Select Asset'}
                </button>
              </motion.div>
            );
          })}
        </div>
      </div>

      <div className="w-full lg:w-80 bg-white border border-slate-200 rounded-3xl p-6 flex flex-col shadow-sm h-fit sticky top-8">
        <h3 className="font-bold text-lg mb-6 flex items-center gap-2 font-display">
          <TrendingUp className="w-5 h-5 text-ares-green" /> Quick Stats
        </h3>
        <div className="space-y-6 flex-1">
          <div className="bg-slate-50 p-4 rounded-2xl">
            <p className="text-sm text-slate-500">Total Assets Selected</p>
            <p className="text-4xl font-bold font-display">{selectedAssets.length}</p>
            <div className="w-full bg-slate-200 h-1.5 rounded-full mt-3 overflow-hidden">
              <div 
                className="bg-ares-green h-full transition-all duration-500" 
                style={{ width: `${Math.min((selectedAssets.length / assets.length) * 100, 100)}%` }}
              ></div>
            </div>
          </div>
          
          <div>
            <p className="text-sm font-bold text-slate-700 mb-3">Allocation Preview</p>
            <div className="flex items-end gap-2 h-32 bg-slate-50/50 rounded-2xl p-4">
              {selectedAssets.length > 0 ? (
                selectedAssets.map((_, i) => (
                  <motion.div 
                    initial={{ height: 0 }}
                    animate={{ height: `${Math.random() * 80 + 20}%` }}
                    key={i} 
                    className={cn(
                      "w-full rounded-t-md",
                      i % 3 === 0 ? "bg-slate-800" : i % 3 === 1 ? "bg-slate-400" : "bg-ares-green"
                    )}
                  ></motion.div>
                ))
              ) : (
                <div className="w-full h-full flex items-center justify-center text-slate-300 text-xs text-center">
                  Select assets to see preview
                </div>
              )}
            </div>
          </div>
        </div>
        <button 
          disabled={selectedAssets.length === 0}
          className="w-full mt-8 py-4 bg-ares-green text-white font-bold rounded-2xl shadow-lg shadow-ares-green/20 flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:scale-100"
        >
          Generate Portfolio <ArrowRight className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
};
