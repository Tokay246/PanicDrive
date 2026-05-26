import { createSearchIndex, searchEntries } from "./search.js";
import { clearLocalOverride, compareRecords, fetchRemoteJson, normalizeYellowPagesRemote, readLocalOverride, readYellowPagesImportFile, saveDraft, writeLocalOverride } from "./sync.js";
import { renderGuideline } from "./guidelines.js";

const DATA_PATHS = {
  modules: "data/modules.json",
  exams: "data/esami-obiettivi.json",
  yellowPages: "data/pagine-gialle.json",
  guidelineIndex: "data/guidelines/index.json",
  sources: "data/sources.json"
};

const state = {
  modules: [],
  exams: {},
  yellowPages: {},
  guidelineIndex: {},
  sources: {},
  searchIndex: [],
  pendingUpdate: null
};

const view = document.querySelector("#view");
const searchInput = document.querySelector("#globalSearch");
const searchResults = document.querySelector("#searchResults");
const themeToggle = document.querySelector("#themeToggle");
const modal = document.querySelector("#updateModal");
const updateSummary = document.querySelector("#updateSummary");

const PGDU_SYNONYMS = {
  orl: ["orl", "otorino", "otorinolaringoiatria", "otorinolaringoiatrico", "orecchio", "naso", "gola"],
  otorino: ["otorino", "orl", "otorinolaringoiatria"],
  radiops: ["radiops", "radiologia ps", "radiologia pronto soccorso", "radiologia urgenza", "rx ps", "tc ps", "tac ps"],
  radiologia: ["radiologia", "rx", "tac", "tc", "ecografia", "eco", "radiodiagnostica"],
  cardio: ["cardio", "cardiologia", "cuore", "utic", "emodinamica", "stemi"],
  cardiologia: ["cardiologia", "cardio", "cuore", "utic", "emodinamica", "stemi"],
  neuro: ["neuro", "neurologia", "ictus", "stroke"],
  neurologia: ["neurologia", "neuro", "ictus", "stroke"],
  rianimazione: ["rianimazione", "rianimatore", "anestesia", "anestesista", "terapia intensiva", "ti"],
  laboratorio: ["laboratorio", "lab", "analisi", "prelievi"],
  trasfusionale: ["trasfusionale", "sangue", "emoteca", "emocomponenti"],
  ortopedia: ["ortopedia", "ortopedico", "trauma", "traumatologia"],
  chirurgia: ["chirurgia", "chirurgo", "sala operatoria", "so"]
};

boot();

async function boot() {
  restoreTheme();
  bindEvents();
  closeUpdateModal();

  try {
    await loadAllData();
    state.searchIndex = createSearchIndex(state);
    await registerServiceWorker();
    renderRoute();
  } catch (error) {
    renderStartupError(error);
  }
}

async function loadAllData() {
  const [modules, exams, yellowPages, guidelineIndex, sources] = await Promise.all([
    loadJson(DATA_PATHS.modules),
    loadJson(DATA_PATHS.exams),
    loadJson(DATA_PATHS.yellowPages, "pagine-gialle"),
    loadJson(DATA_PATHS.guidelineIndex, "guidelines"),
    loadJson(DATA_PATHS.sources)
  ]);

  state.modules = modules.modules || [];
  state.exams = exams;
  state.yellowPages = yellowPages;
  state.guidelineIndex = guidelineIndex;
  state.sources = sources;
}

async function loadJson(path, overrideKey = null) {
  const override = overrideKey ? readLocalOverride(overrideKey) : null;
  if (override) return override;

  const response = await fetch(path, { cache: "no-store" });
  if (!response.ok) throw new Error(`Dato non disponibile: ${path}`);
  return response.json();
}

