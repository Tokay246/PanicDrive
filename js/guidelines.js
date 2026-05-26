export function renderGuideline(pathology) {
  return `
    <section class="panel clinical-warning">
      <p class="eyebrow">Sicurezza clinica</p>
      <p>${escapeHtml(pathology.safetyNotice || "Strumento di supporto: non sostituisce giudizio clinico, protocolli locali e verifica della fonte.")}</p>
      <p class="muted">Ultima verifica manuale: ${escapeHtml(pathology.lastManualReview || "non registrata")}</p>
    </section>

    <section class="panel">
      <p class="eyebrow">Fonti</p>
      <div class="toolbar">
        ${(pathology.sources || []).map((source) => `
          <span class="chip">${escapeHtml(source.society)} ${escapeHtml(source.year)} &middot; ${escapeHtml(source.label)}</span>
        `).join("")}
      </div>
    </section>

    <section class="accordion" aria-label="Scheda clinica">
      <details open>
        <summary>Definizione, fisiopatologia e contesto</summary>
        <div class="accordion-body">
          ${paragraph("Definizione", pathology.definition)}
          ${paragraph("Fisiopatologia essenziale", pathology.pathophysiology)}
          ${listBlock("Eziopatogenesi ed epidemiologia", pathology.etiologyEpidemiology)}
        </div>
      </details>
      ${(pathology.boxes || []).map((box, index) => `
        <details ${index === 0 ? "open" : ""}>
          <summary>${escapeHtml(box.title)}</summary>
          <div class="accordion-body">${renderBoxContent(box)}</div>
        </details>
      `).join("")}
    </section>

    <section class="history-section">
      <p class="eyebrow">Storico aggiornamenti</p>
      <div class="history-list">
        ${(pathology.history || []).map((item) => `
          <article class="history-item">
            <strong>${escapeHtml(item.date)}</strong>
            <p class="muted">${escapeHtml(item.source)} &middot; ${escapeHtml(item.note)}</p>
          </article>
        `).join("") || `<p class="muted">Nessuno storico registrato.</p>`}
      </div>
    </section>
  `;
}

function paragraph(title, value) {
  if (!value) return "";
  return `<h3>${escapeHtml(title)}</h3><p>${escapeHtml(value)}</p>`;
}

function listBlock(title, items = []) {
  if (!items.length) return "";
  return `<h3>${escapeHtml(title)}</h3><ul>${items.map((item) => `<li>${formatEmphasis(item)}</li>`).join("")}</ul>`;
}

function renderBoxContent(box) {
  return Object.entries(box.content || {})
    .map(([key, value]) => {
      const title = key.replace(/([A-Z])/g, " $1").replace(/^./, (char) => char.toUpperCase());
      return Array.isArray(value) ? listBlock(title, value) : paragraph(title, value);
    })
    .join("");
}

function formatEmphasis(value) {
  return escapeHtml(value).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
