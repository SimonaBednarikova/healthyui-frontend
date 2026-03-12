import { DIRECTUS_URL, clearAuthTokens, refreshAccessToken } from "./directus";

export async function api(endpoint, options = {}) {
  let token = localStorage.getItem("access_token");

  if (!token) {
    token = await refreshAccessToken();
  }

  const makeRequest = (authToken) =>
    fetch(`${DIRECTUS_URL}${endpoint}`, {
      method: options.method || "GET",
      headers: {
        "Content-Type": "application/json",
        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        ...(options.headers || {}),
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
    });

  let res = await makeRequest(token);

  if (res.status === 401) {
    const nextToken = await refreshAccessToken();

    if (!nextToken) {
      clearAuthTokens();
      throw new Error("Unauthorized");
    }

    res = await makeRequest(nextToken);

    if (res.status === 401) {
      clearAuthTokens();
      throw new Error("Unauthorized");
    }
  }

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text);
  }

  return res.json();
}
