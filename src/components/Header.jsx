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

  // sme v ScenarioDetail?
  const isScenarioDetail = location.pathname.includes("/scenarios/");
  function handleLogout() {
    logout();
    navigate("/");
  }
  console.log("HEADER pathname:", location.pathname);
  console.log("HEADER isScenarioDetail:", isScenarioDetail);
  console.log("HEADER onToggleDrawer:", onToggleDrawer);
   return (
    <header className="app-header">
      <img
        src="/logo-HelthyU.png"
        alt="HealthyU"
        className="app-logo"
        onClick={() => navigate("/modules")}
      />

      <div className="header-actions">
        {token && !isAuthPage && (
          <button className="logout-btn" onClick={handleLogout}>
            Odhlásiť sa
          </button>
        )}

        {/* 🍔 BURGER – len na ScenarioDetail */}
        {isScenarioDetail && onToggleDrawer && (
          <button
            className="drawer-toggle"
            onClick={() => {
              console.log("BURGER CLICK");
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
