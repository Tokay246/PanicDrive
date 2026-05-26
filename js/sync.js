const STORAGE_PREFIX = "panicdrive:";

export function readLocalOverride(key) {
  const raw = localStorage.getItem(`${STORAGE_PREFIX}${key}`);
  return raw ? JSON.parse(raw) : null;
}

export function writeLocalOverride(key, value) {
  localStorage.setItem(`${STORAGE_PREFIX}${key}`, JSON.stringify(value));
}

export function clearLocalOverride(key) {
  localStorage.removeItem(`${STORAGE_PREFIX}${key}`);
}

export function saveDraft(key, draft) {
  const drafts = JSON.parse(localStorage.getItem(`${STORAGE_PREFIX}drafts`) || "[]");
  drafts.unshift({ key, savedAt: new Date().toISOString(), draft });
  localStorage.setItem(`${STORAGE_PREFIX}drafts`, JSON.stringify(drafts.slice(0, 30)));
}

export function compareRecords(localData, remoteData, sectionLabel = "dataset") {
  if (sectionLabel === "pagine-gialle") return compareYellowPages(localData, remoteData);

  const localText = JSON.stringify(localData, null, 2);
  const remoteText = JSON.stringify(remoteData, null, 2);
  if (localText === remoteText) {
    return { hasChanges: false, changes: [], source: remoteData?.source || null, confidence: "nessuna modifica" };
  }

  const keys = new Set([...Object.keys(localData || {}), ...Object.keys(remoteData || {})]);
  const changes = [];
  for (const key of keys) {
    const oldValue = JSON.stringify(localData?.[key], null, 2);
    const newValue = JSON.stringify(remoteData?.[key], null, 2);
    if (oldValue !== newValue) {
      changes.push({ section: `${sectionLabel}.${key}`, oldValue: oldValue || "(vuoto)", newValue: newValue || "(vuoto)" });
    }
  }

  return {
    hasChanges: true,
    changes,
    source: remoteData?.source || remoteData?.sources?.[0] || null,
    confidence: remoteData?.confidence || "da revisione manuale"
  };
}

export async function fetchRemoteJson(url) {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) throw new Error(`Fonte non raggiungibile: ${response.status}`);
  return response.json();
}

export async function readYellowPagesImportFile(file) {
  const extension = file.name.split(".").pop()?.toLowerCase();

  if (extension === "xlsx" || extension === "xls") {
    throw new Error("Questo browser statico non legge ancora file .xlsx direttamente. Apri il file con Excel e salva/esporta come CSV UTF-8, poi importalo qui.");
  }

  const text = await file.text();
  if (extension === "json") {
    return normalizeYellowPagesRemote(JSON.parse(text), {
      label: `File locale: ${file.name}`,
      url: ""
    });
  }

  if (extension === "csv" || extension === "tsv" || extension === "txt") {
    const rows = parseDelimitedRows(text, extension === "tsv" ? "\t" : detectDelimiter(text));
    return normalizeYellowPagesRemote({
      version: new Date().toISOString().slice(0, 10),
      updatedAt: new Date().toISOString().slice(0, 10),
      source: {
        label: `File locale: ${file.name}`,
        url: "",
        note: "Import locale da file esportato da Excel."
      },
      entries: rows
    });
  }

  throw new Error("Formato non riconosciuto. Usa CSV UTF-8, TSV o JSON PanicDrive.");
}

export function normalizeYellowPagesRemote(remoteData, sourceConfig = {}) {
  const data = remoteData?.data && typeof remoteData.data === "object" ? remoteData.data : remoteData;
  const rawEntries = Array.isArray(data) ? data : data?.entries || data?.items || data?.contacts;

  if (!Array.isArray(rawEntries)) {
    throw new Error("La fonte PSMUO non contiene una lista di contatti leggibile.");
  }

  const entries = rawEntries.map(normalizeContact).filter((entry) => entry.name);
  if (!entries.length) {
    throw new Error("La fonte PSMUO e raggiungibile ma non contiene contatti validi.");
  }

  return {
    version: String(data?.version || data?.updatedAt || data?.modified || new Date().toISOString().slice(0, 10)),
    updatedAt: String(data?.updatedAt || data?.modified || new Date().toISOString().slice(0, 10)),
    source: {
      label: data?.source?.label || sourceConfig.label || "PSMUO Pisa",
      url: data?.source?.url || sourceConfig.url || "",
      note: data?.source?.note || sourceConfig.notes || "Dati importati da fonte WordPress/PSMUO."
    },
    entries
  };
}

