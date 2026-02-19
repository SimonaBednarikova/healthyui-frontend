import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { requestPasswordReset } from "../lib/directus";

function ForgotPassword() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);

    try {
      await requestPasswordReset(email);
      setMessage(
        "Ak email existuje, poslali sme odkaz na obnovu hesla."
      );
    } catch {
      setError("Niečo sa pokazilo. Skúste neskôr.");
    }
  }

  return (
    <div className="container">
      <div className="card">
        <h1>Obnovenie hesla</h1>

        <p style={{ marginBottom: "24px", textAlign: "center" }}>
          Zadajte email, na ktorý vám pošleme odkaz na obnovenie hesla.
        </p>

        <form onSubmit={handleSubmit}>
          <div className="field">
            <label>EMAIL</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          {message && <p style={{ color: "green" }}>{message}</p>}
          {error && <p style={{ color: "red" }}>{error}</p>}

          <button type="submit">Obnoviť heslo</button>
        </form>

        <div style={{ marginTop: "16px", textAlign: "center" }}>
          <button
            type="button"
            className="link-btn"
            onClick={() => navigate("/")}
          >
            ← Späť na prihlásenie
          </button>
        </div>
      </div>
    </div>
  );
}

export default ForgotPassword;
