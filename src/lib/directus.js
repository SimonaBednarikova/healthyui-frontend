export const DIRECTUS_URL = "http://localhost:8055";

/* ======================
   LOGIN
====================== */
export async function login(email, password) {
  const res = await fetch(`${DIRECTUS_URL}/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, password }),
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data?.errors?.[0]?.message || "Login failed");
  }

  localStorage.setItem("access_token", data.data.access_token);
  localStorage.setItem("refresh_token", data.data.refresh_token);

  return data.data;
}

/* ======================
   CURRENT USER
====================== */
export async function getCurrentUser() {
  const token = localStorage.getItem("access_token");
  if (!token) return null;

  const res = await fetch(`${DIRECTUS_URL}/users/me`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    logout();
    return null;
  }

  const data = await res.json();
  return data.data;
}

/* ======================
   LOGOUT
====================== */
export function logout() {
  localStorage.removeItem("access_token");
  localStorage.removeItem("refresh_token");
}

/* ======================
   ZMENA HESLA
====================== */
export async function requestPasswordReset(email) {
  const res = await fetch(
    "http://localhost:8055/auth/password/request",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: email,
        reset_url: "http://localhost:5173/reset-password"
      }),
    }
  );

  if (!res.ok) {
    const err = await res.text();
    console.error("Password reset error:", err);
    throw new Error("Password reset failed");
  }
}
