import fs from 'fs';
import Database from 'better-sqlite3';

/**
 * Script for computing Polymarket Insider scores as a standalone process.
 */

const input = fs.readFileSync(0, 'utf8');
const args = JSON.parse(input || '{}');
const {
    dbPath,
    nowSec,
    since14d,
    since24h,
    since1h,
    // marketMeta
} = args;

if (!dbPath) {
    console.error("Missing dbPath");
    process.exit(1);
}

const db = new Database(dbPath);
db.pragma("journal_mode = WAL");

// --- Helper Functions (Replicated from server.ts) ---

function clamp01(x: number) {
    return Math.max(0, Math.min(1, x));
}

const BOT_MARKET_PATTERNS = [
    "up or down",
    "up-or-down",
    "price above",
    "price below",
    /\d:\d{2}[ap]m-\d:\d{2}[ap]m/,
];

function isBotMarketTitle(title: string): boolean {
    const t = title.toLowerCase();
    return BOT_MARKET_PATTERNS.some((p) =>
        typeof p === "string" ? t.includes(p) : p.test(t)
    );
}

const TIER1_KEYWORDS = ["final", "nominate", "resign", "impeach", "gdp", "inflation"];
const SPORTS_KEYWORDS = ["fc", "united", "city", "nba", "nfl", "premier league", "vs", "real madrid"];

function getMarketCategoryWeight(title: string): number {
    const t = title.toLowerCase();
    if (TIER1_KEYWORDS.some(k => t.includes(k))) return 1.5;
    if (SPORTS_KEYWORDS.some(k => t.includes(k))) return 0.8;
    return 1.0;
}

function computeEarlyMoverScore(wallet: string, since14d: number): number {
    const trades = db.prepare(`
    SELECT slug, price, ts FROM trades 
    WHERE wallet = ? AND ts >= ?
    ORDER BY ts ASC
  `).all(wallet, since14d) as any[];

    if (trades.length < 3) return 0;

    let totalMover = 0;
    const slugs = [...new Set(trades.map(t => t.slug))];

    for (const s of slugs) {
        const mTrades = trades.filter(t => t.slug === s);
        const entryPrice = mTrades[0].price;
        const lastPrice = mTrades[mTrades.length - 1].price;
        if (lastPrice > entryPrice) totalMover++;
    }

    return totalMover / slugs.length;
}

function computeResolvedWinRate(wallet: string, since14d: number): number | undefined {
    try {
        const rows = db.prepare(`
      SELECT r.winningOutcome, t.outcome, t.slug
      FROM market_resolutions r
      JOIN trades t ON r.slug = t.slug
      WHERE t.wallet = ? AND t.ts >= ?
    `).all(wallet, since14d) as any[];

        if (rows.length < 3) return undefined;

        const wins = rows.filter(r => r.winningOutcome === r.outcome).length;
        return wins / rows.length;
    } catch {
        return undefined;
    }
}

function getPersistenceBonus(wallet: string, nowSec: number): { bonus: number; trend: 'up' | 'down' | 'stable' | 'new' } {
    const since5cycles = nowSec - 5 * 3600;
    const history = db.prepare(`
    SELECT score FROM wallet_history 
    WHERE wallet = ? AND ts >= ? 
    ORDER BY ts ASC
  `).all(wallet, since5cycles) as any[];

    if (!history.length) return { bonus: 0, trend: 'new' };

    const bonus = history.length >= 3 ? 0.15 : history.length >= 2 ? 0.07 : 0;
    const delta = history[history.length - 1].score - history[0].score;
    const trend = delta > 0.05 ? 'up' : delta < -0.05 ? 'down' : 'stable';

    return { bonus, trend };
}

// --- Main Worker Logic ---

