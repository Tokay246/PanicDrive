export function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export function createSearchIndex({ modules = [], yellowPages = {}, guidelineIndex = {}, exams = {} }) {
  const entries = [];

  for (const module of modules) {
    entries.push({
      type: "Modulo",
      title: module.title,
      description: module.description,
      target: `#/${module.route}`,
      haystack: [module.title, module.description, module.keywords?.join(" ")]
    });
  }

  for (const contact of yellowPages.entries || []) {
    entries.push({
      type: "Pagine Gialle",
      title: contact.name,
      description: [contact.department, contact.location, contact.tags?.join(", ")].filter(Boolean).join(" - "),
      target: "#/pagine-gialle",
      haystack: [contact.name, contact.department, contact.location, contact.synonyms?.join(" "), contact.tags?.join(" ")]
    });
  }

  for (const guideline of guidelineIndex.pathologies || []) {
    entries.push({
      type: "Malpractice Buster",
      title: guideline.title,
      description: [guideline.area, guideline.status].filter(Boolean).join(" - "),
      target: `#/malpractice/${guideline.slug}`,
      haystack: [guideline.title, guideline.area, guideline.tags?.join(" ")]
    });
  }

  for (const exam of exams.templates || []) {
    entries.push({
      type: "Esami Obiettivi",
      title: exam.title,
      description: exam.summary,
      target: "#/esami-obiettivi",
      haystack: [
        exam.title,
        exam.summary,
        exam.tags?.join(" "),
        exam.phrases?.join(" "),
        exam.sections?.map((section) => [section.title, section.use_case, section.text, flattenText(section.content)].filter(Boolean).join(" ")).join(" ")
      ]
    });
  }

  return entries.map((entry) => ({
    ...entry,
    normalized: normalizeText(entry.haystack.filter(Boolean).join(" "))
  }));
}

function flattenText(value) {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map(flattenText).join(" ");
  if (typeof value === "object") return Object.values(value).map(flattenText).join(" ");
  return String(value);
}

export function searchEntries(index, query, limit = 8) {
  const normalizedQuery = normalizeText(query).trim();
  if (!normalizedQuery) return [];

  const tokens = normalizedQuery.split(/\s+/).filter(Boolean);
  return index
    .map((entry) => ({
      entry,
      score: tokens.reduce((total, token) => total + (entry.normalized.includes(token) ? 1 : 0), 0)
    }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.entry.title.localeCompare(b.entry.title))
    .slice(0, limit)
    .map((item) => item.entry);
}
