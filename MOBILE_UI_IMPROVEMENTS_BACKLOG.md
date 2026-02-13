# Mobile Browser UI Improvements Backlog — Fantacontratti

> Generato il: 2026-02-08
> Target: Smartphone 375px (mobile browser)
> Ordinato per priorita di impatto mobile
> Modalita: Review Only (nessuna modifica applicata)

---

## Come Leggere Questo Backlog

- Focus esclusivo su miglioramenti per **mobile browser** (375px)
- Ogni task e' auto-contenuta e implementabile indipendentemente (salvo dipendenze)
- Sforzo: XS (< 1h), S (1-3h), M (3-8h), L (1-2gg), XL (2-5gg)
- I file coinvolti sono specificati per ogni task
- Le issue GitHub usano label `2.x-mobile` + `enhancement`

---

## Priorita CRITICA

---

### MOB-001: Aggiungere Bottom Navigation Bar

- **Pagina:** Tutte (layout globale)
- **Problema:** L'utente deve fare 2 tap per navigare (hamburger → voce menu). Le app mobile usano bottom tab bar con navigazione a 1 tap. Attualmente l'unica navigazione e' il menu slide-in da hamburger.
- **Proposta:** Creare componente `<BottomNavBar>` visibile solo su mobile (<768px) con 5 tab:
  1. **Home** — Dashboard/LeagueDetail
  2. **Asta** — AuctionRoom/Rubata/Svincolati (con badge "LIVE" se attiva)
  3. **Rosa** — Rose/AllPlayers
  4. **Finanze** — LeagueFinancials/Contracts/Movements
  5. **Menu** — Apre il slide-in panel esistente (profilo, admin, settings)
- **File coinvolti:**
  - Creare: `src/components/BottomNavBar.tsx`
  - Modificare: `src/App.tsx` (aggiungere sotto `<Routes>`)
  - Modificare: `src/index.css` (safe-area padding, z-index)
  - Modificare: tutte le pagine (padding-bottom per non coprire contenuto)
- **Wireframe:**
  ```
  +-------------------------------------------+
  | Contenuto pagina                          |
  +-------------------------------------------+
  | [🏠]    [⚡]    [👥]    [💰]    [≡]     |
  | Home    Asta    Rosa   Finanze  Menu     |
  +-------------------------------------------+
       ↑ safe-area-inset-bottom
  ```
- **Criteri di accettazione:**
  - [ ] Bottom bar visibile solo su <768px
  - [ ] 5 tab con icona + label
  - [ ] Tab attivo evidenziato con primary color
  - [ ] Badge "LIVE" su tab Asta quando sessione attiva
  - [ ] Nasconde quando scroll down, mostra quando scroll up
  - [ ] safe-area-inset-bottom per notch phones
  - [ ] Tutte le pagine hanno padding-bottom sufficiente
  - [ ] z-index sopra il contenuto ma sotto modal/bottomsheet
- **Sforzo stimato:** M (3-8h)
- **Dipendenze:** Nessuna

---

### MOB-002: Rendere profilo accessibile su mobile

- **Pagina:** Navigation, Profile
- **Problema:** Il dropdown profilo usa `hidden sm:block` — sparisce sotto 640px. L'utente non puo accedere al profilo, cambiare password, o fare logout su mobile.
- **Proposta:**
  - Aggiungere voce "Profilo" nel menu slide-in mobile
  - Aggiungere voce "Logout" nel menu slide-in mobile
  - Oppure: aggiungere avatar/icona nell'header mobile accanto al bell
- **File coinvolti:**
  - Modificare: `src/components/Navigation.tsx` (menu mobile)
- **Criteri di accettazione:**
  - [ ] Profilo accessibile da menu mobile
  - [ ] Logout accessibile da menu mobile
  - [ ] Avatar/iniziale visibile nell'header mobile
- **Sforzo stimato:** S (1-3h)
- **Dipendenze:** Nessuna

---

### MOB-003: PWA Manifest + Theme Color + Install Prompt

