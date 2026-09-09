import { NextResponse } from "next/server";
import { kv } from "@vercel/kv";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const latestTips: any = await kv.get("tips:latest");

    if (!latestTips) {
      return NextResponse.json({
        date: new Date().toISOString().slice(0, 10),
        generatedAt: new Date().toISOString(),
        tips: [],
        note: "Tips are updating soon. Check back shortly.",
      });
    }

    return NextResponse.json(latestTips);
  } catch {
    return NextResponse.json({ error: "Failed to load tips", tips: [] }, { status: 500 });
  }
}