import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { canPublishGlobalIndicator, verifyToken } from "@/lib/auth/jwt";

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
    const existing = await prisma.indicator.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Indicator not found" }, { status: 404 });
    }

    if (existing.userId !== user.userId && user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden: Not owner or admin" }, { status: 403 });
    }

    const { name, description, scriptCode, inputsSchema, isGlobal } = await request.json();

    if (isGlobal !== undefined && isGlobal !== existing.isGlobal && !canPublishGlobalIndicator(user.role)) {
      return NextResponse.json({ error: "Forbidden: Only ADMIN can change global status" }, { status: 403 });
    }

    const updated = await prisma.indicator.update({
      where: { id },
      data: {
        ...(name ? { name } : {}),
        ...(description !== undefined ? { description } : {}),
        ...(scriptCode ? { scriptCode } : {}),
        ...(inputsSchema ? { inputsSchema } : {}),
        ...(isGlobal !== undefined ? { isGlobal: Boolean(isGlobal) } : {}),
      },
    });

    return NextResponse.json(updated);
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Failed to update indicator" }, { status: 500 });
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
    const existing = await prisma.indicator.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Indicator not found" }, { status: 404 });
    }

    if (existing.userId !== user.userId && user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden: Not owner or admin" }, { status: 403 });
    }

    await prisma.indicator.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Failed to delete indicator" }, { status: 500 });
  }
}