- **Pagina:** Globale
- **Problema:** L'app non puo essere installata sulla home screen, non ha icona, e il browser chrome non si integra con il tema scuro.
- **Proposta:**
  1. Creare `public/manifest.json` con:
     - `name`: "Fantacontratti"
     - `short_name`: "FC"
     - `start_url`: "/"
     - `display`: "standalone"
     - `theme_color`: "#0a0a0b"
     - `background_color`: "#0a0a0b"
     - Icone 192x192 e 512x512
  2. Aggiungere `<meta name="theme-color" content="#0a0a0b">` in index.html
  3. Aggiungere `<link rel="manifest" href="/manifest.json">` in index.html
  4. Aggiungere `<meta name="apple-mobile-web-app-capable" content="yes">`
  5. Opzionale: banner "Installa app" per utenti ricorrenti
- **File coinvolti:**
  - Creare: `public/manifest.json`
  - Creare: `public/icons/` (icone 192 e 512)
  - Modificare: `index.html` (meta tags)
  - Opzionale: `src/components/InstallPrompt.tsx`
- **Criteri di accettazione:**
  - [ ] manifest.json valido con icone
  - [ ] Theme color integrato con browser chrome
  - [ ] App installabile su Android (banner "Aggiungi a Home")
  - [ ] App installabile su iOS (Add to Home Screen)
  - [ ] Splash screen con logo su apertura standalone
- **Sforzo stimato:** S (1-3h)
- **Dipendenze:** Nessuna

---

### MOB-004: Ridurre padding eccessivo su mobile

- **Pagina:** Tutte (15+ pagine)
- **Problema:** Padding `p-8` (32px x2 = 64px persi), `p-16` (64px x2 = 128px persi), `px-6` (24px x2 = 48px persi). Su 375px si perde dal 13% al 34% dello schermo.
- **Proposta:** Adottare pattern responsive per padding:
  ```
  PRIMA:  p-8 / px-6 / p-16
  DOPO:   p-4 sm:p-6 md:p-8 / px-3 sm:px-4 md:px-6 / p-6 sm:p-10 md:p-16
  ```
- **File coinvolti:**
  - Modificare: `src/pages/Dashboard.tsx`, `src/pages/Login.tsx`, `src/pages/Register.tsx`, `src/pages/LeagueDetail.tsx`, `src/pages/Profile.tsx`, e tutte le pagine con padding fisso alto
- **Criteri di accettazione:**
  - [ ] Nessun padding > 16px (p-4) su viewport < 640px
  - [ ] Contenuto utilizza almeno 343px su schermo 375px
  - [ ] Nessun layout shift tra breakpoints
- **Sforzo stimato:** S (1-3h)
- **Dipendenze:** Nessuna

---

### MOB-005: Card view per tabelle su mobile (Rose, Movements, Financials)

- **Pagina:** Rose, Movements, LeagueFinancials, PlayerStats, Contracts
- **Problema:** Le tabelle con 10-13+ colonne sono inutilizzabili su 375px. Attualmente `hidden lg:table-cell` nasconde colonne senza indicazione.
- **Proposta:** Su mobile (<768px), mostrare i dati come card espandibili:
  ```
  +----------------------------------+
  |  [A] Lautaro Martinez      8.5M |
  |  Inter | 3 anni | Vt: 7.2      |
  |  [v Dettagli]                   |
  +----------------------------------+
  ```
  Expand mostra: presenze, gol, assist, clausola, scadenza, etc.
- **File coinvolti:**
  - Usare: `DataTable` se disponibile (da TASK-001 web), oppure implementare pattern card locale
  - Modificare: `src/pages/Rose.tsx`, `src/pages/Movements.tsx`, `src/pages/LeagueFinancials.tsx`, `src/pages/Contracts.tsx`
- **Criteri di accettazione:**
  - [ ] Mobile: card layout con tutte le info accessibili
  - [ ] Espandi/comprimi per dettagli
  - [ ] Desktop: tabella invariata
  - [ ] Sorting funziona su card
- **Sforzo stimato:** L (1-2gg) oppure S se DataTable web e' gia disponibile
- **Dipendenze:** Opzionale TASK-001 (DataTable web)

---

