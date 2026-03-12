import { useNavigate, useLocation } from "react-router-dom";
import { logout } from "../lib/directus";
import "./Header.css";

export default function Header({ onToggleDrawer }) {
  const navigate = useNavigate();
  const location = useLocation();
  const token = localStorage.getItem("access_token");

  const isAuthPage =
    location.pathname === "/" ||
    location.pathname === "/forgot-password";

  const isScenarioDetail = location.pathname.includes("/scenarios/");

  function handleLogout() {
    window.dispatchEvent(new Event("force-stop-realtime"));
    logout();
    navigate("/");
  }

  function handleLogoClick() {
    window.dispatchEvent(new Event("force-stop-realtime"));
    navigate("/modules");
  }

  return (
    <header className="app-header">
      <img
        src="/logo-HelthyU.png"
        alt="HealthyU"
        className="app-logo"
        onClick={handleLogoClick}
      />

      <div className="header-actions">
        {token && !isAuthPage && (
          <button className="logout-btn" onClick={handleLogout}>
            Odhlásiť sa
          </button>
        )}

        {isScenarioDetail && onToggleDrawer && (
          <button
            className="drawer-toggle"
            onClick={() => {
              onToggleDrawer();
            }}
          >
            ☰
          </button>
        )}
      </div>
    </header>
  );
}
