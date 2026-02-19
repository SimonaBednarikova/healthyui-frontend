import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { DIRECTUS_URL } from "../lib/directus";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = useCallback(async () => {
  let token = localStorage.getItem("access_token");
  const refreshToken = localStorage.getItem("refresh_token");

  if (!token) {
    setUser(null);
    return null;
  }

  try {
    const res = await fetch(`${DIRECTUS_URL}/users/me`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (res.ok) {
      const json = await res.json();
      setUser(json.data);
      return json.data;
    }

    // 🔥 ak je 401 → skúsiť refresh
    if (res.status === 401 && refreshToken) {
      const refreshRes = await fetch(`${DIRECTUS_URL}/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          refresh_token: refreshToken,
        }),
      });

      if (!refreshRes.ok) throw new Error("Refresh failed");

      const refreshJson = await refreshRes.json();

      // uložiť nový access token
      localStorage.setItem("access_token", refreshJson.data.access_token);

      token = refreshJson.data.access_token;

      // znova načítať usera
      const retryRes = await fetch(`${DIRECTUS_URL}/users/me`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!retryRes.ok) throw new Error("Retry failed");

      const retryJson = await retryRes.json();
      setUser(retryJson.data);
      return retryJson.data;
    }

    throw new Error("Unauthorized");
  } catch (e) {
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    setUser(null);
    return null;
  }
}, []);


  // ⬅️ spustí sa pri štarte appky
  useEffect(() => {
    (async () => {
      setLoading(true);
      await refreshUser();
      setLoading(false);
    })();
  }, [refreshUser]);

  useEffect(() => {
    const interval = setInterval(() => {
      refreshUser();
    }, 4 * 60 * 1000); // každé 4 min

    return () => clearInterval(interval);
  }, [refreshUser]);

  function logout() {
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    setUser(null);

    // 🔑 tvrdý reset appky (najspoľahlivejší pri prepínaní userov)
    window.location.href = "/";
  }

  return (
    <AuthContext.Provider
      value={{ user, setUser, loading, logout, refreshUser }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }
  return context;
}
