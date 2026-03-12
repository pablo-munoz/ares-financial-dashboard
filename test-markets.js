const fetch = require('node-fetch');
async function run() {
  const res = await fetch("https://gamma-api.polymarket.com/markets?active=true&limit=50");
  const markets = await res.json();
  markets.slice(0, 10).forEach(m => {
    console.log(m.slug, "->", m.category, "->", JSON.stringify(m.events?.map(e=>e.category)));
  });
}
run();
