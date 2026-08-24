# Verifica pre-lancio beta — lega da 8 manager (avviato 2026-08-24)

> Documento vivo. Aggiornare "Stato avanzamento" a ogni sessione, prima di compact/clear.
> Obiettivo: verificare funzionalità + prestazioni su ambiente Vercel deployato, prima di aprire la piattaforma a una lega reale di 8 manager.
> Piano di riferimento (fasi 0-7): `C:\Users\39349\.claude\plans\inherited-whistling-tulip.md` (approvato da Pietro il 2026-08-24).

---

## Stato avanzamento

**Ultimo aggiornamento: 2026-08-24 — Fasi 0-3 completate.** Prossimo passo: Fase 4 (sweep #7) o Fase 5 (playthrough con Pietro), a scelta di Pietro su cosa fare prima.

| Fase | Stato | Note |
|------|-------|------|
| 0 — Salute locale | ✅ Fatta | test:all 1765/1765, lint 0 errori (1214 warning pre-esistenti), build ok |
| 1 — Deploy preview develop | ✅ Fatta | `REVIEW_PRE_BETA` pushato + merge fast-forward in `develop` (91addae→9757e23) + push. Vercel preview READY |
| 2 — Smoke sul preview | ✅ Fatta | Vedi sezione dedicata sotto |
| 3 — Documento di sessione | ✅ Fatta | Questo file + HANDOFF.md + memoria aggiornati |
| 4 — Sweep bug aperti | 🟡 Parziale | #3 e #11 risultano già risolti dal rework; #7 e #13 verificati ma non azionati (vedi sotto) |
| 5 — Playthrough 8 fasi | ⬜ Da fare | Serve disponibilità Pietro per i test utente da browser |
| 6 — Performance | ⬜ Da fare | Script pronti, da ripuntare sul preview |
| 7 — Go/No-Go main | ⬜ Da fare | Dopo 4-6 |

---

## Deploy attivo

- **Preview URL**: `https://fantacontratti-multiagent-git-develop-pietros-projects-1747b1de.vercel.app`
- Commit deployato: `9757e23` (= HEAD di `develop` dopo il merge di `REVIEW_PRE_BETA`, 38 commit di rework grafico esteso)
- **`main`/prod NON toccato** — resta a `91addae` (13/08), com'era prima di questo ciclo
- **⚠️ Protetto da Vercel SSO** (`ssoProtection: all_except_custom_domains`): per accedervi senza essere loggati come membro del team Vercel serve un link di bypass (`get_access_to_vercel_url`, scade 23h) — va rigenerato ad ogni sessione. Se Pietro accede da browser già loggato su vercel.com con l'account del team, non serve il bypass.
- DB condiviso col prod reale (Neon) — **usare solo leghe/account di test** (`Simulazione Beta 2026-07`, `sim01..07@sim.fantacontratti.it` / `SimBeta2026!`), mai la lega "Fantacontratti Ufficiale".

---

## Smoke test (Fase 2) — esito

Eseguito via curl con cookie di bypass SSO (stesso pattern del luglio 2026):

| Check | Esito |
|-------|-------|
| Health API | 200 `{"status":"ok"}` |
| `/api/debug/timing` (deve essere rimosso in prod) | 404 ✓ |
| `/api/push/vapid-key` (route montata, non configurata) | 503 config ✓ |
| `/api/feedback` senza auth | 401 ✓ |
| Login reale `sim01@sim.fantacontratti.it` | 200 + JWT valido ✓ (dopo 1 retry, vedi finding sotto) |

### Finding: cold-start / pool di connessioni Neon
Il primo tentativo di login ha dato **500 `PrismaClientInitializationError: Timed out fetching a new connection from the connection pool` (limit 5, timeout 10s)**. Ripetendo dopo ~8s, login riuscito 2/2. Non è una regressione di questo deploy — stesso errore già presente in log dal **2026-08-15** (`get_runtime_errors`). È lo stesso limite del piano Free Neon già documentato a luglio (`connection pool timeout`). Da monitorare in Fase 6 (performance) con carico simultaneo reale: se 8 manager fanno login nello stesso istante su un'istanza fredda, il rischio di 500 transitorio è concreto — valutare retry lato frontend o warm-up prima dell'apertura della lega.

---

## Triage 13 bug audit strutturato (2026-08-21)

Fonte: `docs/reviews/audit-2026-08-21-sintesi.md`. Verificato leggendo i commit di `REVIEW_PRE_BETA` successivi all'audit + grep sul codice attuale.

| # | Bug | Stato | Come verificato |
|---|-----|-------|------------------|
| 1 | Rules.tsx moltiplicatore clausola ×4 invece di ×3 | ✅ FIXATO | commit `8cd4d92` |
| 2 | Ordine turni Svincolati non precompilato come inverso Rubata | ✅ FIXATO | commit `01c9e59` |
| 3 | ~100 chiamate `can-prophecy` in parallelo su Movimenti | ✅ FIXATO (di fatto) | `Movements.tsx` rimosso (commit `9aef658`, redirect a History); `History.tsx` non chiama più `can-prophecy` (grep: 0 risultati nei componenti, solo la funzione in `api.ts` rimasta inutilizzata) |
| 4 | Pagina Movements duplicata rispetto a History | ✅ FIXATO | commit `9aef658` |
| 5 | PlayerStatsModal non mostra ingaggio/durata/clausola/rubata in evidenza | ✅ FIXATO | commit `a4aba65` |
| 6 | Overflow-x desktop 1300-1440px su Aste live | ✅ FIXATO | commit `81df1ec` |
| 7 | Sessione con `currentPhase` anomalo manda in contraddizione AdminPanel (bottone morto) | 🟡 APERTO, bassa priorità | Dato di test, non regola di gioco. Non risulta un fix esplicito in `MarketPhaseManager.tsx`. Non bloccante per beta cerchia ristretta (serve solo un dato di seed anomalo per manifestarsi) |
| 8 | Ready-check pesante su ogni nomina Primo Mercato | ✅ FIXATO | commit `418e22f` |
| 9 | Race su click rapido doppia nomina | ✅ FIXATO | commit `02f1989` |
| 10 | Registrazione senza schermo di conferma | ✅ FIXATO | commit `8cd4d92` |
| 11 | Preferenze notifiche Profile senza toast | ✅ FIXATO | `NotificationPreferences.tsx` ora usa `useToast()` (`toast.success`/`toast.error`), confermato via grep |
| 12 | Messaggio rosa vuota fuorviante fuori dal Primo Mercato | ✅ FIXATO | commit `8cd4d92` |
| 13 | Controlli test admin senza gate d'ambiente | 🟡 APERTO per scelta esplicita | Decisione Pietro (luglio 2026, vedi memoria `programma-beta-lancio`): FAB test attivo per ogni admin lega anche in prod (`VITE_TEST_CONTROLS=true`), rischio equità accettato. Non bloccante per beta cerchia ristretta |

**Risultato: 11 su 13 bug già chiusi.** Restano solo #7 (edge case da dato anomalo, bassa priorità) e #13 (non è un bug, è una scelta di prodotto già presa).

Non ancora verificati in questo giro (dai pattern di ridondanza, non dai 13 bug — priorità più bassa, tracciata separatamente in HANDOFF.md §6 "Semplificazione UI/IA"): le 8 duplicazioni strutturali (mappa fase→etichetta, budget ripetuto, QuickAccessTiles, ContractModifier vs renewal-logic, ecc.).

---

## Performance — baseline da riprendere (Fase 6)

Baseline luglio 2026 (pre-rework, hardening only), da rieseguire sul preview attuale:
- Asta Primo Mercato: bid burst avg 272ms / p95 1580ms / max 1582ms, 0 errori
- Rubata: bid burst avg 245ms / p95 362ms / max 1358ms, 0 errori
- Svincolati: bid burst avg 146ms / p95 187ms / max 844ms, 0 errori
- Cold-start: ~1.9s freddo / 473ms caldo

Script: `scripts/_stress-test.mjs` (asta), `scripts/_stress-test-rs.mjs` (rubata+svincolati) — da ripuntare su `E2E_BASE_URL` = preview URL corrente, verificando che gestiscano il bypass SSO (cookie di share) prima del lancio.

---

## Playthrough end-to-end 8 fasi (Fase 5) — runbook

Da eseguire con Pietro sul preview (serve login Vercel team o link di bypass rigenerato). Lega di riferimento: **Simulazione Beta 2026-07** (`cmrhiriba0008x3t07twekh9d`) o una nuova lega di scratch se si preferisce non riusare quella di luglio.

Checklist (da compilare durante il playthrough):

| Fase di gioco | Chi testa | Esito | Bug collegati |
|---|---|---|---|
| Registrazione/Login/Invito lega | Pietro (browser) | ⬜ | |
| Primo Mercato (asta live, timer reale) | Pietro (browser) + Claude (script per riempire velocemente se serve) | ⬜ | |
| Contratti (rinnovi, consolidamento) | Pietro (browser) | ⬜ | |
| Rubata | Pietro (browser) | ⬜ | |
| Svincolati | Pietro (browser) | ⬜ | |
| Scambi (offerta/controfferta tra manager) | Pietro (browser, 2 account) | ⬜ | |
| Premi/indennizzi | Pietro (browser) | ⬜ | Nessuna lega di test l'ha mai attraversata dal vivo (gap noto da cluster 3 audit) |
| Storico/Statistiche/Rose | Pietro (browser) | ⬜ | |

Ogni bug trovato durante il playthrough va aggiunto qui sotto, non solo detto in chat.

## Log nuovi findings (da questo ciclo)

| # | Finding | Severità | Dove |
|---|---------|----------|------|
| 1 | Cold-start: pool connessioni Neon (limit 5) può dare 500 transitorio su login/richieste concorrenti dopo inattività | Media — da confermare sotto carico reale in Fase 6 | Backend, tutte le route che usano Prisma |

---

## Prossimi passi

1. Decidere con Pietro se procedere prima con Fase 4 (chiudere #7, opzionale) o Fase 5 (playthrough live) o Fase 6 (performance).
2. Per Fase 5: Pietro logga sul preview (via team Vercel o link di bypass da rigenerare) e segue la checklist sopra.
3. Per Fase 6: adattare gli script stress-test al preview e gestire il bypass SSO nelle richieste HTTP dello script.
4. A valle di 4-6: Fase 7, proporre `npm run deploy:main` (azione da confermare esplicitamente).
