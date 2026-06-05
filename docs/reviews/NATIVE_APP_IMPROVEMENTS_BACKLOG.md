# Native App (Android/iOS) Improvements Backlog — Fantacontratti

> Generato il: 2026-02-08
> Target: React Native + Expo SDK 52, branch MOBILE-ANDROID
> Ordinato per priorita di impatto mobile
> Modalita: Review Only (nessuna modifica applicata)

---

## Come Leggere Questo Backlog

- Focus esclusivo su miglioramenti per la **native app** React Native / Expo
- Ogni task e' auto-contenuta e implementabile indipendentemente (salvo dipendenze)
- Sforzo: XS (< 1h), S (1-3h), M (3-8h), L (1-2gg), XL (2-5gg)
- I file coinvolti sono specificati per ogni task
- Le issue GitHub usano label `2.x-mobile` + `enhancement`

---

## Priorita CRITICA

---

### APP-001: Implementare AuctionScreen (Asta Iniziale)

- **Pagina:** AuctionDetailScreen, InitialAuctionScreen
- **Problema:** La schermata asta e' solo placeholder "In sviluppo". E' la feature principale dell'app.
- **Proposta:** Implementare schermata completa con:
  - Lista giocatori disponibili con filtri posizione/squadra
  - Bid real-time via Pusher (WebSocket)
  - Timer countdown con animazione
  - Bid controls (+/- stepper) con step configurabile
  - Stato budget aggiornato in tempo reale
  - Notifiche outbid con haptic feedback
  - Indicatore turno corrente
- **File coinvolti:**
  - Modificare: `mobile/src/screens/auctions/AuctionDetailScreen.tsx`
  - Modificare: `mobile/src/screens/auctions/InitialAuctionScreen.tsx`
- **Criteri di accettazione:**
  - [ ] Lista giocatori disponibili con ricerca e filtri
  - [ ] Bid in tempo reale via Pusher
  - [ ] Timer countdown visibile e animato
  - [ ] Stepper +/- per importo offerta
  - [ ] Budget residuo aggiornato live
  - [ ] Haptic feedback su outbid
  - [ ] Notifica push quando superato
  - [ ] Gestione disconnessione/riconnessione WebSocket
- **Sforzo stimato:** XL (2-5gg)
- **Dipendenze:** Nessuna

---

### APP-002: Implementare RepairAuctionScreen (Asta Riparazione/Svincolati)

- **Pagina:** RepairAuctionScreen
- **Problema:** Nessuna implementazione. L'utente non puo partecipare all'asta di riparazione dall'app.
- **Proposta:** Implementare schermata con:
  - Timer countdown fase
  - Bid controls (+/- stepper) riutilizzando componenti di APP-001
  - Lista svincolati con filtri posizione
  - Stato budget aggiornato
- **File coinvolti:**
  - Modificare: `mobile/src/screens/auctions/RepairAuctionScreen.tsx`
- **Criteri di accettazione:**
  - [ ] Timer countdown fase visibile
  - [ ] Lista svincolati con filtri posizione
  - [ ] Bid controls funzionanti
  - [ ] Budget residuo aggiornato live
  - [ ] Riuso componenti bid da APP-001
- **Sforzo stimato:** L (1-2gg)
- **Dipendenze:** APP-001 (riusa componenti bid)

---

### APP-003: Implementare TradesScreen + CreateTradeScreen

- **Pagina:** TradesScreen, CreateTradeScreen, TradeDetailScreen
- **Problema:** Solo placeholder. L'utente non puo gestire scambi dall'app.
- **Proposta:** Implementare flusso completo:
  - Lista scambi ricevuti/inviati con stato (pendente, accettato, rifiutato)
  - Creazione scambio con selezione giocatori da rosa propria e avversaria
  - Conferma/rifiuto con swipe gesture
  - Dettaglio scambio con confronto giocatori
- **File coinvolti:**
  - Modificare: `mobile/src/screens/trades/TradesScreen.tsx`
  - Modificare: `mobile/src/screens/trades/CreateTradeScreen.tsx`
  - Modificare: `mobile/src/screens/trades/TradeDetailScreen.tsx`