### MOB-006: Layout mobile dedicato per Trades

- **Pagina:** Trades
- **Problema:** Il confronto offerta/richiesta usa layout side-by-side che non funziona su 375px. I due pannelli (giocatori offerti vs giocatori richiesti) si comprimono o sovrappongono.
- **Proposta:** Su mobile, usare layout **tab-switch** o **swipe-between**:
  ```
  +-----------------------------------+
  |  Scambio con AC Luigi             |
  |  [Offri ←]  [→ Richiedi]        |
  +-----------------------------------+
  |                                   |
  |  TAB: "Cosa Offri"              |
  |                                   |
  |  +-----------------------------+ |
  |  | [C] Barella          7.2M  | |
  |  | Inter | 2 anni             | |
  |  | [X Rimuovi]                | |
  |  +-----------------------------+ |
  |                                   |
  |  [+ Aggiungi giocatore]         |
  |                                   |
  +-----------------------------------+
  |  [Annulla]     [Proponi Scambio] |
  +-----------------------------------+
  ```
- **File coinvolti:**
  - Modificare: `src/pages/Trades.tsx`
- **Criteri di accettazione:**
  - [ ] Mobile: tab/swipe per alternare offerta/richiesta
  - [ ] Desktop: layout side-by-side invariato
  - [ ] Riepilogo visibile prima di confermare
  - [ ] Bottoni azione sticky in basso
- **Sforzo stimato:** M (3-8h)
- **Dipendenze:** Nessuna

---

## Priorita ALTA

---

### MOB-007: Touch targets minimi 44x44px ovunque

- **Pagina:** Tutte
- **Problema:** Alcuni bottoni e link hanno area touch sotto 44x44px (standard Apple/Google):
  - Hamburger menu: 32x32px
  - Icone azione in tabelle: ~24x24px
  - Badge filtro posizione: ~30x24px
  - Link in breadcrumbs: ~auto height
- **Proposta:** Audit di tutti gli elementi interattivi e aggiunta di padding per raggiungere 44x44px minimo su mobile.
- **File coinvolti:**
  - Modificare: `src/components/Navigation.tsx` (hamburger button)
  - Modificare: pagine con tabelle (icone azione)
  - Modificare: filtri posizione
- **Criteri di accettazione:**
  - [ ] Tutti i bottoni/link >= 44x44px su mobile
  - [ ] Spaziatura sufficiente tra target adiacenti (>= 8px)
  - [ ] Verificato con Chrome DevTools "Show tap targets"
- **Sforzo stimato:** M (3-8h)
- **Dipendenze:** Nessuna

---

### MOB-008: Pull-to-refresh su pagine con dati live

- **Pagina:** Dashboard, LeagueDetail, AuctionRoom, Rose, Movements, LeagueFinancials
- **Problema:** L'utente non ha modo di aggiornare i dati se non ricaricare la pagina. Su mobile browser non c'e' pull-to-refresh nativo (solo su PWA standalone).
- **Proposta:** Implementare pull-to-refresh custom con animazione:
  ```
  ↓ tira giu per aggiornare ↓
  [spinner rotante]
  Aggiornamento...
  ```
- **File coinvolti:**
  - Creare: `src/hooks/usePullToRefresh.ts`
  - Creare: `src/components/PullToRefresh.tsx`
  - Modificare: pagine con dati live
- **Criteri di accettazione:**
  - [ ] Pull-to-refresh funziona su mobile
  - [ ] Animazione fluida (60fps)
  - [ ] Soglia di attivazione: 80px
  - [ ] Feedback visivo durante il pull
  - [ ] Non interferisce con scroll normale
- **Sforzo stimato:** M (3-8h)
- **Dipendenze:** Nessuna

---

### MOB-009: Sticky action buttons su mobile

