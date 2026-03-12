/* ======================
   IDRECTUS_URL pre local : export const DIRECTUS_URL = "http://localhost:8055";
====================== */

export const DIRECTUS_URL = import.meta.env.VITE_DIRECTUS_URL;

export function clearAuthTokens() {
  localStorage.removeItem("access_token");
  localStorage.removeItem("refresh_token");
}

export async function refreshAccessToken() {
  const refreshToken = localStorage.getItem("refresh_token");
  if (!refreshToken) return null;

  const refreshRes = await fetch(`${DIRECTUS_URL}/auth/refresh`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      refresh_token: refreshToken,
    }),
  });

  if (!refreshRes.ok) {
    return null;
  }

  const refreshJson = await refreshRes.json();
  const nextAccessToken = refreshJson?.data?.access_token;
  const nextRefreshToken = refreshJson?.data?.refresh_token;

  if (!nextAccessToken) {
    return null;
  }

  localStorage.setItem("access_token", nextAccessToken);
  if (nextRefreshToken) {
    localStorage.setItem("refresh_token", nextRefreshToken);
  }

  return nextAccessToken;
}

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
  let token = localStorage.getItem("access_token");
  if (!token) {
    token = await refreshAccessToken();
  }
  if (!token) return null;

  const res = await fetch(`${DIRECTUS_URL}/users/me`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (res.status === 401) {
    const nextToken = await refreshAccessToken();
    if (!nextToken) {
      clearAuthTokens();
      return null;
    }

    const retryRes = await fetch(`${DIRECTUS_URL}/users/me`, {
      headers: {
        Authorization: `Bearer ${nextToken}`,
      },
    });

    if (!retryRes.ok) {
      return null;
    }

    const retryData = await retryRes.json();
    return retryData.data;
  }

  if (!res.ok) {
    return null;
  }

  const data = await res.json();
  return data.data;
}

/* ======================
   LOGOUT
====================== */
export function logout() {
  clearAuthTokens();
}

/* ======================
   ZMENA HESLA LOCAL

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
====================== */
export async function requestPasswordReset(email) {
  const res = await fetch(
    `${DIRECTUS_URL}/auth/password/request`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: email,
        reset_url: `${window.location.origin}/reset-password`
      }),
    }
  );

  if (!res.ok) {
    const err = await res.text();
    console.error("Password reset error:", err);
    throw new Error("Password reset failed");
  }
}