- **Criteri di accettazione:**
  - [ ] Lista scambi con tab ricevuti/inviati
  - [ ] Stato visivo chiaro (badge colorati)
  - [ ] Creazione scambio con selezione giocatori
  - [ ] Swipe right per accettare, swipe left per rifiutare
  - [ ] Dettaglio con confronto side-by-side
  - [ ] Conferma modale prima di azioni irreversibili
- **Sforzo stimato:** XL (2-5gg)
- **Dipendenze:** Nessuna

---

### APP-004: Configurare API URL da Environment

- **Pagina:** Globale (servizio API)
- **Problema:** URL hardcoded `http://10.138.157.172:3003` in `api.ts`. Non funziona su altri dispositivi/ambienti. Ogni sviluppatore deve modificare manualmente il file.
- **Proposta:** Usare `expo-constants` o `react-native-dotenv` per configurare `API_URL` per dev/staging/prod. Creare file `.env` per ogni ambiente.
- **File coinvolti:**
  - Modificare: `mobile/src/services/api.ts`
  - Creare: `mobile/app.config.js`
  - Creare: `mobile/.env.development`
  - Creare: `mobile/.env.production`
- **Criteri di accettazione:**
  - [ ] API_URL letto da variabile d'ambiente
  - [ ] File `.env.development` con URL locale
  - [ ] File `.env.production` con URL produzione
  - [ ] Nessun URL hardcoded nel codice
  - [ ] Documentazione setup nel README
- **Sforzo stimato:** S (1-3h)
- **Dipendenze:** Nessuna

---

### APP-005: Allineare tema colori con Web App

- **Pagina:** Tutte
- **Problema:** Colori diversi tra app nativa (`#1a1a2e` / `#6366F1`) e web app (`#0a0a0b` / `#3b82f6`). L'utente ha esperienza visiva incoerente tra le due piattaforme.
- **Proposta:** Creare `theme.ts` centralizzato con i colori web (Stadium Nights):
  - body: `#0a0a0b`
  - card: `#1a1c20`
  - primary: `#3b82f6`
  - secondary: `#22c55e`
  - accent: `#f59e0b`
  - danger: `#ef4444`
  - Aggiungere font Outfit/Inter/Oswald tramite `expo-font`
  - Refactorare tutti i colori hardcoded nei vari screen
- **File coinvolti:**
  - Creare: `mobile/src/theme/theme.ts`
  - Modificare: tutti gli screens (sostituire colori hardcoded con riferimenti a theme)
- **Criteri di accettazione:**
  - [ ] File `theme.ts` con tutti i colori/font centralizzati
  - [ ] Nessun colore hardcoded negli screen
  - [ ] Font Outfit/Inter/Oswald caricati
  - [ ] Coerenza visiva con web app
  - [ ] Dark mode come default
- **Sforzo stimato:** M (3-8h)
- **Dipendenze:** Nessuna

---

### APP-006: Aggiungere Error Boundary globale

- **Pagina:** Globale (App.tsx)
- **Problema:** Un crash JavaScript = schermo bianco senza recovery. L'utente deve chiudere e riaprire l'app manualmente.
- **Proposta:** Implementare React Error Boundary con:
  - UI fallback ("Qualcosa e' andato storto")
  - Bottone "Riprova" che resetta lo stato
  - Opzione "Segnala bug" che apre email/form
  - Log dell'errore per debug
- **File coinvolti:**
  - Creare: `mobile/src/components/ErrorBoundary.tsx`
  - Modificare: `mobile/App.tsx` (wrappare app con ErrorBoundary)
- **Criteri di accettazione:**
  - [ ] Error Boundary cattura errori JavaScript
  - [ ] UI fallback con messaggio chiaro
  - [ ] Bottone "Riprova" funzionante
  - [ ] Opzione "Segnala bug" presente
  - [ ] Errore loggato in console/servizio
  - [ ] Non cattura errori di rete (gestiti separatamente)
- **Sforzo stimato:** S (1-3h)
- **Dipendenze:** Nessuna

---

### APP-007: Implementare Registration Screen

- **Pagina:** RegisterScreen
- **Problema:** Solo login disponibile, nessuna registrazione. L'utente nuovo non puo crearsi un account dall'app e deve usare il browser.
- **Proposta:** Form registrazione con:
  - Email, password, conferma password, nome completo
  - Stessa validazione del web (email valida, password min 6 caratteri)
  - Link "Hai gia un account? Accedi"
  - Redirect a login dopo registrazione riuscita
