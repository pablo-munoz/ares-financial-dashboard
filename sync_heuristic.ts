import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbPath = path.join(__dirname, "data", "polymarket.db");
const db = new Database(dbPath);

const POLYMARKET_DATA_API = "https://data-api.polymarket.com";

async function syncHeuristic() {
    console.log("Fetching some trades to find potential resolved markets...");
    // Get trades for a sample of slugs from the DB
    const recentSlugsRaw = db.prepare("SELECT DISTINCT slug FROM trades ORDER BY ts DESC LIMIT 50").all() as { slug: string }[];
    const slugs = recentSlugsRaw.map(s => s.slug);

    const insertRes = db.prepare("INSERT OR REPLACE INTO market_resolutions (slug, winningOutcome, resolved_at) VALUES (?, ?, ?)");

    for (const slug of slugs) {
        console.log(`Checking ${slug}...`);
        const tRes = await fetch(`${POLYMARKET_DATA_API}/trades?slug=${slug}&limit=1`, {
            headers: { Accept: "application/json" },
        });
        if (tRes.ok) {
            const trades = await tRes.json() as any[];
            if (trades.length > 0) {
                const price = Number(trades[0].price);
                if (price >= 0.99 || price <= 0.01) {
                    const outcome = price >= 0.99 ? "YES" : "NO";
                    const ts = Number(trades[0].timestamp);
                    console.log(`[Sync] Market ${slug} seems resolved to ${outcome} at ${price}`);
                    insertRes.run(slug, outcome, ts);
                }
            }
        }
    }
    console.log("Heuristic sync complete.");
}

syncHeuristic().catch(console.error);
