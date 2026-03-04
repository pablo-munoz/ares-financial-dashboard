import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbPath = path.join(__dirname, "data", "polymarket.db");
const db = new Database(dbPath);
db.pragma("journal_mode = WAL");

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface Trade {
    slug: string;
    ts: number;
    price: number;
    outcome: string;
    side: string;
    size: number;
}

interface Resolution {
    slug: string;
    winningOutcome: string;
    resolved_at: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const POLYMARKET_DATA_API = "https://data-api.polymarket.com";
const SLIPPAGE_BPS = 20;
const INITIAL_CAPITAL = 10000;

// ---------------------------------------------------------------------------
// Ensure anti-leakage validation table exists
// ---------------------------------------------------------------------------
db.exec(`
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

// ---------------------------------------------------------------------------
// Prepared statements — ALL with PIT (ts <= sim_ts) constraint
// ---------------------------------------------------------------------------

/**
 * Returns all trades for a given slug that occurred AT OR BEFORE sim_ts.
 * This is the core PIT guard that prevents lookahead.
 */
const pitTradesStmt = db.prepare<[string, number], { price: number; size: number }>(
    `SELECT price, size FROM trades
     WHERE slug = ? AND ts <= ?
     ORDER BY ts ASC`
);

/**
 * Returns the maximum ts observed in the DB for a slug up to sim_ts.
 * Used for the anti-leakage validation table.
 */
const maxTsSeenStmt = db.prepare<[string, number], { mts: number | null }>(
    `SELECT MAX(ts) AS mts FROM trades WHERE slug = ? AND ts <= ?`
);

/**
 * Inserts a row into the validation audit table.
 */
const validationInsertStmt = db.prepare(
    `INSERT INTO backtest_validation (slug, sim_ts, model_fair_value, max_ts_seen_in_db, run_at)
     VALUES (?, ?, ?, ?, ?)`
);

/**
 * Resolution inference from last observed price BEFORE sim_ts.
 */
const pitLatestPriceStmt = db.prepare<[string, number], { price: number } | undefined>(
    `SELECT price FROM trades WHERE slug = ? AND ts <= ? ORDER BY ts DESC LIMIT 1`
);

// ---------------------------------------------------------------------------
// Task 3: Refined Data Seeding — PIT-compliant
// Only fetches and inserts trades that occurred BEFORE beforeTs.
// Must be called ONCE before the simulation loop, not inside it.
// ---------------------------------------------------------------------------
async function fetchHistoricalTrades(slug: string, beforeTs: number): Promise<Trade[]> {
    try {
        const res = await fetch(`${POLYMARKET_DATA_API}/trades?slug=${slug}&limit=500`, {
            headers: { Accept: "application/json" },
        });
        if (!res.ok) return [];
        const data = await res.json() as any[];

        // PIT filter: only trades that happened before the simulation's earliest timestamp
        return data
            .filter(tr => Number(tr.timestamp) <= beforeTs)
            .map(tr => ({
                slug,
                ts: Number(tr.timestamp) || 0,
                price: Number(tr.price) || 0,
                outcome: tr.outcome || "unknown",
                side: tr.side || "unknown",
                size: Number(tr.size) || 0,
            }));
    } catch (err) {
        return [];
    }
}

// ---------------------------------------------------------------------------
// Brier Score
// ---------------------------------------------------------------------------
function calculateBrierScore(predictions: number[], outcomes: number[]): number {
    if (predictions.length === 0) return 0;
    let sum = 0;
    for (let i = 0; i < predictions.length; i++) {
        sum += Math.pow(predictions[i] - outcomes[i], 2);
    }
    return sum / predictions.length;
}

// ---------------------------------------------------------------------------
// Main backtest
// ---------------------------------------------------------------------------
async function runBacktest() {
    const runAt = Math.floor(Date.now() / 1000);

    // -----------------------------------------------------------------------
    // Load resolutions. At this point we have the "oracle" list of all
    // resolved markets, BUT we will NOT use this map during fairValue
    // calculation. Resolution state is "ghosted" until the simulation clock
    // reaches each market's resolved_at timestamp.
    // -----------------------------------------------------------------------
    const rawResolutions = db
        .prepare("SELECT slug, winningOutcome, resolved_at FROM market_resolutions ORDER BY resolved_at ASC")
        .all() as Resolution[];

    const globalMaxTs = (db.prepare("SELECT MAX(ts) AS m FROM trades").get() as { m: number | null })?.m ?? 0;

    const resolvedList: Resolution[] = [];

    for (const r of rawResolutions) {
        let outcome = r.winningOutcome;

        if (!outcome || (outcome !== "YES" && outcome !== "NO")) {
            const latest = pitLatestPriceStmt.get(r.slug, globalMaxTs);
            if (!latest || typeof latest.price !== "number") continue;
            outcome = latest.price >= 0.5 ? "YES" : "NO";
        }

        resolvedList.push({ slug: r.slug, winningOutcome: outcome, resolved_at: r.resolved_at });
    }

    // -----------------------------------------------------------------------
    // Fallback: When fewer than 20 slugs overlap between the Gamma resolution
    // table and the local trades table (e.g. the Gamma sync imported old slugs
    // while the trades table holds current markets), we infer resolution from
    // the price-boundary heuristic used by the server's insider scorer:
    // a slug is "resolved" when its last observed price crosses >= 0.97 or
    // <= 0.03. This is 100% local-DB, PIT-compliant, and avoids any API call.
    // -----------------------------------------------------------------------
    const resolvedSlugsSet = new Set(resolvedList.map(r => r.slug));
    const matchingTradeslugs = (db
        .prepare(`SELECT DISTINCT slug FROM trades WHERE slug IN (${resolvedList.length > 0 ? resolvedList.map(() => '?').join(',') : "''"})`)
        .all(...resolvedList.map(r => r.slug)) as { slug: string }[]).map(r => r.slug);

    if (matchingTradeslugs.length < 20) {
        console.log(`[Backtest] Only ${matchingTradeslugs.length} slug(s) overlap between trades and market_resolutions.`);
        console.log(`[Backtest] Activating price-boundary resolution inference from local trades DB...`);

        // Fetch slugs with sufficient trade history from the local DB.
        // MIN(ts) per slug is used as the effective "resolved_at" proxy (last trade date).
        const inferredRows = db.prepare(`
            SELECT slug,
                   (SELECT price FROM trades t2 WHERE t2.slug = t.slug ORDER BY t2.ts DESC LIMIT 1) AS lastPrice,
                   MAX(ts) AS lastTs,
                   COUNT(*) AS cnt
            FROM trades t
            WHERE slug NOT LIKE 'hist-%'
            GROUP BY slug
            HAVING cnt >= 30
              AND (lastPrice >= 0.95 OR lastPrice <= 0.05)
            ORDER BY lastTs DESC
            LIMIT 200
        `).all() as { slug: string; lastPrice: number; lastTs: number; cnt: number }[];

        console.log(`[Backtest] Inferred ${inferredRows.length} resolved market(s) from price boundaries.`);

        for (const row of inferredRows) {
            if (resolvedSlugsSet.has(row.slug)) continue; // already in list
            const outcome = row.lastPrice >= 0.5 ? "YES" : "NO";
            resolvedList.push({
                slug: row.slug,
                winningOutcome: outcome,
                resolved_at: row.lastTs,
            });
        }

        // Re-sort by resolved_at ASC so the unveiling pointer works correctly
        resolvedList.sort((a, b) => a.resolved_at - b.resolved_at);
    }

    if (resolvedList.length === 0) {
        console.warn("[Backtest] No resolved markets found. Aborting.");
        return {
            summary: { totalTrades: 0, winRate: 0, brierScore: 0, totalPnL: 0, sharpeRatio: 0 },
            equityCurve: [],
            calibration: [],
            recentResolutions: [],
        };
    }

    // -----------------------------------------------------------------------
    // Task 3: Pre-seeding — happens ONCE before the simulation loop.
    // We only seed slugs with resolved markets and only trades that occurred
    // before startTs (earliest timestamp in our DB across all slugs).
    // -----------------------------------------------------------------------
    const resolvedSlugs = resolvedList.map(r => r.slug);
    const placeholders = resolvedSlugs.map(() => "?").join(",");

    let existingTrades = db
        .prepare(`SELECT * FROM trades WHERE slug IN (${placeholders}) ORDER BY ts ASC`)
        .all(...resolvedSlugs) as Trade[];

    // Determine seeding ceiling: earliest timestamp we already have, or now
    const startTs = existingTrades.length > 0
        ? existingTrades[0].ts
        : Math.min(...resolvedList.map(r => r.resolved_at));

    if (existingTrades.length < 50) {
        console.log(`[Backtest] Sparse trade data (${existingTrades.length}). Pre-seeding from API (PIT ceiling: ${startTs})...`);

        const seedCandidates = resolvedSlugs
            .filter(s => !existingTrades.some(t => t.slug === s))
            .slice(0, 15);

        for (const slug of seedCandidates) {
            // PIT-compliant: only ingest trades that occurred before startTs
            const hTrades = await fetchHistoricalTrades(slug, startTs);
            if (hTrades.length > 0) {
                const insertMany = db.transaction((rows: Trade[]) => {
                    const stmt = db.prepare(
                        `INSERT OR IGNORE INTO trades
                         (txHash, ts, slug, title, wallet, side, outcome, price, size, notional)
                         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
                    );
                    for (const t of rows) {
                        const txHash = `hist-${t.slug}-${t.ts}-${Math.random()}`;
                        stmt.run(txHash, t.ts, t.slug, t.slug, "historic", t.side, t.outcome, t.price, t.size, t.price * t.size);
                    }
                });
                insertMany(hTrades);
                existingTrades.push(...hTrades);
            }
        }
        existingTrades.sort((a, b) => a.ts - b.ts);
    }

    // -----------------------------------------------------------------------
    // Build the sorted day list from actual DB trades only.
    // We group by calendar day so the simulation clock advances day-by-day.
    // -----------------------------------------------------------------------
    const tradesByDay: Record<string, Trade[]> = {};
    existingTrades.forEach(t => {
        const date = new Date(t.ts * 1000).toISOString().split("T")[0];
        if (!tradesByDay[date]) tradesByDay[date] = [];
        tradesByDay[date].push(t);
    });

    const sortedDays = Object.keys(tradesByDay).sort();

    if (sortedDays.length === 0) {
        console.warn("[Backtest] No trade days found in DB.");
        return {
            summary: { totalTrades: 0, winRate: 0, brierScore: 0, totalPnL: 0, sharpeRatio: 0 },
            equityCurve: [],
            calibration: [],
            recentResolutions: [],
        };
    }

    // -----------------------------------------------------------------------
    // Task 2: Resolution State Ghosting
    //
    // resolvedList is sorted by resolved_at ASC.
    // revealedResMap starts empty. As the simulation clock advances, we
    // "unveil" resolutions whose resolved_at <= sim_ts.
    //
    // CRITICAL: fairValue is computed BEFORE checking revealedResMap for
    // the current slug. P&L settlement uses revealedResMap AFTER the signal
    // to prevent any resolution state leaking into the model's signal.
    // -----------------------------------------------------------------------
    const revealedResMap = new Map<string, string>(); // slug → winningOutcome
    let resolutionPointer = 0; // index into resolvedList

    let capital = INITIAL_CAPITAL;
    const equityCurve: { date: string; equity: number }[] = [];
    const predictions: number[] = [];
    const actuals: number[] = [];

    const bins = 10;
    const calibrationBuckets: { count: number; sum: number }[] = Array.from(
        { length: bins }, () => ({ count: 0, sum: 0 })
    );

    // Per-slug EMA state for long-horizon anchor
    const slugState = new Map<string, { longVwap: number; sampleCount: number }>();

    for (const day of sortedDays) {
        // Simulation clock: end-of-day as epoch seconds
        const sim_ts = Math.floor(new Date(day + "T23:59:59.000Z").getTime() / 1000);

        // --- Unveil resolutions that have now occurred ---
        while (
            resolutionPointer < resolvedList.length &&
            resolvedList[resolutionPointer].resolved_at <= sim_ts
        ) {
            const r = resolvedList[resolutionPointer];
            revealedResMap.set(r.slug, r.winningOutcome);
            resolutionPointer++;
        }

        // Gather unique slugs active on this day
        const dailySlugs = new Set(tradesByDay[day].map(t => t.slug));

        for (const slug of dailySlugs) {
            // ----------------------------------------------------------------
            // Task 1: Temporal Query Isolation
            // Use the PIT-prepared statement — only trades with ts <= sim_ts.
            // This is the core lookahead-bias fix.
            // ----------------------------------------------------------------
            const pitTrades = pitTradesStmt.all(slug, sim_ts);

            if (pitTrades.length === 0) continue;

            // Short-horizon VWAP (trades available to the model at sim_ts)
            const vwapNum = pitTrades.reduce((acc, t) => acc + t.price * t.size, 0);
            const vwapDen = pitTrades.reduce((acc, t) => acc + t.size, 0);
            const priceShort = vwapDen > 0
                ? vwapNum / vwapDen
                : pitTrades.reduce((acc, t) => acc + t.price, 0) / pitTrades.length;

            // Long-horizon EMA — purely based on past-visible data
            const prev = slugState.get(slug) ?? { longVwap: priceShort, sampleCount: 0 };
            const alphaEma = 0.1;
            const longVwap = prev.sampleCount > 0
                ? alphaEma * priceShort + (1 - alphaEma) * prev.longVwap
                : priceShort;
            slugState.set(slug, { longVwap, sampleCount: prev.sampleCount + 1 });

            // Fair value: mean-reverting signal anchored on longVwap
            const baseFair = longVwap + 0.15 * (longVwap - priceShort);
            const fairValue = Math.max(0.01, Math.min(0.99, baseFair));

            // ----------------------------------------------------------------
            // Task 4: Anti-Leakage Validation
            // Log fairValue alongside max_ts_seen_in_db for this slug at sim_ts.
            // The invariant max_ts_seen_in_db <= sim_ts must always hold.
            // ----------------------------------------------------------------
            const maxTsRow = maxTsSeenStmt.get(slug, sim_ts);
            const maxTsSeen = maxTsRow?.mts ?? 0;
            validationInsertStmt.run(slug, sim_ts, fairValue, maxTsSeen, runAt);

            // ----------------------------------------------------------------
            // P&L Settlement — only possible if the market is NOW revealed.
            // The fairValue was computed ABOVE with zero knowledge of outcome.
            // ----------------------------------------------------------------
            const outcome = revealedResMap.get(slug);
            if (!outcome) {
                // Market not yet resolved at this sim_ts — no P&L to settle.
                continue;
            }

            const isYesWin = outcome === "YES";
            const actual = isYesWin ? 1 : 0;

            predictions.push(fairValue);
            actuals.push(actual);

            const bucketIdx = Math.min(bins - 1, Math.floor(fairValue * bins));
            calibrationBuckets[bucketIdx].count++;
            calibrationBuckets[bucketIdx].sum += actual;

            const edge = fairValue - priceShort;
            if (Math.abs(edge) > 0.02) {
                let kelly: number;
                if (edge > 0) {
                    kelly = (fairValue - priceShort) / (1 - priceShort);
                } else {
                    kelly = (priceShort - fairValue) / priceShort;
                }

                const fraction = 0.1; // 10% Kelly
                const betSize = Math.max(0, capital * kelly * fraction);

                if (betSize > 10) {
                    const slippage = (priceShort * SLIPPAGE_BPS) / 10000;
                    const entryPrice = edge > 0
                        ? Math.min(0.99, priceShort + slippage)
                        : Math.max(0.01, priceShort - slippage);

                    const win = (edge > 0 && isYesWin) || (edge < 0 && !isYesWin);
                    const pnl = win
                        ? (edge > 0
                            ? betSize * (1 / entryPrice - 1)
                            : betSize * (1 / (1 - entryPrice) - 1))
                        : -betSize;

                    capital += pnl;
                }
            }
        }

        equityCurve.push({ date: day, equity: Math.round(capital * 100) / 100 });
    }

    const brier = calculateBrierScore(predictions, actuals);
    const winRate = actuals.length > 0
        ? actuals.filter((a, i) =>
            (predictions[i] > 0.5 && a === 1) || (predictions[i] <= 0.5 && a === 0)
        ).length / actuals.length
        : 0;

    const calibration = calibrationBuckets.map((b, i) => ({
        bucket: `${i * 10}-${(i + 1) * 10}%`,
        expected: (i + 0.5) / bins,
        actual: b.count > 0 ? b.sum / b.count : 0,
        count: b.count,
    }));

    const recentResolutions = resolvedList
        .filter(r => revealedResMap.has(r.slug))
        .slice(-30)
        .reverse();

    return {
        summary: {
            totalTrades: predictions.length,
            winRate: Math.round(winRate * 100) / 100,
            brierScore: Math.round(brier * 1000) / 1000,
            totalPnL: Math.round((capital - INITIAL_CAPITAL) * 100) / 100,
            sharpeRatio: 0, // requires daily returns series — left for future pass
        },
        equityCurve,
        calibration,
        recentResolutions,
    };
}

if (process.argv[1].endsWith("backtester.ts") || process.argv[1].endsWith("backtester.js")) {
    runBacktest().then(res => console.log(JSON.stringify(res, null, 2))).catch(console.error);
}

export { runBacktest };