- **File coinvolti:**
  - Creare: `mobile/src/screens/auth/RegisterScreen.tsx`
  - Modificare: `mobile/src/navigation/AppNavigator.tsx` (aggiungere route)
- **Criteri di accettazione:**
  - [ ] Form con email, password, conferma password, nome
  - [ ] Validazione client-side (email, password match, lunghezza)
  - [ ] Messaggi di errore chiari
  - [ ] Navigazione da Login a Register e viceversa
  - [ ] Redirect a Login dopo successo
  - [ ] Keyboard-aware (form non coperto dalla tastiera)
- **Sforzo stimato:** M (3-8h)
- **Dipendenze:** Nessuna

---

### APP-008: Implementare IndemnityScreen (Rubata/Indennita)

- **Pagina:** IndemnityScreen
- **Problema:** Screen stub. L'utente non puo partecipare alla fase rubata/indennita dall'app.
- **Proposta:** Implementare schermata con:
  - Board con liste colonne per posizione (P, D, C, A)
  - Selezione preferenze con drag-and-drop o tap per ordinare
  - Timer countdown fase
  - Riepilogo scelte con conferma
- **File coinvolti:**
  - Modificare: `mobile/src/screens/auctions/IndemnityScreen.tsx`
- **Criteri di accettazione:**
  - [ ] Colonne per posizione visibili
  - [ ] Selezione preferenze con tap o drag
  - [ ] Ordinamento preferenze funzionante
  - [ ] Timer countdown visibile
  - [ ] Conferma scelte con riepilogo
  - [ ] Feedback visivo su selezione
- **Sforzo stimato:** L (1-2gg)
- **Dipendenze:** Nessuna

---

## Priorita ALTA

---

### APP-009: Implementare ProfileScreen

- **Pagina:** ProfileScreen
- **Problema:** Screen stub. L'utente non puo vedere o modificare il proprio profilo dall'app.
- **Proposta:** Implementare schermata con:
  - Info utente (nome, email, ruolo)
  - Cambio password con validazione
  - Upload foto profilo (camera + galleria tramite `expo-image-picker`)
  - Statistiche personali (giocatori, budget, scambi)
- **File coinvolti:**
  - Modificare: `mobile/src/screens/more/ProfileScreen.tsx`
- **Criteri di accettazione:**
  - [ ] Info utente visualizzate
  - [ ] Cambio password funzionante con validazione
  - [ ] Upload foto da camera e galleria
  - [ ] Preview foto prima del salvataggio
  - [ ] Statistiche personali visibili
  - [ ] Feedback su salvataggio riuscito/fallito
- **Sforzo stimato:** M (3-8h)
- **Dipendenze:** Nessuna

---

### APP-010: Implementare SettingsScreen

- **Pagina:** SettingsScreen
- **Problema:** Screen stub. L'utente non puo configurare preferenze dell'app.
- **Proposta:** Implementare schermata con:
  - Notifiche on/off (toggle)
  - Suoni on/off
  - Haptic feedback on/off
  - Selezione tema (dark/light/system)
  - Lingua (italiano/inglese)
  - Cache clear con conferma
  - Versione app (info)
  - Logout con conferma
- **File coinvolti:**
  - Modificare: `mobile/src/screens/more/SettingsScreen.tsx`
- **Criteri di accettazione:**
  - [ ] Toggle notifiche funzionante
  - [ ] Toggle suoni e haptic
  - [ ] Selezione tema persistente
  - [ ] Cache clear con conferma e feedback
  - [ ] Versione app visibile
  - [ ] Logout con modale di conferma
  - [ ] Preferenze salvate in AsyncStorage
- **Sforzo stimato:** M (3-8h)
- **Dipendenze:** Nessuna

---

### APP-011: Implementare HistoryScreen

- **Pagina:** HistoryScreen
- **Problema:** Screen stub. L'utente non puo vedere lo storico delle proprie operazioni.
- **Proposta:** Implementare schermata con:
  - Timeline movimenti del manager: acquisti, cessioni, scambi, rinnovi
  - Filtri per tipo (acquisto, cessione, scambio, rinnovo)
  - Filtri per data (range picker)
  - Card per ogni movimento con dettagli
