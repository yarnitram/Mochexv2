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

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const user = await getAuthUser(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const watchlist = await prisma.watchlist.findUnique({ where: { id } });
    if (!watchlist) {
      return NextResponse.json({ error: "Watchlist not found" }, { status: 404 });
    }

    if (watchlist.userId !== user.userId) {
      return NextResponse.json({ error: "Forbidden: Owner only" }, { status: 403 });
    }

    const { name, symbols, isDefault } = await request.json();

    if (isDefault) {
      await prisma.watchlist.updateMany({
        where: { userId: watchlist.userId, isDefault: true },
        data: { isDefault: false },
      });
    }

    const updated = await prisma.watchlist.update({
      where: { id },
      data: {
        ...(name ? { name } : {}),
        ...(symbols ? { symbols } : {}),
        ...(isDefault !== undefined ? { isDefault: Boolean(isDefault) } : {}),
      },
    });

    return NextResponse.json(updated);
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Failed to update watchlist" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const user = await getAuthUser(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const watchlist = await prisma.watchlist.findUnique({ where: { id } });
    if (!watchlist) {
      return NextResponse.json({ error: "Watchlist not found" }, { status: 404 });
    }

    if (watchlist.userId !== user.userId) {
      return NextResponse.json({ error: "Forbidden: Owner only" }, { status: 403 });
    }

    await prisma.watchlist.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Failed to delete watchlist" }, { status: 500 });
  }
}
