export default function ScenarioCard({
  scenario,
  index,
  status,
  showDescription = false,
}) {
  const detailParts = [scenario.age, scenario.role].filter(Boolean);

  function formatDescription(text) {
  if (!text) return null;

  const marker = "Vaša úloha";

  if (!text.includes(marker)) {
    return <p className="scenario-description">{text}</p>;
  }

  const [before, afterRaw] = text.split(marker);

  const after = afterRaw
    ?.replace(/^[:\-\s]*/, "") 
    .trim();

  return (
    <div className="scenario-description">
      {before && <p>{before.trim()}</p>}

      <p className="task-section">
        <strong>{marker}:</strong> {after}
      </p>
    </div>
  );
}

  return (
    <div className="module-card-component">
      {/* TOP */}
      <div className="module-top">
        {index !== undefined && (
          <div className="module-index"><span>{index + 1}</span></div>
        )}

        {status && (
          <div className={`scenario-status ${status === "DONE" ? "done" : ""}`}>
            <div
              className={`scenario-status-fill ${
                status === "DONE" ? "done" : "not-done"
              }`}
            >
              {status === "DONE" ? "✓" : "✕"}
            </div>
          </div>
        )}
      </div>

      {/* TEXT */}
      <div className="module-text-detail">
        <h3 className="module-title-detail">{scenario.name}</h3>

        {detailParts.length > 0 && (
          <p className="module-description-detail">
            {detailParts.join(", ")}
          </p>
        )}
        {scenario.tags?.length > 0 && (
          <div className="tags">
            {scenario.tags.map((tag, i) => (
              <p key={i} className="tag"><span>
                {tag.name ?? tag}</span>
              </p>
            ))}
          </div>
        )}
        {showDescription && scenario.description && (
  formatDescription(scenario.description)
    )}


        
      </div>

      {/* IMAGE LOCAL = src={`http://localhost:8055/assets/${scenario.image}`}*/}
      {scenario.image && (
        <div className="card-image">
          <img
           
            src={`${import.meta.env.VITE_DIRECTUS_URL}/assets/${scenario.image}`}
            alt={scenario.name}
          />
        </div>
      )}
    </div>
  );
}