- **File coinvolti:**
  - Modificare: `mobile/src/screens/more/HistoryScreen.tsx`
- **Criteri di accettazione:**
  - [ ] Timeline cronologica dei movimenti
  - [ ] Filtro per tipo di movimento
  - [ ] Filtro per intervallo di date
  - [ ] Card con dettagli per ogni movimento
  - [ ] Icone diverse per tipo di movimento
  - [ ] Scroll infinito o paginazione
- **Sforzo stimato:** M (3-8h)
- **Dipendenze:** Nessuna

---

### APP-012: Aggiungere Skeleton Loading

- **Pagina:** Tutte le schermate con dati API
- **Problema:** Le schermate mostrano vuoto durante il caricamento dati API. L'utente non capisce se l'app sta caricando o se c'e' un errore.
- **Proposta:** Creare componente `<Skeleton>` riutilizzabile con shimmer animation. Applicare a HomeScreen, RosterScreen, ContractsScreen e tutte le nuove schermate.
- **File coinvolti:**
  - Creare: `mobile/src/components/Skeleton.tsx`
  - Modificare: tutti gli screens con chiamate API
- **Criteri di accettazione:**
  - [ ] Componente Skeleton con shimmer animation
  - [ ] Varianti: text, card, list-item, avatar
  - [ ] Applicato a HomeScreen durante caricamento
  - [ ] Applicato a RosterScreen durante caricamento
  - [ ] Applicato a ContractsScreen durante caricamento
  - [ ] Animazione fluida (60fps)
  - [ ] Colori coerenti con tema dark
- **Sforzo stimato:** M (3-8h)
- **Dipendenze:** Nessuna

---

### APP-013: Aggiungere Pull-to-Refresh

- **Pagina:** Tutte le schermate con dati API
- **Problema:** Nessun modo di aggiornare i dati senza chiudere e riaprire la schermata.
- **Proposta:** Aggiungere `RefreshControl` di React Native su tutte le `FlatList` e `ScrollView` con dati API. Indicatore di aggiornamento con colore primary.
- **File coinvolti:**
  - Modificare: tutti gli screens con liste (`FlatList`, `ScrollView`)
- **Criteri di accettazione:**
  - [ ] Pull-to-refresh su tutte le schermate con dati
  - [ ] Indicatore spinner con colore primary
  - [ ] Richiama API per aggiornare dati
  - [ ] Stato refreshing corretto (non infinito)
  - [ ] Funziona su iOS e Android
- **Sforzo stimato:** S (1-3h)
- **Dipendenze:** Nessuna

---

### APP-014: Biometric Authentication

- **Pagina:** LoginScreen, AuthContext
- **Problema:** Solo email/password per login. Su mobile ci si aspetta Face ID / Touch ID / Fingerprint per accesso rapido.
- **Proposta:** Usare `expo-local-authentication` per biometrics:
  - Dopo primo login riuscito, offrire "Vuoi usare biometria prossima volta?"
  - Salvare token in SecureStore
  - Al prossimo avvio, prompt biometrico diretto
  - Fallback a email/password sempre disponibile
- **File coinvolti:**
  - Creare: `mobile/src/services/biometrics.ts`
  - Modificare: `mobile/src/screens/auth/LoginScreen.tsx`
  - Modificare: `mobile/src/contexts/AuthContext.tsx`
- **Criteri di accettazione:**
  - [ ] Prompt biometria dopo primo login
  - [ ] Face ID su iPhone, Fingerprint su Android
  - [ ] Token salvato in SecureStore (non AsyncStorage)
  - [ ] Login biometrico al prossimo avvio
  - [ ] Fallback a email/password
  - [ ] Gestione errore biometria (sensore non disponibile)
- **Sforzo stimato:** M (3-8h)
- **Dipendenze:** Nessuna

---

### APP-015: Implementare LeagueDetailScreen

- **Pagina:** LeagueDetailScreen
- **Problema:** Non esiste nemmeno come stub. Dalla HomeScreen non si possono vedere dettagli lega, membri, fasi.
- **Proposta:** Implementare schermata con:
  - Info lega (nome, stagione, regolamento)
  - Lista membri con ruoli (admin, manager)
  - Fasi mercato con stato (attiva, completata, futura)
  - Quick actions (vai a asta, contratti, rose, ecc.)