try {
    const rows = db.prepare(`
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
  `).all(since24h, since1h, since24h, since14d) as any[];

    console.error(`[Insider Worker] Found ${rows.length} candidates after volume filtering.`);
    const pool: any[] = [];

    for (const w of rows) {
        if (!w.wallet || w.wallet === "unknown") continue;

        const allMarkets24h = db.prepare(`
      SELECT DISTINCT slug, title FROM trades
      WHERE wallet = ? AND ts >= ?
    `).all(w.wallet, since24h) as any[];

        const qualifyingMarkets = allMarkets24h.filter(m => !isBotMarketTitle(m.title));
        if (qualifyingMarkets.length === 0) continue;

        const firstSeenDaysAgo = (nowSec - (w.first_ts ?? nowSec)) / 86400;
        const ageFactor = 0.5 + 0.5 * Math.min(1, firstSeenDaysAgo / 30);

        const earlyMover = computeEarlyMoverScore(w.wallet, since14d);
        const winRate = computeResolvedWinRate(w.wallet, since14d);

        // Performance gate
        if (winRate !== undefined && winRate < 0.45) {
            const settledCheck = db.prepare(`
        SELECT COUNT(*) AS cnt FROM market_resolutions r
        JOIN trades t ON t.slug = r.slug
        WHERE t.wallet = ? AND t.ts >= ?
      `).get(w.wallet, since14d) as any;
            if ((settledCheck?.cnt ?? 0) >= 5) continue;
        }

        const winRateSignal = winRate !== undefined ? clamp01((winRate - 0.50) / 0.30) : 0;
        const catWeights = qualifyingMarkets.map(m => getMarketCategoryWeight(m.title));
        const categoryWeight = catWeights.reduce((a, b) => a + b, 0) / catWeights.length;
        const { bonus: persistenceBonus, trend } = getPersistenceBonus(w.wallet, nowSec);

        const edgeBetsRow = db.prepare(`
      SELECT COUNT(*) AS edge_count FROM trades
      WHERE wallet = ? AND ts >= ? AND price < 0.40 AND side = 'BUY'
    `).get(w.wallet, since14d) as any;
        const edgeBet = clamp01((edgeBetsRow?.edge_count ?? 0) / Math.max(1, w.lifetime_trades) / 0.30);

        const freshness = Math.exp(-((nowSec - w.lastTs) / 3600) / 2);
        const sizeBurst = clamp01(w.vol1h / (w.vol14d / 14 || 1));
        const focus = qualifyingMarkets.length <= 2 ? 1 : qualifyingMarkets.length <= 4 ? 0.6 : 0.2;
        const perfMultiplier = winRate !== undefined ? (winRate >= 0.60 ? 1.0 : winRate >= 0.50 ? 0.8 : 0.4) : 0.75;

        const baseScore =
            0.20 * freshness * perfMultiplier +
            0.15 * sizeBurst * perfMultiplier +
            0.15 * focus +
            0.15 * earlyMover +
            0.25 * winRateSignal +
            0.05 * edgeBet +
            0.05 * (winRate !== undefined && winRate >= 0.65 ? 1.0 : 0);

        const professionalPenalty = w.lifetime_trades > 5000 ? 0.2 : w.lifetime_trades > 1000 ? 0.5 : 1.0;
        const diversityPenalty = qualifyingMarkets.length > 12 ? 0.2 : qualifyingMarkets.length > 8 ? 0.5 : 1.0;

        const rawScore01 = clamp01(
            ageFactor * categoryWeight * professionalPenalty * diversityPenalty * (baseScore + persistenceBonus * baseScore)
        );

        if (rawScore01 < 0.15) continue;

        const topMarketRow = db.prepare(`
      SELECT title, SUM(notional) AS vol FROM trades
      WHERE wallet = ? AND ts >= ? 
        AND title NOT LIKE '%up or down%'
        AND title NOT LIKE '%up-or-down%'
      GROUP BY slug, title ORDER BY vol DESC LIMIT 1
    `).get(w.wallet, since24h) as any;

        const reasons: string[] = [];
        if (freshness >= 0.7) reasons.push("Large fresh bet");
        if (focus >= 0.9) reasons.push("Highly concentrated");
        if (sizeBurst >= 0.7) reasons.push("Size vs history");
        if (winRate !== undefined && winRate >= 0.65) reasons.push("High win rate");
        if (!reasons.length) reasons.push("High notional (24h)");

        pool.push({
            wallet: w.wallet,
            rawScore01,
            winRate,
            trend,
            topMarket: topMarketRow?.title,
            lastTs: w.lastTs,
            reasons,
        });
    }

    console.error(`[Insider Worker] Qualified ${pool.length} insiders for ranking.`);
    pool.sort((a, b) => a.rawScore01 - b.rawScore01);
    const insiders = pool.map((p, idx) => {
        const total = pool.length;
        const percentile = total > 1 ? Math.round((idx / (total - 1)) * 100) : 75;
        return {
            address: p.wallet,
            score: percentile,
            label: percentile >= 75 ? "High Suspicion" : percentile >= 50 ? "Moderate" : "Watchlist",
            reasons: p.reasons,
            topMarket: p.topMarket,
            lastSeen: p.lastTs,
            trend: p.trend,
            winRate: p.winRate !== undefined ? Math.round(p.winRate * 100) / 100 : undefined,
            _rawScore: p.rawScore01,
        };
    });

    const ranked = insiders
        .sort((a, b) => b._rawScore - a._rawScore)
        .slice(0, 12)
        .map(({ _rawScore, ...rest }) => rest);

    process.stdout.write("___JSON_START___" + JSON.stringify(ranked) + "___JSON_END___");
} catch (error) {
    console.error('[Insider Runner Error]', error);
    process.stdout.write("___JSON_START___[]___JSON_END___");
}
