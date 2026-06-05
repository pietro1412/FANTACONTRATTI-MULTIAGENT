# Native App (Android/iOS) Review Report — Fantacontratti

> Generato il: 2026-02-08
> Target: React Native + Expo SDK 52
> Branch: MOBILE-ANDROID
> Modalita: Review Only (nessuna modifica applicata)

---

## Sommario Esecutivo

L'app nativa ha una **base solida** con stack moderno (React Native 0.76.9 + Expo ~52.0.0), navigazione configurata, autenticazione JWT e supporto real-time. Tuttavia la **maggior parte delle schermate sono vuote o inesistenti**:

- **6 schermate implementate** con funzionalita reali
- **8 schermate stub** (solo placeholder "In sviluppo")
- **10+ schermate completamente mancanti** (nemmeno un file)
- **Tema non allineato** con la web app (colori diversi)
- **API URL hardcoded** con IP locale (non utilizzabile in produzione)
- **Nessun test**, nessun CI/CD, nessuna gestione offline

### Punteggio Globale: 4.5/10 (base funzionale, la maggior parte delle schermate vuota)

---

## Infrastruttura Tecnica

| Aspetto | Stato | Dettaglio |
|---------|-------|-----------|
| React Native | OK | 0.76.9 |
| Expo SDK | OK | ~52.0.0 |
| Navigation | OK | Bottom tabs + stacks (5 tab: Home, Rosa, Mercato, Scambi, Altro) |
| Auth | OK | JWT + expo-secure-store |
| State Management | OK | Context API (3 contexts) |
| Real-time | OK | Pusher.js 8.4.0 |
| Push Notifications | PARZIALE | expo-notifications configurato ma non testato |
| API Client | OK | Axios con interceptor JWT |
| TypeScript | OK | strict mode, path aliases |
| Offline | MANCANTE | Nessun AsyncStorage per cache dati |
| Deep Linking | PARZIALE | Scheme configurato (fantacontratti://) ma no routes |
| CI/CD | MANCANTE | Nessun Fastlane/EAS Build configurato |
| Tests | MANCANTE | Nessun test |
| Internazionalizzazione | MANCANTE | Stringhe hardcoded in italiano |
| Tema | PARZIALE | Dark only, colori diversi dalla web (web: #0a0a0b/#3b82f6, app: #1a1a2e/#6366F1) |
| API URL | PROBLEMA | Hardcoded 10.138.157.172:3003 invece di variabile ambiente |

---

## Analisi per Schermata

### Schermate Implementate

| Schermata | Punteggio | Note |
|-----------|-----------|------|
| LoginScreen | 7/10 | Email validation, error handling, loading state. Manca: registrazione, forgot password, biometrics |
| HomeScreen | 6/10 | Dashboard con stats cards, quick actions, league selection. Manca: pull-to-refresh, skeleton loading |
| LeagueSelectionScreen | 6/10 | Lista leghe con selezione persistente. Manca: ricerca, creazione lega |
| RosterScreen | 7/10 | Lista giocatori con filtro posizione, salario, dettagli contratto. Ben implementato |
| ContractsScreen | 6.5/10 | Gestione contratti con modal editing. Manca: validazione avanzata |
| MoreScreen | 5/10 | Menu navigazione a History, Settings, Profile. Solo links, nessuna info utente |

### Schermate Stub (Placeholder)

| Schermata | Punteggio | Note |
|-----------|-----------|------|
| AuctionsScreen | 1/10 | Solo "In sviluppo" placeholder |
| AuctionDetailScreen | 0/10 | Non implementato |
| InitialAuctionScreen | 0/10 | Non implementato |
| RepairAuctionScreen | 0/10 | Non implementato |
| IndemnityScreen | 0/10 | Non implementato |
| TradesScreen | 1/10 | Solo "In sviluppo" placeholder |
| TradeDetailScreen | 0/10 | Non implementato |
| CreateTradeScreen | 0/10 | Non implementato |
| HistoryScreen | 0/10 | Non implementato |
| SettingsScreen | 0/10 | Non implementato |
| ProfileScreen | 0/10 | Non implementato |

---

## Schermate Mancanti (non esistono nemmeno come stub)

- **RegistrationScreen** — Registrazione nuovo utente
- **ForgotPasswordScreen** — Recupero password
- **LeagueDetailScreen** — Dettagli lega, membri, fasi
- **LeagueFinancialsScreen** — Tabellone finanze
- **PlayerStatsScreen** — Statistiche singolo giocatore
- **AllPlayersScreen** — Ricerca tutti i giocatori
- **MovementsScreen** — Storico movimenti
- **PropheciesScreen** — Pronostici
- **AdminPanelScreen** — Gestione admin lega
- **NotificationsScreen** — Lista notifiche

---

## Problemi Architetturali Trasversali

### 1. API URL Hardcoded

**Impatto:** CRITICO

L'URL API (`10.138.157.172:3003`) e' hardcoded in `api.ts`. Questo rende l'app inutilizzabile fuori dalla rete locale di sviluppo. Serve una variabile ambiente (tramite `expo-constants` o `.env`) per gestire correttamente dev/staging/prod.

### 2. Tema Non Allineato con Web

**Impatto:** ALTO

L'app usa colori diversi dalla web app:
| Proprieta | Web App | Native App |
|-----------|---------|------------|
| Background | `#0a0a0b` | `#1a1a2e` |
| Primary | `#3b82f6` | `#6366F1` |

Servono variabili tema condivise o un design system comune per garantire coerenza visiva tra le piattaforme.

### 3. Nessun Error Boundary

**Impatto:** CRITICO

Un crash non gestito porta a uno schermo bianco senza possibilita di recupero. Serve un `ErrorBoundary` globale con fallback UI che permetta all'utente di tornare alla home o riavviare l'app.

### 4. Nessuna Gestione Offline

**Impatto:** ALTO

Se l'utente perde la connessione, l'app diventa completamente inutilizzabile. Serve una cache locale con `AsyncStorage` per i dati essenziali (rosa, contratti, dettagli lega) e un indicatore di stato connessione.

### 5. No Skeleton Loading

**Impatto:** MEDIO

Le schermate mostrano contenuto vuoto durante il caricamento dei dati. Servono componenti skeleton/shimmer per ogni schermata con fetch asincrono, migliorando la percezione di velocita.

### 6. No Biometric Auth

**Impatto:** MEDIO

Il login avviene solo con email e password. Su dispositivi mobili gli utenti si aspettano autenticazione biometrica (Face ID, Touch ID, fingerprint) per accessi rapidi dopo il primo login.

### 7. No App Store Readiness

**Impatto:** ALTO

Mancano tutti gli elementi necessari per la pubblicazione sugli store:
- Splash screen ottimizzato
- Icone adaptive (Android) e corrette dimensioni (iOS)
- Store listing (descrizione, screenshot, categorizzazione)
- Privacy policy
- EAS Build configurato per build di produzione

---

## Componenti Riutilizzabili Esistenti

| Componente | File | Note |
|-----------|------|------|
| AuthContext | `src/store/AuthContext.tsx` | Login/logout, token management |
| LeagueContext | `src/store/LeagueContext.tsx` | League selection, stats |
| NotificationContext | `src/store/NotificationContext.tsx` | Real-time toasts, push |
| API service | `src/services/api.ts` | Axios + JWT interceptor |
| Pusher service | `src/services/pusher.ts` | Real-time events |
| Types | `src/types/index.ts` | Comprehensive TypeScript types |

---

## Raccomandazioni

### Immediato (Sprint 1-2)
1. Completare schermate asta (la feature principale dell'app)
2. Implementare schermate scambi
3. Allineare tema colori con la web app
4. Configurare API URL da variabile ambiente
5. Aggiungere Error Boundary globale

### Medio termine (Sprint 3-4)
6. Implementare tutte le schermate mancanti
7. Aggiungere autenticazione biometrica
8. Skeleton loading su tutte le schermate
9. Deep linking per notifiche push
10. Offline mode con cache locale (AsyncStorage)

### Lungo termine (Sprint 5+)
11. CI/CD con EAS Build (dev/preview/production)
12. Submission su App Store e Google Play
13. Analytics (Firebase Analytics / Amplitude)
14. Crash reporting (Sentry)
15. A/B testing

---

*Report generato tramite analisi statica del codice sorgente sul branch MOBILE-ANDROID. Nessun file modificato.*
