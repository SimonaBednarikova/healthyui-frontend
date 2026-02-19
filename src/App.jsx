import { Routes, Route } from "react-router-dom";
import { useState } from "react";

import Header from "./components/Header";
import Login from "./pages/Login";
import Info from "./pages/Info";
import Modules from "./pages/Modules";
import ModuleDetail from "./pages/ModuleDetail";
import ForgotPassword from "./pages/ForgotPassword";
import RequireAuth from "./components/RequireAuth";
import ResetPassword from "./pages/ResetPassword";
import ScenarioDetail from "./pages/ScenarioDetail";

function App() {
  const [mobileOpen, setMobileOpen] = useState(false);
  return (
    <>
      {/* Header teraz vie otvoriť drawer */}
      <Header onToggleDrawer={() => setMobileOpen(v => !v)} />

      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />

        {/* 🔒 chránené routes */}
        <Route
          path="/info"
          element={
            <RequireAuth>
              <Info />
            </RequireAuth>
          }
        />

        <Route
          path="/modules"
          element={
            <RequireAuth>
              <Modules />
            </RequireAuth>
          }
        />

        <Route
          path="/modules/:moduleId"
          element={
            <RequireAuth>
              <ModuleDetail />
            </RequireAuth>
          }
        />
        <Route
          path="/modules/:moduleId/scenarios/:scenarioId"
          element={
            <RequireAuth>
              <ScenarioDetail
        mobileOpen={mobileOpen}
        setMobileOpen={setMobileOpen}
      />
            </RequireAuth>
          }
        />

      </Routes>
    </>
  );
}

export default App;
