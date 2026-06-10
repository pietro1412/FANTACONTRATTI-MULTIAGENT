# Procedura Aggiornamento Quotazioni

> Guida operativa per Claude Code cowork. Eseguire step-by-step.

## Variabili Ambiente Richieste (nel .env del PC locale)

```
FANTACALCIO_USER=<username fantacalcio.it>
FANTACALCIO_PASSWORD=<password fantacalcio.it>
PLATFORM_URL=https://fantacontratti-multiagent.vercel.app
PLATFORM_ADMIN_EMAIL=admin@fantacontratti.it
PLATFORM_ADMIN_PASSWORD=SuperAdmin2025!
NOTIFICATION_EMAIL=pietro1412@gmail.com
```

## Step 1 — Login su fantacalcio.it

Esegui login tramite il form su `https://www.fantacalcio.it/api/v1/User/login` (o endpoint equivalente).

**Metodo**: POST con `username` e `password` (form-encoded o JSON).
**Risultato atteso**: Cookie di sessione (`.AspNetCore.Cookies` o simile).
**Se fallisce**: Riprova 1 volta. Se fallisce ancora, invia email di errore e termina.

## Step 2 — Download file quotazioni

Con la sessione autenticata, scarica:
```
GET https://www.fantacalcio.it/api/v1/Excel/prices/20/1
```

**Risultato atteso**: File .xlsx (~500KB-2MB).
**Salva in**: `data/quotazioni-latest.xlsx` (sovrascrivendo il precedente).
**Se fallisce**: Potrebbe essere cambiato l'URL. Prova anche `/api/v1/Excel/prices/21/1` (stagione successiva). Se fallisce, email di errore.

## Step 3 — Login sulla piattaforma FantaContratti

```
POST {PLATFORM_URL}/api/auth/login
Body: { "email": PLATFORM_ADMIN_EMAIL, "password": PLATFORM_ADMIN_PASSWORD }
```

**Risultato atteso**: `{ success: true, data: { accessToken: "..." } }`
**Se fallisce**: Email di errore e termina.

## Step 4 — Upload quotazioni

```
POST {PLATFORM_URL}/api/superadmin/quotazioni/import
Headers: Authorization: Bearer {accessToken}
Body: multipart/form-data
  - file: quotazioni-latest.xlsx
  - sheetName: "Tutti"
```

**Risultato atteso**: `{ success: true, data: { created: N, updated: M, notInList: K } }`
**Se fallisce per nome foglio**: Riprova con sheetName "Tutti - Classic", poi "Quotazioni", poi il primo foglio disponibile.

## Step 5 — Verifica giocatori da classificare

```
GET {PLATFORM_URL}/api/superadmin/players/needing-classification
Headers: Authorization: Bearer {accessToken}
```

**Se la lista e' vuota**: Procedi allo Step 7 (report finale).
**Se ci sono giocatori**: Procedi allo Step 6.

## Step 6 — Classificazione giocatori usciti

Per OGNI giocatore nella lista, determina l'exitReason:

### Regole di classificazione

Cerca online (Google) informazioni sul giocatore: "{nomeGiocatore} calciatore trasferimento 2025" o simile.

| Situazione trovata | exitReason |
|---|---|
| Si e' ritirato dal calcio professionistico | `RITIRATO` |
| Trasferito in un campionato estero (qualsiasi lega fuori Italia) | `ESTERO` |
| Trasferito in Serie B, Serie C, o serie minori italiane | `RETROCESSO` |
| Non si trovano informazioni chiare | **NON classificare** — segnala nel report per revisione manuale |

### Invio classificazioni

Per i giocatori classificati con certezza:
```
POST {PLATFORM_URL}/api/superadmin/players/classify-exits
Headers: Authorization: Bearer {accessToken}
Body: {
  "classifications": [
    { "playerId": "xxx", "exitReason": "ESTERO" },
    { "playerId": "yyy", "exitReason": "RETROCESSO" }
  ]
}
```

## Step 7 — Report finale via email

Invia email a `{NOTIFICATION_EMAIL}` con oggetto "Aggiornamento Quotazioni - {data odierna}":

```
AGGIORNAMENTO QUOTAZIONI - {DD/MM/YYYY}

DOWNLOAD: OK/FALLITO
  Fonte: fantacalcio.it
  File: {fileName} ({dimensione})

IMPORT: OK/FALLITO
  Giocatori creati: {N}
  Giocatori aggiornati: {M}
  Rimossi dalla lista: {K}
  Errori import: {eventuali errori}

CLASSIFICAZIONI:
  Totale da classificare: {X}
  Classificati automaticamente: {Y}
    - {nomeGiocatore}: {exitReason} (motivo: {spiegazione breve})
    - ...
  Da revisione manuale: {Z}
    - {nomeGiocatore}: {motivo dubbio}
    - ...

PROSSIMO AGGIORNAMENTO: {data prossimo lunedi}
```

## Note

- La procedura e' idempotente: se rieseguita, i giocatori gia' aggiornati vengono solo confermati (UPDATE, non duplicati).
- Il file scaricato viene sovrascritto ad ogni esecuzione.
- Le credenziali sono SOLO nel .env locale, MAI nel codice o nei commit.
- Se il sito fantacalcio.it cambia struttura, la procedura potrebbe fallire — il report email segnalera' l'errore.