function compareYellowPages(localData = {}, remoteData = {}) {
  const changes = [];
  const localEntries = new Map((localData.entries || []).map((entry) => [entry.id, entry]));
  const remoteEntries = new Map((remoteData.entries || []).map((entry) => [entry.id, entry]));

  if (localData.version !== remoteData.version || localData.updatedAt !== remoteData.updatedAt) {
    changes.push({
      section: "Versione dataset",
      oldValue: formatMeta(localData),
      newValue: formatMeta(remoteData)
    });
  }

  for (const [id, remoteEntry] of remoteEntries) {
    const localEntry = localEntries.get(id);
    if (!localEntry) {
      changes.push({
        section: `Nuovo contatto: ${remoteEntry.name}`,
        oldValue: "(assente)",
        newValue: formatContact(remoteEntry)
      });
      continue;
    }

    const oldValue = formatContact(localEntry);
    const newValue = formatContact(remoteEntry);
    if (oldValue !== newValue) {
      changes.push({
        section: `Contatto modificato: ${remoteEntry.name}`,
        oldValue,
        newValue
      });
    }
  }

  for (const [id, localEntry] of localEntries) {
    if (!remoteEntries.has(id)) {
      changes.push({
        section: `Contatto rimosso: ${localEntry.name}`,
        oldValue: formatContact(localEntry),
        newValue: "(non presente nella fonte PSMUO)"
      });
    }
  }

  return {
    hasChanges: changes.length > 0,
    changes,
    source: remoteData.source || null,
    confidence: changes.length ? "da confermare manualmente" : "nessuna modifica"
  };
}

function normalizeContact(item) {
  const acf = item?.acf || {};
  const meta = item?.meta || {};
  const title = typeof item?.title === "object" ? item.title.rendered : item?.title;
  const name = pick(item.name, item.nome, item.reparto, item.departmentName, acf.name, acf.nome, acf.reparto, meta.name, title);
  const id = pick(item.id, item.slug, item.code, item.codice, acf.id, acf.slug, meta.id) || slugify(name);

  return {
    id: slugify(id),
    name: clean(name),
    department: clean(pick(item.department, item.dipartimento, item.reparto, item.area, acf.department, acf.dipartimento, acf.reparto, acf.area, "")),
    location: clean(pick(item.location, item.sede, item.corsia, item.piano, item.ubicazione, acf.location, acf.sede, acf.corsia, acf.ubicazione, "")),
    urgent: clean(pick(item.urgent, item.urgenze, item.urgenza, item.telefono_urgenze, item.numero_urgenze, acf.urgent, acf.urgenze, acf.numero_urgenze, "")),
    ward: clean(pick(item.ward, item.corsiaTelefono, item.corsia_telefono, item.telefono_corsia, item.corsia_numero, acf.ward, acf.telefono_corsia, acf.corsia_numero, "")),
    clinic: clean(pick(item.clinic, item.ambulatorio, item.telefono_ambulatorio, item.ambulatori, acf.clinic, acf.ambulatorio, acf.ambulatori, "")),
    secretariat: clean(pick(item.secretariat, item.segreteria, item.telefono_segreteria, item.segretaria, acf.secretariat, acf.segreteria, acf.segretaria, "")),
    fax: clean(pick(item.fax, acf.fax, "")),
    email: clean(pick(item.email, acf.email, "")),
    synonyms: normalizeList(pick(item.synonyms, item.sinonimi, acf.synonyms, acf.sinonimi, [])),
    tags: normalizeList(pick(item.tags, item.tag, acf.tags, acf.tag, [])),
    notes: clean(pick(item.notes, item.note, item.info, acf.notes, acf.note, acf.info, ""))
  };
}

