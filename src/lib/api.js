import { DIRECTUS_URL } from "./directus";

export async function api(endpoint, options = {}) {
  const token = localStorage.getItem("access_token");

  const res = await fetch(`${DIRECTUS_URL}${endpoint}`, {
    method: options.method || "GET",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  if (res.status === 401) {
  throw new Error("Unauthorized");
}


  if (!res.ok) {
    const text = await res.text();
    throw new Error(text);
  }

  return res.json();
}