- **Pagina:** Contracts, Trades, AdminPanel, CreateLeague
- **Problema:** I bottoni di azione (Salva, Conferma, Invia) sono in fondo alla pagina. Su mobile l'utente deve scrollare fino in fondo per trovare il bottone Salva.
- **Proposta:** Su mobile, rendere i bottoni azione **sticky in basso** sopra la bottom nav bar:
  ```
  +-----------------------------------+
  | [Contenuto scrollabile]           |
  +-----------------------------------+
  | [Annulla]          [Salva ✓]     |
  +-----------------------------------+
  | [Bottom Nav Bar]                  |
  +-----------------------------------+
  ```
  Nota: Contracts ha gia un footer sticky mobile — estendere il pattern.
- **File coinvolti:**
  - Creare: `src/components/StickyActionBar.tsx`
  - Modificare: `src/pages/Contracts.tsx`, `src/pages/Trades.tsx`, `src/pages/AdminPanel.tsx`
- **Criteri di accettazione:**
  - [ ] Bottoni azione sticky in basso su mobile
  - [ ] Sopra la bottom nav bar
  - [ ] Ombra/border per distinguere dal contenuto
  - [ ] safe-area-inset-bottom rispettato
- **Sforzo stimato:** S (1-3h)
- **Dipendenze:** MOB-001 (bottom nav bar per calcolare offset)

---

### MOB-010: Hamburger menu piu grande e accessibile

- **Pagina:** Tutte (Navigation)
- **Problema:** Il bottone hamburger e' 24x24px con padding 8px = 32x32px area touch. Sotto il minimo 44px.
- **Proposta:** Aumentare a 44x44px con icona 24x24 centrata. Aggiungere `aria-label="Apri menu navigazione"`.
- **File coinvolti:**
  - Modificare: `src/components/Navigation.tsx`
- **Criteri di accettazione:**
  - [ ] Area touch >= 44x44px
  - [ ] aria-label descrittivo
  - [ ] Visivamente bilanciato nell'header
- **Sforzo stimato:** XS (< 1h)
- **Dipendenze:** Nessuna

---

### MOB-011: Collassare filtri in BottomSheet su mobile

- **Pagina:** AllPlayers, Rose, Movements, PlayerStats
- **Problema:** Le barre filtro (posizione, team, ricerca, ordinamento) occupano 80-120px in alto su 375px, riducendo lo spazio per il contenuto.
- **Proposta:** Su mobile, mostrare solo il campo ricerca + bottone "Filtri" che apre BottomSheet con tutti i filtri:
  ```
  +-----------------------------------+
  | [Cerca...]  [Filtri 🔽] [Ordina] |
  +-----------------------------------+
  ```
  BottomSheet Filtri:
  ```
  +-----------------------------------+
  | Filtri                        [X] |
  +-----------------------------------+
  | Posizione:  [P] [D] [C] [A]     |
  | Squadra:    [Tutte v]            |
  | Stato:      [Tutti v]            |
  | [Applica Filtri]                  |
  +-----------------------------------+
  ```
- **File coinvolti:**
  - Modificare: `src/pages/AllPlayers.tsx`, `src/pages/Rose.tsx`, `src/pages/Movements.tsx`, `src/pages/PlayerStats.tsx`
  - Usare: `src/components/ui/BottomSheet.tsx`
- **Criteri di accettazione:**
  - [ ] Mobile: filtri collassati in BottomSheet
  - [ ] Indicatore numero filtri attivi: "Filtri (3)"
  - [ ] Desktop: filtri inline invariati
  - [ ] Campo ricerca sempre visibile
- **Sforzo stimato:** M (3-8h)
- **Dipendenze:** Nessuna

---

### MOB-012: Swipe gesture per navigazione tra tab

- **Pagina:** AdminPanel, LeagueDetail, ManagerDashboard
- **Problema:** Le tab richiedono tap preciso. Su mobile, lo swipe orizzontale e' il pattern nativo per cambiare tab.
- **Proposta:** Aggiungere supporto swipe left/right per cambiare tab nelle pagine con tab.
- **File coinvolti:**
  - Creare: `src/hooks/useSwipeGesture.ts`
  - Modificare: `src/pages/AdminPanel.tsx`, `src/pages/LeagueDetail.tsx`
- **Criteri di accettazione:**
  - [ ] Swipe left/right cambia tab
  - [ ] Animazione slide fluida
  - [ ] Non interferisce con scroll verticale
  - [ ] Soglia swipe: 50px orizzontale