- **File coinvolti:**
  - Creare: `mobile/src/screens/home/LeagueDetailScreen.tsx`
  - Modificare: `mobile/src/navigation/AppNavigator.tsx` (aggiungere route)
- **Criteri di accettazione:**
  - [ ] Info lega complete
  - [ ] Lista membri con ruolo e avatar
  - [ ] Fasi mercato con indicatore stato
  - [ ] Quick actions funzionanti
  - [ ] Navigazione da HomeScreen a LeagueDetail
  - [ ] Pull-to-refresh per aggiornare dati
- **Sforzo stimato:** M (3-8h)
- **Dipendenze:** Nessuna

---

### APP-016: Implementare LeagueFinancialsScreen

- **Pagina:** LeagueFinancialsScreen
- **Problema:** Non esiste. L'utente non vede il tabellone finanze della lega dall'app.
- **Proposta:** Implementare schermata con:
  - Budget per manager (lista ordinata)
  - Grafico a torta spese (acquisti, stipendi, clausole)
  - Classifica budget residuo
  - Filtri per tipo spesa
- **File coinvolti:**
  - Creare: `mobile/src/screens/home/LeagueFinancialsScreen.tsx`
- **Criteri di accettazione:**
  - [ ] Budget per ogni manager visibile
  - [ ] Grafico spese (usando react-native-chart-kit o victory-native)
  - [ ] Classifica budget ordinabile
  - [ ] Filtri per tipo di spesa
  - [ ] Colori coerenti con tema
  - [ ] Dati aggiornabili con pull-to-refresh
- **Sforzo stimato:** L (1-2gg)
- **Dipendenze:** Nessuna

---

## Priorita MEDIA

---

### APP-017: Deep Linking per Notifiche

- **Pagina:** AppNavigator, NotificationContext
- **Problema:** Tap su notifica push non porta alla schermata giusta. L'utente deve navigare manualmente dopo aver aperto l'app.
- **Proposta:** Configurare `react-navigation` deep linking:
  - Notifica asta → AuctionDetailScreen
  - Notifica scambio → TradeDetailScreen
  - Notifica contratti → ContractsScreen
  - Gestione URL scheme `fantacontratti://`
- **File coinvolti:**
  - Modificare: `mobile/src/navigation/AppNavigator.tsx` (linking config)
  - Modificare: `mobile/src/contexts/NotificationContext.tsx` (gestione tap)
- **Criteri di accettazione:**
  - [ ] Tap su notifica asta apre AuctionDetailScreen
  - [ ] Tap su notifica scambio apre TradeDetailScreen
  - [ ] URL scheme `fantacontratti://` configurato
  - [ ] Gestione notifica con app in foreground/background/killed
  - [ ] Fallback a HomeScreen se schermata non trovata
- **Sforzo stimato:** M (3-8h)
- **Dipendenze:** APP-001, APP-003

---

### APP-018: Offline Mode con Cache Locale

- **Pagina:** Globale
- **Problema:** App non funziona senza internet. L'utente vede errore di rete senza possibilita di vedere dati cached.
- **Proposta:** Implementare cache locale:
  - Cache rosa, contratti, leghe in AsyncStorage
  - Mostrare dati cached con banner "Offline — dati potrebbero non essere aggiornati"
  - Rilevamento stato rete tramite `@react-native-community/netinfo`
  - Sync automatico al ripristino connessione
- **File coinvolti:**
  - Creare: `mobile/src/services/cache.ts`
  - Modificare: `mobile/src/services/api.ts` (intercettore cache)
- **Criteri di accettazione:**
  - [ ] Dati rosa/contratti/leghe cached in AsyncStorage
  - [ ] Banner "Offline" visibile quando senza rete
  - [ ] Dati cached mostrati in modalita offline
  - [ ] Sync automatico al ripristino connessione
  - [ ] Cache invalidata dopo TTL configurabile
  - [ ] Azioni di scrittura disabilitate offline
- **Sforzo stimato:** L (1-2gg)
- **Dipendenze:** Nessuna

---

### APP-019: Implementare PlayerStatsScreen

- **Pagina:** PlayerStatsScreen
- **Problema:** Non esiste. L'utente non vede statistiche dettagliate di un giocatore dall'app.
- **Proposta:** Implementare schermata con:
  - Radar chart con voti (usando victory-native o react-native-chart-kit)
  - Storico presenze/gol/assist
  - Valore di mercato attuale
  - Info contratto (durata, salario, clausola)
