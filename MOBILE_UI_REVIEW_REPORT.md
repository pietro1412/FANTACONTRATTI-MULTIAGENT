# Mobile Browser UI Review Report — Fantacontratti

> Generato il: 2026-02-08
> Target: Smartphone 375px (iPhone SE/12/13/14, Samsung Galaxy S)
> Agente: Mobile UI Review Agent v1.0
> Modalita: Review Only (nessuna modifica applicata)

---

## Sommario Esecutivo

L'app Fantacontratti ha una **buona base responsive** con componenti mobile-ready (BottomSheet, haptic feedback, safe-area support). Tuttavia e' **ottimizzata per desktop** e presenta problemi critici su smartphone 375px:

- **6 pagine inutilizzabili** su mobile (tabelle 10+ colonne senza alternative)
- **Navigazione incompleta** (no bottom nav bar, profilo inaccessibile sotto 640px)
- **Nessun supporto PWA** (no manifest, no service worker, no offline)
- **Spazi eccessivi** (padding p-8/p-16 spreca fino al 17% dello schermo)
- **Interazioni desktop-only** (drag-and-drop, hover tooltip, side-by-side comparison)

### Punteggio Globale Mobile: 5.2/10

---

## Infrastruttura Mobile

| Aspetto | Stato | Dettaglio |
|---------|-------|-----------|
| Viewport meta | OK | `width=device-width, initial-scale=1.0` |
| PWA Manifest | MANCANTE | Nessun `manifest.json` |
| Service Worker | MANCANTE | Nessun supporto offline |
| Theme-color | MANCANTE | Browser chrome non integrato con tema |
| Safe-area insets | PARZIALE | Solo su bid controls sticky |
| Haptic feedback | OK | Vibration API per asta (bid, outbid, win) |
| BottomSheet | OTTIMO | Componente production-ready con drag-to-dismiss |
| Touch targets | PARZIALE | Bottoni OK (44px+), ma hamburger menu 32x32 |

---

## Analisi per Pagina (su 375px)

### Punteggio per Pagina

| Pagina | Punteggio | Problemi Critici |
|--------|-----------|------------------|
| Login/Register | 7/10 | Padding eccessivo (p-8 = 343px utili) |
| Dashboard | 6.5/10 | Layout OK ma padding px-6 spreca spazio |
| LeagueDetail | 5.5/10 | Fasi mercato non cliccabili, membri compressi |
| AuctionRoom | 6/10 | Bid controls sticky OK, ma layout selettore confuso |
| Rubata | 3/10 | Board orizzontale rotto, preferenze DnD-only |
| Svincolati | 5/10 | Timer OK, bid controls da migliorare |
| Contracts | 4/10 | Form editing impossibile su 375px |
| Trades | 3.5/10 | Confronto side-by-side non funziona |
| Rose | 4.5/10 | Tabella 11 colonne → 3 visibili |
| LeagueFinancials | 4/10 | Grafici SVG non responsive, tabella compressa |
| AllPlayers | 5/10 | Filtri da collassare, lista OK |
| Movements | 4.5/10 | Tabella 12 colonne → inutilizzabile |
| PlayerStats | 2.5/10 | 20+ colonne statistiche, radar chart compresso |
| Prophecies | 7/10 | Compact view + infinite scroll = ottimo |
| AdminPanel | 3.5/10 | 8 tab overflow, form complessi |
| ManagerDashboard | 5/10 | Card layout OK, dati finanziari compressi |
| Profile | 5.5/10 | INACCESSIBILE da nav mobile sotto 640px |
| History | 6/10 | Timeline OK, dettagli compressi |

---

## Pattern Problematici Trasversali

### 1. Nessuna Bottom Navigation Bar

**Impatto:** CRITICO — 23 pagine

L'app usa solo hamburger menu + slide-in panel. Su mobile questo richiede 2 tap per ogni navigazione (apri menu → seleziona voce). Le app mobile moderne usano una **bottom tab bar** con 4-5 voci principali per navigazione con 1 tap.

**Stato attuale:**
```
[Hamburger] ─ Logo ─ [Notifiche]
      ↓
  Slide-in menu (2 tap per navigare)
```

**Proposta:**
```
+-----------------------------------------+
|  [Contenuto pagina]                     |
+-----------------------------------------+
| [Home] [Asta] [Rosa] [Finanze] [Menu]  |
+-----------------------------------------+
```

### 2. Profilo Inaccessibile

**Impatto:** CRITICO — Tutte le pagine

Il dropdown profilo usa `hidden sm:block` — sparisce sotto 640px. Non c'e' modo di accedere al profilo, cambiare password, o fare logout su mobile.

### 3. Tabelle Inutilizzabili (8 pagine)

**Impatto:** CRITICO

Rose, Movements, LeagueFinancials, PlayerStats, AdminPanel, Contracts, ManagerDashboard usano tabelle con 10-13+ colonne. Su 375px mostrano 2-4 colonne, il resto e' `hidden lg:table-cell` senza indicazione.

### 4. Padding Eccessivo

**Impatto:** ALTO — 15+ pagine

