import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { login } from "../lib/directus";
import { useAuth } from "../context/AuthContext";

function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { refreshUser } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const from = location.state?.from;
  const redirectTo = from?.pathname
    ? `${from.pathname}${from.search || ""}${from.hash || ""}`
    : "/info";

  async function handleLogin() {
    setError(null);

    try {
      await login(email, password);

      // 🔑 KRITICKÉ – načítaj usera z /users/me
      await refreshUser();

      navigate(redirectTo, { replace: true });
    } catch (err) {
      setError("Nesprávny email alebo heslo");
    }
  }

  return (
    <div className="container login-page">
      <div className="login-wrapper">
        <div className="card">
          <h1>Prihlásenie</h1>

          <div className="field">
            <label>EMAIL</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className="field">
            <label>HESLO</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <div className="forgot-password">
            <button
              type="button"
              className="link-btn"
              onClick={() => navigate("/forgot-password")}
            >
              Zabudnuté heslo?
            </button>
          </div>

          {error && <p style={{ color: "red" }}>{error}</p>}

          <button  className="login-btn" onClick={handleLogin}>Prihlásiť</button>
        </div>

        <p className="login-note">
          Prihlasovacie údaje získate od vášho pedagóga
        </p>
      </div>
    </div>
  );
}

export default Login;
