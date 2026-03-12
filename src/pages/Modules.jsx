import "./Modules.css";
import { useNavigate } from "react-router-dom";
import { useRef, useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { api } from "../lib/api";
import { fetchOverallProgress } from "../lib/progress";
import { prefetchModuleDetail } from "../lib/prefetchModuleDetail";



export default function Modules() {
  const { user, loading } = useAuth();

  const [modules, setModules] = useState([]);
  const [progress, setProgress] = useState({
  overall: { percent: 0 },
  modules: {},
});


  const navigate = useNavigate();
  const trackRef = useRef(null);
  

  // âŹł ÄŤakĂˇme na auth
  if (loading) return <div>â€¦</div>;
  if (!user) return null;

  // 1ď¸ŹâŁ naÄŤĂ­taj moduly
  useEffect(() => {
    api("/items/modules")
      .then((res) => {
        setModules(res.data || []);
      })
      .catch((err) =>
        console.error("âťŚ Error loading modules:", err)
      );
  }, []);

  // 2ď¸ŹâŁ naÄŤĂ­taj progress z Flow
useEffect(() => {
  if (!user?.id) return;

  fetchOverallProgress(user.id)
    .then((data) => {
      setProgress(data);
    })
    .catch((err) =>
      console.error("âťŚ Error loading progress:", err)
    );
}, [user.id]);




const overall = progress?.overall ?? { percent: 0 };
const modulesProgress = progress?.modules ?? {};



  function scrollLeft() {
    trackRef.current?.scrollBy({ left: -324, behavior: "smooth" });
  }

  function scrollRight() {
    trackRef.current?.scrollBy({ left: 324, behavior: "smooth" });
  }

  return (
    <div className="modules-page modules-overview-page">
      {/* ================= HEADER ================= */}
      <header className="modules-header">
        <h1 className="modulestitle">Moduly</h1>

        {/* OVERALL PROGRESS */}
        <div className="course-progress">
          <div className="course-progress-bar">
            <div
              className="course-progress-fill"
              style={{ width: `${overall.percent}%` }}
            >
              <span>{overall.percent} %</span>
            </div>
          </div>
        </div>
      </header>

      {/* ================= MODULES ================= */}
      <div className="modules-track" ref={trackRef}>
        {modules.map((m, index) => {
          const moduleProgress = modulesProgress[m.id];

          return (
            <div
              key={m.id}
              className="module-card"
              onMouseEnter={() =>
                prefetchModuleDetail(m.id, user.id)
              }
              onClick={async () => {
                await prefetchModuleDetail(m.id, user.id);
                navigate(`/modules/${m.id}`);
              }}
            >

              <div className="module-top">
                <div className="module-index"><span>{index + 1}</span></div>

                {/* MODULE PROGRESS */}
                <div className="module-progress-bar">
                  <div
                    className="module-progress-fill"
                    style={{
                      width: `${moduleProgress?.percent ?? 0}%`,
                    }}
                  >
                    <span>{moduleProgress?.percent ?? 0}%</span>
                  </div>
                </div>
              </div>

              <div className="module-text">
                <h3 className="module-title">{m.title}</h3>
                <p className="module-description">
                  {m.description}
                </p>
              </div>
              {/*LOCAL src={`http://localhost:8055/assets/${m.image}`} */}
              <div className="module-image">
                {m.image && (
                  <img
                    src={`${import.meta.env.VITE_DIRECTUS_URL}/assets/${m.image}`}
                    alt={m.title}
                  />
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* ================= NAV ================= */}
      <div className="modules-nav">
        <button className="modules-nav-btn" onClick={scrollLeft}>
          <span>&lt;</span>
        </button>
        <button className="modules-nav-btn" onClick={scrollRight}>
          <span>&gt;</span>
        </button>
      </div>
    </div>
  );
}

