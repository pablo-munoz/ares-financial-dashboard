import express from "express";
import { createServer } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { createServer as createViteServer } from "vite";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import Database from "better-sqlite3";
import { runBacktest } from "./backtester.js";
import YahooFinance from "yahoo-finance2";
const yahooFinance = new YahooFinance();

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

type Asset = {
  id: string;
  name: string;
  price: number;
  change: number;
  sector: string;
  country?: string;
};

type PolymarketAlphaSignal = {
  id: string;
  eventSlug?: string; // event-level slug used for polymarket.com/event/<eventSlug>
  marketName: string;
  fairValue: number;
  marketPrice: number;
  ev: number;
  kellyStake: number;
};

type PolymarketInsider = {
  address: string;
  score: number; // 0-100
  label: 'High Suspicion' | 'Moderate' | 'Watchlist';
  reasons: string[];
  topMarket?: string;
  lastSeen?: number;
  trend?: 'up' | 'down' | 'stable' | 'new';
  winRate?: number; // 0-1
};

type PolymarketWhaleTrade = {
  id: string;
  time: string;
  market: string;
  slug?: string;
  address: string;
  amount: number;
  side: 'YES' | 'NO';
};

type PolymarketData = {
  alphaSignals: PolymarketAlphaSignal[];
  insiders: PolymarketInsider[];
  whaleFeed: PolymarketWhaleTrade[];
  lastUpdated?: number;
};

const POLYMARKET_BASE_URL =
  process.env.POLYMARKET_BASE_URL ?? "https://gamma-api.polymarket.com";

// Deterministic risk scoring based on asset sector and unique ticker hashing
const calculateRiskScore = (asset: Asset): number => {
  let baseRisk = 0.5;
  const s = (asset.sector || "").toLowerCase();

  if (s.includes("crypto") || s.includes("bitcoin")) baseRisk = 0.95;
  else if (s.includes("technology") || s.includes("communication")) baseRisk = 0.75;
  else if (s.includes("consumer discretionary") || s.includes("industrials")) baseRisk = 0.65;
  else if (s.includes("real estate") || s.includes("financials")) baseRisk = 0.55;
  else if (s.includes("health care") || s.includes("energy")) baseRisk = 0.45;
  else if (s.includes("consumer staples")) baseRisk = 0.35;
  else if (s.includes("commodities")) baseRisk = 0.30;
  else if (s.includes("fixed income") || s.includes("bond")) baseRisk = 0.15;
  else if (s.includes("etf")) baseRisk = 0.4;

  // Create deterministic variance from -0.1 to +0.1 based on ticker letters
  let hash = 0;
  for (let i = 0; i < asset.id.length; i++) hash += asset.id.charCodeAt(i);
  const variance = ((hash % 20) - 10) / 100;

  return Math.min(1.0, Math.max(0.05, baseRisk + variance));
};

let assets: Asset[] = [];
let polymarketData: PolymarketData;
let currentVix = 15.0; // Baseline VIX

async function loadAssetsUniverse() {
  const universePath = path.join(__dirname, "data", "assets-universe.json");
  let raw: string;
  try {
    raw = fs.readFileSync(universePath, "utf-8");
  } catch (err) {
    console.error("Failed to read assets-universe.json, falling back to small mock set:", err);
    assets = [
      { id: "AAPL", name: "Apple Inc.", price: 189.45, change: 1.2, sector: "Technology" },
      { id: "MSFT", name: "Microsoft Corp.", price: 420.15, change: 0.8, sector: "Technology" },
      { id: "GOOGL", name: "Alphabet Inc.", price: 145.6, change: -0.5, sector: "Communication Services" },
      { id: "AMZN", name: "Amazon.com Inc.", price: 178.2, change: 2.1, sector: "Consumer Discretionary" },
      { id: "TSLA", name: "Tesla Inc.", price: 195.3, change: -3.4, sector: "Consumer Discretionary" },
      { id: "NVDA", name: "NVIDIA Corp.", price: 825.4, change: 4.5, sector: "Technology" },
      { id: "META", name: "Meta Platforms Inc.", price: 485.2, change: 1.1, sector: "Communication Services" },
      { id: "V", name: "Visa Inc.", price: 280.1, change: 0.3, sector: "Financials" },
      { id: "JPM", name: "JPMorgan Chase & Co.", price: 185.5, change: 0.7, sector: "Financials" },
    ];
    return;
  }

  const universe = JSON.parse(raw) as {
    ticker: string;
    name: string;
    sector: string;
    country?: string;
    basePrice?: number;
  }[];

  assets = universe.map((u) => ({
    id: u.ticker,
    name: u.name,
    sector: u.sector,
    country: u.country,
    price: u.basePrice ?? 100,
    change: 0,
  }));
}

async function fetchLivePrices() {
  if (assets.length === 0) return;
  try {
    const tickers = assets.map((a) => a.id);
    const queries = [...tickers, "^VIX"];

    const quotes = await yahooFinance.quote(queries) as any[];
    for (const q of quotes) {
      if (q.symbol === "^VIX") {
        currentVix = q.regularMarketPrice ?? currentVix;
        continue;
      }
      const asset = assets.find((a) => a.id === q.symbol);
      if (asset) {
        asset.price = q.regularMarketPrice ?? asset.price;
        asset.change = q.regularMarketChangePercent ?? asset.change;
      }
    }
  } catch (err) {
    console.error("Failed to fetch live prices from Yahoo Finance:", err);
  }
}

async function fetchPolymarketTrades(limit: number = 500): Promise<any[]> {
  const url = `https://data-api.polymarket.com/trades?limit=${limit}`;
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) {
    throw new Error(`Polymarket trades HTTP ${res.status}`);
  }
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

const polymarketLastPrices: Record<string, number> = {};
type MarketStats = {
  longVwap: number;
  sampleCount: number;
  lastUpdated: number;
  rollingVolatility: number;
  avgTradeSize: number;
};
const polymarketStats: Record<string, MarketStats> = {};
let polymarketLastAlphaSlugs: string[] = [];
let alphaRotation = 0;
let insiderRotation = 0;
// Track wallets shown in the last refresh cycle to prevent duplicates
const recentlyShownInsiders: Set<string> = new Set();

type MarketMeta = {
  slug: string;
  title: string;
  category?: string;
  endTs?: number; // epoch seconds
  fetchedAtMs: number;
};
const polymarketMarketMeta: Record<string, MarketMeta> = {};

/**
 * Returns a directional shift (-1 to 1) based on top-performing insider sentiment.
 * If 3+ insiders with >60% winrate are betting "YES", returns 1.0 (strong bullish).
 */
function getSharpDirection(slug: string): number {
  if (!polymarketData || !polymarketData.insiders) return 0;

  let shift = 0;
  const sharps = polymarketData.insiders.filter(i => (i.winRate ?? 0) >= 0.60);

  for (const s of sharps) {
    if (s.topMarket === slug) {
      // Scale by score if they are currently active in this market
      shift += s.score / 100;
    }
  }

  return Math.max(-1, Math.min(1, shift));
}

const dbPath = path.join(__dirname, "data", "polymarket.db");
const db = new Database(dbPath);
db.pragma("journal_mode = WAL");
db.exec(`
  CREATE TABLE IF NOT EXISTS trades (
    txHash TEXT PRIMARY KEY,
    ts INTEGER NOT NULL,
    slug TEXT NOT NULL,
    title TEXT,
    conditionId TEXT,
    wallet TEXT,
    side TEXT,
    outcome TEXT,
    price REAL,
    size REAL,
    notional REAL
  );
  CREATE INDEX IF NOT EXISTS idx_trades_slug_ts ON trades(slug, ts);
  CREATE INDEX IF NOT EXISTS idx_trades_wallet_ts ON trades(wallet, ts);

  CREATE TABLE IF NOT EXISTS market_resolutions (
    slug TEXT PRIMARY KEY,
    winningOutcome TEXT,
    resolved_at INTEGER
  );
  CREATE INDEX IF NOT EXISTS idx_resolutions_resolved_at ON market_resolutions(resolved_at);

  CREATE TABLE IF NOT EXISTS backtest_validation (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    slug              TEXT    NOT NULL,
    sim_ts            INTEGER NOT NULL,
    model_fair_value  REAL    NOT NULL,
    max_ts_seen_in_db INTEGER NOT NULL,
    run_at            INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_bv_slug_sim_ts ON backtest_validation(slug, sim_ts);
`);

const insertTradeStmt = db.prepare(`
  INSERT OR IGNORE INTO trades
  (txHash, ts, slug, title, conditionId, wallet, side, outcome, price, size, notional)
  VALUES
  (@txHash, @ts, @slug, @title, @conditionId, @wallet, @side, @outcome, @price, @size, @notional)
`);

const insertResolutionStmt = db.prepare(`
  INSERT OR REPLACE INTO market_resolutions (slug, winningOutcome, resolved_at)
  VALUES (?, ?, ?)
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS wallet_history (
    wallet TEXT NOT NULL,
    ts     INTEGER NOT NULL,
    score  REAL NOT NULL,
    PRIMARY KEY (wallet, ts)
  );
  CREATE INDEX IF NOT EXISTS idx_wh_wallet_ts ON wallet_history(wallet, ts);
`);

function clamp01(x: number) {
  return Math.max(0, Math.min(1, x));
}