function bindEvents() {
  window.addEventListener("hashchange", renderRoute);

  searchInput.addEventListener("input", () => {
    renderSearchResults(searchEntries(state.searchIndex, searchInput.value));
  });

  document.addEventListener("click", (event) => {
    if (!searchResults.contains(event.target) && event.target !== searchInput) searchResults.hidden = true;
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !modal.hidden) closeUpdateModal();
  });

  modal.addEventListener("click", (event) => {
    if (event.target === modal) closeUpdateModal();
  });

  themeToggle.addEventListener("click", () => {
    document.body.classList.toggle("dark");
    localStorage.setItem("panicdrive:theme", document.body.classList.contains("dark") ? "dark" : "light");
  });

  document.querySelector("#closeModal").addEventListener("click", closeUpdateModal);
  document.querySelector("#rejectUpdate").addEventListener("click", closeUpdateModal);
  document.querySelector("#saveDraftUpdate").addEventListener("click", () => {
    if (state.pendingUpdate) saveDraft(state.pendingUpdate.key, state.pendingUpdate.remoteData);
    closeUpdateModal();
  });
  document.querySelector("#acceptUpdate").addEventListener("click", async () => {
    if (!state.pendingUpdate) return;
    writeLocalOverride(state.pendingUpdate.key, state.pendingUpdate.remoteData);
    await loadAllData();
    state.searchIndex = createSearchIndex(state);
    closeUpdateModal();
    renderRoute();
  });
}

function restoreTheme() {
  const saved = localStorage.getItem("panicdrive:theme");
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  document.body.classList.toggle("dark", saved ? saved === "dark" : prefersDark);
}