| Pattern | Px usato | Su 375px | Spazio perso |
|---------|----------|----------|-------------|
| `px-6` | 24px x2 | 327px utili | 13% |
| `p-8` | 32px x2 | 311px utili | 17% |
| `p-16` | 64px x2 | 247px utili | 34% |

### 5. Nessun Supporto Offline/PWA

**Impatto:** ALTO

L'app non ha manifest.json ne service worker. Non puo essere:
- Installata sulla home screen
- Usata offline (nemmeno cache delle pagine visitate)
- Integrata con il tema del browser (theme-color)

### 6. Drag-and-Drop Touch-Unfriendly

**Impatto:** MEDIO — Rubata, AuctionRoom

@dnd-kit supporta touch ma:
- Nessuna alternativa keyboard/bottoni
- Nessun feedback visivo durante drag su touch
- Conflitto con scroll nativo

### 7. Hover-Only Interactions

**Impatto:** MEDIO — 10+ pagine

Tooltip, hover states su tabelle, dropdown on hover non funzionano su touch. Serve conversione a tap/long-press.

---

## Proposte Layout Mobile (375px)

### Dashboard Mobile
```
+-----------------------------------+
| [Hamburger]  Logo  [Bell] [User] |
+-----------------------------------+
|                                   |
|  Le tue Leghe (3)                |
|                                   |
|  +-----------------------------+ |
|  | Serie A Fantasy     [Admin] | |
|  | 8 membri | Fase: Contratti  | |
|  | Budget: 187/300             | |
|  | [████████░░░░] 62%         | |
|  +-----------------------------+ |
|                                   |
|  +-----------------------------+ |
|  | Champions League    [Mgr]   | |
|  | 6 membri | Fase: Rubata    | |
|  +-----------------------------+ |
|                                   |
|  [+ Crea Lega]  [Cerca Leghe]  |
|                                   |
+-----------------------------------+
| [Home] [Asta] [Rosa] [€] [Menu] |
+-----------------------------------+
```

### Asta Mobile
```
+-----------------------------------+
| Budget: 187M       Timer: 00:24  |
| [████████████░░░] "Tempo OK"     |
+-----------------------------------+
|                                   |
|    [A] Lautaro Martinez          |
|    Inter | Quot: 35M              |
|                                   |
|    Offerta attuale: 42M          |
|    di FC Mario                   |
|                                   |
+-----------------------------------+
| [- ] [  43M  ] [+ ]   [OFFRI!]  |
+-----------------------------------+
| [Home] [Asta] [Rosa] [€] [Menu] |
+-----------------------------------+
```

### Contratti Mobile (BottomSheet)
```
Tap su giocatore → apre BottomSheet:

+-----------------------------------+
| Modifica Contratto            [X] |
| ─────────────────────────────    |
|                                   |
|  [A] Lautaro Martinez            |
|  Inter | Acquistato: 42M         |
|                                   |
|  Durata:                         |
|  [1a]  [2a]  [3a*]  [4a]       |
|                                   |
|  Salario mensile:                |
|  [- ]    8.5M    [+ ]           |
|                                   |
|  Clausola rescissoria:           |
|  [- ]   15.0M    [+ ]           |
|                                   |
|  [Annulla]        [Salva]        |
+-----------------------------------+
```

---

## Componenti Mobile Esistenti (Riutilizzabili)

| Componente | File | Stato | Note |
|-----------|------|-------|------|
| BottomSheet | `src/components/ui/BottomSheet.tsx` | Ottimo | Drag-dismiss, safe-area, backdrop |
| Button | `src/components/ui/Button.tsx` | Buono | Sizes sm/md/lg/xl, touch-friendly |
| DurationSlider | `src/components/ui/DurationSlider.tsx` | Buono | Touch-friendly range input |
| NumberStepper | `src/components/ui/NumberStepper.tsx` | Buono | +/- buttons |
| Skeleton | `src/components/ui/Skeleton.tsx` | Buono | 9 varianti loading |
| PositionBadge | `src/components/ui/PositionBadge.tsx` | Ottimo | P/D/C/A con gradients |
| Haptics | `src/utils/haptics.ts` | Ottimo | Vibration API, 9 patterns |
| Navigation | `src/components/Navigation.tsx` | Da migliorare | Hamburger OK, manca bottom nav |

---

## Raccomandazioni Architetturali

### Immediato (Sprint 1-2)
1. Aggiungere **bottom navigation bar** con 5 tab
2. Rendere profilo accessibile da menu mobile
3. Ridurre padding su mobile (`px-3 sm:px-6`)
4. Aggiungere PWA manifest + theme-color
5. Convertire tabelle in card view su mobile

### Medio termine (Sprint 3-4)
6. Aggiungere service worker per cache offline
7. Layout mobile dedicato per AuctionRoom
8. BottomSheet per editing contratti
9. Swipe gestures (pull-to-refresh, swipe-to-delete)

### Lungo termine
10. Push notifications via Web Push API
11. Condivisione nativa (Web Share API)
12. Camera API per upload foto profilo

---

*Report generato tramite analisi statica del codice sorgente. Nessun file modificato.*
