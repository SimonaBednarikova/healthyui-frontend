import { Navigate, useLocation } from "react-router-dom";
import { useEffect, useRef } from "react";
import { useAuth } from "../context/AuthContext";
import { initProgressIfNeeded } from "../lib/initProgress";

export default function RequireAuth({ children }) {
  const { user, loading } = useAuth();
  const initRanRef = useRef(false);
  const location = useLocation();

  // ✅ HOOK VŽDY ZAVOLANÝ
  useEffect(() => {
    if (loading) return;
    if (!user) return;
    if (initRanRef.current) return;

    initRanRef.current = true;
    initProgressIfNeeded();
  }, [user, loading]);

  // ⏳ ešte zisťujeme stav
  if (loading) {
    return <div style={{ padding: 40 }}>Načítavam aplikáciu…</div>;
  }

  // 🔒 nie je prihlásený → login
  if (!user) {
    return <Navigate to="/" replace state={{ from: location }} />;
  }

  // ✅ všetko OK
  return children;
}
