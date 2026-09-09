"use client";

import { useEffect, useState } from "react";

interface TipMarket {
  pick: string;
  odds: number | null;
  confidence: "Low" | "Medium" | "High";
  reasoning: string;
}

interface MatchTip {
  league: string;
  homeTeam: string;
  awayTeam: string;
  kickoff: string;
  matchWinner: TipMarket;
  bothTeamsToScore: TipMarket;
  overUnder: TipMarket & { line: number };
}

interface TipsResponse {
  date: string;
  generatedAt: string;
  tips: MatchTip[];
  note?: string;
  error?: string;
}

function ConfidenceBadge({ level }: { level: "Low" | "Medium" | "High" }) {
  const styles: Record<string, string> = {
    Low: "bg-neutral-800 text-neutral-400",
    Medium: "bg-amber-500/20 text-amber-400 border border-amber-500/30",
    High: "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30",
  };
  return <span className={`text-xs px-2 py-0.5 rounded-full ${styles[level]}`}>{level}</span>;
}

function MarketRow({ label, pick, odds, confidence, reasoning }: { label: string; pick: string; odds: number | null; confidence: "Low" | "Medium" | "High"; reasoning: string }) {
  return (
    <div className="py-2.5 border-t border-neutral-800 first:border-t-0">
      <div className="flex items-center justify-between">
        <span className="text-sm text-neutral-400">{label}</span>
        <div className="flex items-center gap-2">
          <span className="font-semibold">{pick}</span>
          {odds !== null && <span className="text-sm text-neutral-400">@ {odds.toFixed(2)}</span>}
          <ConfidenceBadge level={confidence} />
        </div>
      </div>
      <p className="text-xs text-neutral-500 mt-1">{reasoning}</p>
    </div>
  );
}

export default function Home() {
  const [data, setData] = useState<TipsResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/tips")
      .then((res) => res.json())
      .then((json) => setData(json))
      .catch(() => setData({ date: "", generatedAt: "", tips: [], error: "Failed to load" }))
      .finally(() => setLoading(false));
  }, []);

  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100 px-4 py-8 max-w-lg mx-auto">
      <header className="mb-6">
        <h1 className="text-xl font-bold">Daily Soccer Tips</h1>
        <p className="text-neutral-500 text-xs mt-0.5">{data ? `Matches for ${data.date}` : "Loading..."}</p>
      </header>

      {loading && <p className="text-neutral-500 text-sm">Loading tips...</p>}

      {data?.note && <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-3 text-xs text-neutral-400 mb-4">{data.note}</div>}

      <div className="space-y-4">
        {data?.tips?.map((tip, i) => (
          <div key={i} className="bg-neutral-900 border border-neutral-800 rounded-xl p-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] uppercase tracking-wider text-neutral-500">{tip.league}</span>
              <span className="text-[10px] text-neutral-500">
                {new Date(tip.kickoff).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </span>
            </div>
            <h2 className="text-base font-semibold mb-3">
              {tip.homeTeam} <span className="text-neutral-600">vs</span> {tip.awayTeam}
            </h2>

            <MarketRow label="Match Winner" pick={tip.matchWinner.pick} odds={tip.matchWinner.odds} confidence={tip.matchWinner.confidence} reasoning={tip.matchWinner.reasoning} />
            <MarketRow label="Both Teams to Score" pick={tip.bothTeamsToScore.pick} odds={tip.bothTeamsToScore.odds} confidence={tip.bothTeamsToScore.confidence} reasoning={tip.bothTeamsToScore.reasoning} />
            <MarketRow label={`Over/Under ${tip.overUnder.line}`} pick={tip.overUnder.pick} odds={tip.overUnder.odds} confidence={tip.overUnder.confidence} reasoning={tip.overUnder.reasoning} />
          </div>
        ))}
      </div>

      <footer className="mt-8 text-center text-[10px] text-neutral-600">For entertainment purposes only. 18+</footer>
    </main>
  );
}