- **Sforzo stimato:** M (3-8h)
- **Dipendenze:** Nessuna

---

## Priorita MEDIA

---

### MOB-013: Service Worker per cache offline

- **Pagina:** Globale
- **Problema:** L'app non funziona offline. Se l'utente perde connessione durante un'asta, vede pagina bianca.
- **Proposta:** Implementare service worker con strategia cache-first per asset statici e network-first per API:
  - Cache: HTML shell, CSS, JS, font, icone
  - Network: API calls (con fallback "Sei offline")
  - Pagina offline dedicata con stato e retry
- **File coinvolti:**
  - Creare: `public/sw.js` o usare Workbox via Vite plugin
  - Creare: `src/pages/Offline.tsx`
  - Modificare: `index.html` (registrazione SW)
  - Modificare: `vite.config.ts` (plugin PWA)
- **Criteri di accettazione:**
  - [ ] Asset statici disponibili offline
  - [ ] Pagina offline user-friendly quando senza rete
  - [ ] Retry automatico quando torna la connessione
  - [ ] Cache aggiornata ad ogni visita online
- **Sforzo stimato:** L (1-2gg)
- **Dipendenze:** MOB-003 (PWA manifest)

---

### MOB-014: Ottimizzare input per mobile keyboard

- **Pagina:** Login, Register, Contracts, Trades, AdminPanel
- **Problema:** I campi numerici (salario, prezzo, budget) non aprono il tastierino numerico. I campi email non mostrano `@` nella keyboard.
- **Proposta:**
  - Aggiungere `inputMode="numeric"` ai campi numerici
  - Aggiungere `inputMode="email"` ai campi email
  - Aggiungere `inputMode="tel"` ai campi telefono
  - Aggiungere `autocomplete` appropriato
  - Aggiungere `enterkeyhint="next"` per navigare tra campi
- **File coinvolti:**
  - Modificare: tutti i componenti `<input>` con tipo numerico/email
- **Criteri di accettazione:**
  - [ ] Campi numerici aprono tastierino numerico
  - [ ] Campi email mostrano @ nella keyboard
  - [ ] `enterkeyhint` guida l'utente al campo successivo
  - [ ] `autocomplete` abilitato dove appropriato
- **Sforzo stimato:** S (1-3h)
- **Dipendenze:** Nessuna

---

### MOB-015: Contratti editing via BottomSheet

- **Pagina:** Contracts
- **Problema:** Modificare salario, durata e clausola nella tabella su 375px e' impossibile — i campi sono troppo piccoli.
- **Proposta:** Su mobile, tap su un contratto apre BottomSheet con form dedicato (DurationSlider, NumberStepper full-width).
- **File coinvolti:**
  - Modificare: `src/pages/Contracts.tsx`
  - Usare: `src/components/ui/BottomSheet.tsx`, `DurationSlider.tsx`, `NumberStepper.tsx`
- **Criteri di accettazione:**
  - [ ] Mobile: tap apre BottomSheet con form
  - [ ] DurationSlider e NumberStepper full-width
  - [ ] Bottoni 44x44px
  - [ ] Desktop: form inline invariato
- **Sforzo stimato:** M (3-8h)
- **Dipendenze:** Nessuna
- **Nota:** Corrisponde a TASK-017 del backlog web

---

### MOB-016: Notifiche push via Web Push API

- **Pagina:** Globale
- **Problema:** L'utente deve tenere l'app aperta per sapere quando e' il suo turno in asta. Se chiude il browser, perde il turno.
- **Proposta:** Implementare Web Push API per notifiche anche con browser chiuso:
  - "Il tuo turno in asta!"
  - "Sei stato superato nell'offerta per Lautaro Martinez"
  - "Nuova proposta di scambio da FC Mario"
  - "Fase Contratti aperta — imposta i rinnovi entro 3 giorni"
- **File coinvolti:**
  - Creare: `src/services/push.service.ts`
  - Modificare: Service Worker (da MOB-013)
  - Modificare: Backend API (endpoint per push subscription)
