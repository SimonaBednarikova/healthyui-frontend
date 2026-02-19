import { api } from "./api";

export async function initProgressIfNeeded() {
  console.log("INIT PROGRESS STARTED");

  let me;
  try {
    // ⚠️ Nechajme role ako "role" (ID) + skúsime aj role.name ak je povolené
    const meRes = await api("/users/me?fields=id,role,role.name,first_login_completed");
    me = meRes.data;
    console.log("ME:", me);
  } catch (e) {
    console.error("INIT: failed to load /users/me", e);
    return;
  }

  // ✅ Robustná kontrola roly:
  // - ak vieme prečítať názov roly a je to niečo iné než Student → skip
  // - ak nevieme prečítať názov (undefined), NEBLOKUJEME init (typicky permissions)
  const roleName = typeof me.role === "object" ? me.role?.name : undefined;
  if (roleName && roleName !== "Student") {
    console.log("SKIP: not student (roleName=", roleName, ")");
    return;
  }

  // 1️⃣ over, či progress existuje
  let hasProgress = false;
  try {
    const existingProgressRes = await api(
      `/items/user_scenario_progress?filter[user][_eq]=${me.id}&limit=1&fields=id`
    );
    hasProgress = (existingProgressRes.data ?? []).length > 0;
  } catch (e) {
    console.error("INIT: failed to check existing progress", e);
    // ak nevieme overiť, radšej neskipuj – pokračuj
  }

  // ✅ Skip len vtedy, keď flag je true A zároveň progress reálne existuje
  if (me.first_login_completed === true && hasProgress) {
    console.log("SKIP: already initialized");
    return;
  }

  // 2️⃣ načítaj scenáre (a keď to zlyhá, vypíš celú odpoveď)
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
    console.log("SKIP: no scenarios returned (check Directus permissions for Student on scenarios)");
    return;
  }

  // 3️⃣ vytvor progress (idempotentne – chyby len zalogujeme)
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
      console.log("✅ Created progress for scenario", scenario.id);
    } catch (e) {
      console.warn("⚠️ Create progress failed (maybe already exists):", scenario.id);
    }
  }

  // 4️⃣ označ first login ako hotový (aj keď niektoré insert-y už existovali)
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
