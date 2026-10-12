import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const symbol = searchParams.get("symbol") || "BTCUSDT";
  const interval = searchParams.get("interval") || "15m";
  const startTime = searchParams.get("startTime");
  const endTime = searchParams.get("endTime");
  const limit = searchParams.get("limit") || "500";

  const mexcBase = process.env.NEXT_PUBLIC_MEXC_API_BASE || "https://api.mexc.co";
  const params = new URLSearchParams({
    symbol: symbol.toUpperCase(),
    interval,
    limit,
  });

  if (startTime) params.set("startTime", startTime);
  if (endTime) params.set("endTime", endTime);

  try {
    const upstreamUrl = `${mexcBase}/api/v3/klines?${params.toString()}`;
    const response = await fetch(upstreamUrl, {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: `Upstream MEXC error: ${response.status} ${response.statusText}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to fetch from MEXC upstream" },
      { status: 502 }
    );
  }
}
