# PROJECT-STATUS — FantaContratti Dynasty Platform

> Documento di stato consolidato e roadmap. Source of truth operativa per "dove siamo e cosa manca".
> Generato: 2026-06-05 — verificato su branch `feature/1.x-gap-analysis`.
> Affianca `docs/SESSION-CONTEXT.md` (storico decisioni, fermo a 2026-02-06).
>
> **Aggiornamento 2026-06-06:** Sprint A e Sprint B (feature di gioco) COMPLETATI e verdi. I gap "C1–C4" descritti sotto sono risolti o erano dead code — lo stato corrente è in `docs/COMPLETAMENTO-BACKLOG.md`. Rinviati a round dedicati post-merge: **formula indennizzo ESTERO** (in attesa input) e **Polish UX web**.

---

## 1. Salute tecnica (verificata oggi)

| Check | Esito | Note |
|-------|-------|------|
| `npm install` | ✅ OK | dipendenze ripristinate (mancavano) |
| `npx tsc --noEmit` | ✅ 0 errori | typecheck pulito su tutto il progetto |
| `npm run test:all` | ✅ 2249/2249 verdi | 115 file di test, ~81s |
| Build | non eseguita | (typecheck pulito ⇒ atteso OK) |

**Conclusione**: il **core web è tecnicamente sano**. I report di review presenti nel repo (UX/mobile) misurano *qualità d'esperienza e completezza mobile*, non correttezza: non vanno confusi con bug bloccanti.

---

## 2. Stato repository & branch

### Working tree (dopo pulizia 2026-06-05)
Pulizia già eseguita:
- ❌ Eliminati ~24 MB di dump rigenerabili (`eslint-*.json/txt`, `ts-errors.txt`, file spurio `nul`).
- 📁 Report e mockup archiviati in **`docs/reviews/`** (PLATFORM_REVIEW, NATIVE_APP_*, UI_UX_*, UX_AUDIT, COMBINED_UI_MOBILE_PROMPT, *_MOCKUPS.html).
- 🔒 `.gitignore` aggiornato: artefatti lint, `screenshots/`, `.vercel/`, lock Claude, xlsx storico.

Restano nel working tree (decisioni aperte, §5):
- `D docs/bibbie/BIBBIA-CONTRATTI.md` + `M docs/bibbie/GIOCATORI.md` → modifiche di **regolamento** non committate.
- Untracked legittimi: `scripts/migration/`, `scripts/analyze-historical-data.ts`, `scripts/capture-screenshots.ts`, `docs/guides/QUOTAZIONI-UPDATE.md`.

### Branch
- **`feature/1.x-gap-analysis`** (corrente): 18 commit avanti `develop`, 0 indietro. Contiene logging strutturato, `ErrorBoundary`, `PreMarketOverview`, refactor fase indennizzi. **Non mergiato.**
- ⚠️ **`main` è 8 commit AVANTI `develop`** (`develop` interamente contenuto in `main`). Inverte il modello dichiarato (`develop` = staging davanti a `main`). Da sanare: riallineare `develop` a `main` prima di aprire nuove PR.
- ✅ **9 branch locali già mergiati in `develop`**, eliminabili: `feature/1.x-combined-sprint-{1..5}`, `feature/1.x-player-stats-ui-review`, `feature/1.x-ux-overhaul`, `fix/sprint-1-formule-critiche`, `test/e2e-session`.
- Non mergiati (valutare): `MOBILE-ANDROID` (app nativa), `blissful-hodgkin` (nome sospetto/auto-generato), `feature/1.x-logging-monitor`, `feature/1.x-remaining-refactors`, `feature/1.x-rubata-redesign`.

---

## 3. Cosa manca nel CORE (codice incompleto verificato)

