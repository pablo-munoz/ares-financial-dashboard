import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbPath = path.join(__dirname, "data", "polymarket.db");
const db = new Database(dbPath);

const POLYMARKET_BASE_URL = "https://gamma-api.polymarket.com";
const DATA_API_URL = "https://data-api.polymarket.com";

const insertResolutionStmt = db.prepare(`
  INSERT OR REPLACE INTO market_resolutions (slug, winningOutcome, resolved_at)
  VALUES (?, ?, ?)
`);

const insertTradeStmt = db.prepare(`
  INSERT OR IGNORE INTO trades
  (txHash, ts, slug, title, conditionId, wallet, side, outcome, price, size, notional)
  VALUES
  (@txHash, @ts, @slug, @title, @conditionId, @wallet, @side, @outcome, @price, @size, @notional)
`);

async function fetchHistoricalMarkets(limit = 100) {
    // Try to get markets that are explicitly closed and have an outcome
    // The Gamma API sometimes returns outcomes in '0'/'1' format for binary markets
    console.log(`[Bootstrap] Fetching ${limit} historical markets...`);
    try {
        const res = await fetch(`${POLYMARKET_BASE_URL}/markets?active=false&limit=${limit}`, {
            headers: { Accept: "application/json" },
        });
        if (!res.ok) throw new Error(`Gamma API HTTP ${res.status}`);
        const markets = await res.json();
        return Array.isArray(markets) ? markets : [];
    } catch (err) {
        console.error("[Bootstrap] Failed to fetch markets:", err);
        return [];
    }
}

async function fetchHistoricalTrades(slug: string, limit = 100) {
    try {
        const res = await fetch(`${DATA_API_URL}/trades?slug=${slug}&limit=${limit}`, {
            headers: { Accept: "application/json" },
        });
        if (!res.ok) return [];
        const data = await res.json();
        return Array.isArray(data) ? data : [];
    } catch {
        return [];
    }
}

function parseOutcome(m: any): string | null {
    const wo = m.winningOutcome;
    if (wo === "0" || wo === 0) return "YES";
    if (wo === "1" || wo === 1) return "NO";
    if (wo === "YES" || wo === "NO") return wo;

    // If outcomes array exists, try to map index 0 -> YES, index 1 -> NO
    try {
        const outcomes = JSON.parse(m.outcomes);
        if (Array.isArray(outcomes) && outcomes.length === 2) {
            if (wo === "0") return "YES";
            if (wo === "1") return "NO";
        }
    } catch { }

    return wo;
}

async function run() {
    // We'll do multiple batches to get variety
    const markets = await fetchHistoricalMarkets(200);
    // Filter for those that have SOME indication of resolution
    const resolved = markets.filter(m => m.winningOutcome !== null || m.closed === true);

    console.log(`[Bootstrap] Processing ${resolved.length} potential markets...`);

    let count = 0;
    for (const m of resolved) {
        let outcome = parseOutcome(m);

        // Even if outcome is null, we'll ingestion if we find trades, 
        // because the backtester can infer it from price.
        const resolvedAt = m.closedTime ? Math.floor(Date.parse(m.closedTime) / 1000) : Math.floor(Date.now() / 1000);

        // We only insert if we have a slug
        if (!m.slug) continue;

        insertResolutionStmt.run(m.slug, outcome, resolvedAt);

        // Fetch trades
        const trades = await fetchHistoricalTrades(m.slug, 100);
        if (trades.length > 0) {
            db.transaction((rows: any[]) => {
                for (const tr of rows) {
                    const txHash = tr.transactionHash ?? `hist-${m.slug}-${tr.timestamp}-${Math.random()}`;
                    insertTradeStmt.run({
                        txHash,
                        ts: Number(tr.timestamp) || 0,
                        slug: m.slug,
                        title: tr.title ?? m.question ?? m.slug,
                        conditionId: m.conditionId ?? null,
                        wallet: tr.proxyWallet ?? "unknown",
                        side: tr.side ?? null,
                        outcome: tr.outcome ?? null,
                        price: Number(tr.price) || 0,
                        size: Number(tr.size) || 0,
                        notional: (Number(tr.price) || 0) * (Number(tr.size) || 0),
                    });
                }
            })(trades);
            count++;
            if (count % 10 === 0) console.log(`[Bootstrap] Ingested ${count} markets with trades...`);
        }

        // Throttle
        await new Promise(r => setTimeout(r, 100));

        if (count >= 150) break;
    }

    console.log(`[Bootstrap] Complete. Ingested trades for ${count} markets.`);
}

run().catch(console.error);