- **Criteri di accettazione:**
  - [ ] Permesso notifiche richiesto dopo primo login
  - [ ] Notifica push per turno asta
  - [ ] Notifica per superamento offerta
  - [ ] Notifica per scambi ricevuti
  - [ ] Click su notifica apre la pagina giusta
- **Sforzo stimato:** XL (2-5gg)
- **Dipendenze:** MOB-013 (Service Worker), Backend API

---

### MOB-017: Condivisione nativa (Web Share API)

- **Pagina:** PlayerStats, LeagueFinancials, Rose
- **Problema:** L'utente non puo condividere facilmente una pagina o un dato con gli altri manager della lega.
- **Proposta:** Aggiungere bottone "Condividi" che usa Web Share API:
  ```
  navigator.share({
    title: 'Statistiche Lautaro Martinez',
    text: 'Rating 7.2 | 18 gol | 5 assist',
    url: window.location.href
  })
  ```
- **File coinvolti:**
  - Creare: `src/components/ShareButton.tsx`
  - Modificare: pagine con dati condivisibili
- **Criteri di accettazione:**
  - [ ] Bottone condivisione visibile su mobile
  - [ ] Usa Web Share API nativa
  - [ ] Fallback: copia link negli appunti su desktop
- **Sforzo stimato:** S (1-3h)
- **Dipendenze:** Nessuna

---

### MOB-018: Ottimizzare scrolling lungo con scroll-to-top

- **Pagina:** AllPlayers, Movements, Prophecies, Rose
- **Problema:** Le pagine con liste lunghe richiedono molto scrolling. Tornare in cima e' faticoso.
- **Proposta:** Aggiungere bottone "Torna su" floating che appare dopo 500px di scroll.
- **File coinvolti:**
  - Creare: `src/components/ScrollToTop.tsx`
  - Aggiungere nelle pagine con liste lunghe
- **Criteri di accettazione:**
  - [ ] Bottone appare dopo 500px di scroll
  - [ ] Smooth scroll to top
  - [ ] Non copre contenuto importante
  - [ ] Posizionato sopra la bottom nav bar
- **Sforzo stimato:** XS (< 1h)
- **Dipendenze:** MOB-001 (per posizionamento sopra bottom nav)

---

### MOB-019: Gesture swipe-to-dismiss per modali/bottomsheet

- **Pagina:** Tutte (modali)
- **Problema:** I modal si chiudono solo con X o tap su backdrop. Su mobile lo swipe-down e' piu naturale.
- **Proposta:** Aggiungere swipe-down-to-dismiss a tutti i modal (BottomSheet lo ha gia — estendere a Modal.tsx).
- **File coinvolti:**
  - Modificare: `src/components/ui/Modal.tsx`
- **Criteri di accettazione:**
  - [ ] Swipe down chiude il modal su mobile
  - [ ] Soglia: 100px
  - [ ] Animazione slide-down fluida
  - [ ] Non interferisce con scroll interno al modal
- **Sforzo stimato:** S (1-3h)
- **Dipendenze:** Nessuna

---

## Priorita BASSA

---

### MOB-020: Landscape mode per grafici

- **Pagina:** LeagueFinancials, PlayerStats
- **Problema:** I grafici (DonutChart, BarChart, RadarChart) sono piccoli su 375px portrait. In landscape avrebbero piu spazio.
- **Proposta:** Suggerire rotazione device quando l'utente apre un grafico, con banner "Ruota il dispositivo per una vista migliore".
- **File coinvolti:** Modificare pagine con grafici
- **Sforzo stimato:** XS (< 1h)
- **Dipendenze:** Nessuna

---

### MOB-021: Dark/Light mode toggle rapido

- **Pagina:** Navigation
- **Problema:** Il selettore tema e' nel menu slide-in, richiede 3 tap per cambiare tema.
- **Proposta:** Aggiungere toggle dark/light nell'header mobile (icona sole/luna).
- **File coinvolti:** Modificare `src/components/Navigation.tsx`
- **Sforzo stimato:** XS (< 1h)
- **Dipendenze:** Nessuna

---

### MOB-022: Vibrazione feedback per azioni importanti

