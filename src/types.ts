export interface Asset {
  id: string;
  name: string;
  price: number;
  change: number;
  sector: string;
}

export interface IndexData {
  id: string;
  name: string;
  price: number;
  change: number;
  region: string;
}

export interface RiskData {
  correlationMatrix: any[];
  riskContribution: { name: string; value: number; color: string }[];
  stressTest: {
    scenario: string;
    impact: number;
    estLoss: number;
    description: string;
  };
}

export interface FrontierData {
  scatter: { risk: number; return: number; type: string }[];
  maxSharpe: { risk: number; return: number; ratio: number };
  minVol: { risk: number; return: number; ratio: number };
  allocations: { name: string; value: number }[];
}

export interface BacktestData {
  growth: { month: number; portfolio: number; benchmark: number }[];
  metrics: {
    maxDrawdown: number;
    sharpeRatio: number;
    beta: number;
    portfolioCAGR: number;
    benchmarkCAGR: number;
    totalReturn: number;
  };
  monthlyReturns: any[];
}

export interface PriceUpdate {
  id: string;
  price: number;
  change: number;
}

export interface PolymarketAlphaSignal {
  id: string;
  marketName: string;
  fairValue: number;    // 0–1 probability
  marketPrice: number;  // 0–1 market price
  ev: number;           // edge in percentage points
  kellyStake: number;   // suggested Kelly fraction in %
}

export interface PolymarketInsider {
  address: string;
  score: number; // 0-100
  label: 'High Suspicion' | 'Watchlist';
  reasons: string[];
  topMarket?: string;
  lastSeen?: number; // epoch seconds
}

export interface PolymarketWhaleTrade {
  id: string;
  time: string;
  market: string;
  address: string;
  amount: number;
  side: 'YES' | 'NO';
}

export interface PolymarketData {
  alphaSignals: PolymarketAlphaSignal[];
  insiders: PolymarketInsider[];
  whaleFeed: PolymarketWhaleTrade[];
  lastUpdated?: number; // epoch ms
}