- **File coinvolti:**
  - Creare: `mobile/src/screens/roster/PlayerStatsScreen.tsx`
- **Criteri di accettazione:**
  - [ ] Radar chart con statistiche giocatore
  - [ ] Storico presenze, gol, assist visibile
  - [ ] Valore mercato e quotazione
  - [ ] Info contratto completa
  - [ ] Navigazione da RosterScreen a PlayerStats
  - [ ] Condivisione stats (opzionale)
- **Sforzo stimato:** L (1-2gg)
- **Dipendenze:** Nessuna

---

### APP-020: Implementare AllPlayersScreen

- **Pagina:** AllPlayersScreen
- **Problema:** Non esiste. L'utente non puo cercare giocatori fuori dalla propria rosa.
- **Proposta:** Implementare schermata con:
  - Ricerca per nome con debounce
  - Filtri posizione (P, D, C, A) e squadra
  - Lista virtualizzata (`FlatList`) per performance
  - Tap su giocatore apre dettaglio (PlayerStatsScreen)
- **File coinvolti:**
  - Creare: `mobile/src/screens/roster/AllPlayersScreen.tsx`
- **Criteri di accettazione:**
  - [ ] Campo ricerca con debounce 300ms
  - [ ] Filtri posizione e squadra
  - [ ] Lista virtualizzata (FlatList) performante
  - [ ] Card giocatore con info essenziali
  - [ ] Tap naviga a PlayerStatsScreen
  - [ ] Gestione lista vuota ("Nessun giocatore trovato")
- **Sforzo stimato:** M (3-8h)
- **Dipendenze:** Nessuna

---

### APP-021: Implementare MovementsScreen

- **Pagina:** MovementsScreen
- **Problema:** Non esiste. L'utente non vede lo storico movimenti della lega dall'app.
- **Proposta:** Implementare schermata con:
  - Timeline cronologica di tutti i movimenti (acquisti, cessioni, scambi)
  - Filtri per tipo, manager, data
  - Card per ogni movimento con dettagli
  - Scroll infinito
- **File coinvolti:**
  - Creare: `mobile/src/screens/more/MovementsScreen.tsx`
- **Criteri di accettazione:**
  - [ ] Timeline cronologica dei movimenti lega
  - [ ] Filtro per tipo di movimento
  - [ ] Filtro per manager
  - [ ] Filtro per intervallo di date
  - [ ] Card dettagliata per ogni movimento
  - [ ] Scroll infinito o paginazione
- **Sforzo stimato:** M (3-8h)
- **Dipendenze:** Nessuna

---

### APP-022: Implementare NotificationsScreen

- **Pagina:** NotificationsScreen
- **Problema:** Le notifiche appaiono come toast ma non c'e' una lista persistente per rivederle. L'utente perde le notifiche se non le legge subito.
- **Proposta:** Implementare schermata con:
  - Lista notifiche con stato read/unread
  - Swipe per archiviare
  - Filtri per tipo (asta, scambio, contratto, sistema)
  - Badge count su tab navigation
- **File coinvolti:**
  - Creare: `mobile/src/screens/more/NotificationsScreen.tsx`
- **Criteri di accettazione:**
  - [ ] Lista notifiche con read/unread (visual diff)
  - [ ] Swipe left per archiviare
  - [ ] Tap per segnare come letta e navigare
  - [ ] Filtri per tipo di notifica
  - [ ] Badge count aggiornato su tab
  - [ ] "Segna tutte come lette" action
- **Sforzo stimato:** M (3-8h)
- **Dipendenze:** Nessuna

---

## Priorita BASSA

---

### APP-023: CI/CD con EAS Build

- **Pagina:** Infrastruttura
- **Problema:** Build manuale. Nessun pipeline automatico per release. Ogni build richiede intervento manuale dello sviluppatore.
- **Proposta:** Configurare EAS Build:
  - Build Android APK/AAB automatico
  - Build iOS IPA automatico
  - GitHub Actions per build automatico su push a MOBILE-ANDROID
  - Canali: development, preview, production
