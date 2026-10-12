import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { verifyPassword } from "@/lib/auth/password";
import { signToken } from "@/lib/auth/jwt";

export async function POST(request: NextRequest) {
  try {
    const { usernameOrEmail, password } = await request.json();

    if (!usernameOrEmail || !password) {
      return NextResponse.json(
        { error: "Username/email and password are required" },
        { status: 400 }
      );
    }

    const user = await prisma.user.findFirst({
      where: {
        OR: [{ username: usernameOrEmail }, { email: usernameOrEmail }],
      },
    });

    if (!user || !verifyPassword(password, user.passwordHash)) {
      return NextResponse.json(
        { error: "Invalid credentials" },
        { status: 401 }
      );
    }

    const token = await signToken({
      userId: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
    });

    const response = NextResponse.json({
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
      },
    });

    response.cookies.set({
      name: "mochex_token",
      value: token,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });

    return response;
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to log in" },
      { status: 500 }
    );
  }
}