| # | Area | File | Cosa manca | Stima |
|---|------|------|-----------|-------|
| C1 | Trade | `src/services/trade.service.ts:234,337,443` | Auto-scadenza offerte: codice Prisma commentato ("uncomment after prisma generate"). Da sbloccare + rigenerare client + test. | ~30 min |
| C2 | Rubata | `src/modules/rubata/infrastructure/api/rubata.routes.ts:164` | Endpoint `DELETE board/:entryId` ritorna **501**. Manca `RemoveFromBoardUseCase`. | ~1.5–2 h |
| C3 | Svincolati | `src/modules/svincolati/.../get-svincolati-state.use-case.ts:174` | `activeAuction` hardcoded a `null`: manca integrazione stato asta. | ~1–2 h |
| C4 | Feature mancanti | `docs/GAP-ANALYSIS-REPORT.md` | **Sprint 5 (M-1…M-15)** mai realizzato. Da triare: quante sono ancora rilevanti. | da definire |

Nessun blocco critico al deploy, ma C1–C3 vanno chiusi prima di un release "feature-complete".

---

## 4. Backlog QUALITÀ / UX / MOBILE (separato dal core)

Sintesi dai report in `docs/reviews/`. È **miglioramento**, non correttezza.

- **UX web** (score 3.5/5): debounce/conferma sulle aste, contrasto WCAG AA (`text-gray-500/600` sotto soglia), `prefers-reduced-motion`.
- **Componenti duplicati**: `POSITION_COLORS` definito ×11, `alert()/confirm()` nativi ×23 → centralizzare in `ConfirmDialog`/`ToastProvider`.
- **Mobile-web responsive**: layout rotti a 375px (Roster, Svincolati, Rose, Dashboard), `grid-cols-4` senza breakpoint, drag&drop HTML5 non-touch (→ @dnd-kit).
- **App nativa** (`MOBILE-ANDROID`, score 4.5/10): API URL hardcoded, tema non allineato, 14/24 schermate stub o assenti, no error boundary/offline/biometric. Scope di settimane.

---

## 5. Decisioni pendenti (servono da te)

1. **Regolamento bibbie**: committare o scartare?
   - `BIBBIA-CONTRATTI.md` eliminata (sostituita da `CONTRATTI.md`?).
   - `GIOCATORI.md`: nuova regola — esteri/retrocessi ora con scelta **KEEP/RELEASE in Fase 3 Rinnovi** (prima: rilascio obbligatorio). **Cambio di regola di gioco**: se confermato, il codice fase rinnovi/indennizzi va allineato.
2. **Scope di "concludere"** (vedi §6): core-beta / core+UX / tutto-mobile.
3. **Igiene branch**: ok eliminare i 9 branch mergiati e riallineare `develop` ← `main`?
4. **Script untracked**: committare `scripts/migration/` e gli script di analisi/screenshot, o restano locali?

---

## 6. Roadmap proposta (a fasi)

### Fase 0 — Igiene (½ giornata)
Riallineare `develop` ← `main`; eliminare 9 branch mergiati; decidere bibbie e script untracked; mergiare/PR `feature/1.x-gap-analysis`.

### Fase 1 — Chiudere il core (1–2 giorni)
C1 (trade auto-scadenza) → C2 (rubata RemoveFromBoard) → C3 (svincolati activeAuction) → triage Sprint 5 (M-1…M-15): chiudere quelle ancora rilevanti, archiviare il resto. **Esito: web feature-complete per beta.**

### Fase 2 — Polish UX web (1–2 settimane, opzionale per beta)
Quick wins aste + WCAG + centralizzazione componenti (ConfirmDialog/Toast/POSITION_COLORS) + responsive 375px.

### Fase 3 — App nativa mobile (settimane)
Sprint N1 foundation (API/tema/error boundary) → completamento schermate. Da affrontare solo se il mobile nativo è un obiettivo reale.

---

## 7. Riferimenti
- `docs/SESSION-CONTEXT.md` — storico decisioni finanziarie e sprint 1-4.
- `docs/GAP-ANALYSIS-REPORT.md` — bug e feature mancanti (M-1…M-15).
- `docs/reviews/` — report UX/mobile e mockup.
- `docs/bibbie/` — regolamento di dominio.