- **File coinvolti:**
  - Creare: `mobile/eas.json`
  - Creare: `.github/workflows/mobile-build.yml`
- **Criteri di accettazione:**
  - [ ] `eas.json` configurato con profili dev/preview/production
  - [ ] GitHub Action per build automatico su push
  - [ ] Build Android APK generato correttamente
  - [ ] Build iOS IPA generato correttamente
  - [ ] Notifica su Slack/Discord al completamento build
- **Sforzo stimato:** L (1-2gg)
- **Dipendenze:** Nessuna

---

### APP-024: App Store Readiness

- **Pagina:** Configurazione e asset
- **Problema:** L'app non e' pronta per pubblicazione su App Store / Play Store. Mancano icone, splash screen ottimizzato, metadata.
- **Proposta:** Preparare:
  - Splash screen con logo e animazione
  - Icone adaptive per Android
  - Screenshots per store listing (5 schermate per device)
  - Privacy policy URL
  - Termini di servizio URL
  - Descrizione app per store
- **File coinvolti:**
  - Modificare: `mobile/app.json` (icone, splash, metadata)
  - Creare: `mobile/assets/` (icone, splash, screenshots)
- **Criteri di accettazione:**
  - [ ] Icona adaptive Android corretta
  - [ ] Icona App Store corretta (1024x1024)
  - [ ] Splash screen con logo
  - [ ] Screenshots 5 schermate principali
  - [ ] Privacy policy URL configurato
  - [ ] Termini di servizio URL configurato
  - [ ] Descrizione app in italiano e inglese
- **Sforzo stimato:** L (1-2gg)
- **Dipendenze:** Nessuna

---

### APP-025: Analytics & Crash Reporting

- **Pagina:** Globale
- **Problema:** Nessun tracking di crash o usage. I bug in produzione non vengono rilevati automaticamente.
- **Proposta:** Integrare:
  - Sentry per crash reporting (errori JavaScript + native)
  - Firebase Analytics o Amplitude per usage analytics
  - Tracking schermate visitate, azioni principali
- **File coinvolti:**
  - Creare: `mobile/src/services/analytics.ts`
  - Modificare: `mobile/App.tsx` (init Sentry + analytics)
- **Criteri di accettazione:**
  - [ ] Sentry configurato e funzionante
  - [ ] Crash report inviato automaticamente
  - [ ] Analytics tracking schermate
  - [ ] Analytics tracking azioni principali (bid, scambio, salvataggio)
  - [ ] Dashboard Sentry accessibile
  - [ ] No impatto su performance (lazy init)
- **Sforzo stimato:** M (3-8h)
- **Dipendenze:** Nessuna

---

### APP-026: Haptic Feedback Completo

- **Pagina:** Tutte
- **Problema:** Nessun feedback tattile. L'esperienza e' "piatta" rispetto alle app native.
- **Proposta:** Usare `expo-haptics` per:
  - Bid in asta: `impactAsync(ImpactFeedbackStyle.Medium)`
  - Win asta: `notificationAsync(NotificationFeedbackType.Success)`
  - Errore: `notificationAsync(NotificationFeedbackType.Error)`
  - Navigazione tab: `selectionAsync()`
  - Pull-to-refresh: `impactAsync(ImpactFeedbackStyle.Light)`
- **File coinvolti:**
  - Creare: `mobile/src/utils/haptics.ts`
  - Modificare: screens con interazioni (asta, navigazione, form)
- **Criteri di accettazione:**
  - [ ] Haptic su bid in asta
  - [ ] Haptic success su vittoria
  - [ ] Haptic error su errore
  - [ ] Haptic selection su navigazione tab
  - [ ] Haptic light su pull-to-refresh
  - [ ] Disattivabile da settings (APP-010)
- **Sforzo stimato:** S (1-3h)
- **Dipendenze:** Nessuna

---

### APP-027: Forgot Password Screen

- **Pagina:** ForgotPasswordScreen
- **Problema:** L'utente non puo recuperare la password dall'app. Deve usare il browser per il reset.
- **Proposta:** Implementare schermata "Password dimenticata":
  - Campo email
  - Invio richiesta reset via API
  - Messaggio conferma "Email inviata"
  - Link "Torna al Login"
- **File coinvolti:**
  - Creare: `mobile/src/screens/auth/ForgotPasswordScreen.tsx`
  - Modificare: `mobile/src/navigation/AppNavigator.tsx` (aggiungere route)
