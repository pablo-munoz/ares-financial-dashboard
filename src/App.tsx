import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Asset, RiskData, PriceUpdate, IndexData, FrontierData, BacktestData } from './types';
import { Sidebar } from './components/Sidebar';
import { DashboardOverview } from './components/DashboardOverview';
import { AssetSelection } from './components/AssetSelection';
import { RiskAnalysis } from './components/RiskAnalysis';
import { EfficientFrontier } from './components/EfficientFrontier';
import { Backtesting } from './components/Backtesting';
import { IndicesSearch } from './components/IndicesSearch';
import { VeoAnimation } from './components/VeoAnimation';
import { Polymarket } from './components/Polymarket';
import { AlphaBacktest } from './components/AlphaBacktest';

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [assets, setAssets] = useState<Asset[]>([]);
  const [selectedAssets, setSelectedAssets] = useState<string[]>([]);
  const [riskData, setRiskData] = useState<RiskData | null>(null);
  const [indices, setIndices] = useState<IndexData[]>([]);
  const [frontierData, setFrontierData] = useState<FrontierData | null>(null);
  const [backtestData, setBacktestData] = useState<BacktestData | null>(null);

  useEffect(() => {
    // Initial data fetch
    fetch('/api/assets')
      .then(res => res.json())
      .then((payload) => {
        if (Array.isArray(payload)) {
          setAssets(payload);
        } else if (Array.isArray(payload.data)) {
          setAssets(payload.data);
        }
      });
    fetch('/api/risk-data').then(res => res.json()).then(setRiskData);
    fetch('/api/indices').then(res => res.json()).then(setIndices);
    fetch('/api/efficient-frontier').then(res => res.json()).then(setFrontierData);
    fetch('/api/backtest').then(res => res.json()).then(setBacktestData);

    // WebSocket setup
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const socket = new WebSocket(`${protocol}//${window.location.host}`);

    socket.onmessage = (event) => {
      const message = JSON.parse(event.data);
      if (message.type === 'PRICE_UPDATE') {
        const updates: PriceUpdate[] = message.data;
        setAssets(prev => prev.map(asset => {
          const update = updates.find(u => u.id === asset.id);
          return update ? { ...asset, price: update.price, change: update.change } : asset;
        }));
      }
    };

    return () => socket.close();
  }, []);

  const toggleAsset = (id: string) => {
    setSelectedAssets(prev =>
      prev.includes(id) ? prev.filter(a => a !== id) : [...prev, id]
    );
  };

  return (
    <div className="flex min-h-screen">
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />

      <main className="flex-1 px-4 lg:px-10 py-8 overflow-y-auto">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3 }}
            className="h-full"
          >
            {activeTab === 'dashboard' && (
              <DashboardOverview
                assets={assets}
                onNavigateAlphaBacktest={() => setActiveTab('alphaBacktest')}
              />
            )}
            {activeTab === 'portfolio' && (
              <AssetSelection
                assets={assets}
                selectedAssets={selectedAssets}
                toggleAsset={toggleAsset}
              />
            )}
            {activeTab === 'risk' && <RiskAnalysis riskData={riskData} />}
            {activeTab === 'frontier' && <EfficientFrontier data={frontierData} />}
            {activeTab === 'backtest' && <Backtesting data={backtestData} />}
            {activeTab === 'alphaBacktest' && <AlphaBacktest />}
            {activeTab === 'indices' && <IndicesSearch indices={indices} />}
            {activeTab === 'polymarket' && <Polymarket />}
            {activeTab === 'veo' && <VeoAnimation />}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}