function formatMeta(data) {
  return [
    `versione: ${data?.version || ""}`,
    `aggiornato: ${data?.updatedAt || ""}`,
    `fonte: ${data?.source?.label || ""}`
  ].join("\n");
}

function formatContact(entry) {
  return [
    `nome: ${entry.name || ""}`,
    `reparto: ${entry.department || ""}`,
    `sede: ${entry.location || ""}`,
    `urgenze: ${entry.urgent || ""}`,
    `corsia: ${entry.ward || ""}`,
    `ambulatorio: ${entry.clinic || ""}`,
    `segreteria: ${entry.secretariat || ""}`,
    `fax: ${entry.fax || ""}`,
    `email: ${entry.email || ""}`,
    `sinonimi: ${(entry.synonyms || []).join(", ")}`,
    `tag: ${(entry.tags || []).join(", ")}`,
    `note: ${entry.notes || ""}`
  ].join("\n");
}

function pick(...values) {
  return values.find((value) => value !== undefined && value !== null && value !== "");
}

function clean(value) {
  return String(value ?? "").replace(/<[^>]*>/g, "").trim();
}

function normalizeList(value) {
  if (Array.isArray(value)) return value.map(clean).filter(Boolean);
  if (typeof value === "string") return value.split(/[,;|]/).map(clean).filter(Boolean);
  return [];
}

function slugify(value) {
  return clean(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function detectDelimiter(text) {
  const firstLine = text.split(/\r?\n/).find((line) => line.trim()) || "";
  const semicolons = (firstLine.match(/;/g) || []).length;
  const commas = (firstLine.match(/,/g) || []).length;
  const tabs = (firstLine.match(/\t/g) || []).length;
  if (tabs >= semicolons && tabs >= commas) return "\t";
  return semicolons >= commas ? ";" : ",";
}

function parseDelimitedRows(text, delimiter) {
  const matrix = parseDelimitedMatrix(text, delimiter).filter((row) => row.some((cell) => clean(cell)));
  if (matrix.length < 2) throw new Error("Il file non contiene righe sufficienti: serve una riga intestazione e almeno un contatto.");

  const headers = matrix[0].map((header) => normalizeHeader(header));
  return matrix.slice(1).map((row) => {
    const record = {};
    headers.forEach((header, index) => {
      if (header) record[header] = row[index] ?? "";
    });
    return record;
  });
}

function parseDelimitedMatrix(text, delimiter) {
  const rows = [];
  let row = [];
  let cell = "";
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (char === "\"" && inQuotes && next === "\"") {
      cell += "\"";
      index += 1;
      continue;
    }

    if (char === "\"") {
      inQuotes = !inQuotes;
      continue;
    }

    if (!inQuotes && char === delimiter) {
      row.push(cell);
      cell = "";
      continue;
    }

    if (!inQuotes && (char === "\n" || char === "\r")) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
      continue;
    }

    cell += char;
  }

  row.push(cell);
  rows.push(row);
  return rows;
}

function normalizeHeader(value) {
  const header = clean(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

  const aliases = {
    codice: "id",
    reparto: "name",
    nome: "name",
    servizio: "name",
    dipartimento: "department",
    area: "department",
    sede: "location",
    ubicazione: "location",
    piano: "location",
    urgenza: "urgent",
    urgenze: "urgent",
    numero_urgenze: "urgent",
    telefono_urgenze: "urgent",
    corsia: "ward",
    telefono_corsia: "ward",
    ambulatorio: "clinic",
    ambulatori: "clinic",
    telefono_ambulatorio: "clinic",
    segreteria: "secretariat",
    segretaria: "secretariat",
    telefono_segreteria: "secretariat",
    sinonimi: "synonyms",
    parole_chiave: "tags",
    tag: "tags",
    info: "notes",
    note: "notes"
  };

  return aliases[header] || header;
}
