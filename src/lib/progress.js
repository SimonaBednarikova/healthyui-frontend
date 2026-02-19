import { api } from "./api";

/**
 * ⚡ RÝCHLY READ pre ModuleDetail (bez Flow)
 */
export async function fetchProgressForModule(moduleId, userId) {
  const res = await api(
    `/items/user_scenario_progress` +
      `?filter[user][_eq]=${userId}` +
      `&filter[scenario][module][_eq]=${moduleId}` +
      `&fields=scenario.id,status`
  );

  return res.data ?? [];
}

/**
 * 🧠 FLOW – iba pre Modules stránku (overall progress)
 */
export async function fetchProgress() {
  const res = await api(
    "/flows/trigger/5644920b-ad09-40e0-98e1-1a0b4bebeeba"
  );

  return res;
}
/**
 * ⚡ RÝCHLY READ – overall + module progress (bez Flow)
 */
export async function fetchOverallProgress(userId) {
  const res = await api(
    `/items/user_scenario_progress` +
      `?filter[user][_eq]=${userId}` +
      `&fields=status,scenario.module`
  );

  const rows = res.data ?? [];

  const result = {
    overall: { total: 0, completed: 0, percent: 0 },
    modules: {},
  };

  rows.forEach((r) => {
    const moduleId = r.scenario?.module;
    if (!moduleId) return;

    if (!result.modules[moduleId]) {
      result.modules[moduleId] = {
        total: 0,
        completed: 0,
        percent: 0,
      };
    }

    result.modules[moduleId].total += 1;
    result.overall.total += 1;

    if (r.status === "DONE") {
      result.modules[moduleId].completed += 1;
      result.overall.completed += 1;
    }
  });

  // percentá
  Object.values(result.modules).forEach((m) => {
    m.percent = m.total
      ? Math.round((m.completed / m.total) * 100)
      : 0;
  });

  result.overall.percent = result.overall.total
    ? Math.round(
        (result.overall.completed / result.overall.total) * 100
      )
    : 0;

  return result;
}
