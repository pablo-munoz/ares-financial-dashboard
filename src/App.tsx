import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Asset, RiskData, PriceUpdate, IndexData, FrontierData, BacktestData, SavedPortfolio, SavedAlphaTrade, SavedWallet } from './types';
import { Sidebar } from './components/Sidebar';
import { DashboardOverview } from './components/DashboardOverview';
import { AssetSelection } from './components/AssetSelection';
import { Backtesting } from './components/Backtesting';
import { IndicesSearch } from './components/IndicesSearch';
import { VeoAnimation } from './components/VeoAnimation';
import { Polymarket } from './components/Polymarket';
import { SavedPortfolios } from './components/SavedPortfolios';
import { SavedTrades } from './components/SavedTrades';

const STORAGE_KEY = 'ares_saved_portfolios';
const TRADES_STORAGE_KEY = 'ares_saved_trades';
const WALLETS_STORAGE_KEY = 'ares_saved_wallets';

function loadSaved(): SavedPortfolio[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function persistSaved(portfolios: SavedPortfolio[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(portfolios));
}

function loadSavedTrades(): SavedAlphaTrade[] {
  try {
    const raw = localStorage.getItem(TRADES_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function persistSavedTrades(trades: SavedAlphaTrade[]) {
  localStorage.setItem(TRADES_STORAGE_KEY, JSON.stringify(trades));
}

function loadSavedWallets(): SavedWallet[] {
  try {
    const raw = localStorage.getItem(WALLETS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function persistSavedWallets(wallets: SavedWallet[]) {
  localStorage.setItem(WALLETS_STORAGE_KEY, JSON.stringify(wallets));
}

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [assets, setAssets] = useState<Asset[]>([]);
  const [selectedAssets, setSelectedAssets] = useState<string[]>([]);
  const [riskData, setRiskData] = useState<RiskData | null>(null);
  const [indices, setIndices] = useState<IndexData[]>([]);
  const [frontierData, setFrontierData] = useState<FrontierData | null>(null);
  const [backtestData, setBacktestData] = useState<BacktestData | null>(null);
  const [vix, setVix] = useState<number>(15.0);
  const [optimizationResult, setOptimizationResult] = useState<any>(null);
  const [savedPortfolios, setSavedPortfolios] = useState<SavedPortfolio[]>(loadSaved);
  const [savedTrades, setSavedTrades] = useState<SavedAlphaTrade[]>(loadSavedTrades);

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
    Promise.all([
      fetch('/api/indices').then(res => res.json()),
      fetch('/api/backtest').then(res => res.json())
    ])
      .then(([indicesRes, backtestRes]) => {
        setIndices(indicesRes);
        setBacktestData(backtestRes);
      })
      .catch(console.error);

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
        if (typeof message.vix === 'number') {
          setVix(message.vix);
        }
      }
    };

    return () => socket.close();
  }, []);

  useEffect(() => {
    // Dynamic Risk Data fetch based on portfolio
    let body = {};
    if (optimizationResult?.optimization?.weights) {
      body = {
        weights: optimizationResult.optimization.weights,
        investment: optimizationResult.metadata?.totalInvestment || 100000
      };
    }

    fetch('/api/risk-data', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    })
      .then(res => res.json())
      .then(setRiskData)
      .catch(console.error);

    fetch('/api/efficient-frontier', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    })
      .then(res => res.json())
      .then(setFrontierData)
      .catch(console.error);
  }, [optimizationResult]);

  const toggleAsset = (id: string) => {
    setSelectedAssets(prev =>
      prev.includes(id) ? prev.filter(a => a !== id) : [...prev, id]
    );
  };

  const handleSavePortfolio = (name: string, result: any, investment: number) => {
    const entryPrices: Record<string, number> = {};
    if (result?.optimization?.weights) {
      Object.keys(result.optimization.weights).forEach(ticker => {
        const match = assets.find(a => a.id === ticker);
        entryPrices[ticker] = match ? match.price : 0;
      });
    }

    const newEntry: SavedPortfolio = {
      id: crypto.randomUUID(),
      name,
      savedAt: new Date().toISOString(),
      investment,
      entryPrices,
      optimization: result.optimization,
      backtest: result.backtest,
      monthlyReturns: result.monthlyReturns,
    };
    const updated = [newEntry, ...savedPortfolios];
    setSavedPortfolios(updated);
    persistSaved(updated);
  };

  const handleLoadPortfolio = (portfolio: SavedPortfolio) => {
    setOptimizationResult({
      optimization: portfolio.optimization,
      backtest: portfolio.backtest,
      metadata: {
        totalInvestment: portfolio.investment || 100000,
        loadedName: portfolio.name
      }
    });
  };

  const handleDeletePortfolio = (id: string) => {
    const updated = savedPortfolios.filter(p => p.id !== id);
    setSavedPortfolios(updated);
    persistSaved(updated);
  };

  const handleSaveTrade = (trade: SavedAlphaTrade) => {
    const updated = [trade, ...savedTrades];
    setSavedTrades(updated);
    persistSavedTrades(updated);
  };

  const handleDeleteTrade = (id: string) => {
    const updated = savedTrades.filter(t => t.id !== id);
    setSavedTrades(updated);
    persistSavedTrades(updated);
  };

  const handleUpdateTrade = (updatedTrade: SavedAlphaTrade) => {
    const updated = savedTrades.map(t => t.id === updatedTrade.id ? updatedTrade : t);
    setSavedTrades(updated);
    persistSavedTrades(updated);
  };

  const [savedWallets, setSavedWallets] = useState<SavedWallet[]>(loadSavedWallets());

  const handleSaveWallet = (wallet: SavedWallet) => {
    // Prevent duplicates by address
    if (savedWallets.some(w => w.address === wallet.address)) return;
    const updated = [wallet, ...savedWallets];
    setSavedWallets(updated);
    persistSavedWallets(updated);
  };

  const handleDeleteWallet = (id: string) => {
    const updated = savedWallets.filter(w => w.id !== id);
    setSavedWallets(updated);
    persistSavedWallets(updated);
  };
  const handleExportTrades = () => {
    const dataToExport = {
      trades: savedTrades,
      wallets: savedWallets
    };
    const jsonString = JSON.stringify(dataToExport, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `ares-saved-trades-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();

    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleImportTrades = (importedData: any) => {
    try {
      if (importedData.trades && Array.isArray(importedData.trades)) {
        const newTrades = importedData.trades.filter(
          (t: SavedAlphaTrade) => !savedTrades.some(existing => existing.id === t.id)
        );
        if (newTrades.length > 0) {
          const updatedTrades = [...newTrades, ...savedTrades];
          setSavedTrades(updatedTrades);
          persistSavedTrades(updatedTrades);
        }
      }

      if (importedData.wallets && Array.isArray(importedData.wallets)) {
        const newWallets = importedData.wallets.filter(
          (w: SavedWallet) => !savedWallets.some(existing => existing.address === w.address)
        );
        if (newWallets.length > 0) {
          const updatedWallets = [...newWallets, ...savedWallets];
          setSavedWallets(updatedWallets);
          persistSavedWallets(updatedWallets);
        }
      }
    } catch (e) {
      console.error("Failed to import trades:", e);
      alert("Failed to parse the uploaded file. Please ensure it is a valid Ares export.");
    }
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
                vix={vix}
                optimizationResult={optimizationResult}
                setOptimizationResult={setOptimizationResult}
                onNavigateAlphaBacktest={() => setActiveTab('polymarket')}
                onSavePortfolio={handleSavePortfolio}
                savedPortfolios={savedPortfolios}
                onLoadPortfolio={handleLoadPortfolio}
                riskData={riskData}
                frontierData={frontierData}
              />
            )}
            {activeTab === 'saved' && (
              <SavedPortfolios
                portfolios={savedPortfolios}
                assets={assets}
                onDelete={handleDeletePortfolio}
                onNavigateDashboard={() => setActiveTab('dashboard')}
              />
            )}
            {activeTab === 'portfolio' && (
              <AssetSelection
                assets={assets}
                selectedAssets={selectedAssets}
                toggleAsset={toggleAsset}
              />
            )}
            {activeTab === 'backtest' && <Backtesting data={backtestData} savedPortfolios={savedPortfolios} />}
            {activeTab === 'indices' && <IndicesSearch indices={indices} />}
            {activeTab === 'polymarket' && <Polymarket onSaveTrade={handleSaveTrade} onSaveWallet={handleSaveWallet} />}
            {activeTab === 'savedTrades' && (
              <SavedTrades
                trades={savedTrades}
                wallets={savedWallets}
                onDeleteTrade={handleDeleteTrade}
                onDeleteWallet={handleDeleteWallet}
                onUpdateTrade={handleUpdateTrade}
                onNavigatePolymarket={() => setActiveTab('polymarket')}
                onExport={handleExportTrades}
                onImport={handleImportTrades}
              />
            )}
            {activeTab === 'veo' && <VeoAnimation />}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}
