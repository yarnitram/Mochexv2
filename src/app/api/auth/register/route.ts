import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { hashPassword } from "@/lib/auth/password";
import { signToken } from "@/lib/auth/jwt";

export async function POST(request: NextRequest) {
  try {
    const { username, email, password } = await request.json();

    if (!username || !email || !password) {
      return NextResponse.json(
        { error: "Username, email, and password are required" },
        { status: 400 }
      );
    }

    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [{ username }, { email }],
      },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "Username or email is already taken" },
        { status: 409 }
      );
    }

    const passwordHash = hashPassword(password);
    const user = await prisma.user.create({
      data: {
        username,
        email,
        passwordHash,
        role: "TRADER",
      },
    });

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
      maxAge: 60 * 60 * 24 * 7, // 7 days
    });

    return response;
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to register user" },
      { status: 500 }
    );
  }
}
