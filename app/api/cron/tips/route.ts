import { NextResponse } from "next/server";
import { kv } from "@vercel/kv";

const LEAGUES = [
  { oddsKey: "soccer_epl", name: "Premier League" },
  { oddsKey: "soccer_spain_la_liga", name: "La Liga" },
  { oddsKey: "soccer_italy_serie_a", name: "Serie A" },
  { oddsKey: "soccer_germany_bundesliga", name: "Bundesliga" },
  { oddsKey: "soccer_france_ligue_one", name: "Ligue 1" },
  { oddsKey: "soccer_uefa_champs_league", name: "Champions League" },
];

const ODDS_BASE = "https://api.the-odds-api.com/v4";
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";

function todayUtcRange(): { from: string } {
  const d = new Date();
  return { from: d.toISOString().slice(0, 10) };
}

async function fetchOddsForLeague(oddsKey: string, leagueName: string) {
  const apiKey = process.env.ODDS_API_KEY || "";
  const url = `${ODDS_BASE}/sports/${oddsKey}/odds/?apiKey=${apiKey}&regions=eu&markets=h2h,totals&oddsFormat=decimal`;

  try {
    const res = await fetch(url);
    if (!res.ok) return [];
    const events = await res.json();
    const { from } = todayUtcRange();
    const todaysEvents = events.filter((e: any) => e.commence_time.startsWith(from));

    return todaysEvents.map((match: any) => {
      const h2hPrices: { home: number[]; draw: number[]; away: number[] } = { home: [], draw: [], away: [] };
      let totalsPoint: number | undefined;
      const totalsPrices: { over: number[]; under: number[] } = { over: [], under: [] };

      for (const bk of match.bookmakers) {
        for (const mk of bk.markets) {
          if (mk.key === "h2h") {
            for (const o of mk.outcomes) {
              if (o.name === match.home_team) h2hPrices.home.push(o.price);
              else if (o.name === match.away_team) h2hPrices.away.push(o.price);
              else if (o.name.toLowerCase() === "draw") h2hPrices.draw.push(o.price);
            }
          } else if (mk.key === "totals") {
            for (const o of mk.outcomes) {
              if (totalsPoint === undefined && o.point !== undefined) totalsPoint = o.point;
              if (o.point === totalsPoint) {
                if (o.name.toLowerCase() === "over") totalsPrices.over.push(o.price);
                else if (o.name.toLowerCase() === "under") totalsPrices.under.push(o.price);
              }
            }
          }
        }
      }

      const avg = (arr: number[]) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : undefined);

      return {
        league: leagueName,
        homeTeam: match.home_team,
        awayTeam: match.away_team,
        kickoff: match.commence_time,
        h2h: { home: avg(h2hPrices.home), draw: avg(h2hPrices.draw), away: avg(h2hPrices.away) },
        totals: totalsPoint !== undefined ? { point: totalsPoint, over: avg(totalsPrices.over), under: avg(totalsPrices.under) } : undefined,
      };
    });
  } catch {
    return [];
  }
}

async function generateTipsWithGemini(fixtures: any[]) {
  if (fixtures.length === 0) return [];
  const apiKey = process.env.GEMINI_API_KEY || "";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;

  const prompt = `You are a football betting analyst. For each fixture, provide tips for match winner, both teams to score, and total goals.
Fixtures: ${JSON.stringify(fixtures, null, 2)}
Respond with ONLY a JSON array matching:
[{ "league": string, "homeTeam": string, "awayTeam": string, "kickoff": string, "matchWinner": { "pick": "Home"|"Draw"|"Away", "odds": number|null, "confidence": "Low"|"Medium"|"High", "reasoning": string }, "bothTeamsToScore": { "pick": "Yes"|"No", "odds": number|null, "confidence": "Low"|"Medium"|"High", "reasoning": string }, "overUnder": { "line": number, "pick": "Over"|"Under", "odds": number|null, "confidence": "Low"|"Medium"|"High", "reasoning": string } }]`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: prompt }] }], generationConfig: { responseMimeType: "application/json" } }),
  });

  if (!res.ok) return [];
  const data = await res.json();
  try {
    return JSON.parse(data?.candidates?.[0]?.content?.parts?.[0]?.text || "[]");
  } catch {
    return [];
  }
}

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    const results = await Promise.all(LEAGUES.map((l) => fetchOddsForLeague(l.oddsKey, l.name)));
    const allFixtures = results.flat();
    const tips = await generateTipsWithGemini(allFixtures);

    const payload = {
      date: todayUtcRange().from,
      generatedAt: new Date().toISOString(),
      tips,
      note: allFixtures.length === 0 ? "No fixtures found today." : undefined,
    };

    await kv.set("tips:latest", payload);
    return NextResponse.json({ success: true, count: tips.length });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}