- **Criteri di accettazione:**
  - [ ] Campo email con validazione
  - [ ] Chiamata API per reset password
  - [ ] Messaggio conferma dopo invio
  - [ ] Gestione errore (email non trovata)
  - [ ] Navigazione da Login a ForgotPassword
  - [ ] Link "Torna al Login"
- **Sforzo stimato:** S (1-3h)
- **Dipendenze:** Nessuna

---

### APP-028: Animazioni e Transizioni

- **Pagina:** Tutte
- **Problema:** Navigazione senza animazioni, interazioni piatte. L'app sembra meno "nativa" rispetto alle aspettative.
- **Proposta:** Implementare:
  - Shared element transitions tra schermate (es. card giocatore → dettaglio)
  - Animated list items su `FlatList` (fade-in sequenziale)
  - Gesture-based interactions (swipe cards per scambi)
  - Usare `react-native-reanimated` per performance
- **File coinvolti:**
  - Modificare: `mobile/src/navigation/AppNavigator.tsx` (transizioni)
  - Modificare: vari screens (animazioni lista, shared elements)
- **Criteri di accettazione:**
  - [ ] Transizioni fluide tra schermate (60fps)
  - [ ] Shared element transition su almeno 2 flussi
  - [ ] List items animati al caricamento
  - [ ] Swipe gesture su card scambi
  - [ ] Nessun jank o frame drop
  - [ ] Animazioni disattivabili per accessibilita
- **Sforzo stimato:** L (1-2gg)
- **Dipendenze:** Nessuna

---

## Riepilogo per Sforzo

| Sforzo | Tasks | Ore Stimate |
|--------|-------|-------------|
| XS (< 1h) | — | 0h |
| S (1-3h) | APP-004, APP-006, APP-013, APP-026, APP-027 | ~10h |
| M (3-8h) | APP-005, APP-007, APP-009, APP-010, APP-011, APP-012, APP-014, APP-015, APP-017, APP-020, APP-021, APP-022, APP-025 | ~70h |
| L (1-2gg) | APP-002, APP-008, APP-016, APP-018, APP-019, APP-023, APP-024, APP-028 | ~12gg |
| XL (2-5gg) | APP-001, APP-003 | ~8gg |

**Totale stimato: ~30 giorni di lavoro**

---

## Percorso Consigliato

### Sprint N1 (Foundation - 2 settimane)
1. APP-004: Config API URL (S)
2. APP-005: Tema colori allineato web (M)
3. APP-006: Error Boundary globale (S)
4. APP-012: Skeleton Loading (M)
5. APP-013: Pull-to-refresh (S)
6. APP-007: Registration Screen (M)

### Sprint N2 (Core Feature: Asta - 2 settimane)
1. APP-001: AuctionScreen completa (XL)
2. APP-002: RepairAuctionScreen (L)
3. APP-008: IndemnityScreen (L)

### Sprint N3 (Core Feature: Scambi + Profilo - 2 settimane)
1. APP-003: TradesScreen + CreateTradeScreen (XL)
2. APP-009: ProfileScreen (M)
3. APP-010: SettingsScreen (M)
4. APP-011: HistoryScreen (M)

### Sprint N4 (Schermate Mancanti - 2 settimane)
1. APP-015: LeagueDetailScreen (M)
2. APP-016: LeagueFinancialsScreen (L)
3. APP-019: PlayerStatsScreen (L)
4. APP-020: AllPlayersScreen (M)
5. APP-021: MovementsScreen (M)
6. APP-022: NotificationsScreen (M)

### Sprint N5 (Polish & Release - 2 settimane)
1. APP-014: Biometric Authentication (M)
2. APP-017: Deep Linking (M)
3. APP-018: Offline Mode (L)
4. APP-026: Haptic Feedback (S)
5. APP-027: Forgot Password (S)

### Sprint N6 (Release - 1 settimana)
1. APP-023: CI/CD con EAS Build (L)
2. APP-024: App Store Readiness (L)
3. APP-025: Analytics & Crash Reporting (M)
4. APP-028: Animazioni e Transizioni (L)

---

*Backlog generato tramite analisi statica del branch MOBILE-ANDROID. Nessun file modificato.*
