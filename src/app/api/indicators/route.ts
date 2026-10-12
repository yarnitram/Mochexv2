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

export async function GET(request: NextRequest) {
  const user = await getAuthUser(request);

  try {
    const indicators = await prisma.indicator.findMany({
      where: {
        OR: [
          { isGlobal: true },
          ...(user ? [{ userId: user.userId }] : []),
        ],
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(indicators);
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Failed to fetch indicators" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const user = await getAuthUser(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { name, description, scriptCode, inputsSchema, isGlobal = false } = await request.json();

    if (!name || !scriptCode) {
      return NextResponse.json({ error: "Name and scriptCode are required" }, { status: 400 });
    }

    if (isGlobal && !canPublishGlobalIndicator(user.role)) {
      return NextResponse.json(
        { error: "Forbidden: Only ADMIN role can publish global indicators" },
        { status: 403 }
      );
    }

    const indicator = await prisma.indicator.create({
      data: {
        userId: user.userId,
        name,
        description: description || null,
        scriptCode,
        inputsSchema: inputsSchema || {},
        isGlobal: Boolean(isGlobal),
      },
    });

    return NextResponse.json(indicator, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Failed to create indicator" }, { status: 500 });
  }
}
