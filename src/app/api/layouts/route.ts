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
    const layouts = await prisma.chartLayout.findMany({
      where: { userId: user.userId },
      select: {
        id: true,
        name: true,
        symbol: true,
        resolution: true,
        isDefault: true,
        updatedAt: true,
      },
      orderBy: { updatedAt: "desc" },
    });

    return NextResponse.json(layouts);
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Failed to fetch layouts" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const user = await getAuthUser(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { name, symbol = "BTCUSDT", resolution = "15", content, isDefault = false } = await request.json();

    if (!name || !content) {
      return NextResponse.json({ error: "Name and content are required" }, { status: 400 });
    }

    if (isDefault) {
      await prisma.chartLayout.updateMany({
        where: { userId: user.userId, isDefault: true },
        data: { isDefault: false },
      });
    }

    const layout = await prisma.chartLayout.create({
      data: {
        userId: user.userId,
        name,
        symbol,
        resolution,
        content,
        isDefault: Boolean(isDefault),
      },
    });

    return NextResponse.json(layout, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Failed to save layout" }, { status: 500 });
  }
}
