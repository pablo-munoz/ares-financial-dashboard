import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbPath = path.join(__dirname, "data", "polymarket.db");
const db = new Database(dbPath);

const POLYMARKET_BASE_URL = "https://gamma-api.polymarket.com";
const POLYMARKET_DATA_API = "https://data-api.polymarket.com";

async function syncRecent() {
    console.log("Fetching recently closed markets...");
    // Use a more recent limit and maybe search for '2025' or '2026' in slugs
    const res = await fetch(`${POLYMARKET_BASE_URL}/markets?active=false&limit=100`, {
        headers: { Accept: "application/json" },
    });
    const markets = await res.json() as any[];

    // Filter for markets that are actually resolved and were closed RECENTLY (e.g. in the last month)
    const now = Date.now();
    const oneMonthAgo = now - 30 * 24 * 60 * 60 * 1000;

    const resolved = markets.filter(m => {
        const closedAt = m.closedTime ? Date.parse(m.closedTime) : 0;
        return m.winningOutcome !== null && (closedAt > oneMonthAgo || m.slug.includes("202"));
    });

    console.log(`Found ${resolved.length} potentially relevant resolved markets.`);
    
    // Create market_meta table if it doesn't exist (sync script standalone safety)
    db.exec(`
      CREATE TABLE IF NOT EXISTS market_meta (
        slug TEXT PRIMARY KEY,
        eventSlug TEXT,
        title TEXT,
        category TEXT,
        endTs INTEGER,
        yesOutcome TEXT,
        noOutcome TEXT,
        fetchedAtMs INTEGER
      );
    `);

    const insertRes = db.prepare("INSERT OR REPLACE INTO market_resolutions (slug, winningOutcome, resolved_at) VALUES (?, ?, ?)");
    const insertMeta = db.prepare(`
        INSERT OR REPLACE INTO market_meta (slug, eventSlug, title, category, endTs, yesOutcome, noOutcome, fetchedAtMs)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const insertTrade = db.prepare(`
    INSERT OR IGNORE INTO trades
    (txHash, ts, slug, title, conditionId, wallet, side, outcome, price, size, notional)
    VALUES
    (@txHash, @ts, @slug, @title, @conditionId, @wallet, @side, @outcome, @price, @size, @notional)
  `);

    for (const m of resolved.slice(0, 50)) {
        const resolvedAt = m.closedTime ? Math.floor(Date.parse(m.closedTime) / 1000) : Math.floor(Date.now() / 1000);
        insertRes.run(m.slug, m.winningOutcome, resolvedAt);

        // Sync Metadata
        const outcomes = m.outcomes ? (typeof m.outcomes === 'string' ? JSON.parse(m.outcomes) : m.outcomes) : [];
        insertMeta.run(
            m.slug,
            m.events?.[0]?.slug || m.slug,
            m.question || m.slug,
            m.groupSlug || "General",
            resolvedAt,
            outcomes[0] || "YES",
            outcomes[1] || "NO",
            Date.now()
        );

        console.log(`Fetching trades for ${m.slug}...`);
        const tRes = await fetch(`${POLYMARKET_DATA_API}/trades?slug=${m.slug}&limit=200`, {
            headers: { Accept: "application/json" },
        });
        if (tRes.ok) {
            const tradesRaw = await tRes.json() as any[];
            console.log(`Got ${tradesRaw.length} trades for ${m.slug}`);
            db.transaction(() => {
                for (const tr of tradesRaw) {
                    insertTrade.run({
                        txHash: tr.transactionHash || `${tr.proxyWallet}-${tr.timestamp}-${Math.random()}`,
                        ts: Number(tr.timestamp) || 0,
                        slug: m.slug,
                        title: tr.title || m.question || m.slug,
                        conditionId: tr.conditionId || null,
                        wallet: tr.proxyWallet || "unknown",
                        side: tr.side || null,
                        outcome: tr.outcome || null,
                        price: Number(tr.price) || 0,
                        size: Number(tr.size) || 0,
                        notional: (Number(tr.price) || 0) * (Number(tr.size) || 0)
                    });
                }
            })();
        }
    }
    console.log("Sync complete.");
}

syncRecent().catch(console.error);
