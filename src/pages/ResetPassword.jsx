import { useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";

function ResetPassword() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get("token");

  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);

    const res = await fetch(
      "http://localhost:8055/auth/password/reset",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          password,
        }),
      }
    );

    if (!res.ok) {
      setError("Obnova hesla zlyhala");
      return;
    }

    alert("Heslo bolo zmenené");
    navigate("/");
  }

  if (!token) {
    return <p>Neplatný odkaz</p>;
  }

  return (
    <div className="container">
      <div className="card">
        <h1>Nové heslo</h1>

        <form onSubmit={handleSubmit}>
          <div className="field">
            <label>Nové heslo</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          {error && <p style={{ color: "red" }}>{error}</p>}

          <button type="submit">Uložiť nové heslo</button>
        </form>
      </div>
    </div>
  );
}

export default ResetPassword;