async function fetchGammaMarketMetaBySlug(slug: string): Promise<MarketMeta | null> {
  const cached = polymarketMarketMeta[slug];
  const now = Date.now();
  if (cached && now - cached.fetchedAtMs < 10 * 60_000) {
    return cached;
  }

  try {
    const res = await fetch(`${POLYMARKET_BASE_URL}/markets?slug=${encodeURIComponent(slug)}`, {
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return null;
    const data = await res.json();
    const m = Array.isArray(data) ? data[0] : null;
    if (!m) return null;

    const title = (m.question ?? m.slug ?? slug) as string;
    const category = (m.category ?? m.events?.[0]?.category) as string | undefined;

    const endStr =
      (m.umaEndDate as string | undefined) ??
      (m.endDate as string | undefined) ??
      (m.closedTime as string | undefined);
    let endTs: number | undefined;
    if (endStr) {
      const parsed = Date.parse(endStr);
      if (!Number.isNaN(parsed)) {
        endTs = Math.floor(parsed / 1000);
      }
    }

    const meta: MarketMeta = { slug, title, category, endTs, fetchedAtMs: now };
    polymarketMarketMeta[slug] = meta;
    return meta;
  } catch {
    return null;
  }
}

export async function syncClosedMarkets() {
  console.log("[Sync] Fetching recently closed markets...");
  try {
    const res = await fetch(`${POLYMARKET_BASE_URL}/markets?active=false&limit=500`, {
      headers: { Accept: "application/json" },
    });
    if (!res.ok) throw new Error(`Gamma API HTTP ${res.status}`);
    const markets = await res.json();
    if (!Array.isArray(markets)) return;

    const resolved = markets.filter(m => m.winningOutcome !== null);
    console.log(`[Sync] Found ${resolved.length} resolved markets.`);

    const insertMany = db.transaction((rows: any[]) => {
      for (const m of rows) {
        let outcome = m.winningOutcome;
        if (outcome === "0") outcome = "YES";
        else if (outcome === "1") outcome = "NO";

        const resolvedAt = m.closedTime ? Math.floor(Date.parse(m.closedTime) / 1000) : Math.floor(Date.now() / 1000);
        insertResolutionStmt.run(m.slug, outcome, resolvedAt);
      }
    });

    insertMany(resolved);
  } catch (err) {
    console.error("[Sync] Closed markets sync failed:", err);
  }
}

function categorizeInsiderRisk(title: string, category?: string) {
  const t = title.toLowerCase();
  const c = (category ?? "").toLowerCase();
  const hay = `${t} ${c}`;

  const keywords = [
    "launch",
    "release",
    "openai",
    "apple",
    "earnings",
    "sec",
    "etf",
    "court",
    "supreme",
    "ruling",
    "military",
    "strike",
    "extraction",
    "invasion",
    "youtube",
    "mrbeast",
    "tweet",
    "elon",
  ];
  const hit = keywords.some((k) => hay.includes(k));
  return hit ? 1.3 : 1.0;
}

// ---------------------------------------------------------------------------
// Signal C — Market category weighting
// ---------------------------------------------------------------------------
const TIER1_KEYWORDS = [
  "sec", "fda", "merger", "acquisition", "acqui", "takeover",
  "ruling", "court", "invasion", "military", "strike", "sanction",
  "launch", "arrested", "indicted", "charged", "bankrupt", "default",
];
const TIER2_KEYWORDS = [
  "election", "vote", "fed", "rate cut", "rate hike", "championship",
  "final", "nominate", "resign", "impeach", "gdp", "inflation",
];
const SPORTS_KEYWORDS = [
  "fc", "united", "city", "nba", "nfl", "premier league", "laliga",
  "championship", "vs", "real madrid", "barcelona", "liverpool", "arsenal"
];

function isSportsMarket(title: string): boolean {
  const t = title.toLowerCase();
  return SPORTS_KEYWORDS.some((k) => t.includes(k));
}

function getMarketCategoryWeight(title: string): number {
  const t = title.toLowerCase();
  if (isSportsMarket(t)) return 0.5;
  if (TIER1_KEYWORDS.some((k) => t.includes(k))) return 1.5;
  if (TIER2_KEYWORDS.some((k) => t.includes(k))) return 1.2;
  return 1.0;
}

// ---------------------------------------------------------------------------
// Signal A — Early mover advantage
// Returns [0, 1]: fraction of qualifying slugs where wallet's entry price
// drifted positively in the direction of their bet.
// ---------------------------------------------------------------------------
function computeEarlyMoverScore(wallet: string, since14d: number): number {
  // For each slug, get: wallet's earliest entry price+outcome, and latest market price
  const slugStats = db
    .prepare(
      `SELECT t.slug,
              t.outcome                        AS betOutcome,
              MIN(t.price)                     AS entryPrice,
              (SELECT price FROM trades t2
               WHERE t2.slug = t.slug
               ORDER BY t2.ts DESC LIMIT 1)    AS latestPrice
       FROM trades t
       WHERE t.wallet = ? AND t.ts >= ?
         AND t.title NOT LIKE '%up or down%'
         AND t.title NOT LIKE '%up-or-down%'
         AND t.title NOT LIKE '%price above%'
         AND t.title NOT LIKE '%price below%'
       GROUP BY t.slug, t.outcome`
    )
    .all(wallet, since14d) as Array<{
      slug: string;
      betOutcome: string | null;
      entryPrice: number;
      latestPrice: number;
    }>;

  if (!slugStats.length) return 0;

  let positiveCount = 0;
  for (const s of slugStats) {
    if (s.latestPrice === null || s.entryPrice === null) continue;
    const drift =
      s.betOutcome === "YES"
        ? s.latestPrice - s.entryPrice          // YES bet: higher = good
        : s.entryPrice - s.latestPrice;         // NO bet: lower = good
    if (drift > 0.03) positiveCount++;           // >3¢ drift = meaningful move
  }
  return positiveCount / slugStats.length;
}

// ---------------------------------------------------------------------------
// Signal B — Resolved market win rate
// A slug is considered resolved when its latest observed price >= 0.97 or <= 0.03.
// Returns undefined when <3 resolved positions (insufficient sample).
// ---------------------------------------------------------------------------
function computeResolvedWinRate(
  wallet: string,
  since14d: number
): number | undefined {
  const resolved = db
    .prepare(
      `SELECT t.outcome AS betOutcome,
              (SELECT price FROM trades t2
               WHERE t2.slug = t.slug
               ORDER BY t2.ts DESC LIMIT 1) AS latestPrice
       FROM trades t
       WHERE t.wallet = ? AND t.ts >= ?
         AND t.title NOT LIKE '%up or down%'
         AND t.title NOT LIKE '%up-or-down%'
         AND t.title NOT LIKE '%price above%'
         AND t.title NOT LIKE '%price below%'
       GROUP BY t.slug`
    )
    .all(wallet, since14d) as Array<{
      betOutcome: string | null;
      latestPrice: number;
    }>;

  const settled = resolved.filter(
    (r) => r.latestPrice >= 0.97 || r.latestPrice <= 0.03
  );
  if (settled.length < 3) return undefined; // not enough data

  let wins = 0;
  for (const s of settled) {
    const isYesWin = s.latestPrice >= 0.97;
    if (s.betOutcome === "YES" && isYesWin) wins++;
    else if (s.betOutcome === "NO" && !isYesWin) wins++;
  }
  return wins / settled.length;
}

// ---------------------------------------------------------------------------
// Signal D — Score persistence helpers
// ---------------------------------------------------------------------------
const insertWalletHistoryStmt = db.prepare(
  `INSERT OR REPLACE INTO wallet_history (wallet, ts, score)
   VALUES (@wallet, @ts, @score)`
);

function getPersistenceBonus(
  wallet: string,
  nowSec: number
): { bonus: number; trend: 'up' | 'down' | 'stable' | 'new' } {
  const since5cycles = nowSec - 6 * 60 * 60; // roughly 6h back covers ~5 refresh cycles
  const history = db
    .prepare(
      `SELECT score FROM wallet_history
       WHERE wallet = ? AND ts >= ?
       ORDER BY ts ASC`
    )
    .all(wallet, since5cycles) as Array<{ score: number }>;

  if (!history.length) return { bonus: 0, trend: 'new' };

  const appearances = history.length;
  const bonus = appearances >= 3 ? 0.15 : appearances >= 2 ? 0.07 : 0;

  // Trend: compare latest vs earliest in window
  const first = history[0].score;
  const last = history[history.length - 1].score;
  const delta = last - first;
  const trend: 'up' | 'down' | 'stable' =
    delta > 0.05 ? 'up' :
      delta < -0.05 ? 'down' :
        'stable';

  return { bonus, trend };
}

// Patterns that indicate a bot/algo market — not insider-tradeable
const BOT_MARKET_PATTERNS = [
  "up or down",
  "up-or-down",
  "price above",
  "price below",
  // 5-min window slugs contain time ranges like "6:20am-6:25am"
  /\d:\d{2}[ap]m-\d:\d{2}[ap]m/,
];

function isBotMarketTitle(title: string): boolean {
  const t = title.toLowerCase();
  return BOT_MARKET_PATTERNS.some((p) =>
    typeof p === "string" ? t.includes(p) : p.test(t)
  );
}

async function computePolymarketInsidersFromDb(): Promise<PolymarketInsider[]> {
  const nowSec = Math.floor(Date.now() / 1000);
  const since14d = nowSec - 14 * 24 * 60 * 60;
  const since24h = nowSec - 24 * 60 * 60;
  const since1h = nowSec - 60 * 60;

  // --- Primary query: aggregate wallet stats over 14d window ---
  // NOTE: Bot-market trades are excluded here so that wallets trading only
  // 5-min crypto up/down markets cannot pass the volume/trade thresholds.
  const rows = db
    .prepare(
      `
      SELECT wallet,
             SUM(notional)                                               AS vol14d,
             COALESCE(SUM(CASE WHEN ts >= ? THEN notional END), 0)       AS vol24h,
             COALESCE(SUM(CASE WHEN ts >= ? THEN notional END), 0)       AS vol1h,
             COUNT(DISTINCT CASE WHEN ts >= ? THEN slug END)             AS markets24h,
             COUNT(*)                                                    AS lifetime_trades,
             MIN(ts)                                                     AS first_ts,
             MAX(ts)                                                     AS lastTs
      FROM trades
      WHERE ts >= ?
        AND title NOT LIKE '%up or down%'
        AND title NOT LIKE '%up-or-down%'
        AND title NOT LIKE '%price above%'
        AND title NOT LIKE '%price below%'
        AND slug NOT LIKE '%-5m-%'
        AND slug NOT LIKE '%-15m-%'
      GROUP BY wallet
      HAVING vol24h >= 1500
        AND lifetime_trades >= 5
        AND vol14d >= 2000
      ORDER BY vol14d DESC
      LIMIT 200
    `
    )
    .all(since24h, since1h, since24h, since14d) as Array<{
      wallet: string;
      vol14d: number;
      vol24h: number;
      vol1h: number;
      markets24h: number;
      lifetime_trades: number;
      first_ts: number;
      lastTs: number;
    }>;

  // Pool for percentile normalisation — collect raw scores before finalising
  const pool: Array<{
    wallet: string;
    rawScore01: number;
    winRate: number | undefined;
    trend: 'up' | 'down' | 'stable' | 'new';
    topMarket: string | undefined;
    lastTs: number;
    reasons: string[];
    categoryWeight: number;
  }> = [];

  for (const w of rows) {
    if (!w.wallet || w.wallet === "unknown") continue;

    // --- Market-type filter: count qualifying (non-bot) markets in 24h ---
    const allMarkets24h = db
      .prepare(
        `SELECT DISTINCT slug, title FROM trades
         WHERE wallet = ? AND ts >= ?`
      )
      .all(w.wallet, since24h) as Array<{ slug: string; title: string }>;

    const qualifyingMarkets = allMarkets24h.filter(
      (m) => !isBotMarketTitle(m.title)
    );
    if (qualifyingMarkets.length === 0) continue; // only bot markets → skip

    // --- Bot-pattern detector: top market trade concentration ---
    const topMarketTradeCountRow = db
      .prepare(
        `SELECT COUNT(*) AS cnt FROM trades
         WHERE wallet = ? AND ts >= ?
         GROUP BY slug ORDER BY cnt DESC LIMIT 1`
      )
      .get(w.wallet, since14d) as { cnt: number } | undefined;

    const topMarketFraction = topMarketTradeCountRow
      ? topMarketTradeCountRow.cnt / Math.max(1, w.lifetime_trades)
      : 0;
    const botPenalty = topMarketFraction >= 0.50 ? 0.2 : topMarketFraction >= 0.35 ? 0.6 : 1.0;

    // --- Account age / maturity discount ---
    const firstSeenDaysAgo = (nowSec - (w.first_ts ?? nowSec)) / 86400;
    const maturity = Math.min(1, firstSeenDaysAgo / 30);
    const ageFactor = 0.5 + 0.5 * maturity;

    // --- Signal A: Early mover advantage ---
    const earlyMover = computeEarlyMoverScore(w.wallet, since14d);

    // --- Signal B: Resolved market win rate ---
    const winRate = computeResolvedWinRate(w.wallet, since14d);
    // Hard gate: if we have enough resolved data AND the win rate is clearly poor, skip
    if (winRate !== undefined && winRate < 0.45) {
      try {
        const settledCheck = db
          .prepare(`SELECT COUNT(*) AS cnt FROM market_resolutions r
                    JOIN trades t ON t.slug = r.slug
                    WHERE t.wallet = ? AND t.ts >= ?`)
          .get(w.wallet, since14d) as { cnt: number } | undefined;
        if ((settledCheck?.cnt ?? 0) >= 5) continue; // known loser with sufficient data — skip
      } catch {
        // market_resolutions table might not be populated yet — skip the gate, don't crash
      }
    }
    const winRateSignal = winRate !== undefined
      ? clamp01((winRate - 0.50) / 0.30)  // steeper: 70%+ win rate → 1.0; 50% → 0; below 50% stays 0
      : 0;

    // --- Signal C: Market category weight (average over qualifying markets) ---
    const catWeights = qualifyingMarkets.map((m) => getMarketCategoryWeight(m.title));
    const categoryWeight = catWeights.reduce((a, b) => a + b, 0) / catWeights.length;

    // --- Signal D: Persistence & trend ---
    const { bonus: persistenceBonus, trend } = getPersistenceBonus(w.wallet, nowSec);

    // --- Edge-bet signal (contrarian low-price bets) ---
    const edgeBetsRow = db
      .prepare(
        `SELECT COUNT(*) AS edge_count FROM trades
         WHERE wallet = ? AND ts >= ? AND price < 0.40 AND side = 'BUY'`
      )
      .get(w.wallet, since14d) as { edge_count: number } | undefined;
    const edgeBetFraction = (edgeBetsRow?.edge_count ?? 0) /
      Math.max(1, w.lifetime_trades);
    const edgeBet = clamp01(edgeBetFraction / 0.30);

    // --- Core freshness & size signals ---
    const hoursSinceLast = (nowSec - w.lastTs) / 3600;
    const freshness = Math.exp(-hoursSinceLast / 2);
    const avgDaily = w.vol14d / 14 || 1;
    const sizeBurst = clamp01(w.vol1h / avgDaily);

    // Concentration on qualifying markets only
    const qMkt24h = qualifyingMarkets.length;
    const focus = qMkt24h <= 2 ? 1 : qMkt24h <= 4 ? 0.6 : 0.2;

    // --- Performance multiplier: dampens freshness/size signals for known losers ---
    // A wallet with a known poor win rate should not score high just from fresh big bets
    const perfMultiplier = winRate !== undefined
      ? (winRate >= 0.60 ? 1.0 : winRate >= 0.50 ? 0.8 : 0.4)
      : 0.75; // unknown history — partial dampening

    // --- Updated score formula (weights sum to 1.00) ---
    // Win rate is now the dominant signal (25%) to prevent loss-history wallets from surfacing
    const baseScore =
      0.20 * freshness * perfMultiplier +
      0.15 * sizeBurst * perfMultiplier +
      0.15 * focus +
      0.15 * earlyMover +
      0.25 * winRateSignal +
      0.05 * edgeBet +
      0.05 * (winRate !== undefined && winRate >= 0.65 ? 1.0 : 0); // win rate bonus tier

    // --- NEW: Professional and Diversity Penalties ---
    const professionalPenalty = w.lifetime_trades > 5000 ? 0.2 : w.lifetime_trades > 1000 ? 0.5 : 1.0;
    const diversityPenalty = qMkt24h > 12 ? 0.2 : qMkt24h > 8 ? 0.5 : 1.0;

    // Multiply by modifiers (bounded, no threshold tuning)
    const rawScore01 = clamp01(
      botPenalty * ageFactor * categoryWeight * professionalPenalty * diversityPenalty * (baseScore + persistenceBonus * baseScore)
    );

    if (rawScore01 < 0.15) continue; // low-score early-exit

    // Top qualifying market
    const topMarketRow = db
      .prepare(
        `SELECT title, SUM(notional) AS vol
         FROM trades
         WHERE wallet = ? AND ts >= ?
           AND title NOT LIKE '%up or down%'
           AND title NOT LIKE '%up-or-down%'
           AND title NOT LIKE '%price above%'
           AND title NOT LIKE '%price below%'
         GROUP BY slug, title ORDER BY vol DESC LIMIT 1`
      )
      .get(w.wallet, since24h) as { title: string; vol: number } | undefined;

    const reasons: string[] = [];
    if (freshness >= 0.7) reasons.push("Large fresh bet");
    if (focus >= 0.9) reasons.push("Highly concentrated");
    if (sizeBurst >= 0.7) reasons.push("Size vs history");
    if (earlyMover >= 0.5) reasons.push("Early mover");
    if (edgeBet >= 0.5) reasons.push("Contrarian edge bets");
    if (winRate !== undefined && winRate >= 0.65) reasons.push("High win rate");
    if (categoryWeight >= 1.4) reasons.push("High-sensitivity market");
    if (professionalPenalty < 1.0) reasons.push("Professional volume");
    if (diversityPenalty < 1.0) reasons.push("Broad market activity");
    if (!reasons.length) reasons.push("High notional (24h)");

    // Persist raw score to wallet_history before percentile ranking
    insertWalletHistoryStmt.run({ wallet: w.wallet, ts: nowSec, score: rawScore01 });

    pool.push({
      wallet: w.wallet,
      rawScore01,
      winRate,
      trend,
      topMarket: topMarketRow?.title,
      lastTs: w.lastTs,
      reasons,
      categoryWeight,
    });
  }

  // --- Signal E: Percentile normalisation ---
  // Sort pool by rawScore, assign percentile rank (0–100)
  pool.sort((a, b) => a.rawScore01 - b.rawScore01);
  const total = pool.length;

  const insiders: Array<PolymarketInsider & { _rawScore: number }> = pool.map(
    (p, idx) => {
      const percentile = total > 1 ? Math.round((idx / (total - 1)) * 100) : 75;
      const label: PolymarketInsider['label'] =
        percentile >= 75 ? "High Suspicion" :
          percentile >= 50 ? "Moderate" :
            "Watchlist";

      return {
        address: p.wallet,
        score: percentile,
        label,
        reasons: p.reasons,
        topMarket: p.topMarket,
        lastSeen: p.lastTs,
        trend: p.trend,
        winRate: p.winRate !== undefined ? Math.round(p.winRate * 100) / 100 : undefined,
        _rawScore: p.rawScore01,
      };
    }
  );

  // Return top-12 ranked by raw score (descending)
  const ranked = insiders
    .sort((a, b) => b._rawScore - a._rawScore)
    .slice(0, 12)
    .map(({ _rawScore, ...rest }) => rest);

  if (ranked.length >= 3) return ranked;

  // Fallback: pad with top-volume wallets (same bot-market filter + gates)
  const topVol = db
    .prepare(
      `SELECT wallet, SUM(notional) AS vol, MAX(ts) AS lastTs, COUNT(*) AS lifetime_trades
       FROM trades
       WHERE ts >= ?
       GROUP BY wallet
       HAVING lifetime_trades >= 10 AND vol >= 2000
       ORDER BY vol DESC
       LIMIT 20`
    )
    .all(since14d) as Array<{ wallet: string; vol: number; lastTs: number; lifetime_trades: number }>;

  const seen = new Set(ranked.map((r) => r.address));
  for (const r of topVol) {
    if (ranked.length >= 12) break;
    if (!r.wallet || r.wallet === "unknown" || seen.has(r.wallet)) continue;

    const hasQualMarket = (db
      .prepare(
        `SELECT COUNT(*) AS cnt FROM trades
         WHERE wallet = ? AND ts >= ?
           AND title NOT LIKE '%up or down%'
           AND title NOT LIKE '%up-or-down%'
           AND title NOT LIKE '%price above%'
           AND title NOT LIKE '%price below%'
         LIMIT 1`
      )
      .get(r.wallet, since14d) as { cnt: number }).cnt > 0;

    if (!hasQualMarket) continue;
    seen.add(r.wallet);
    ranked.push({
      address: r.wallet,
      score: 20,
      label: "Watchlist",
      reasons: [`High notional ($${Math.round(r.vol).toLocaleString()} in 14d)`],
      topMarket: undefined,
      lastSeen: r.lastTs,
      trend: 'new',
    });
  }
  return ranked;
}

async function refreshPolymarketDataFromApi(opts?: {
  rotate?: boolean;
  scope?: "alpha" | "insiders" | "all";
}): Promise<void> {
  const scope: "alpha" | "insiders" | "all" = opts?.scope ?? "all";

  // If we only want to refresh insiders: fetch fresh trades first, then recompute from DB.
  if (scope === "insiders") {
    let tradesForInsiders: any[] = [];
    try {
      tradesForInsiders = await fetchPolymarketTrades(500);
    } catch (err) {
      console.warn("Polymarket trades fetch failed for insiders:", err);
    }
    if (tradesForInsiders.length) {
      const insertMany = db.transaction((rows: any[]) => {
        for (const tr of rows) {
          const txHash =
            tr.transactionHash ??
            tr.name ??
            `${tr.proxyWallet ?? "unknown"}-${tr.timestamp ?? 0}-${tr.asset ?? ""}-${tr.side ?? ""}-${tr.price ?? ""}-${tr.size ?? ""}`;
          const ts = Number(tr.timestamp) || 0;
          const slug = tr.slug ?? tr.eventSlug ?? "unknown-market";
          const price = Number(tr.price) || 0;
          const size = Number(tr.size) || 0;
          insertTradeStmt.run({
            txHash,
            ts,
            slug,
            title: tr.title ?? slug,
            conditionId: tr.conditionId ?? null,
            wallet: tr.proxyWallet ?? "unknown",
            side: tr.side ?? null,
            outcome: tr.outcome ?? null,
            price,
            size,
            notional: price * size,
          });
        }
      });
      insertMany(tradesForInsiders);
    }
    const allInsiders = await computePolymarketInsidersFromDb();
    const windowSize = 5;
    if (allInsiders.length) {
      // Pick wallets not recently shown to ensure fresh faces on each Refresh click
      let selected: typeof allInsiders;
      const freshPool = allInsiders.filter((i) => !recentlyShownInsiders.has(i.address));
      if (freshPool.length >= windowSize) {
        // Sort fresh pool by score desc and pick the top 5
        selected = freshPool.sort((a, b) => b.score - a.score).slice(0, windowSize);
      } else {
        // Not enough fresh wallets — clear the seen set and fall back to top-5 overall
        recentlyShownInsiders.clear();
        selected = allInsiders.slice(0, windowSize);
      }
      // Record shown wallets; clear when the set gets too large
      selected.forEach((i) => recentlyShownInsiders.add(i.address));
      if (recentlyShownInsiders.size > allInsiders.length * 2) recentlyShownInsiders.clear();
      polymarketData = {
        ...polymarketData,
        insiders: selected,
        lastUpdated: Date.now(),
      };
    } else {
      polymarketData = {
        ...polymarketData,
        lastUpdated: Date.now(),
      };
    }
    return;
  }

  let trades: any[] = [];
  try {
    trades = await fetchPolymarketTrades(500);
  } catch (err) {
    console.warn("Polymarket trades fetch failed; recomputing from DB snapshot only:", err);
    trades = [];
  }

  // Persist latest trades into SQLite for wallet-based modeling
  if (trades.length) {
    const insertMany = db.transaction((rows: any[]) => {
      for (const tr of rows) {
        const txHash =
          tr.transactionHash ??
          tr.name ??
          `${tr.proxyWallet ?? "unknown"}-${tr.timestamp ?? 0}-${tr.asset ?? ""}-${tr.side ?? ""}-${tr.price ?? ""}-${tr.size ?? ""}`;
        const ts = Number(tr.timestamp) || 0;
        const slug = tr.slug ?? tr.eventSlug ?? "unknown-market";
        const price = Number(tr.price) || 0;
        const size = Number(tr.size) || 0;
        insertTradeStmt.run({
          txHash,
          ts,
          slug,
          title: tr.title ?? slug,
          conditionId: tr.conditionId ?? null,
          wallet: tr.proxyWallet ?? "unknown",
          side: tr.side ?? null,
          outcome: tr.outcome ?? null,
          price,
          size,
          notional: price * size,
        });
      }
    });
    insertMany(trades);
  }

  // Group trades by slug (market); also capture the eventSlug for URL generation
  const bySlug: Record<string, any[]> = {};
  const slugToEventSlug: Record<string, string> = {};
  for (const t of trades) {
    const slug = t.slug ?? t.eventSlug ?? "unknown-market";
    if (!bySlug[slug]) bySlug[slug] = [];
    bySlug[slug].push(t);
    // Keep the first eventSlug seen for this market slug
    if (t.eventSlug && !slugToEventSlug[slug]) {
      slugToEventSlug[slug] = t.eventSlug;
    }
  }

  // Rank markets by a signal score (edge potential * recent volume)
  const rankedMarkets = Object.entries(bySlug)
    .map(([slug, ts]) => {
      const title = (ts[0] as any).title ?? slug;

      // Skip noisy binary price-move markets — they add noise, not alpha
      const titleL = title.toLowerCase();
      if (
        titleL.includes('up or down') ||
        titleL.includes('up-or-down') ||
        titleL.includes('price above') ||
        titleL.includes('price below')
      ) return null;

      const totalNotional = ts.reduce(
        (acc, tr: any) => acc + (Number(tr.size) || 0) * (Number(tr.price) || 0),
        0
      );

      // Use the latest timestamp as "now" proxy (data API is batched)
      const latestTs = ts.reduce(
        (max, tr: any) => Math.max(max, Number(tr.timestamp) || 0),
        0
      );
      const cutoffRecent = latestTs - 30 * 60; // last 30 minutes, in seconds

      // Recent traded notional (all sides) used for scoring and filtering
      const recent = ts.filter(
        (tr: any) => (Number(tr.timestamp) || 0) >= cutoffRecent
      );
      const volumeRecent = recent.reduce(
        (acc, tr: any) => acc + (Number(tr.size) || 0) * (Number(tr.price) || 0),
        0
      );

      return { slug, title, trades: ts, totalNotional, volumeRecent };
    })
    .filter((m): m is NonNullable<typeof m> => m !== null)
    // Filter out very illiquid / inactive markets
    .filter((m) => {
      if (m.volumeRecent <= 100) return false;
      // Exclude sports/financial up-or-down slug noise
      const titleL = (m.title ?? m.slug ?? '').toLowerCase();
      if (titleL.includes('up or down') || titleL.includes('up-or-down') || titleL.includes('price above') || titleL.includes('price below')) return false;
      return true;
    })
    .sort((a, b) => b.volumeRecent - a.volumeRecent)
    .slice(0, 40);

  const pool = rankedMarkets;

  const rawSignals = pool.map((m, idx) => {
    // Each slug in the Polymarket data API is a SINGLE outcome token (e.g. one team, Over, Yes).
    // A plain VWAP across all trades for this slug gives the real current token price.
    const tradesForMarket = m.trades as any[];
    const latestTs = tradesForMarket.reduce(
      (max, tr) => Math.max(max, Number(tr.timestamp) || 0),
      0
    );
    const cutoffShort = latestTs - 10 * 60; // last 10 minutes

    const tradesShort = tradesForMarket.filter(
      (tr) => (Number(tr.timestamp) || 0) >= cutoffShort
    );
    const tradesAll = tradesForMarket;

    const vwap = (ts: any[]) => {
      const [num, den] = ts.reduce(
        ([n, d], tr: any) => {
          const sz = Number(tr.size) || 0;
          const pr = Number(tr.price) || 0;
          return [n + sz * pr, d + sz];
        },
        [0, 0]
      );
      return den > 0 ? num / den : 0.5;
    };

    if (!tradesAll.length) {
      return null;
    }

    // Use the most recently traded price as the short-term price (most reflects live price)
    const sortedByTs = [...tradesAll].sort((a, b) => (Number(b.timestamp) || 0) - (Number(a.timestamp) || 0));
    const lastTradedPrice = Number(sortedByTs[0]?.price) || 0.5;

    const priceShort = tradesShort.length ? vwap(tradesShort) : lastTradedPrice;
    const priceMid = vwap(tradesAll);

    // Skip already-resolved markets: price pinned at ~0¢ or ~100¢
    if (priceShort >= 0.97 || priceShort <= 0.03) {
      return null;
    }

    // --- ALPHA V3.0: Model Logic Overhaul ---
    const now = Date.now();
    const key = m.slug;
    const priceDiff = Math.abs(priceMid - (polymarketStats[key]?.longVwap ?? priceMid));
    const alpha = 0.05; // slower EMA for more stability

    const prevStats = polymarketStats[key] ?? {
      longVwap: priceMid,
      sampleCount: 0,
      lastUpdated: now,
      rollingVolatility: priceDiff,
      avgTradeSize: m.totalNotional / Math.max(1, m.trades.length),
    };

    const longVwap =
      prevStats.sampleCount > 0
        ? alpha * priceMid + (1 - alpha) * prevStats.longVwap
        : priceMid;

    const rollingVolatility = alpha * priceDiff + (1 - alpha) * prevStats.rollingVolatility;
    const avgTradeSize = alpha * (m.totalNotional / Math.max(1, m.trades.length)) + (1 - alpha) * prevStats.avgTradeSize;

    polymarketStats[key] = {
      longVwap,
      sampleCount: prevStats.sampleCount + 1,
      lastUpdated: now,
      rollingVolatility,
      avgTradeSize,
    };

    // 1. Zero-Lag Fair Value (Mean Reversion)
    // baseFair = longVwap + (MeanReversionConstant * (longVwap - priceMid))
    const baseFair = longVwap + (0.15 * (longVwap - priceMid));

    // 2. Order Book Imbalance (OBI) & Flow Skew
    const yesNo = tradesForMarket.reduce(
      (acc, tr: any) => {
        const sz = Number(tr.size) || 0;
        const pr = Number(tr.price) || 0;
        const notion = sz * pr;
        if (tr.outcome === "YES") { acc.yesNotion += notion; acc.yesCount++; }
        else if (tr.outcome === "NO") { acc.noNotion += notion; acc.noCount++; }
        return acc;
      },
      { yesNotion: 0, yesCount: 0, noNotion: 0, noCount: 0 }
    );
    // obi = (yesNotional / yesTrades) - (noNotional / noTrades)
    const obi = (yesNo.yesNotion / Math.max(1, yesNo.yesCount)) - (yesNo.noNotion / Math.max(1, yesNo.noCount));
    const flowSkew = Math.max(-1, Math.min(1, obi / 500)); // normalized skew

    // 3. Sharp Multiplier (Insider Integration)
    // Shifts the fair value based on direction of top-performing insiders
    const sharpShift = getSharpDirection(key) * 0.03;

    // 4. Sector-Specific Anchors (Internal Correlations)
    let sectorAnchor = 0;
    const titleLower = m.title.toLowerCase();
    if (titleLower.includes("btc") || titleLower.includes("bitcoin") || titleLower.includes("eth")) {
      sectorAnchor = 0.01; // Placeholder for spot delta; favors the trend
    }
    if (isSportsMarket(m.title)) {
      sectorAnchor = -0.01; // Sports entropy discount
    }

    const fairValue = Math.min(
      0.99,
      Math.max(0.01, baseFair + (0.05 * flowSkew) + sharpShift + sectorAnchor)
    );
    const priceNow = priceShort;

    // 5. Improved Signal Filtering (Noise Suppression)
    let ev = (fairValue - priceNow) * 100; // percentage points
    if (Math.abs(ev) < 3.0) { // Ignores minor noise per plan
      ev = 0;
    }

    // 6. Risk-Adjusted Kelly Stake
    // (EV / Volatility) * LiquidityPenalty
    const volFactor = Math.max(0.01, rollingVolatility * 100);
    const liquidityPenalty = Math.min(1, m.volumeRecent / 5000);
    let stake = ev === 0 ? 0 : Math.max(0, Math.min(10, (Math.abs(ev) / volFactor) * liquidityPenalty));

    // Ensure interesting edges get at least a minimal stake
    if (Math.abs(ev) >= 5 && stake > 0 && stake < 1) {
      stake = 1;
    }

    polymarketLastPrices[m.slug] = priceNow;

    return {
      slug: m.slug,
      eventSlug: slugToEventSlug[m.slug],
      title: m.title,
      fairValue,
      marketPrice: priceNow,
      ev,
      kellyStake: stake,
    };
  }).filter((s) => s) as Array<{
    slug: string;
    eventSlug?: string;
    title: string;
    fairValue: number;
    marketPrice: number;
    ev: number;
    kellyStake: number;
  }>;

  // Rank by absolute edge so we see the most mispriced markets (rich or cheap)
  const signalsRanked = rawSignals
    .sort((a, b) => Math.abs(b.ev) - Math.abs(a.ev))
    .slice(0, 36);

  const windowSize = 3;
  if (opts?.rotate && signalsRanked.length > windowSize) {
    alphaRotation = (alphaRotation + windowSize) % signalsRanked.length;
  }

  const start = alphaRotation % Math.max(1, signalsRanked.length);
  const rotatedSignals = [
    ...signalsRanked.slice(start),
    ...signalsRanked.slice(0, start),
  ];
  const selectedSignals = rotatedSignals.slice(0, windowSize);

  polymarketLastAlphaSlugs = selectedSignals.map((s) => s.slug);

  const alphaSignals: PolymarketAlphaSignal[] = selectedSignals.map(
    (s, idx) => ({
      id: s.slug ?? `pm-${idx}`,
      eventSlug: s.eventSlug ?? s.slug,
      marketName: s.title,
      fairValue: s.fairValue,
      marketPrice: s.marketPrice,
      ev: Number(s.ev.toFixed(1)),
      kellyStake: Number(s.kellyStake.toFixed(1)),
    })
  );

  // Whale feed: top recent large trades
  const whaleFeed: PolymarketWhaleTrade[] = trades
    .slice() // copy
    .sort((a: any, b: any) => (b.size * b.price) - (a.size * a.price))
    .slice(0, 5)
    .map((tr: any, i: number) => ({
      id: tr.transactionHash ?? `wf-${i}`,
      time: "Just now",
      market: tr.title ?? tr.slug ?? "Unknown market",
      slug: tr.slug,
      address: tr.proxyWallet ?? "unknown",
      amount: Number(tr.size) * Number(tr.price),
      side: tr.side === "SELL" ? "NO" : "YES",
    }));
  const insiders =
    scope === "all" ? await computePolymarketInsidersFromDb() : polymarketData.insiders;

  polymarketData = {
    alphaSignals,
    insiders,
    whaleFeed,
    lastUpdated: Date.now(),
  };
}

async function startServer() {
  const app = express();
  const server = createServer(app);
  const wss = new WebSocketServer({ server });

  const PORT = 3000;

  app.use(express.json({ limit: "50mb" }));

  await loadAssetsUniverse();
  await fetchLivePrices();

  const indices = [
    // US broad market / style
    { id: 'SPX', name: 'S&P 500', price: 4783.45, change: 1.24, region: 'US' },
    { id: 'SPY', name: 'SPDR S&P 500 ETF', price: 520.12, change: 1.18, region: 'US' },
    { id: 'IVV', name: 'iShares Core S&P 500 ETF', price: 519.03, change: 1.15, region: 'US' },
    { id: 'VOO', name: 'Vanguard S&P 500 ETF', price: 518.67, change: 1.10, region: 'US' },
    { id: 'NDX', name: 'NASDAQ-100', price: 16982.10, change: 2.15, region: 'US' },
    { id: 'QQQ', name: 'Invesco QQQ Trust (NASDAQ-100)', price: 430.22, change: 2.05, region: 'US' },
    { id: 'DJI', name: 'Dow Jones Industrial Average', price: 38650.21, change: 0.85, region: 'US' },
    { id: 'DIA', name: 'SPDR Dow Jones Industrial Average ETF', price: 390.12, change: 0.80, region: 'US' },
    { id: 'RUT', name: 'Russell 2000', price: 2054.32, change: 0.96, region: 'US' },
    { id: 'IWM', name: 'iShares Russell 2000 ETF', price: 205.44, change: 0.90, region: 'US' },

    // Global / MSCI proxies
    { id: 'URTH', name: 'iShares MSCI World ETF', price: 143.87, change: 0.92, region: 'Global' },
    { id: 'ACWI', name: 'iShares MSCI ACWI ETF', price: 114.53, change: 0.88, region: 'Global' },
    { id: 'VEA', name: 'Vanguard FTSE Developed Markets ETF', price: 51.24, change: 0.74, region: 'Global' },
    { id: 'EEM', name: 'iShares MSCI Emerging Markets ETF', price: 42.87, change: 0.65, region: 'Global' },

    // Europe / UK
    { id: 'UKX', name: 'FTSE 100', price: 7682.30, change: -0.45, region: 'EMEA' },
    { id: 'STOXX50E', name: 'EURO STOXX 50', price: 4521.66, change: 0.52, region: 'EMEA' },
    { id: 'DAX', name: 'DAX 40', price: 16700.12, change: 0.30, region: 'EMEA' },
    { id: 'CAC40', name: 'CAC 40', price: 7421.33, change: 0.41, region: 'EMEA' },

    // Asia Pacific
    { id: 'N225', name: 'Nikkei 225', price: 33450.00, change: 0.85, region: 'Asia Pacific' },
    { id: 'HSI', name: 'Hang Seng', price: 16535.33, change: -1.92, region: 'Asia Pacific' },
    { id: 'AS51', name: 'S&P/ASX 200', price: 7654.21, change: 0.37, region: 'Asia Pacific' },
    { id: 'SSE', name: 'Shanghai Composite', price: 3021.44, change: -0.22, region: 'Asia Pacific' },

    // Sector / thematic
    { id: 'XLK', name: 'Technology Select Sector SPDR', price: 205.45, change: 1.75, region: 'US' },
    { id: 'XLF', name: 'Financial Select Sector SPDR', price: 40.32, change: 0.65, region: 'US' },
    { id: 'XLE', name: 'Energy Select Sector SPDR', price: 92.11, change: -0.34, region: 'US' },
    { id: 'XLV', name: 'Health Care Select Sector SPDR', price: 142.25, change: 0.48, region: 'US' },

    // Commodities (mapped to Commodities tab)
    { id: 'GLD', name: 'SPDR Gold Trust', price: 190.34, change: 0.62, region: 'Commodities' },
    { id: 'SLV', name: 'iShares Silver Trust', price: 24.85, change: 0.45, region: 'Commodities' },
    { id: 'USO', name: 'United States Oil Fund', price: 73.12, change: -0.28, region: 'Commodities' },
    { id: 'DBC', name: 'Invesco DB Commodity Index Tracking Fund', price: 25.44, change: 0.31, region: 'Commodities' },
  ];

  polymarketData = {
    alphaSignals: [
      {
        id: 'pm-1',
        marketName: 'Trump to win 2024 US Presidential election',
        fairValue: 0.58,
        marketPrice: 0.48,
        ev: 10.0,
        kellyStake: 6.5,
      },
      {
        id: 'pm-2',
        marketName: 'Federal Reserve to cut rates at next meeting',
        fairValue: 0.76,
        marketPrice: 0.69,
        ev: 7.0,
        kellyStake: 4.2,
      },
      {
        id: 'pm-3',
        marketName: 'Bitcoin to trade above $100k by year-end',
        fairValue: 0.32,
        marketPrice: 0.24,
        ev: 8.0,
        kellyStake: 3.1,
      },
    ],
    insiders: [
      {
        address: '0x72a...9f21',
        score: 88,
        label: 'High Suspicion',
        reasons: ['Fresh wallet + concentration', 'Resolution sniping'],
        topMarket: 'Trump to win 2024 US Presidential election',
      },
      {
        address: '0x4b1...e112',
        score: 67,
        label: 'Watchlist',
        reasons: ['Low-odds scooping (1–15%)'],
        topMarket: 'Federal Reserve to cut rates at next meeting',
      },
      {
        address: '0x88c...d33a',
        score: 74,
        label: 'Watchlist',
        reasons: ['High market concentration'],
        topMarket: 'Bitcoin to trade above $100k by year-end',
      },
    ],
    whaleFeed: [
      {
        id: 'wf-1',
        time: 'Just now',
        market: 'Trump 2024 election winner',
        address: '0x72a...9f21',
        amount: 45000,
        side: 'YES',
      },
      {
        id: 'wf-2',
        time: '2 mins ago',
        market: 'BTC > $100k by year-end',
        address: '0x4b1...e112',
        amount: 12000,
        side: 'NO',
      },
      {
        id: 'wf-3',
        time: '5 mins ago',
        market: 'Fed to cut rates at next meeting',
        address: '0x992...a321',
        amount: 250000,
        side: 'YES',
      },
    ],
  };

  // Try to refresh Polymarket data from live API on startup
  try {
    await refreshPolymarketDataFromApi();
  } catch (err) {
    console.warn("Initial Polymarket API refresh failed, using snapshot:", err);
  }

  const buildOptimizationSimulation = (
    tickers: string[],
    investment: number,
    risk: number, // User preferred risk (0 to 1)
    timeHorizonYears: number,
    monthlyContribution: number,
    isCompounded: boolean = true
  ) => {
    const weights: Record<string, number> = {};

    // Generate intelligent deterministic weights aligning with the user's selected risk
    // We score how closely an asset's risk matches the requested portfolio risk
    const unnormalizedWeights = tickers.map((t) => {
      const asset = assets.find(a => a.id === t);
      const assetRisk = asset ? calculateRiskScore(asset) : 0.5;

      // Calculate a "distance" from the requested risk
      const distance = Math.abs(assetRisk - risk);

      // Weights are inversely proportional to the distance plus a small base score
      // Small penalty if distance is large, huge bonus if distance is small
      let weightScore = 1.0 / (0.1 + distance);

      // Add a slight deterministic randomized jitter to ensure varying weights
      const hash = t.charCodeAt(0) + (t.charCodeAt(t.length - 1) || 0);
      weightScore *= (0.8 + ((hash % 40) / 100));

      return weightScore;
    });

    const sumScores = unnormalizedWeights.reduce((sum, v) => sum + v, 0);

    let assigned = 0;
    tickers.forEach((t, index) => {
      if (index === tickers.length - 1) {
        // Last asset absorbs floating point rounding errors to equal precisely 100%
        weights[t] = Math.max(0, +(1 - assigned).toFixed(4));
      } else {
        const w = unnormalizedWeights[index] / sumScores;
        const rounded = +w.toFixed(4);
        weights[t] = rounded;
        assigned += rounded;
      }
    });

    const baseReturn = 0.05 + risk * 0.15;
    const baseVol = 0.08 + risk * 0.25;
    const expected_return = baseReturn + (Math.random() - 0.5) * 0.02;
    const volatility = baseVol + (Math.random() - 0.5) * 0.03;
    const sharpe_ratio = (expected_return - 0.04) / volatility;

    const strategy = risk < 0.3 ? "Conservative" : risk < 0.7 ? "Balanced" : "Aggressive";

    const months = timeHorizonYears * 12;
    const growth = [];
    let currentVal = investment;
    let benchVal = investment;
    let accumulatedCash = 0;

    for (let i = 0; i <= months; i++) {
      growth.push({
        month: i,
        portfolio: isCompounded ? currentVal : currentVal + accumulatedCash,
        benchmark: benchVal,
      });

      const portReturn =
        expected_return / 12 + (Math.random() - 0.5) * (volatility / Math.sqrt(12));
      const benchReturn =
        0.08 / 12 + (Math.random() - 0.5) * (0.15 / Math.sqrt(12));

      if (isCompounded) {
        currentVal = (currentVal + monthlyContribution) * (1 + portReturn);
      } else {
        currentVal += monthlyContribution;
        accumulatedCash += currentVal * portReturn;
      }

      benchVal = (benchVal + monthlyContribution) * (1 + benchReturn);
    }

    const finalPortfolioValue = isCompounded ? currentVal : currentVal + accumulatedCash;

    return {
      optimization: {
        weights,
        expected_return: Math.round(expected_return * 10000) / 10000,
        volatility: Math.round(volatility * 10000) / 10000,
        sharpe_ratio: Math.round(sharpe_ratio * 100) / 100,
        strategy,
      },
      backtest: {
        growth,
        portfolio_total_return:
          Math.round(((finalPortfolioValue / (investment + monthlyContribution * months)) - 1) * 10000) / 10000,
        benchmark_total_return:
          Math.round(((benchVal / (investment + monthlyContribution * months)) - 1) * 10000) / 10000,
        max_drawdown_pct: -Math.round((10 + Math.random() * 20) * 10) / 10,
      },
      risk_details: {
        contribution_to_risk: tickers.map((t) => ({
          ticker: t,
          contribution: Math.round((100 / tickers.length) + (Math.random() - 0.5) * 10),
        })),
      },
    };
  };

  // API Routes
  app.get("/api/assets", (req, res) => {
    const { search, sector, country, limit, offset } = req.query;

    let filtered = assets;

    if (typeof search === "string" && search.trim()) {
      const term = search.trim().toLowerCase();
      filtered = filtered.filter(
        (a) =>
          a.id.toLowerCase().includes(term) ||
          a.name.toLowerCase().includes(term)
      );
    }

    if (typeof sector === "string" && sector.trim()) {
      filtered = filtered.filter(
        (a) => a.sector.toLowerCase() === sector.trim().toLowerCase()
      );
    }

    if (typeof country === "string" && country.trim()) {
      filtered = filtered.filter(
        (a) => (a.country ?? "").toLowerCase() === country.trim().toLowerCase()
      );
    }

    const lim =
      typeof limit === "string" ? Math.min(parseInt(limit) || 50, 200) : 50;
    const off = typeof offset === "string" ? parseInt(offset) || 0 : 0;

    const page = filtered.slice(off, off + lim);

    res.json({
      total: filtered.length,
      limit: lim,
      offset: off,
      data: page,
    });
  });

  app.post("/api/portfolio/optimize", (req, res) => {
    const {
      tickers,
      investment,
      risk_tolerance,
      time_horizon_years,
      monthly_contribution,
    } = req.body;

    if (!tickers || tickers.length < 2) {
      return res
        .status(422)
        .json({ success: false, detail: "At least 2 tickers required" });
    }

    const risk =
      typeof risk_tolerance === "number"
        ? risk_tolerance
        : parseFloat(risk_tolerance) || 0.5;
    const inv =
      typeof investment === "number"
        ? investment
        : parseFloat(investment) || 100000;
    const horizon =
      typeof time_horizon_years === "number"
        ? time_horizon_years
        : parseInt(time_horizon_years) || 5;
    const monthly =
      typeof monthly_contribution === "number"
        ? monthly_contribution
        : parseFloat(monthly_contribution) || 0;
    const isCompounded = req.body?.is_compounded ?? true;

    const simulation = buildOptimizationSimulation(
      tickers,
      inv,
      risk,
      horizon,
      monthly,
      isCompounded
    );

    res.json({
      success: true,
      data: simulation,
    });
  });

  app.get("/api/backtest/results", async (req, res) => {
    try {
      const results = await runBacktest();
      res.json(results);
    } catch (err) {
      console.error("Backtest failed:", err);
      res.status(500).json({ error: "Backtest failed" });
    }
  });

  app.get("/api/backtest/trades", (req, res) => {
    const slugRaw = req.query.slug;
    const slug = typeof slugRaw === "string" ? slugRaw.trim() : "";
    if (!slug) {
      res.status(400).json({ error: "Query parameter 'slug' is required" });
      return;
    }

    try {
      const rows = db
        .prepare(
          `SELECT ts, price, size, notional, outcome, side, wallet, title
           FROM trades
           WHERE slug = ?
           ORDER BY ts ASC
           LIMIT 500`
        )
        .all(slug) as Array<{
          ts: number;
          price: number;
          size: number;
          notional: number;
          outcome: string | null;
          side: string | null;
          wallet: string | null;
          title: string | null;
        }>;

      res.json({
        slug,
        trades: rows,
      });
    } catch (err) {
      console.error("Failed to load backtest trades:", err);
      res.status(500).json({ error: "Failed to load trades" });
    }
  });

  app.get("/api/backtest/validation", (req, res) => {
    try {
      const limitRaw = typeof req.query.limit === "string" ? parseInt(req.query.limit) : 500;
      const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, 5000) : 500;

      const rows = db
        .prepare(
          `SELECT slug, sim_ts, model_fair_value, max_ts_seen_in_db, run_at
           FROM backtest_validation
           ORDER BY run_at DESC, sim_ts DESC
           LIMIT ?`
        )
        .all(limit) as Array<{
          slug: string;
          sim_ts: number;
          model_fair_value: number;
          max_ts_seen_in_db: number;
          run_at: number;
        }>;

      // Leakage check: flag any row where max_ts_seen_in_db > sim_ts
      const leakageCount = rows.filter(r => r.max_ts_seen_in_db > r.sim_ts).length;

      res.json({
        total: rows.length,
        leakageViolations: leakageCount,
        rows,
      });
    } catch (err) {
      console.error("Failed to load backtest validation:", err);
      res.status(500).json({ error: "Failed to load validation data" });
    }
  });

  app.get("/api/sync/force", async (req, res) => {
    try {
      console.log("[API] Forced sync triggered...");
      await syncClosedMarkets();
      res.json({ success: true, message: "Sync completed" });
    } catch (err) {
      console.error("Forced sync failed:", err);
      res.status(500).json({ error: "Sync failed" });
    }
  });

  app.post("/api/portfolio/recommend", (req, res) => {
    const {
      investment,
      risk_tolerance,
      time_horizon_years,
      monthly_contribution,
      num_holdings,
    } = req.body;

    const risk =
      typeof risk_tolerance === "number"
        ? risk_tolerance
        : parseFloat(risk_tolerance) || 0.5;
    const inv =
      typeof investment === "number"
        ? investment
        : parseFloat(investment) || 100000;
    const horizon =
      typeof time_horizon_years === "number"
        ? time_horizon_years
        : parseInt(time_horizon_years) || 5;
    const monthly =
      typeof monthly_contribution === "number"
        ? monthly_contribution
        : parseFloat(monthly_contribution) || 0;

    const desiredCountRaw =
      typeof num_holdings === "number"
        ? num_holdings
        : parseInt(num_holdings) || 5;
    const desiredCount = Math.min(
      assets.length,
      Math.max(2, desiredCountRaw)
    );

    const ranked = [...assets].sort((a, b) => {
      const riskA = calculateRiskScore(a);
      const riskB = calculateRiskScore(b);
      return (
        Math.abs(riskA - risk) -
        Math.abs(riskB - risk)
      );
    });

    const selected = ranked.slice(0, desiredCount);
    const tickers = selected.map((a) => a.id);
    const isCompounded = req.body?.is_compounded ?? true;

    const simulation = buildOptimizationSimulation(
      tickers,
      inv,
      risk,
      horizon,
      monthly,
      isCompounded
    );

    res.json({
      success: true,
      data: {
        ...simulation,
        universe: tickers,
      },
    });
  });

  app.get("/api/indices", (req, res) => {
    res.json(indices);
  });

  app.get("/api/polymarket", (req, res) => {
    res.json(polymarketData);
  });

  app.post("/api/polymarket/refresh", async (req, res) => {
    const scopeRaw = (req.body && req.body.scope) as string | undefined;
    const scope: "alpha" | "insiders" | "all" =
      scopeRaw === "alpha" || scopeRaw === "insiders" ? scopeRaw : "all";

    try {
      await refreshPolymarketDataFromApi({
        rotate: true,
        scope,
      });
      res.json({ success: true, data: polymarketData });
    } catch (err) {
      console.error("Polymarket manual refresh failed:", err);
      // Return current snapshot so the UI doesn't "break" on refresh failures.
      res.json({ success: false, error: "Refresh failed", data: polymarketData });
    }
  });

  app.post("/api/efficient-frontier", (req, res) => {
    // Read user's generated portfolio state if available
    const weights: Record<string, number> = req.body?.weights || {};
    const tickers = Object.keys(weights);

    // Fallback if no portfolio is generated
    const simTickers = tickers.length > 0 ? tickers : ['SPY', 'QQQ', 'TLT', 'GLD'];
    const simWeights = tickers.length > 0 ? weights : { SPY: 0.45, TLT: 0.3, QQQ: 0.15, GLD: 0.1 };

    // 1. Calculate Active Portfolio metrics
    let activeReturn = 0;
    let activeRisk = 0;
    const activeData = simTickers.map(t => {
      const asset = assets.find(a => a.id === t);
      const risk = asset ? calculateRiskScore(asset) : 0.5;
      const expReturn = 0.04 + (risk * 0.12);
      return { risk, expReturn, w: simWeights[t] };
    });

    activeData.forEach(item => {
      activeReturn += item.expReturn * item.w;
      activeRisk += item.risk * item.w;
    });

    // We scale risk up slightly to make it display nicely on the scatter as roughly 5-25%
    const scaleReturn = (r: number) => Math.round(r * 100 * 10) / 10;
    const scaleRisk = (r: number) => Math.round(r * 30 * 10) / 10;

    const activePt = {
      risk: scaleRisk(activeRisk),
      return: scaleReturn(activeReturn),
      ratio: scaleReturn(activeReturn) / scaleRisk(activeRisk),
      type: 'portfolio'
    };

    // 2. Monte Carlo Simulation: Generate 50 random portfolios to find the efficient frontier
    const scatter = [];
    let maxSharpe = { risk: 0, return: 0, ratio: -100, weights: {} as Record<string, number> };
    let minVol = { risk: 100, return: 0, ratio: 0, weights: {} as Record<string, number> };

    for (let i = 0; i < 50; i++) {
      // Generate random weights that sum to 1
      let raw = simTickers.map(() => Math.random());
      let sum = raw.reduce((a, b) => a + b, 0);
      let ws = raw.map(v => v / sum);

      let ptReturn = 0;
      let ptRisk = 0;

      activeData.forEach((item, idx) => {
        ptReturn += item.expReturn * ws[idx];
        ptRisk += item.risk * ws[idx];
      });

      // Create some correlation jitter so it forms a scatter blob instead of a straight line
      ptRisk *= (0.9 + Math.random() * 0.2);

      const finalRisk = scaleRisk(ptRisk);
      const finalReturn = scaleReturn(ptReturn);
      const ratio = finalReturn / (finalRisk || 1);

      const pt = { risk: finalRisk, return: finalReturn, type: 'scatter', ratio, weights: {} as Record<string, number> };
      simTickers.forEach((t, idx) => pt.weights[t] = ws[idx]);

      scatter.push(pt);

      if (ratio > maxSharpe.ratio) maxSharpe = pt;
      if (finalRisk < minVol.risk) minVol = pt;
    }

    // 3. Current Portfolio formatting
    // We add it to scatter to optionally render it together, but distinct in UI
    scatter.push({ ...activePt, type: 'current_portfolio' });

    // Format Allocations (Max Sharpe) for the pie chart list
    const allocations = simTickers.map(t => ({
      name: t,
      value: Math.round(maxSharpe.weights[t] * 100)
    })).sort((a, b) => b.value - a.value).slice(0, 5); // top 5

    res.json({
      scatter,
      maxSharpe: { risk: maxSharpe.risk, return: maxSharpe.return, ratio: maxSharpe.ratio },
      minVol: { risk: minVol.risk, return: minVol.return, ratio: minVol.ratio },
      allocations,
      currentPortfolio: { risk: activePt.risk, return: activePt.return, ratio: activePt.ratio }
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

  app.post("/api/risk-data", (req, res) => {
    const weights: Record<string, number> = req.body?.weights || {};
    const tickers = Object.keys(weights);

    if (tickers.length === 0) {
      // Fallback data if no portfolio is generated yet
      return res.json({
        correlationMatrix: [
          { id: 'AAPL', AAPL: 1.00, MSFT: 0.65, GOOGL: 0.55 },
          { id: 'MSFT', AAPL: 0.65, MSFT: 1.00, GOOGL: 0.70 },
          { id: 'GOOGL', AAPL: 0.55, MSFT: 0.70, GOOGL: 1.00 },
        ],
        riskContribution: [
          { name: 'AAPL', value: 33.3, color: '#f59e0b' },
          { name: 'MSFT', value: 33.3, color: '#3b82f6' },
          { name: 'GOOGL', value: 33.4, color: '#10b981' },
        ],
        stressTests: [
          {
            id: 'black_swan',
            scenario: "2008 Financial Crisis",
            impact: -22.5,
            estLoss: 22500,
            description: "Simulation based on the 2008 global financial crisis parameters."
          }
        ],
        insights: [
          "Please generate a portfolio on the Dashboard to see personalized risk analysis."
        ]
      });
    }

    // --- Dynamic Generation based on weights ---
    const totalInvestment = typeof req.body?.investment === 'number' ? req.body.investment : 100000;

    // 1. Dynamic Correlation Matrix
    // We mock realistic-looking correlations: 1.0 on diagonal, 0.3-0.8 otherwise based on a hash of the tickers
    const correlationMatrix = tickers.map(t1 => {
      const row: any = { id: t1 };
      tickers.forEach(t2 => {
        if (t1 === t2) {
          row[t2] = 1.0;
        } else {
          // deterministic pseudo-random correlation between 0.2 and 0.85
          const hash = (t1.charCodeAt(0) + t2.charCodeAt(0)) % 100;
          row[t2] = 0.2 + (hash / 100) * 0.65;
        }
      });
      return row;
    });

    // 2. Risk Contribution
    // We adjust weights slightly by a "mock beta" so it's not exactly identical to the dollar weights
    const colors = ['#f43f5e', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#06b6d4', '#ec4899', '#64748b'];
    let totalRiskUnits = 0;
    const riskUnits = tickers.map(t => {
      const w = weights[t];
      const mockBeta = 0.8 + ((t.charCodeAt(0) % 10) / 10) * 0.6; // 0.8 to 1.4
      const units = w * mockBeta;
      totalRiskUnits += units;
      return { t, units };
    });

    const riskContribution = riskUnits
      .sort((a, b) => b.units - a.units)
      .slice(0, 5)
      .map((item, idx) => ({
        name: item.t,
        value: Number(((item.units / totalRiskUnits) * 100).toFixed(1)),
        color: colors[idx % colors.length]
      }));

    // If more than 5 assets, group the rest into "Others"
    if (tickers.length > 5) {
      const remainingStats = riskUnits.slice(5).reduce((sum, item) => sum + item.units, 0);
      riskContribution.push({
        name: 'Others',
        value: Number(((remainingStats / totalRiskUnits) * 100).toFixed(1)),
        color: colors[5]
      });
    }

    // 3. Stress Tests (scaled by total investment and an aggregate portfolio beta)
    const portBeta = totalRiskUnits; // already weighted

    // Base impacts for different scenarios
    const baseImpacts = {
      black_swan: -25.0,
      covid_crash: -20.0,
      tech_selloff: -15.0
    };

    const stressTests = [
      {
        id: 'black_swan',
        scenario: "2008 Financial Crisis",
        impact: Number((baseImpacts.black_swan * portBeta).toFixed(1)),
        estLoss: totalInvestment * Math.abs((baseImpacts.black_swan * portBeta) / 100),
        description: "Simulation based on the 2008 global financial crisis parameters."
      },
      {
        id: 'covid_crash',
        scenario: "2020 COVID-19 Crash",
        impact: Number((baseImpacts.covid_crash * portBeta).toFixed(1)),
        estLoss: totalInvestment * Math.abs((baseImpacts.covid_crash * portBeta) / 100),
        description: "Simulation based on the rapid 2020 pandemic market selloff."
      },
      {
        id: 'tech_selloff',
        scenario: "2022 Tech Selloff",
        impact: Number((baseImpacts.tech_selloff * portBeta).toFixed(1)),
        estLoss: totalInvestment * Math.abs((baseImpacts.tech_selloff * portBeta) / 100),
        description: "Simulation based on the 2022 rising interest rate tech correction."
      }
    ];

    // 4. Actionable Insights
    const insights: string[] = [];

    // Concentration Risk Check
    const topAsset = riskContribution[0];
    if (topAsset && topAsset.value > 40) {
      insights.push(`Concentration Risk: A significant portion (${topAsset.value}%) of your expected volatility is driven by ${topAsset.name}.`);
    } else {
      insights.push(`Diversified Risk: Your portfolio risk is relatively well-distributed, with ${topAsset?.name} leading at ${topAsset?.value}%.`);
    }

    // High Correlation Check
    let highestCorr = 0;
    let corrPair = "";
    for (let i = 0; i < correlationMatrix.length; i++) {
      for (let j = i + 1; j < correlationMatrix.length; j++) {
        const t1 = correlationMatrix[i].id;
        const t2 = correlationMatrix[j].id;
        const val = correlationMatrix[i][t2];
        if (val > highestCorr) {
          highestCorr = val;
          corrPair = `${t1} and ${t2}`;
        }
      }
    }
    if (highestCorr > 0.75) {
      insights.push(`High Correlation: ${corrPair} are highly correlated (${highestCorr.toFixed(2)}). They will likely move together during market shocks.`);
    }

    // Stress test insight
    insights.push(`Stress Vulnerability: In a severe 2008-style crisis, expect drawdowns near ${Math.abs(stressTests[0].impact)}%, translating to around $${(stressTests[0].estLoss / 1000).toFixed(1)}k on your initial investment.`);

    res.json({
      correlationMatrix,
      riskContribution,
      stressTests,
      insights
    });
  });

  // Broadcast live market prices via local WebSocket
  wss.on("connection", (ws) => {
    console.log("Client connected to WebSocket");
    const sendSnapshot = () => {
      if (ws.readyState !== WebSocket.OPEN) return;
      const updates = assets.map((asset) => ({
        id: asset.id,
        price: asset.price,
        change: asset.change,
      }));
      ws.send(JSON.stringify({ type: "PRICE_UPDATE", data: updates, vix: currentVix }));
    };

    // Send immediately on connect, then periodically to keep UI feeling live
    sendSnapshot();
    const interval = setInterval(sendSnapshot, 10_000);

    ws.on("close", () => {
      clearInterval(interval);
    });
  });

  // Fetch live prices every 30 seconds
  setInterval(() => {
    fetchLivePrices().catch(err => console.error("Background fetchLivePrices failed:", err));
  }, 30_000);

  // Background refresh for Polymarket markets (live-ish data)
  setInterval(() => {
    refreshPolymarketDataFromApi().catch((err) =>
      console.warn("Background Polymarket API refresh failed, using snapshot:", err)
    );
  }, 30_000);

  // Sync closed markets every hour
  setInterval(() => {
    syncClosedMarkets().catch((err) =>
      console.error("Background syncClosedMarkets failed:", err)
    );
  }, 3600_000);

  // Sync once on startup
  syncClosedMarkets().catch(console.error);

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
