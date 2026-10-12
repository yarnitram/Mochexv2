import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { canDeleteAnyLayout, verifyToken } from "@/lib/auth/jwt";

async function getAuthUser(request: NextRequest) {
  const token =
    request.cookies.get("mochex_token")?.value ||
    request.headers.get("Authorization")?.replace("Bearer ", "");
  if (!token) return null;
  return verifyToken(token);
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const user = await getAuthUser(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const layout = await prisma.chartLayout.findUnique({ where: { id } });
    if (!layout) {
      return NextResponse.json({ error: "Layout not found" }, { status: 404 });
    }

    if (layout.userId !== user.userId && user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    return NextResponse.json(layout);
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Failed to retrieve layout" }, { status: 500 });
  }
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
    const layout = await prisma.chartLayout.findUnique({ where: { id } });
    if (!layout) {
      return NextResponse.json({ error: "Layout not found" }, { status: 404 });
    }

    if (layout.userId !== user.userId && user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { name, symbol, resolution, content, isDefault } = await request.json();

    if (isDefault) {
      await prisma.chartLayout.updateMany({
        where: { userId: layout.userId, isDefault: true },
        data: { isDefault: false },
      });
    }

    const updated = await prisma.chartLayout.update({
      where: { id },
      data: {
        ...(name ? { name } : {}),
        ...(symbol ? { symbol } : {}),
        ...(resolution ? { resolution } : {}),
        ...(content ? { content } : {}),
        ...(isDefault !== undefined ? { isDefault: Boolean(isDefault) } : {}),
      },
    });

    return NextResponse.json(updated);
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Failed to update layout" }, { status: 500 });
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
    const layout = await prisma.chartLayout.findUnique({ where: { id } });
    if (!layout) {
      return NextResponse.json({ error: "Layout not found" }, { status: 404 });
    }

    if (layout.userId !== user.userId && !canDeleteAnyLayout(user.role)) {
      return NextResponse.json({ error: "Forbidden: Only owner or admin can delete layouts" }, { status: 403 });
    }

    await prisma.chartLayout.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Failed to delete layout" }, { status: 500 });
  }
}
