"use client";

import { useState, useEffect, useCallback } from "react";

export interface AuthUser {
  id: string;
  username: string;
  email: string;
  role: "TRADER" | "ADMIN";
}

export function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const checkSession = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/me", { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        if (data.user) {
          setUser({
            id: data.user.userId,
            username: data.user.username,
            email: data.user.email,
            role: data.user.role,
          });
        } else {
          setUser(null);
        }
      } else {
        setUser(null);
      }
    } catch {
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    checkSession();
  }, [checkSession]);

  const syncLocalToCloud = useCallback(async () => {
    if (typeof window === "undefined") return;
    try {
      // Sync local layouts to cloud
      const savedSymbol = localStorage.getItem("mochex:symbol") || "BTCUSDT";
      const savedRes = localStorage.getItem("mochex:resolution") || "15";
      const savedIndicators = localStorage.getItem("mochex:active_indicators");

      const localLayoutContent = {
        symbol: savedSymbol,
        resolution: savedRes,
        indicators: savedIndicators ? JSON.parse(savedIndicators) : [],
        savedAt: new Date().toISOString(),
      };

      await fetch("/api/layouts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name: "Imported Local Setup",
          symbol: savedSymbol,
          resolution: savedRes,
          content: localLayoutContent,
          isDefault: true,
        }),
      });

      // Sync local watchlists
      const localWatchlist = localStorage.getItem("mochex:watchlist_symbols");
      if (localWatchlist) {
        const symbols = JSON.parse(localWatchlist);
        await fetch("/api/watchlists", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            name: "My Local Watchlist",
            symbols,
            isDefault: true,
          }),
        });
      }
    } catch (err) {
      console.warn("Failed to sync local data to cloud:", err);
    }
  }, []);

  const login = async (usernameOrEmail: string, password: string) => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ usernameOrEmail, password }),
      });

      const data = await res.json();
      if (!res.ok) {
        return { success: false, error: data.error || "Login failed" };
      }

      setUser(data.user);
      await syncLocalToCloud();
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err?.message || "Network error" };
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (username: string, email: string, password: string) => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ username, email, password }),
      });

      const data = await res.json();
      if (!res.ok) {
        return { success: false, error: data.error || "Registration failed" };
      }

      setUser(data.user);
      await syncLocalToCloud();
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err?.message || "Network error" };
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    setIsLoading(true);
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
      });
      setUser(null);
    } catch (err) {
      console.warn("Logout error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  return {
    user,
    isAuthenticated: Boolean(user),
    role: user?.role || "GUEST",
    isLoading,
    login,
    register,
    logout,
    checkSession,
    syncLocalToCloud,
  };
}
