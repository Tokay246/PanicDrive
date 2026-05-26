# Esami Obiettivi: dove inserire nuovi template

Gli esami obiettivi stanno in `data/esami-obiettivi.json`.

Per aggiungerne uno:

1. Copia l'oggetto di esempio da `_template-esame-obiettivo.json`.
2. Incollalo dentro l'array `templates` di `esami-obiettivi.json`.
3. Cambia `id`, `area`, `title`, `summary`, `tags` e `phrases`.

Regole pratiche:

- `id`: minuscolo, senza spazi, per esempio `eo-neurologico`.
- `area`: categoria breve, per esempio `Neurologico`.
- `title`: titolo visibile.
- `summary`: descrizione sintetica.
- `tags`: parole che devono uscire nella ricerca.
- `phrases`: frasi rapide copiabili/riusabili.
