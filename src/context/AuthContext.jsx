import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { DIRECTUS_URL, clearAuthTokens, refreshAccessToken } from "../lib/directus";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    let token = localStorage.getItem("access_token");

    if (!token) {
      token = await refreshAccessToken();
    }

    if (!token) {
      setUser(null);
      return null;
    }

    const loadUser = async (authToken) => {
      const res = await fetch(`${DIRECTUS_URL}/users/me`, {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });

      if (!res.ok) {
        return null;
      }

      const json = await res.json();
      setUser(json.data);
      return json.data;
    };

    try {
      const currentUser = await loadUser(token);
      if (currentUser) {
        return currentUser;
      }

      const nextToken = await refreshAccessToken();
      if (!nextToken) {
        clearAuthTokens();
        setUser(null);
        return null;
      }

      const refreshedUser = await loadUser(nextToken);
      if (refreshedUser) {
        return refreshedUser;
      }

      clearAuthTokens();
      setUser(null);
      return null;
    } catch (error) {
      console.error("Auth refresh error", error);
      return null;
    }
  }, []);

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
    }, 4 * 60 * 1000);

    return () => clearInterval(interval);
  }, [refreshUser]);

  function logout() {
    clearAuthTokens();
    setUser(null);
    window.location.href = "/";
  }

  return (
    <AuthContext.Provider value={{ user, setUser, loading, logout, refreshUser }}>
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
