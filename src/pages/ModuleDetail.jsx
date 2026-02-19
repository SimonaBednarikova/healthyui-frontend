import "./Modules.css";
import { useParams, useNavigate } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import { api } from "../lib/api";
import { fetchProgressForModule } from "../lib/progress";
import { useAuth } from "../context/AuthContext";

export default function ModuleDetail() {
  const { user } = useAuth();
  const { moduleId } = useParams();
  const navigate = useNavigate();
  const trackRef = useRef(null);

  const [module, setModule] = useState(null);
  const [scenarios, setScenarios] = useState([]);
  const [progress, setProgress] = useState([]);
  const [loading, setLoading] = useState(false);

  // ================= LOAD DATA =================
  useEffect(() => {
  if (!user?.id) return;

  // 🔴 RESET STAVU PRI ZMENE USERA ALEBO MODULU
  setModule(null);
  setScenarios([]);
  setProgress([]);
  setLoading(true);

  async function loadData() {
    try {
      const [moduleRes, scenariosRes, progressRes] = await Promise.all([
        api(`/items/modules/${moduleId}?fields=title,intro_text`),
        api(
          `/items/scenarios?filter[module][_eq]=${moduleId}&limit=100&fields=id,name,age,role,image,tags`
        ),
        fetchProgressForModule(moduleId, user.id),
      ]);

      setModule(moduleRes.data);
      setScenarios(scenariosRes.data || []);
      setProgress(progressRes || []);
    } catch (err) {
      console.error("❌ Module detail load error:", err);
    } finally {
      setLoading(false);
    }
  }

  loadData();
}, [moduleId, user.id]);


  // ================= GUARDS =================
  if (!user) {
    return <div className="modules-page">Načítavam…</div>;
  }

  if (loading) {
    return <div className="modules-page">Načítavam modul…</div>;
  }

  if (loading) {
  return <div className="modules-page">Načítavam modul…</div>;
}

if (!module && !loading) {
  return <div className="modules-page">Modul neexistuje</div>;
}


  // ================= PROGRESS =================
  const scenarioStatusMap = {};
  progress.forEach((p) => {
    scenarioStatusMap[p.scenario.id] = p.status;
  });

  const total = scenarios.length;
  const completed = progress.filter((p) => p.status === "DONE").length;
  const percent = total > 0 ? Math.round((completed / total) * 100) : 0;

  // ================= RENDER =================
  return (
    <div className="modules-page">
      {/* ================= HEADER ================= */}
      <header className="modules-header module-detail-header">
        <div>
          <button className="back-btn" onClick={() => navigate("/modules")}>
            &lt; Naspäť na moduly
          </button>

          <h1 className="modulestitle modulesdetailtitle">
            {module.title}
          </h1>

          {module.intro_text && <p className="moduledescriptiontext">{module.intro_text}</p>}
        </div>

        {/* MODULE PROGRESS */}
        <div className="course-progress">
          <div className="course-progress-bar">
            <div
              className="course-progress-fill"
              style={{ width: `${percent}%` }}
            >
              <span>{percent} %</span>
            </div>
          </div>
        </div>
      </header>

      {/* ================= SCENARIOS ================= */}
      <div className="modules-track" ref={trackRef}>
        {scenarios.map((s, index) => {
          const status = scenarioStatusMap[s.id];

          return (
            <div
              key={s.id}
              className="module-card clickable"
              onClick={() =>
                navigate(`/modules/${moduleId}/scenarios/${s.id}`)
              }
            >
              {/* TOP */}
              <div className="module-top">
                <div className="module-index">{index + 1}</div>

                <div
                  className={`scenario-status ${
                    status === "DONE" ? "done" : ""
                  }`}
                >
                  <div
                    className={`scenario-status-fill ${
                      status === "DONE" ? "done" : "not-done"
                    }`}
                  >
                    {status === "DONE" ? "✓" : "✕"}
                  </div>
                </div>
              </div>

              {/* TEXT */}
              <div className="module-text-detail">
                <h3 className="module-title-detail">{s.name}</h3>
                <p className="module-description-detail">
                  {s.age}, {s.role}
                </p>

                {s.tags?.length > 0 && (
                  <div className="tags">
                    {s.tags.map((tag, i) => (
                      <p key={i} className="tag">
                        {tag}
                      </p>
                    ))}
                  </div>
                )}
              </div>

              {/* IMAGE */}
              {s.image && (
                <div className="module-image">
                  <img
                    src={`http://localhost:8055/assets/${s.image}`}
                    alt={s.name}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