function renderRoute() {
  const parts = location.hash.replace(/^#\/?/, "").split("/").filter(Boolean);
  const route = parts[0] || "home";

  if (route === "home") return renderHome();
  if (route === "esami-obiettivi") return renderExams();
  if (route === "pagine-gialle") return renderYellowPages();
  if (route === "malpractice" && parts[1]) return renderGuidelinePage(parts[1]);
  if (route === "malpractice") return renderMalpractice();
  return renderPlaceholder();
}

function renderHome() {
  view.innerHTML = `
    <section class="module-grid" aria-label="Moduli principali">
      ${state.modules.map((module) => `
        <a class="module-card" href="#/${module.route}" aria-label="${escapeHtml(module.title)}">
          <div>
            <span class="module-visual"><img class="module-icon" src="${escapeHtml(module.icon)}" alt=""></span>
            <h2 class="module-title">${escapeHtml(module.title)}</h2>
            <p class="muted">${escapeHtml(module.description)}</p>
          </div>
          <div class="module-meta"><span class="chip">${escapeHtml(module.status)}</span><span aria-hidden="true">&rarr;</span></div>
        </a>
      `).join("")}
    </section>
  `;
}

function renderExams() {
  view.innerHTML = `
    ${viewHeader("Esami Obiettivi", "Template modificabili e frasi rapide salvabili nei dati locali.", "")}
    <section class="list-grid">
      ${(state.exams.templates || []).map((template) => `
        <article class="template-card">
          <p class="eyebrow">${escapeHtml(template.area)}</p>
          <h2 class="module-title">${escapeHtml(template.title)}</h2>
          <p class="muted">${escapeHtml(template.summary)}</p>
          ${renderExamBlocks(template)}
        </article>
      `).join("")}
    </section>
  `;
}

function renderExamBlocks(template) {
  if (Array.isArray(template.sections) && template.sections.length) {
    return template.sections.map((section, index) => `
      <details ${section.defaultOpen === true || (index === 0 && section.defaultOpen !== false) ? "open" : ""}>
        <summary>${escapeHtml(section.title)}</summary>
        <div class="accordion-body">
          ${section.use_case ? `<p class="exam-section-meta">${escapeHtml(section.use_case)}</p>` : ""}
          ${section.text ? `<p class="exam-text">${formatInline(section.text)}</p>` : ""}
          ${section.content ? renderExamContent(section.content) : ""}
        </div>
      </details>
    `).join("");
  }

  if (Array.isArray(template.phrases) && template.phrases.length) {
    return `<details open><summary>Frasi rapide</summary><div class="accordion-body"><ul>${template.phrases.map((phrase) => `<li>${escapeHtml(phrase)}</li>`).join("")}</ul></div></details>`;
  }

  return `<p class="muted">Nessun contenuto ancora inserito.</p>`;
}

function renderExamContent(content) {
  return Object.entries(content || {})
    .map(([key, value]) => `
      <section class="exam-content-block">
        <h3>${escapeHtml(humanizeKey(key))}</h3>
        ${renderExamValue(value)}
      </section>
    `)
    .join("");
}

function renderExamValue(value) {
  if (Array.isArray(value)) {
    if (value.some((item) => item && typeof item === "object")) {
      return `<div class="maneuver-list">${value.map(renderManeuver).join("")}</div>`;
    }
    return `<ul>${value.map((item) => `<li>${formatInline(item)}</li>`).join("")}</ul>`;
  }

  if (value && typeof value === "object") {
    return renderExamContent(value);
  }

  return `<p class="exam-text">${formatInline(value)}</p>`;
}

function renderManeuver(item) {
  if (!item || typeof item !== "object") return `<p>${formatInline(item)}</p>`;
  return `
    <article class="maneuver-card">
      <h4>${escapeHtml(item.name || "Manovra")}</h4>
      ${item.how ? `<p><strong>Come:</strong> ${formatInline(item.how)}</p>` : ""}
      ${item.positive ? `<p><strong>Positiva se:</strong> ${formatInline(item.positive)}</p>` : ""}
      ${item.suggests ? `<p><strong>Suggerisce:</strong> ${formatInline(item.suggests)}</p>` : ""}
      ${item.avoidIf ? `<p><strong>Evita se:</strong> ${formatInline(item.avoidIf)}</p>` : ""}
    </article>
  `;
}

function humanizeKey(key) {
  return String(key)
    .replace(/([A-Z])/g, " $1")
    .replace(/_/g, " ")
    .replace(/^./, (char) => char.toUpperCase());
}

function formatInline(value) {
  return escapeHtml(value).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
}

function renderMalpractice() {
  view.innerHTML = `
    ${viewHeader("Malpractice Buster", "Linee guida per patologia con fonti, revisioni e storico.", `<button class="secondary-button" id="digestGuidelines" type="button">METABOLIZZA LINEE GUIDA</button><button class="primary-button" id="checkGuidelines" type="button">Controlla aggiornamenti</button><input id="guidelinePdfInput" type="file" accept="application/pdf,.pdf" hidden>`)}
    <section class="list-grid">
      ${(state.guidelineIndex.pathologies || []).map((item) => `
        <a class="guideline-card" href="#/malpractice/${item.slug}">
          <p class="eyebrow">${escapeHtml(item.area)}</p>
          <h2 class="module-title">${escapeHtml(item.title)}</h2>
          <p class="muted">${escapeHtml(item.status)} &middot; Ultima verifica: ${escapeHtml(item.lastManualReview || "non registrata")}</p>
        </a>
      `).join("")}
    </section>
  `;
  document.querySelector("#checkGuidelines").addEventListener("click", () => checkConfiguredUpdate("guidelines"));
  document.querySelector("#digestGuidelines").addEventListener("click", () => document.querySelector("#guidelinePdfInput").click());
  document.querySelector("#guidelinePdfInput").addEventListener("change", handleGuidelinePdfImport);
}

async function renderGuidelinePage(slug) {
  const item = (state.guidelineIndex.pathologies || []).find((candidate) => candidate.slug === slug);
  if (!item) return renderPlaceholder();
  const pathology = await loadJson(`data/guidelines/${item.file}`);
  view.innerHTML = `${viewHeader(pathology.title, "Scheda clinica strutturata per revisione manuale.", `<a class="secondary-button" href="#/malpractice">Indietro</a>`)}${renderGuideline(pathology)}`;
}

function renderYellowPages() {
  const categories = [...new Set((state.yellowPages.entries || []).map((contact) => contact.department).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  view.innerHTML = `
    ${viewHeader("Pagine Gialle d'Urgenza", `Versione locale: ${escapeHtml(state.yellowPages.version || "demo")}`, `<button class="primary-button" id="importYellowPages" type="button">Importa Excel/CSV</button><button class="secondary-button" id="clearYellowPages" type="button">Cancella dati locali</button><input id="yellowPagesFileInput" type="file" accept=".csv,.tsv,.txt,.json,.xlsx,.xls,text/csv,application/json" hidden>`)}
    <section class="panel yellow-toolbar" aria-label="Filtri Pagine Gialle">
      <label class="yellow-search">
        <span class="search-icon" aria-hidden="true"></span>
        <input id="yellowPagesSearch" type="search" placeholder="Cerca reparto, sinonimo, tag..." autocomplete="off">
      </label>
      <select id="yellowPagesCategory" aria-label="Filtra per categoria">
        <option value="">Tutte le categorie</option>
        ${categories.map((category) => `<option value="${escapeHtml(category)}">${escapeHtml(category)}</option>`).join("")}
      </select>
      <div class="yellow-quick" aria-label="Filtri rapidi">
        <button class="secondary-button quick-filter" type="button" data-contact-filter="urgent">Urgenze</button>
        <button class="secondary-button quick-filter" type="button" data-contact-filter="ward">Corsia</button>
        <button class="secondary-button quick-filter" type="button" data-contact-filter="clinic">Ambulatori</button>
        <button class="secondary-button quick-filter" type="button" data-contact-filter="secretariat">Segreteria</button>
        <button class="secondary-button quick-filter" type="button" data-contact-filter="">Reset</button>
      </div>
    </section>
    <section class="list-grid" id="yellowPagesList">
      ${(state.yellowPages.entries || []).map((contact) => `
        <article class="contact-card" data-category="${escapeHtml(contact.department || "")}" data-haystack="${escapeHtml(yellowPagesHaystack(contact))}">
          <p class="eyebrow">${escapeHtml(contact.department)}</p>
          <h2 class="module-title">${escapeHtml(contact.name)}</h2>
          <p class="muted">${escapeHtml(contact.location)} &middot; ${escapeHtml((contact.tags || []).join(", "))}</p>
          <div class="contact-lines">
            ${contact.urgent ? contactLine("Urgenze", contact.urgent, "urgent") : ""}
            ${contact.ward ? contactLine("Corsia", contact.ward, "ward") : ""}
            ${contact.clinic ? contactLine("Ambulatorio", contact.clinic, "clinic") : ""}
            ${contact.secretariat ? contactLine("Segreteria", contact.secretariat, "secretariat") : ""}
            ${contact.fax ? contactLine("Fax", contact.fax, "fax") : ""}
            ${contact.email ? contactLine("Email", contact.email, "email") : ""}
          </div>
          ${contact.notes ? `<p class="muted">${escapeHtml(contact.notes)}</p>` : ""}
        </article>
      `).join("")}
    </section>
  `;
  document.querySelector("#importYellowPages").addEventListener("click", () => document.querySelector("#yellowPagesFileInput").click());
  document.querySelector("#yellowPagesFileInput").addEventListener("change", handleYellowPagesFileImport);
  document.querySelector("#clearYellowPages").addEventListener("click", clearYellowPagesData);
  document.querySelector("#yellowPagesSearch").addEventListener("input", applyYellowPagesFilters);
  document.querySelector("#yellowPagesCategory").addEventListener("input", applyYellowPagesFilters);
  document.querySelectorAll("[data-contact-filter]").forEach((button) => {
    button.addEventListener("click", () => {
      document.querySelectorAll("[data-contact-filter]").forEach((item) => item.classList.remove("active"));
      button.classList.toggle("active", Boolean(button.dataset.contactFilter));
      view.dataset.yellowContactFilter = button.dataset.contactFilter || "";
      applyYellowPagesFilters();
    });
  });
  applyYellowPagesFilters();
}

function renderPlaceholder() {
  view.innerHTML = `${viewHeader("Modulo futuro", "Spazio pronto per calcolatori, farmaci, dimissioni, protocolli o manuale.", "")}<section class="panel empty-state">Aggiungi un file JSON, una voce in modules.json e una funzione di rendering dedicata.</section>`;
}

function renderStartupError(error) {
  const isFile = location.protocol === "file:";
  view.innerHTML = `
    <section class="panel clinical-warning">
      <p class="eyebrow">Avvio non completato</p>
      <h1>${isFile ? "Apri PanicDrive da un indirizzo locale" : "Dati non caricati"}</h1>
      <p class="muted">${isFile ? "Non aprire solo index.html con doppio click. Avvia un piccolo server locale nella cartella e apri http://localhost:8080." : "Controlla che data/, js/ e assets/ siano presenti."}</p>
      <p class="muted">Dettaglio: ${escapeHtml(error.message)}</p>
    </section>
  `;
}

async function checkConfiguredUpdate(kind) {
  const source = state.sources[kind];
  if (!source?.url || source.url.includes("example.")) {
    openUpdateModal({
      key: kind,
      comparison: {
        confidence: "configurazione richiesta",
        source: { label: source?.label || "Fonte non configurata", url: source?.url || "" },
        changes: [{ section: "Fonte aggiornamenti", oldValue: "Endpoint remoto non configurato.", newValue: "Inserisci in data/sources.json un URL JSON o un endpoint WordPress REST verificabile." }]
      },
      remoteData: null,
      readOnly: true
    });
    return;
  }

  try {
    const rawRemoteData = await fetchRemoteJson(source.url);
    const remoteData = kind === "pagine-gialle" ? normalizeYellowPagesRemote(rawRemoteData, source) : rawRemoteData;
    const localData = kind === "pagine-gialle" ? state.yellowPages : state.guidelineIndex;
    openUpdateModal({ key: kind, comparison: compareRecords(localData, remoteData, kind), remoteData });
  } catch (error) {
    openUpdateModal({
      key: kind,
      comparison: {
        confidence: "fonte non verificabile",
        source,
        changes: [{ section: "Errore", oldValue: "Dati locali mantenuti.", newValue: error.message }]
      },
      remoteData: null,
      readOnly: true
    });
  }
}

function openUpdateModal({ key, comparison, remoteData, readOnly = false }) {
  state.pendingUpdate = readOnly ? null : { key, remoteData };
  const source = comparison.source || {};
  updateSummary.innerHTML = `
    <section class="panel">
      <p><strong>Fonte:</strong> ${escapeHtml(source.label || source.society || "non dichiarata")}</p>
      <p><strong>URL/Riferimento:</strong> ${escapeHtml(source.url || source.reference || "non disponibile")}</p>
      <p><strong>Confidenza:</strong> ${escapeHtml(comparison.confidence)}</p>
    </section>
    <div class="diff-grid">
      ${(comparison.changes || []).map((change) => `
        <article class="diff-card">
          <h3>${escapeHtml(change.section)}</h3>
          <div class="diff-columns"><pre>${escapeHtml(change.oldValue)}</pre><pre>${escapeHtml(change.newValue)}</pre></div>
        </article>
      `).join("") || `<p class="muted">Nessuna modifica rilevata.</p>`}
    </div>
  `;
  document.querySelector("#acceptUpdate").disabled = readOnly || !remoteData;
  document.querySelector("#saveDraftUpdate").disabled = readOnly || !remoteData;
  modal.hidden = false;
  document.body.classList.add("modal-open");
}

function handleGuidelinePdfImport(event) {
  const file = event.target.files?.[0];
  event.target.value = "";
  if (!file) return;

  openUpdateModal({
    key: "guideline-pdf",
    comparison: {
      confidence: "bozza locale, revisione manuale obbligatoria",
      source: { label: "PDF caricato dall'utente", reference: file.name },
      changes: [
        {
          section: "PDF selezionato",
          oldValue: "Nessun contenuto locale modificato.",
          newValue: `${file.name} (${Math.round(file.size / 1024)} KB)`
        },
        {
          section: "Prossimo passo progettuale",
          oldValue: "Aggiornamento manuale tramite JSON.",
          newValue: "Estrarre testo con PDF.js, proporre modifiche sezione per sezione, mostrare fonti/pagine/confidenza e salvare solo come bozza finche non viene revisionata."
        },
        {
          section: "Sicurezza clinica",
          oldValue: "Nessuna validazione automatica.",
          newValue: "PanicDrive non deve sovrascrivere linee guida cliniche senza conferma esplicita e storico dell'utente."
        }
      ]
    },
    remoteData: null,
    readOnly: true
  });
}

async function handleYellowPagesFileImport(event) {
  const file = event.target.files?.[0];
  event.target.value = "";
  if (!file) return;

  try {
    const importedData = await readYellowPagesImportFile(file);
    openUpdateModal({
      key: "pagine-gialle",
      comparison: compareRecords(state.yellowPages, importedData, "pagine-gialle"),
      remoteData: importedData
    });
  } catch (error) {
    openUpdateModal({
      key: "pagine-gialle",
      comparison: {
        confidence: "import non completato",
        source: { label: `File locale: ${file.name}`, reference: "Import Excel/CSV" },
        changes: [
          {
            section: "File non importato",
            oldValue: "Dati locali mantenuti.",
            newValue: error.message
          },
          {
            section: "Formato consigliato",
            oldValue: "File Excel .xlsx",
            newValue: "Da Excel: File > Salva con nome > CSV UTF-8. Intestazioni consigliate: id, name/nome, department, location/sede, urgent/urgenze, ward/corsia, clinic/ambulatorio, secretariat/segreteria, fax, email, synonyms/sinonimi, tags/tag, notes/note."
          }
        ]
      },
      remoteData: null,
      readOnly: true
    });
  }
}

async function clearYellowPagesData() {
  if (!confirm("Vuoi rimuovere i numeri importati da questo dispositivo e tornare al dataset demo?")) return;
  clearLocalOverride("pagine-gialle");
  await loadAllData();
  state.searchIndex = createSearchIndex(state);
  renderYellowPages();
}

function applyYellowPagesFilters() {
  const query = document.querySelector("#yellowPagesSearch")?.value || "";
  const category = normalizeYellowText(document.querySelector("#yellowPagesCategory")?.value || "");
  const activeType = view.dataset.yellowContactFilter || "";
  let visibleCards = 0;

  document.querySelectorAll("#yellowPagesList .contact-card").forEach((card) => {
    let show = true;
    const haystack = card.dataset.haystack || "";
    const cardCategory = normalizeYellowText(card.dataset.category || "");

    if (query && !yellowQueryMatches(query, haystack)) show = false;
    if (category && cardCategory !== category) show = false;

    let visibleContacts = 0;
    card.querySelectorAll(".contact-line").forEach((line) => {
      const contactMatches = !activeType || line.dataset.contactType === activeType;
      line.hidden = !contactMatches;
      if (contactMatches) visibleContacts += 1;
    });

    if (activeType && visibleContacts === 0) show = false;
    card.hidden = !show;
    if (show) visibleCards += 1;
  });

  const empty = document.querySelector("#yellowPagesEmpty");
  if (empty) empty.remove();
  if (!visibleCards) {
    document.querySelector("#yellowPagesList").insertAdjacentHTML("beforeend", `<section class="panel empty-state" id="yellowPagesEmpty">Nessun contatto trovato.</section>`);
  }
}

function closeUpdateModal() {
  modal.hidden = true;
  state.pendingUpdate = null;
  document.body.classList.remove("modal-open");
}

function renderSearchResults(results) {
  if (!results.length) {
    searchResults.hidden = true;
    searchResults.innerHTML = "";
    return;
  }
  searchResults.innerHTML = results.map((result) => `
    <a class="result-item" href="${result.target}">
      <p class="result-kicker">${escapeHtml(result.type)}</p>
      <p class="result-title">${escapeHtml(result.title)}</p>
      <p class="result-desc">${escapeHtml(result.description)}</p>
    </a>
  `).join("");
  searchResults.hidden = false;
}

function viewHeader(title, subtitle, actions) {
  return `<section class="view-header"><div><h1>${escapeHtml(title)}</h1><p class="muted">${escapeHtml(subtitle)}</p></div><div class="toolbar">${actions}</div></section>`;
}

function contactLine(label, value, type) {
  return `<div class="contact-line" data-contact-type="${escapeHtml(type)}"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`;
}

function yellowPagesHaystack(contact) {
  return [
    contact.name,
    contact.department,
    contact.location,
    contact.urgent,
    contact.ward,
    contact.clinic,
    contact.secretariat,
    contact.fax,
    contact.email,
    contact.notes,
    (contact.synonyms || []).join(" "),
    (contact.tags || []).join(" ")
  ].filter(Boolean).join(" ");
}

function yellowQueryMatches(query, haystack) {
  const normalizedQuery = normalizeYellowText(query);
  if (!normalizedQuery) return true;
  if (yellowTermMatches(normalizedQuery, haystack)) return true;
  return normalizedQuery.split(/\s+/).filter(Boolean).every((term) => yellowTermMatches(term, haystack));
}

function yellowTermMatches(term, haystack) {
  const normalizedTerm = normalizeYellowText(term);
  const normalizedHaystack = normalizeYellowText(haystack);
  if (!normalizedTerm) return true;
  if (normalizedHaystack.includes(normalizedTerm)) return true;
  return (PGDU_SYNONYMS[normalizedTerm] || [normalizedTerm]).some((variant) => normalizedHaystack.includes(normalizeYellowText(variant)));
}

function normalizeYellowText(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

async function registerServiceWorker() {
  if (!("serviceWorker" in navigator) || !["http:", "https:"].includes(location.protocol)) return;
  try {
    await navigator.serviceWorker.register("./service-worker.js");
  } catch (error) {
    console.warn("Service worker non registrato", error);
  }
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
