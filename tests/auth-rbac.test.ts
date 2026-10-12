import { describe, it, expect } from "vitest";
import {
  signToken,
  verifyToken,
  canPublishGlobalIndicator,
  canDeleteAnyLayout,
  canManagePersonalLayout,
  canManagePersonalWatchlist,
  UserPayload,
} from "@/lib/auth/jwt";

describe("JWT Authentication & Role-Based Access Control (RBAC)", () => {
  const traderUser: UserPayload = {
    userId: "trader-uuid-123",
    username: "crypto_trader",
    email: "trader@mochex.io",
    role: "TRADER",
  };

  const adminUser: UserPayload = {
    userId: "admin-uuid-456",
    username: "system_admin",
    email: "admin@mochex.io",
    role: "ADMIN",
  };

  it("should sign and verify valid JWT token for TRADER", async () => {
    const token = await signToken(traderUser);
    expect(typeof token).toBe("string");

    const decoded = await verifyToken(token);
    expect(decoded).not.toBeNull();
    expect(decoded?.userId).toBe(traderUser.userId);
    expect(decoded?.username).toBe(traderUser.username);
    expect(decoded?.role).toBe("TRADER");
  });

  it("should reject tampered or invalid JWT token", async () => {
    const token = await signToken(traderUser);
    const tampered = token.slice(0, -6) + "abcdef";
    const decoded = await verifyToken(tampered);
    expect(decoded).toBeNull();
  });

  it("should enforce RBAC rule: Publish Global Custom Indicators", () => {
    // Spec Section 4: TRADER Denied (403), ADMIN Allowed
    expect(canPublishGlobalIndicator("TRADER")).toBe(false);
    expect(canPublishGlobalIndicator("ADMIN")).toBe(true);
  });

  it("should enforce RBAC rule: Delete / Override User Layouts", () => {
    // Spec Section 4: TRADER Denied, ADMIN Allowed
    expect(canDeleteAnyLayout("TRADER")).toBe(false);
    expect(canDeleteAnyLayout("ADMIN")).toBe(true);
  });

  it("should enforce RBAC rule: Personal Layout Management", () => {
    // Owner is allowed
    expect(canManagePersonalLayout(traderUser.userId, traderUser.userId, "TRADER")).toBe(true);
    // Non-owner TRADER is denied
    expect(canManagePersonalLayout("other-trader-id", traderUser.userId, "TRADER")).toBe(false);
    // ADMIN can override
    expect(canManagePersonalLayout(adminUser.userId, traderUser.userId, "ADMIN")).toBe(true);
  });

  it("should enforce RBAC rule: Personal Watchlist Management", () => {
    // Owner is allowed
    expect(canManagePersonalWatchlist(traderUser.userId, traderUser.userId)).toBe(true);
    // Non-owner is denied
    expect(canManagePersonalWatchlist("other-trader-id", traderUser.userId)).toBe(false);
  });
});
