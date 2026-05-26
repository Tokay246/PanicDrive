# PanicDrive

Web app statica offline-first per consultazione rapida in Pronto Soccorso.

## Come provarla

Non aprire solo `index.html` con doppio click. Avvia un piccolo server locale nella cartella e poi apri `http://localhost:8080`.

Esempio:

```powershell
python -m http.server 8080
```

## Struttura

- `index.html`: ingresso dell'app.
- `assets/`: logo, icone e CSS.
- `js/`: logica app, ricerca, aggiornamenti e schede linee guida.
- `data/`: contenuti JSON locali.
- `service-worker.js`: cache offline quando l'app gira da `http` o `https`.

## Asset tuoi

Le istruzioni sono in:

- `assets/logo/README.md`
- `assets/icons/README.md`
- `assets/fonts/README.md`

## Dove inserire i contenuti

Malpractice Buster:

- crea una nuova patologia copiando `data/guidelines/_template-patologia.json`;
- salva il nuovo file dentro `data/guidelines/`;
- registra la patologia in `data/guidelines/index.json`.

Esami obiettivi:

- copia `data/_template-esame-obiettivo.json`;
- incollalo dentro l'array `templates` di `data/esami-obiettivi.json`.

Pagine Gialle:

- i dati stanno in `data/pagine-gialle.json`;
- se hai gia una formattazione dal sito, conviene adattare lo schema a quella invece di forzare il contrario.
