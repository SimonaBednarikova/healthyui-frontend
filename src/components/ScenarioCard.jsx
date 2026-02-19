export default function ScenarioCard({
  scenario,
  index,
  status,
  showDescription = false,
}) {
  function formatDescription(text) {
  if (!text) return null;

  const marker = "Tvoja úloha";

  if (!text.includes(marker)) {
    return <p className="scenario-description">{text}</p>;
  }

  const [before, afterRaw] = text.split(marker);

  const after = afterRaw
    ?.replace(/^[:\-\s]*/, "") // odstráni prípadnú dvojbodku, pomlčku, medzery
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

        <p className="module-description-detail">
          {scenario.age}, {scenario.role}
        </p>
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

      {/* IMAGE */}
      {scenario.image && (
        <div className="card-image">
          <img
            src={`http://localhost:8055/assets/${scenario.image}`}
            alt={scenario.name}
          />
        </div>
      )}
    </div>
  );
}
