import { api } from "./api";
import { fetchProgressForModule } from "./progress";
import { moduleDetailCache } from "./prefetch";

export async function prefetchModuleDetail(moduleId, userId) {
  if (moduleDetailCache[moduleId]) return;

  const [moduleRes, scenariosRes, progressRes] = await Promise.all([
    api(`/items/modules/${moduleId}?fields=title,intro_text`),
    api(
      `/items/scenarios?filter[module][_eq]=${moduleId}&limit=100&fields=id,name,age,role,image,tags`
    ),
    fetchProgressForModule(moduleId, userId),
  ]);

  moduleDetailCache[moduleId] = {
    module: moduleRes.data,
    scenarios: scenariosRes.data || [],
    progress: progressRes || [],
  };
}
