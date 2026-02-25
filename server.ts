import express from "express";
import { createServer } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const server = createServer(app);
  const wss = new WebSocketServer({ server });

  const PORT = 3000;

  app.use(express.json({ limit: '50mb' }));

  // Mock data for assets
  const assets = [
    { id: 'AAPL', name: 'Apple Inc.', price: 189.45, change: 1.2, sector: 'Technology' },
    { id: 'MSFT', name: 'Microsoft Corp.', price: 420.15, change: 0.8, sector: 'Technology' },
    { id: 'GOOGL', name: 'Alphabet Inc.', price: 145.60, change: -0.5, sector: 'Technology' },
    { id: 'AMZN', name: 'Amazon.com Inc.', price: 178.20, change: 2.1, sector: 'Consumer Cyclical' },
    { id: 'TSLA', name: 'Tesla Inc.', price: 195.30, change: -3.4, sector: 'Consumer Cyclical' },
    { id: 'NVDA', name: 'NVIDIA Corp.', price: 825.40, change: 4.5, sector: 'Technology' },
    { id: 'META', name: 'Meta Platforms Inc.', price: 485.20, change: 1.1, sector: 'Communication Services' },
    { id: 'V', name: 'Visa Inc.', price: 280.10, change: 0.3, sector: 'Financial Services' },
    { id: 'JPM', name: 'JPMorgan Chase & Co.', price: 185.50, change: 0.7, sector: 'Financial Services' },
  ];

  const indices = [
    { id: 'SPX', name: 'S&P 500', price: 4783.45, change: 1.24, region: 'US' },
    { id: 'NDX', name: 'NASDAQ-100', price: 16982.10, change: 2.15, region: 'US' },
    { id: 'UKX', name: 'FTSE 100', price: 7682.30, change: -0.45, region: 'EMEA' },
    { id: 'N225', name: 'Nikkei 225', price: 33450.00, change: 0.85, region: 'Asia Pacific' },
    { id: 'GDAXI', name: 'DAX Performance', price: 16700.12, change: 0.00, region: 'EMEA' },
    { id: 'HSI', name: 'Hang Seng', price: 16535.33, change: -1.92, region: 'Asia Pacific' },
  ];

  // API Routes
  app.get("/api/assets", (req, res) => {
    res.json(assets);
  });

  app.post("/api/portfolio/optimize", (req, res) => {
    const { tickers, investment, risk_tolerance, time_horizon_years, monthly_contribution } = req.body;
    
    if (!tickers || tickers.length < 2) {
      return res.status(422).json({ success: false, detail: "At least 2 tickers required" });
    }

    // Simulate optimization logic
    const risk = parseFloat(risk_tolerance) || 0.5;
    const inv = parseFloat(investment) || 100000;
    const horizon = parseInt(time_horizon_years) || 5;
    const monthly = parseFloat(monthly_contribution) || 0;

    // Generate weights
    const weights: Record<string, number> = {};
    let remaining = 1.0;
    tickers.forEach((t: string, i: number) => {
      if (i === tickers.length - 1) {
        weights[t] = Math.round(remaining * 100) / 100;
      } else {
        const w = Math.random() * remaining * 0.8;
        weights[t] = Math.round(w * 100) / 100;
        remaining -= weights[t];
      }
    });

    // Performance metrics based on risk tolerance
    const baseReturn = 0.05 + (risk * 0.15); // 5% to 20%
    const baseVol = 0.08 + (risk * 0.25);   // 8% to 33%
    const expected_return = baseReturn + (Math.random() - 0.5) * 0.02;
    const volatility = baseVol + (Math.random() - 0.5) * 0.03;
    const sharpe_ratio = (expected_return - 0.04) / volatility;

    const strategy = risk < 0.3 ? "Conservative" : risk < 0.7 ? "Balanced" : "Aggressive";

    // Backtest simulation
    const months = horizon * 12;
    const growth = [];
    let currentVal = inv;
    let benchVal = inv;
    
    for (let i = 0; i <= months; i++) {
      growth.push({
        month: i,
        portfolio: currentVal,
        benchmark: benchVal
      });
      
      const portReturn = (expected_return / 12) + (Math.random() - 0.5) * (volatility / Math.sqrt(12));
      const benchReturn = (0.08 / 12) + (Math.random() - 0.5) * (0.15 / Math.sqrt(12));
      
      currentVal = (currentVal + monthly) * (1 + portReturn);
      benchVal = (benchVal + monthly) * (1 + benchReturn);
    }

    res.json({
      success: true,
      data: {
        optimization: {
          weights,
          expected_return: Math.round(expected_return * 10000) / 10000,
          volatility: Math.round(volatility * 10000) / 10000,
          sharpe_ratio: Math.round(sharpe_ratio * 100) / 100,
          strategy
        },
        backtest: {
          growth,
          portfolio_total_return: Math.round(((currentVal / (inv + monthly * months)) - 1) * 10000) / 10000,
          benchmark_total_return: Math.round(((benchVal / (inv + monthly * months)) - 1) * 10000) / 10000,
          max_drawdown_pct: -Math.round((10 + Math.random() * 20) * 10) / 10
        },
        risk_details: {
          contribution_to_risk: tickers.map((t: string) => ({
            ticker: t,
            contribution: Math.round((100 / tickers.length) + (Math.random() - 0.5) * 10)
          }))
        }
      }
    });
  });

  app.get("/api/indices", (req, res) => {
    res.json(indices);
  });

  app.get("/api/efficient-frontier", (req, res) => {
    res.json({
      scatter: Array.from({ length: 50 }, (_, i) => ({
        risk: 2 + Math.random() * 15,
        return: 4 + Math.random() * 12,
        type: 'portfolio'
      })),
      maxSharpe: { risk: 8.5, return: 12.8, ratio: 1.45 },
      minVol: { risk: 2.1, return: 4.2, ratio: 0.82 },
      allocations: [
        { name: 'US Equities', value: 45 },
        { name: 'Intl Bonds', value: 30 },
        { name: 'Real Estate', value: 15 },
        { name: 'Cash', value: 10 },
      ]
    });
  });

  app.get("/api/backtest", (req, res) => {
    res.json({
      growth: Array.from({ length: 60 }, (_, i) => ({
        month: i,
        portfolio: 100000 * Math.pow(1.012, i) * (1 + (Math.random() - 0.5) * 0.05),
        benchmark: 100000 * Math.pow(1.008, i) * (1 + (Math.random() - 0.5) * 0.03),
      })),
      metrics: {
        maxDrawdown: -12.4,
        sharpeRatio: 1.85,
        beta: 0.92,
        portfolioCAGR: 15.4,
        benchmarkCAGR: 10.2,
        totalReturn: 42.3
      },
      monthlyReturns: [
        { year: 2023, jan: 4.2, feb: -1.2, mar: 2.8, q1: 5.8, annual: 18.4 },
        { year: 2022, jan: -3.5, feb: 0.5, mar: -2.1, q1: -5.1, annual: -8.2 },
        { year: 2021, jan: 1.2, feb: 3.4, mar: 2.1, q1: 6.7, annual: 24.5 },
      ]
    });
  });

  app.get("/api/risk-data", (req, res) => {
    res.json({
      correlationMatrix: [
        { id: 'AAPL', AAPL: 1.00, MSFT: 0.65, GOOGL: 0.55 },
        { id: 'MSFT', AAPL: 0.65, MSFT: 1.00, GOOGL: 0.70 },
        { id: 'GOOGL', AAPL: 0.55, MSFT: 0.70, GOOGL: 1.00 },
      ],
      riskContribution: [
        { name: 'TSLA', value: 32.5, color: '#f43f5e' },
        { name: 'AMZN', value: 24.2, color: '#3b82f6' },
        { name: 'NVDA', value: 18.3, color: '#10b981' },
        { name: 'AAPL', value: 15.0, color: '#f59e0b' },
        { name: 'Others', value: 10.0, color: '#64748b' },
      ],
      stressTest: {
        scenario: "Black Swan Event",
        impact: -20.0,
        estLoss: 308000,
        description: "Simulation based on 2008 Financial Crisis parameters."
      }
    });
  });

  // Real-time price updates via WebSocket
  wss.on("connection", (ws) => {
    console.log("Client connected to WebSocket");
    
    const interval = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        const updates = assets.map(asset => ({
          id: asset.id,
          price: asset.price + (Math.random() - 0.5) * 2,
          change: asset.change + (Math.random() - 0.5) * 0.2
        }));
        ws.send(JSON.stringify({ type: 'PRICE_UPDATE', data: updates }));
      }
    }, 2000);

    ws.on("close", () => {
      clearInterval(interval);
      console.log("Client disconnected");
    });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
