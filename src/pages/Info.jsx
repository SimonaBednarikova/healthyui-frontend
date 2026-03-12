import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
 // API zmena !!!: const API_URL = "http://localhost:8055";
 // API zmena na deploy !!!: const API_URL = import.meta.env.VITE_DIRECTUS_URL;
const API_URL = import.meta.env.VITE_DIRECTUS_URL;


function Info() {
  const navigate = useNavigate();
  const [info, setInfo] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadInfo() {
      try {
        const res = await fetch(
          `${API_URL}/items/info?fields=textinfo`
        );
        const json = await res.json();
        console.log("INFO RAW:", json);
        setInfo(json.data[0] || null);
      } catch (err) {
        console.error("Chyba pri načítaní info:", err);
      } finally {
        setLoading(false);
      }
    }

    loadInfo();
  }, []);

  if (loading) return <div className="container info-page">Načítavam…</div>;
  if (!info) return <div className="container info-page">Bez obsahu</div>;

  return (
    <div className="container info-page">
      <div className="card card--wide">
        <h1 className="infotitle">Kouč v zácviku</h1>

        <div
          className="info-text"
          dangerouslySetInnerHTML={{ __html: info.textinfo }}
        />

        <button className="infobutton" onClick={() => navigate("/modules")}>
          Prejsť do kurzu
        </button>
      </div>
    </div>
  );
}

export default Info;
