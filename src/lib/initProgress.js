import { api } from "./api";

export async function initProgressIfNeeded() {
  console.log("INIT PROGRESS STARTED");

  let me;
  try {
    const meRes = await api("/users/me?fields=id,role,role.name,first_login_completed");
    me = meRes.data;
    console.log("ME:", me);
  } catch (e) {
    console.error("INIT: failed to load /users/me", e);
    return;
  }

  // Allow both real students and admin testers to get scenario progress rows.
  const allowedRoles = new Set(["Student", "Administrator"]);
  const roleName = typeof me.role === "object" ? me.role?.name : undefined;
  if (roleName && !allowedRoles.has(roleName)) {
    console.log("SKIP: unsupported role for progress init (roleName=", roleName, ")");
    return;
  }

  let hasProgress = false;
  try {
    const existingProgressRes = await api(
      `/items/user_scenario_progress?filter[user][_eq]=${me.id}&limit=1&fields=id`
    );
    hasProgress = (existingProgressRes.data ?? []).length > 0;
  } catch (e) {
    console.error("INIT: failed to check existing progress", e);
  }

  if (me.first_login_completed === true && hasProgress) {
    console.log("SKIP: already initialized");
    return;
  }

  let scenarios = [];
  try {
    const scenariosRes = await api("/items/scenarios?fields=id&limit=-1");
    scenarios = scenariosRes.data ?? [];
    console.log("SCENARIOS COUNT:", scenarios.length);
  } catch (e) {
    console.error("INIT: failed to load scenarios (permissions?)", e);
    return;
  }

  if (scenarios.length === 0) {
    console.log("SKIP: no scenarios returned (check Directus permissions for allowed roles on scenarios)");
    return;
  }

  for (const scenario of scenarios) {
    try {
      await api("/items/user_scenario_progress", {
        method: "POST",
        body: {
          user: me.id,
          scenario: scenario.id,
          status: "NOT_STARTED",
        },
      });
      console.log("Created progress for scenario", scenario.id);
    } catch (e) {
      console.warn("Create progress failed (maybe already exists):", scenario.id);
    }
  }

  try {
    await api("/users/me", {
      method: "PATCH",
      body: { first_login_completed: true },
    });
  } catch (e) {
    console.error("INIT: failed to set first_login_completed", e);
  }

  console.log("INIT PROGRESS DONE");
}