- **Pagina:** Contracts, Trades, AdminPanel
- **Problema:** L'haptic feedback e' solo in AuctionRoom. Azioni importanti (salva contratto, invia scambio, approva membro) non hanno feedback tattile.
- **Proposta:** Estendere `haptics.ts` con pattern per:
  - `save`: vibrazione success dopo salvataggio
  - `send`: vibrazione medium dopo invio scambio
  - `approve`: vibrazione success dopo approvazione
  - `reject`: vibrazione error dopo rifiuto
- **File coinvolti:** Modificare `src/utils/haptics.ts` e pagine interessate
- **Sforzo stimato:** S (1-3h)
- **Dipendenze:** Nessuna

---

### MOB-023: Ridurre font-size su mobile per titoli

- **Pagina:** Tutte
- **Problema:** Titoli `text-3xl` (30px) e `text-4xl` (36px) sono troppo grandi su 375px, causano wrapping su 2-3 righe.
- **Proposta:** Usare `text-xl sm:text-2xl md:text-3xl` per titoli principali.
- **File coinvolti:** Tutte le pagine con titoli grandi
- **Sforzo stimato:** S (1-3h)
- **Dipendenze:** Nessuna

---

### MOB-024: Camera per upload foto profilo

- **Pagina:** Profile
- **Problema:** L'upload foto usa file picker standard che non offre opzione camera diretta.
- **Proposta:** Usare `<input type="file" accept="image/*" capture="user">` per aprire camera frontale direttamente.
- **File coinvolti:** Modificare `src/pages/Profile.tsx`
- **Sforzo stimato:** XS (< 1h)
- **Dipendenze:** Nessuna

---

## Riepilogo per Sforzo

| Sforzo | Tasks | Ore Stimate |
|--------|-------|-------------|
| XS (< 1h) | MOB-010, MOB-018, MOB-020, MOB-021, MOB-024 | ~4h |
| S (1-3h) | MOB-002, MOB-003, MOB-004, MOB-009, MOB-014, MOB-017, MOB-019, MOB-022, MOB-023 | ~18h |
| M (3-8h) | MOB-001, MOB-006, MOB-007, MOB-008, MOB-011, MOB-012, MOB-015 | ~40h |
| L (1-2gg) | MOB-005, MOB-013 | ~4gg |
| XL (2-5gg) | MOB-016 | ~3gg |

**Totale stimato: ~14 giorni di lavoro**

---

## Percorso Consigliato

### Sprint M1 (Quick Wins - 1 settimana)
1. MOB-003: PWA Manifest + theme-color (S)
2. MOB-004: Ridurre padding su mobile (S)
3. MOB-002: Profilo accessibile mobile (S)
4. MOB-010: Hamburger piu grande (XS)
5. MOB-014: Input keyboard mobile (S)
6. MOB-023: Font-size responsive (S)
7. MOB-018: Scroll-to-top (XS)
8. MOB-024: Camera profilo (XS)

### Sprint M2 (Navigazione - 1 settimana)
1. MOB-001: Bottom Navigation Bar (M)
2. MOB-009: Sticky action buttons (S)
3. MOB-011: Filtri in BottomSheet (M)
4. MOB-021: Dark/light toggle (XS)

### Sprint M3 (Interazioni - 2 settimane)
1. MOB-005: Card view tabelle mobile (L)
2. MOB-006: Trades layout mobile (M)
3. MOB-015: Contratti BottomSheet (M)
4. MOB-007: Touch targets 44px (M)
5. MOB-022: Haptic esteso (S)

### Sprint M4 (Power Features - 2 settimane)
1. MOB-008: Pull-to-refresh (M)
2. MOB-012: Swipe gestures tab (M)
3. MOB-013: Service Worker offline (L)
4. MOB-019: Swipe-to-dismiss modali (S)
5. MOB-020: Landscape hint grafici (XS)

### Backlog Futuro
- MOB-016: Notifiche push (XL) — richiede backend
- MOB-017: Web Share API (S)

---

*Backlog generato tramite analisi statica del codice sorgente. Nessun file modificato.*
