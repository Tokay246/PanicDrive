# Import Pagine Gialle

Per numeri riservati, non pubblicare il dataset reale su GitHub Pages pubblico.

Flusso consigliato:

1. Mantieni i numeri reali in un file Excel interno.
2. Da Excel esporta una copia come **CSV UTF-8**.
3. Apri PanicDrive sul dispositivo autorizzato.
4. Vai in **Pagine Gialle d'Urgenza**.
5. Premi **Importa Excel/CSV**.
6. Seleziona il CSV.
7. Controlla il confronto.
8. Premi **Accetta aggiornamento** solo se le modifiche sono corrette.

PanicDrive salva i dati nel browser del dispositivo tramite memoria locale: restano consultabili offline su quel dispositivo.

## Colonne consigliate

```text
id
name
department
location
urgent
ward
clinic
secretariat
fax
email
synonyms
tags
notes
```

Sono accettati anche nomi italiani:

```text
nome
reparto
sede
urgenze
corsia
ambulatorio
segreteria
sinonimi
tag
note
```

Per `synonyms` e `tags`, separa i valori con virgola o punto e virgola.

## Nota sui file .xlsx

La versione statica attuale non legge direttamente `.xlsx` senza aggiungere una libreria locale dedicata. Per mantenere PanicDrive leggero e offline-first, il flusso sicuro ora e:

```text
Excel -> Salva come CSV UTF-8 -> Importa in PanicDrive
```

In futuro si puo aggiungere una libreria locale come SheetJS, evitando CDN esterne se l'app deve funzionare offline.

## Template

Puoi partire da:

```text
data/pagine-gialle-template.csv
```

Aprilo con Excel, sostituisci le righe dimostrative, poi salva/esporta una copia come CSV UTF-8.
