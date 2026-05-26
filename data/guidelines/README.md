# Malpractice Buster: dove inserire nuove patologie

Per aggiungere una patologia:

1. Copia `_template-patologia.json`.
2. Rinominalo con uno slug semplice, per esempio `scompenso-cardiaco.json`.
3. Compila il file.
4. Apri `index.json`.
5. Aggiungi una voce dentro `pathologies`, indicando:
   - `slug`: lo stesso slug usato nell'URL.
   - `file`: il nome del file JSON.
   - `title`: nome visibile nella lista.
   - `area`, `status`, `lastManualReview`, `tags`.

Esempio:

```json
{
  "slug": "scompenso-cardiaco",
  "file": "scompenso-cardiaco.json",
  "title": "Scompenso cardiaco",
  "area": "Cardiologia",
  "status": "Da revisionare",
  "lastManualReview": "2026-05-20",
  "tags": ["scompenso", "dispnea", "cardiologia"]
}
```

Non inserire dosaggi, indicazioni o condotte se non sono stati verificati manualmente da fonte ufficiale/protocollo locale.
