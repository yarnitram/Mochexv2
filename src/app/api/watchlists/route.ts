import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { verifyToken } from "@/lib/auth/jwt";

async function getAuthUser(request: NextRequest) {
  const token =
    request.cookies.get("mochex_token")?.value ||
    request.headers.get("Authorization")?.replace("Bearer ", "");
  if (!token) return null;
  return verifyToken(token);
}

export async function GET(request: NextRequest) {
  const user = await getAuthUser(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const watchlists = await prisma.watchlist.findMany({
      where: { userId: user.userId },
      orderBy: { updatedAt: "desc" },
    });

    return NextResponse.json(watchlists);
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Failed to fetch watchlists" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const user = await getAuthUser(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { name = "Main Watchlist", symbols = ["BTCUSDT", "ETHUSDT", "SOLUSDT"], isDefault = true } = await request.json();

    if (isDefault) {
      await prisma.watchlist.updateMany({
        where: { userId: user.userId, isDefault: true },
        data: { isDefault: false },
      });
    }

    const watchlist = await prisma.watchlist.create({
      data: {
        userId: user.userId,
        name,
        symbols,
        isDefault: Boolean(isDefault),
      },
    });

    return NextResponse.json(watchlist, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Failed to create watchlist" }, { status: 500 });
  }
}
