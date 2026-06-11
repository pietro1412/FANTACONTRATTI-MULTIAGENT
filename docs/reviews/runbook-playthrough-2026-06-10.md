# Runbook — Playthrough manuale completo (F0→F8)

> Giro manuale dell'utente sulla **"Lega test E2E"**, dall'inizio. Claude assiste: prepara dati,
> verifica correttezza, accelera dove serve. Tu pilota la UI; quando ti serve qualcosa, **chiedi**.
> Aggiornato: 2026-06-10.

## Stato di partenza

- **Si parte da F0**: crei una **lega NUOVA** dalla UI (creazione + inviti/richieste). Vedi sezione F0.
- Account test già registrati (admin + 7 manager) pronti per inviti/accettazioni — vedi tabella Credenziali.
- La vecchia **"Lega test E2E"** resta separata (resettata e pulita), NON è la base del playthrough.
- Pool giocatori: 589 Serie A, nessun flag uscita.
- Piloti scelti: **mix** — finestre reali sui manager chiave + bot/[TEST] per riempire.

## Ambiente

| Cosa | Dove |
|---|---|
| Client | http://localhost:5174 |
| API | http://localhost:3003 |
| DB | Docker `fantacontratti-db` :5433 (`.env.local`) |

**Credenziali** (admin = Pietro):

| Ruolo | Email | Password |
|---|---|---|
| Admin lega | pietro@test.it | Pietro2025! |
| Manager | michele@test.it · mirko@test.it · emmanuele@test.it · diego@test.it · marco@test.it · marcolino@test.it · emiliano@test.it | `<Nome>2025!` (es. `Michele2025!`) |

**Multi-finestra**: le finestre **incognito condividono i cookie** → per più manager loggati insieme usa **profili browser distinti** (Chrome profilo 1/2/…, Edge, Firefox) o browser diversi. Una finestra per manager "reale".

## Come chiedermi aiuto (cosa posso fare in qualsiasi momento)

- **Seed/compilazione dati**: "completa le rose", "seed 2 ritirati + 1 estero + 1 retrocesso prima dell'apertura", "metti budget X a Y", "crea uno scambio di esempio".
- **Accelerare**: "chiudi il Primo Mercato", "porta la lega a fine F_n".
- **Verificare**: "verifica F_n" → lancio `scripts/test-session/verify-f*.ts` e ti dico se i numeri tornano.
- **Avanzare fase**: l'avanzamento lo fai tu da admin (UI); se serve lo forzo via script.
- **Ispezionare**: "com'è lo stato?" → `inspect-e2e.ts`.

## Fasi (ordine) e cosa fare

### F0 — Setup (NUOVA LEGA da zero) ⬅️ si parte da qui
Crei una **lega nuova** dalla UI testando creazione + inviti/richieste. La "Lega test E2E" resta separata (resettata, non si tocca).

**1. Chi crea (admin)**: logga l'account che farà da admin (es. `pietro@test.it`) — chi crea la lega ne diventa ADMIN. Per testare anche la **registrazione**, registra un'email nuova e crea la lega con quella.

**2. Crea lega** (Dashboard → "Crea Lega"): nome, **pubblica/privata**, budget iniziale, n° partecipanti (**min 6**), slot ruolo (**minimi P3 D8 C8 A6** — si possono aumentare, non ridurre [oss. #1/#2]).
- **Privata** → popoli via **inviti** (invii invito → il manager apre il link/banner "Inviti Pendenti" → accetta con teamName).
- **Pubblica** → i manager fanno **richiesta di partecipazione** → l'admin **approva** dalla lega.

**3. Manager da coinvolgere**: gli account test sono già registrati e possono accettare/richiedere subito → `michele@ · mirko@ · emmanuele@ · diego@ · marco@ · marcolino@ · emiliano@` (`<Nome>2025!`). In alternativa registra email nuove (le piloti tu).

**4. Avvio lega**: raggiunto il minimo membri ACTIVE, l'admin **avvia la lega** (DRAFT → ACTIVE) → si passa a F1.

**Come ti assisto in F0**:
- Appena creata la lega, **dimmi il nome** (o l'ID): aggancio i miei script (verify/seed) al **nuovo ID lega**.
- Se non vuoi pilotare ogni finestra per inviti/accettazioni, **chiedimi** "genera inviti per i manager" / "fai accettare i manager X,Y,Z" / "approva le richieste" → lo simulo via script lato manager.
- Note già validate (così sai cosa aspettarti): accettazione invito richiede **teamName ≥2 char**; il bottone "Accetta" del banner reindirizza a InviteDetail [oss. #3 risolta]; re-invito dopo kick ok [oss. #5 risolta].

> ⚠️ I miei script in `scripts/test-session/` sono cablati sull'ID della vecchia lega E2E. Per la lega nuova li riadatto al nuovo ID quando me lo dai.

### F1 — Primo Mercato (asta libera P→D→C→A)
1. Login **Pietro** → lega → entra nella sala asta → **"Avvia Primo Mercato"** (definisce ordine turni).
2. Si nomina a turno (P prima, poi D, C, A); offerte libere; timer per asta.
3. **Mix**: tieni 2-3 finestre reali (es. Michele, Mirko, Diego) per le offerte; per gli altri usa i bottoni **[TEST] Simula Scelta/Conferma/Offerta** (admin) come bot.
4. Riempire 27 slot × 8 = 216 acquisti è lungo: gioca quante aste vuoi per il "feel", poi **chiedimi "completa le rose e chiudi il Primo Mercato"** (riempio con durate miste e chiudo).
- Contratto post-asta: salary = 10% prezzo, durata 3. Riserva 2 crediti/slot vuoto.

### F2 — Apertura Mercato Ricorrente
- Prima dell'apertura, se vuoi testare gli auto-svincoli: **chiedimi "seed 2 ritirati + 1 retrocesso + 1 estero"** (contratti durata 3).
- Admin → lega → **"Avvia Mercato Ricorrente"** → compare la **modale riepilogo apertura** (decremento durata, svincoli per scadenza, ritirati). [fix #32]
- Verifica: "verifica F2".

### F3 — Offerte Pre-Rinnovo (scambi)
- Fase iniziale del Mercato Ricorrente. Pagina **Trattative**: crea offerta (giocatori + crediti), controfferta, accetta/rifiuta. Indicatore "trattative in corso" per i non coinvolti.
- Mix: 2 finestre reali (mittente/destinatario). Real-time <1s.

### F4 — Premi (admin)
- Admin → **/prizes**: re-incremento base (default 100), categorie/premi custom, indennizzo ESTERO. Poi **Finalizza Premi** → budget accreditati.
- Nota: la pagina auto-inizializza (fix #34, niente più 500 al primo accesso).

### F5 — Contratti (ogni manager)
- Admin passa a fase CONTRATTI. Ogni manager su **/contracts**: rinnovi, spalma (durata 1), svincoli (costo `ceil(s·d/2)`; gratis esteri/retrocessi), decisioni KEEP/RELEASE usciti, poi **Consolida** (definitivo).
- Avanzamento bloccato finché non consolidano tutti.

### F6 — Rubata
- Admin → **/rubata**: conferma **ordine** (classifica inversa) → **Genera Tabellone** → ready-check → aste forzate (prezzo base = clausola+ingaggio, non rifiutabile). Preferenze su /strategie-rubata.
- Mix: finestre reali + bot dove supportati.

### F7 — Svincolati
- Admin → **/svincolati**: **"Conferma e Inizia Aste"** (ordine turni) → nomination a turno, asta con timer (reset a ogni bid), pass. Bot per nomination/bid disponibili.

### F8 — Post-asta + trasversali
- Secondo round **scambi** (OFFERTE_POST_ASTA_SVINCOLATI). Ricorsi, **Storico Movimenti** (/movements), **Finanze**, statistiche.

## Riferimenti
- Script: `scripts/test-session/` (reset, prepare, seed-exits, verify-f*, inspect)
- Registro osservazioni/storico: `docs/reviews/test-session-2026-06-07.md`
- Regole di dominio: skill `fantacontratti-domain` / `docs/bibbie/`
