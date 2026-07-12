# Documentazione Tecnica - FANTACONTRATTI

## Indice

1. [Architettura del Sistema](#architettura-del-sistema)
2. [Stack Tecnologico](#stack-tecnologico)
3. [Struttura delle Cartelle](#struttura-delle-cartelle)
4. [Schema Database](#schema-database)
5. [API Endpoints](#api-endpoints)
6. [Servizi Backend](#servizi-backend)
7. [Componenti Frontend](#componenti-frontend)
8. [Sistema di Autenticazione](#sistema-di-autenticazione)
9. [Sistema Real-time (Pusher)](#sistema-real-time-pusher)
10. [Gestione Email](#gestione-email)
11. [Deploy e CI/CD](#deploy-e-cicd)

---

## Architettura del Sistema

FANTACONTRATTI e una piattaforma web full-stack per la gestione di leghe di fantacalcio in formato dynasty. L'architettura segue un pattern monorepo con separazione logica tra frontend e backend.

```
┌─────────────────────────────────────────────────────────────────┐
│                         CLIENT (Browser)                         │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │   React 19      │  │  React Router   │  │   Pusher.js     │ │
│  │   + Tailwind    │  │     v7          │  │   (Real-time)   │ │
│  └────────┬────────┘  └────────┬────────┘  └────────┬────────┘ │
└───────────┼────────────────────┼────────────────────┼──────────┘
            │                    │                    │
            ▼                    ▼                    ▼
┌─────────────────────────────────────────────────────────────────┐
│                      VITE DEV SERVER / VERCEL                   │
│                         (Frontend Hosting)                       │
└─────────────────────────────────────────────────────────────────┘
            │
            ▼ REST API (JSON)
┌─────────────────────────────────────────────────────────────────┐
│                       EXPRESS.JS SERVER                          │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │   Routes        │  │   Middleware    │  │   Services      │ │
│  │   (16 moduli)   │  │   (Auth, CORS)  │  │   (Business)    │ │
│  └────────┬────────┘  └────────┬────────┘  └────────┬────────┘ │
└───────────┼────────────────────┼────────────────────┼──────────┘
            │                    │                    │
            ▼                    ▼                    ▼
┌─────────────────────────────────────────────────────────────────┐
│                       PRISMA ORM CLIENT                          │
└─────────────────────────────────────────────────────────────────┘
            │
            ▼
┌─────────────────────────────────────────────────────────────────┐
│                      POSTGRESQL DATABASE                         │
│                      (Neon / Supabase)                          │
└─────────────────────────────────────────────────────────────────┘
```

---

## Stack Tecnologico

### Frontend
| Tecnologia | Versione | Utilizzo |
|------------|----------|----------|
| React | 19.2.3 | UI Library |
| React Router DOM | 7.11.0 | Routing |
| Tailwind CSS | 3.4.19 | Styling |
| Vite | 7.3.0 | Build tool & Dev Server |
| Pusher.js | 8.4.0 | WebSocket client |
| Zod | 4.2.1 | Validazione schema |

### Backend
| Tecnologia | Versione | Utilizzo |
|------------|----------|----------|
| Express.js | 5.2.1 | Web framework |
| Prisma | 5.22.0 | ORM |
| PostgreSQL | - | Database |
| bcryptjs | 3.0.3 | Password hashing |
| jsonwebtoken | 9.0.3 | JWT tokens |
| Pusher | 5.2.0 | WebSocket server |
| Nodemailer | 7.0.12 | Email (Gmail) |
| Resend | 6.7.0 | Email (Resend API) |
| multer | 2.0.2 | File upload |
| xlsx | 0.18.5 | Excel parsing |

### DevOps & Testing
| Tecnologia | Versione | Utilizzo |
|------------|----------|----------|
| TypeScript | 5.9.3 | Type safety |
| Vitest | 4.0.16 | Unit testing |
| Playwright | 1.57.0 | E2E testing |
| ESLint | 9.39.2 | Linting |
| Prettier | 3.7.4 | Formatting |

---

## Struttura delle Cartelle

```
FANTACONTRATTI-MULTIAGENT/
├── prisma/
│   ├── schema.prisma           # Entry point schema
│   ├── schema.generated.prisma # Schema combinato (generato)
│   ├── schemas/                # Moduli schema separati
│   │   ├── _base.prisma        # Enums condivisi
│   │   ├── identity.prisma     # User model
│   │   ├── league.prisma       # League, LeagueMember, LeagueInvite
│   │   ├── player.prisma       # SerieAPlayer, QuotazioniUpload
│   │   ├── roster.prisma       # PlayerRoster, PlayerContract
│   │   ├── auction.prisma      # Auction, AuctionBid, AuctionAppeal
│   │   ├── trade.prisma        # TradeOffer
│   │   ├── market-session.prisma # MarketSession, ContractConsolidation
│   │   ├── movement.prisma     # PlayerMovement, Prophecy
│   │   ├── prize.prisma        # Prize, PrizeCategory, SessionPrize
│   │   ├── rubata.prisma       # RubataPreference
│   │   ├── chat.prisma         # ChatMessage
│   │   └── admin.prisma        # AuditLog
│   └── seed.ts                 # Database seeder
│
├── src/
│   ├── api/
│   │   ├── index.ts            # Express app entry point
│   │   ├── routes/             # 16 route modules
│   │   │   ├── auth.ts         # Autenticazione
│   │   │   ├── users.ts        # Gestione utenti
│   │   │   ├── leagues.ts      # Gestione leghe
│   │   │   ├── players.ts      # Giocatori Serie A
│   │   │   ├── auctions.ts     # Sistema aste
│   │   │   ├── contracts.ts    # Contratti
│   │   │   ├── trades.ts       # Scambi
│   │   │   ├── rubata.ts       # Fase rubata
│   │   │   ├── svincolati.ts   # Asta svincolati
│   │   │   ├── invites.ts      # Inviti email
│   │   │   ├── movements.ts    # Movimenti giocatori
│   │   │   ├── prizes.ts       # Fase premi
│   │   │   ├── history.ts      # Storico
│   │   │   ├── chat.ts         # Chat sessione
│   │   │   ├── admin.ts        # Funzioni admin lega
│   │   │   └── superadmin.ts   # Funzioni superadmin
│   │   └── middleware/
│   │       └── auth.ts         # JWT middleware
│   │
│   ├── services/               # Business logic
│   │   ├── api.ts              # Frontend API client
│   │   ├── auth.service.ts     # Autenticazione
│   │   ├── league.service.ts   # Leghe
│   │   ├── auction.service.ts  # Aste
│   │   ├── contract.service.ts # Contratti
│   │   ├── trade.service.ts    # Scambi
│   │   ├── rubata.service.ts   # Rubata
│   │   ├── svincolati.service.ts # Svincolati
│   │   ├── invite.service.ts   # Inviti
│   │   ├── movement.service.ts # Movimenti
│   │   ├── prize-phase.service.ts # Premi
│   │   ├── history.service.ts  # Storico
│   │   ├── chat.service.ts     # Chat
│   │   ├── player.service.ts   # Giocatori
│   │   ├── user.service.ts     # Utenti
│   │   ├── admin.service.ts    # Admin
│   │   ├── superadmin.service.ts # Superadmin
│   │   ├── bot.service.ts      # Bot simulazione
│   │   ├── pusher.service.ts   # Pusher server
│   │   └── pusher.client.ts    # Pusher client
│   │
│   ├── modules/                # Domain-driven modules
│   │   ├── identity/           # Autenticazione
│   │   │   ├── domain/
│   │   │   │   └── services/
│   │   │   │       ├── password.service.ts
│   │   │   │       ├── token.service.ts
│   │   │   │       └── email.service.interface.ts
│   │   │   ├── application/
│   │   │   │   └── use-cases/
│   │   │   │       ├── forgot-password.use-case.ts
│   │   │   │       └── reset-password.use-case.ts
│   │   │   └── infrastructure/
│   │   │       ├── repositories/
│   │   │       │   └── user.prisma-repository.ts
│   │   │       └── services/
│   │   │           ├── bcrypt-password.service.ts
│   │   │           ├── jwt-token.service.ts
│   │   │           ├── email.factory.ts
│   │   │           ├── gmail-email.service.ts
│   │   │           └── resend-email.service.ts
│   │   ├── roster/
│   │   │   └── domain/services/
│   │   │       └── contract-calculator.service.ts
│   │   └── trade/
│   │       └── domain/services/
│   │           └── trade-validator.service.ts
│   │
│   ├── pages/                  # React pages (27 pagine)
│   │   ├── Login.tsx
│   │   ├── Register.tsx
│   │   ├── Dashboard.tsx
│   │   ├── Profile.tsx
│   │   ├── CreateLeague.tsx
│   │   ├── LeagueDetail.tsx
│   │   ├── AuctionRoom.tsx
│   │   ├── Rose.tsx            # Visualizzazione rose
│   │   ├── Contracts.tsx
│   │   ├── Trades.tsx
│   │   ├── Rubata.tsx
│   │   ├── StrategieRubata.tsx
│   │   ├── Svincolati.tsx
│   │   ├── AllPlayers.tsx
│   │   ├── ManagerDashboard.tsx
│   │   ├── AdminPanel.tsx
│   │   ├── Movements.tsx
│   │   ├── History.tsx
│   │   ├── Prophecies.tsx
│   │   ├── PrizePhasePage.tsx
│   │   ├── SuperAdmin.tsx
│   │   ├── InviteDetail.tsx
│   │   ├── ForgotPassword.tsx
│   │   ├── ResetPassword.tsx
│   │   └── LatencyTest.tsx
│   │
│   ├── components/             # Componenti React
│   │   ├── ui/                 # Componenti base
│   │   │   ├── Button.tsx
│   │   │   ├── Card.tsx
│   │   │   ├── Input.tsx
│   │   │   ├── Modal.tsx
│   │   │   ├── Badge.tsx
│   │   │   ├── BottomSheet.tsx
│   │   │   ├── Skeleton.tsx
│   │   │   ├── DurationSlider.tsx
│   │   │   ├── NumberStepper.tsx
│   │   │   └── PositionBadge.tsx
│   │   ├── layout/
│   │   │   └── PageLayout.tsx
│   │   ├── history/            # Componenti storico
│   │   ├── Navigation.tsx
│   │   ├── Chat.tsx
│   │   ├── Notifications.tsx
│   │   ├── PlayerRevealCard.tsx
│   │   ├── MarketPhaseManager.tsx
│   │   ├── PrizePhaseManager.tsx
│   │   ├── PendingInvites.tsx
│   │   ├── JoinLeagueModal.tsx
│   │   └── SearchLeaguesModal.tsx
│   │
│   ├── hooks/                  # React hooks
│   │   └── useAuth.tsx         # Auth context & hook
│   │
│   ├── utils/                  # Utilities
│   │   ├── validation.ts       # Zod schemas
│   │   ├── jwt.ts              # Token utilities
│   │   └── password.ts         # Password hashing
│   │
│   ├── App.tsx                 # Main React app
│   ├── main.tsx                # Entry point
│   └── index.css               # Global styles
│
├── scripts/
│   ├── build-schema.ts         # Combina schema Prisma
│   ├── build-api.mjs           # Build API per Vercel
│   └── init-production.ts      # Inizializzazione prod
│
├── docs/                       # Documentazione
├── tests/                      # Test files
├── package.json
├── vite.config.ts
├── tailwind.config.js
├── tsconfig.json
├── vercel.json                 # Config Vercel
└── CLAUDE.md                   # Istruzioni progetto
```

---

## Schema Database

### Modelli Principali

#### User (Identity)
```prisma
model User {
  id            String   @id @default(cuid())
  email         String   @unique
  username      String   @unique
  passwordHash  String
  emailVerified Boolean  @default(false)
  isSuperAdmin  Boolean  @default(false)
  profilePhoto  String?

  // Password reset
  passwordResetToken    String?   @unique
  passwordResetExpires  DateTime?

  // Relazioni
  leagueMemberships LeagueMember[]
  sentOffers        TradeOffer[]     @relation("OfferSender")
  receivedOffers    TradeOffer[]     @relation("OfferReceiver")
  auctionBids       AuctionBid[]
  auditLogs         AuditLog[]
  sentInvites       LeagueInvite[]
  quotazioniUploads QuotazioniUpload[]
}
```

#### League
```prisma
model League {
  id               String   @id @default(cuid())
  name             String
  description      String?
  minParticipants  Int      @default(6)
  maxParticipants  Int      @default(20)
  requireEvenNumber Boolean @default(true)
  initialBudget    Int      @default(500)

  // Slot rosa
  goalkeeperSlots  Int      @default(3)
  defenderSlots    Int      @default(8)
  midfielderSlots  Int      @default(8)
  forwardSlots     Int      @default(6)

  status           LeagueStatus @default(DRAFT)
  currentSeason    Int          @default(1)
  inviteCode       String   @unique @default(cuid())
}
```

#### SerieAPlayer
```prisma
model SerieAPlayer {
  id           String   @id @default(cuid())
  externalId   String?  @unique
  name         String
  team         String
  position     Position  // P, D, C, A
  quotation    Int      @default(1)
  age          Int?
  isActive     Boolean  @default(true)
  listStatus   PlayerListStatus @default(IN_LIST)
}
```

#### PlayerRoster & PlayerContract
```prisma
model PlayerRoster {
  id              String   @id @default(cuid())
  leagueMemberId  String
  playerId        String
  acquisitionPrice Int
  acquisitionType  AcquisitionType  // FIRST_MARKET, RUBATA, SVINCOLATI, TRADE
  status          RosterStatus @default(ACTIVE)

  contract        PlayerContract?
}

model PlayerContract {
  id              String   @id @default(cuid())
  rosterId        String   @unique
  leagueMemberId  String
  salary          Int      // Ingaggio
  duration        Int      // 1-4 semestri
  initialSalary   Int
  initialDuration Int
  rescissionClause Int     // salary * multiplier

  // Bozza rinnovo
  draftSalary     Int?
  draftDuration   Int?
  draftReleased   Boolean  @default(false)
}
```

#### MarketSession
```prisma
model MarketSession {
  id          String   @id @default(cuid())
  leagueId    String
  type        MarketType       // PRIMO_MERCATO, MERCATO_RICORRENTE
  season      Int
  semester    Int              // 1 = estivo, 2 = invernale
  status      SessionStatus    // SCHEDULED, ACTIVE, COMPLETED, CANCELLED
  currentPhase MarketPhase?    // ASTA_LIBERA, OFFERTE_PRE_RINNOVO, PREMI,
                               // CONTRATTI, RUBATA, ASTA_SVINCOLATI, OFFERTE_POST_ASTA

  // Configurazione timer
  auctionTimerSeconds Int @default(30)
  rubataOfferTimerSeconds Int @default(30)
  rubataAuctionTimerSeconds Int @default(15)
  svincolatiTimerSeconds Int @default(30)
}
```

#### Auction & AuctionBid
```prisma
model Auction {
  id              String   @id @default(cuid())
  leagueId        String
  marketSessionId String?
  playerId        String
  type            AuctionType  // FREE_BID, RUBATA
  basePrice       Int      @default(1)
  currentPrice    Int
  winnerId        String?
  sellerId        String?  // Per rubata
  status          AuctionStatus
  timerExpiresAt  DateTime?
  timerSeconds    Int?

  bids            AuctionBid[]
  appeals         AuctionAppeal[]
  acknowledgments AuctionAcknowledgment[]
}

model AuctionBid {
  id          String   @id @default(cuid())
  auctionId   String
  bidderId    String
  userId      String
  amount      Int
  isWinning   Boolean  @default(false)
  isCancelled Boolean  @default(false)
  placedAt    DateTime @default(now())
}
```

#### TradeOffer
```prisma
model TradeOffer {
  id              String   @id @default(cuid())
  marketSessionId String
  senderId        String
  receiverId      String
  offeredPlayers  Json     // [playerId, ...]
  offeredBudget   Int      @default(0)
  requestedPlayers Json
  requestedBudget  Int     @default(0)
  status          TradeStatus  // PENDING, ACCEPTED, REJECTED, COUNTERED, CANCELLED, EXPIRED
  involvedPlayers Json
  message         String?
  expiresAt       DateTime?

  parentOfferId   String?  // Per controproposte
}
```

### Enums Principali

```prisma
enum LeagueStatus { DRAFT, ACTIVE, ARCHIVED }
enum MemberRole { ADMIN, MANAGER }
enum MemberStatus { PENDING, ACTIVE, SUSPENDED, LEFT }
enum Position { P, D, C, A }
enum AcquisitionType { FIRST_MARKET, RUBATA, SVINCOLATI, TRADE }
enum RosterStatus { ACTIVE, RELEASED, TRADED }
enum MarketType { PRIMO_MERCATO, MERCATO_RICORRENTE }
enum SessionStatus { SCHEDULED, ACTIVE, COMPLETED, CANCELLED }
enum MarketPhase {
  ASTA_LIBERA, OFFERTE_PRE_RINNOVO, PREMI, CONTRATTI,
  RUBATA, ASTA_SVINCOLATI, OFFERTE_POST_ASTA_SVINCOLATI
}
enum AuctionType { FREE_BID, RUBATA }
enum AuctionStatus { PENDING, ACTIVE, COMPLETED, CANCELLED, NO_BIDS, APPEAL_REVIEW, AWAITING_APPEAL_ACK, AWAITING_RESUME }
enum TradeStatus { PENDING, ACCEPTED, REJECTED, COUNTERED, CANCELLED, EXPIRED }
enum MovementType { FIRST_MARKET, TRADE, RUBATA, SVINCOLATI, RELEASE, CONTRACT_RENEW }
```

---

## API Endpoints

### Autenticazione (`/api/auth`)
| Metodo | Endpoint | Descrizione |
|--------|----------|-------------|
| POST | `/register` | Registrazione nuovo utente |
| POST | `/login` | Login utente |
| POST | `/logout` | Logout |
| POST | `/refresh` | Refresh access token |
| GET | `/me` | Ottieni utente corrente |
| POST | `/forgot-password` | Richiedi reset password |
| POST | `/reset-password` | Esegui reset password |

### Leghe (`/api/leagues`)
| Metodo | Endpoint | Descrizione |
|--------|----------|-------------|
| POST | `/` | Crea nuova lega |
| GET | `/` | Lista leghe utente |
| GET | `/search` | Cerca leghe |
| GET | `/join/:code` | Info lega da codice invito |
| GET | `/:id` | Dettaglio lega |
| PUT | `/:id` | Aggiorna lega (Admin) |
| POST | `/:id/join` | Richiedi partecipazione |
| POST | `/:id/start` | Avvia lega (Admin) |
| POST | `/:id/leave` | Lascia lega |
| GET | `/:id/members` | Lista membri |
| PUT | `/:id/members/:memberId` | Accetta/Rifiuta membro (Admin) |
| GET | `/:id/rosters` | Tutte le rose |

### Aste (`/api/auctions`)
| Metodo | Endpoint | Descrizione |
|--------|----------|-------------|
| POST | `/leagues/:leagueId/auctions` | Crea sessione mercato |
| GET | `/leagues/:leagueId/auctions` | Lista sessioni |
| PUT | `/auctions/sessions/:sessionId/phase` | Cambia fase (Admin) |
| PUT | `/auctions/sessions/:sessionId/timer` | Aggiorna timer (Admin) |
| PUT | `/auctions/sessions/:sessionId/close` | Chiudi sessione (Admin) |
| POST | `/auctions/sessions/:sessionId/nominate` | Nomina giocatore |
| GET | `/auctions/sessions/:sessionId/current` | Asta corrente |
| POST | `/auctions/:auctionId/bid` | Fai offerta |
| PUT | `/auctions/:auctionId/close` | Chiudi asta (Admin) |
| POST | `/auctions/:auctionId/acknowledge` | Conferma visione risultato |
| POST | `/auctions/:auctionId/appeal` | Presenta ricorso |

### Contratti (`/api/contracts`)
| Metodo | Endpoint | Descrizione |
|--------|----------|-------------|
| GET | `/leagues/:leagueId/contracts` | Lista contratti |
| POST | `/contracts/create` | Crea contratto |
| POST | `/contracts/:contractId/renew` | Rinnova contratto |
| POST | `/contracts/:contractId/release` | Svincola giocatore |
| GET | `/leagues/:leagueId/contracts/consolidation` | Stato consolidamento |
| POST | `/leagues/:leagueId/contracts/consolidate` | Consolida contratti |

### Scambi (`/api/trades`)
| Metodo | Endpoint | Descrizione |
|--------|----------|-------------|
| POST | `/leagues/:leagueId/trades` | Crea offerta |
| GET | `/leagues/:leagueId/trades/received` | Offerte ricevute |
| GET | `/leagues/:leagueId/trades/sent` | Offerte inviate |
| PUT | `/trades/:tradeId/accept` | Accetta scambio |
| PUT | `/trades/:tradeId/reject` | Rifiuta scambio |
| POST | `/trades/:tradeId/counter` | Controproposta |

### Rubata (`/api/rubata`)
| Metodo | Endpoint | Descrizione |
|--------|----------|-------------|
| PUT | `/leagues/:leagueId/rubata/order` | Imposta ordine (Admin) |
| GET | `/leagues/:leagueId/rubata/board` | Tabellone rubata |
| POST | `/leagues/:leagueId/rubata/board/generate` | Genera tabellone (Admin) |
| POST | `/leagues/:leagueId/rubata/start` | Avvia rubata (Admin) |
| POST | `/leagues/:leagueId/rubata/offer` | Fai offerta iniziale |
| POST | `/leagues/:leagueId/rubata/auction/bid` | Rilancia in asta |
| POST | `/leagues/:leagueId/rubata/ready` | Segna pronto |

### Svincolati (`/api/svincolati`)
| Metodo | Endpoint | Descrizione |
|--------|----------|-------------|
| GET | `/leagues/:leagueId/svincolati` | Lista svincolati |
| GET | `/leagues/:leagueId/svincolati/board` | Stato turni |
| POST | `/leagues/:leagueId/svincolati/turn-order` | Imposta ordine turni (Admin) |
| POST | `/leagues/:leagueId/svincolati/nominate` | Nomina giocatore |
| POST | `/svincolati/:auctionId/bid` | Fai offerta |
| PUT | `/svincolati/:auctionId/close-turn` | Chiudi asta (Admin) |

### Inviti (`/api/invites`)
| Metodo | Endpoint | Descrizione |
|--------|----------|-------------|
| POST | `/leagues/:leagueId/invites` | Invia invito email (Admin) |
| GET | `/leagues/:leagueId/invites` | Lista inviti pendenti |
| GET | `/invites/:token` | Info invito |
| POST | `/invites/:token/accept` | Accetta invito |
| POST | `/invites/:token/reject` | Rifiuta invito |
| DELETE | `/invites/:inviteId` | Cancella invito (Admin) |

### Superadmin (`/api/superadmin`)
| Metodo | Endpoint | Descrizione |
|--------|----------|-------------|
| GET | `/superadmin/status` | Verifica stato superadmin |
| POST | `/superadmin/quotazioni/import` | Importa quotazioni Excel |
| GET | `/superadmin/quotazioni/history` | Storico import |
| GET | `/superadmin/players/stats` | Statistiche giocatori |
| GET | `/superadmin/players` | Lista giocatori |
| GET | `/superadmin/leagues` | Tutte le leghe |
| GET | `/superadmin/users` | Tutti gli utenti |
| POST | `/superadmin/grant` | Assegna/Revoca superadmin |

---

## Servizi Backend

### auth.service.ts
Gestisce registrazione e login utenti.

```typescript
// Funzioni principali
registerUser(input): Promise<AuthResult>
loginUser(input): Promise<AuthResult>
getUserById(userId: string): Promise<User | null>
```

### auction.service.ts
Gestisce le sessioni di mercato e le aste.

```typescript
// Funzioni principali
createAuctionSession(leagueId, userId, isRegularMarket): Promise<Result>
setMarketPhase(sessionId, userId, phase): Promise<Result>
nominatePlayer(sessionId, playerId, userId, basePrice?): Promise<Result>
placeBid(auctionId, userId, amount): Promise<Result>
closeAuction(auctionId, userId): Promise<Result>
acknowledgeAuction(auctionId, userId, prophecy?): Promise<Result>
```

### contract.service.ts
Gestisce contratti e rinnovi.

```typescript
// Funzioni principali
createContract(rosterId, userId, salary, duration): Promise<Result>
renewContract(contractId, userId, newSalary, newDuration): Promise<Result>
releasePlayer(contractId, userId): Promise<Result>
consolidateContracts(leagueId, userId, renewals?, newContracts?): Promise<Result>
```

### trade.service.ts
Gestisce proposte di scambio.

```typescript
// Funzioni principali
createTradeOffer(...): Promise<Result>
acceptTrade(tradeId, userId): Promise<Result>
rejectTrade(tradeId, userId): Promise<Result>
counterOffer(tradeId, userId, ...): Promise<Result>
```

### pusher.service.ts
Gestisce eventi real-time.

```typescript
// Eventi disponibili
PUSHER_EVENTS = {
  BID_PLACED: 'bid-placed',
  NOMINATION_PENDING: 'nomination-pending',
  NOMINATION_CONFIRMED: 'nomination-confirmed',
  MEMBER_READY: 'member-ready',
  AUCTION_STARTED: 'auction-started',
  AUCTION_CLOSED: 'auction-closed',
  TIMER_UPDATE: 'timer-update',
  RUBATA_STEAL_DECLARED: 'rubata-steal-declared',
  RUBATA_BID_PLACED: 'rubata-bid-placed',
  RUBATA_STATE_CHANGED: 'rubata-state-changed',
  SVINCOLATI_STATE_CHANGED: 'svincolati-state-changed',
  // ...
}
```

---

## Componenti Frontend

### Pagine Principali

| Pagina | File | Descrizione |
|--------|------|-------------|
| Login | `Login.tsx` | Accesso utente |
| Register | `Register.tsx` | Registrazione |
| Dashboard | `Dashboard.tsx` | Home utente con liste leghe |
| LeagueDetail | `LeagueDetail.tsx` | Dettaglio singola lega |
| AuctionRoom | `AuctionRoom.tsx` | Sala aste real-time |
| Rose | `Rose.tsx` | Visualizza tutte le rose |
| Contracts | `Contracts.tsx` | Gestione contratti |
| Trades | `Trades.tsx` | Proposte scambio |
| Rubata | `Rubata.tsx` | Fase rubata |
| Svincolati | `Svincolati.tsx` | Asta svincolati |
| AdminPanel | `AdminPanel.tsx` | Pannello admin lega |
| SuperAdmin | `SuperAdmin.tsx` | Pannello superadmin |

### Componenti UI Base

```
components/ui/
├── Button.tsx      - Pulsante con varianti
├── Card.tsx        - Card container
├── Input.tsx       - Input field
├── Modal.tsx       - Modal dialog
├── Badge.tsx       - Badge/Tag
├── BottomSheet.tsx - Sheet mobile
├── Skeleton.tsx    - Loading skeleton
├── PositionBadge.tsx - Badge ruolo giocatore
├── DurationSlider.tsx - Slider durata contratto
└── NumberStepper.tsx  - Stepper numerico
```

---

## Sistema di Autenticazione

### Flusso JWT
```
1. Login: Client invia credenziali
2. Server verifica e genera:
   - Access Token (15 min, in response)
   - Refresh Token (7 giorni, httpOnly cookie)
3. Client usa Access Token per richieste API
4. Token scaduto: Client chiama /refresh
5. Server verifica Refresh Token e genera nuovi token
```

### Middleware Auth
```typescript
// src/api/middleware/auth.ts
authMiddleware(req, res, next)
  - Estrae token da header Authorization
  - Verifica signature JWT
  - Aggiunge req.user = { userId, email, username }

optionalAuthMiddleware(req, res, next)
  - Come authMiddleware ma non blocca se manca token
```

### Token Payload
```typescript
interface TokenPayload {
  userId: string
  email: string
  username: string
}
```

---

## Sistema Real-time (Pusher)

### Configurazione Server
```typescript
// Variabili ambiente
PUSHER_APP_ID
PUSHER_SECRET
VITE_PUSHER_KEY
VITE_PUSHER_CLUSTER
```

### Configurazione Client
```typescript
// src/services/pusher.client.ts
const pusher = new Pusher(VITE_PUSHER_KEY, {
  cluster: VITE_PUSHER_CLUSTER,
})

// Sottoscrizione canale
const channel = pusher.subscribe(`auction-${sessionId}`)
channel.bind('bid-placed', handleBid)
channel.bind('auction-closed', handleClose)
```

### Eventi Principali

| Evento | Payload | Descrizione |
|--------|---------|-------------|
| `bid-placed` | `{auctionId, memberId, amount, playerName}` | Nuova offerta |
| `nomination-confirmed` | `{playerId, playerName, timerDuration}` | Asta iniziata |
| `auction-closed` | `{winnerId, winnerName, finalPrice}` | Asta conclusa |
| `member-ready` | `{memberId, readyCount, totalMembers}` | Manager pronto |
| `rubata-state-changed` | `{newState, currentIndex}` | Cambio stato rubata |

---

## Gestione Email

### Factory Pattern
```typescript
// src/modules/identity/infrastructure/services/email.factory.ts
createEmailService(): IEmailService {
  // Priorita:
  // 1. EMAIL_PROVIDER env (gmail/resend)
  // 2. Auto-detect da credenziali disponibili
  // 3. Default: Gmail (console mode se non configurato)
}
```

### Provider Gmail
```typescript
// Variabili ambiente
GMAIL_USER
GMAIL_APP_PASSWORD

// Richiede App Password (2FA abilitata)
```

### Provider Resend
```typescript
// Variabili ambiente
RESEND_API_KEY
RESEND_FROM_EMAIL  // optional, default: noreply@fantacontratti.com
```

### Template Email
- Reset password
- Invito a lega

---

## Deploy e CI/CD

### Vercel Configuration
```json
// vercel.json
{
  "rewrites": [
    { "source": "/api/:path*", "destination": "/api/:path*" },
    { "source": "/(.*)", "destination": "/" }
  ]
}
```

### Build Commands
```bash
# Development
npm run dev          # Frontend + Backend concurrently
npm run dev:client   # Solo Vite
npm run dev:api      # Solo Express

# Production
npm run build        # Vite build
npm run vercel-build # Prisma generate + db push + API build + Vite build

# Database
npm run db:generate  # Prisma generate
npm run db:push      # Prisma db push
npm run db:studio    # Prisma Studio
npm run db:seed      # Seed database
npm run db:build-schema # Combina schema modulari

# Test
npm run test         # Vitest
npm run test:e2e     # Playwright
```

### Environment Variables (Production)
```
# Database
DATABASE_URL=postgresql://...
DATABASE_URL_UNPOOLED=postgresql://...

# JWT
JWT_SECRET=...
JWT_REFRESH_SECRET=...

# Pusher
PUSHER_APP_ID=...
PUSHER_SECRET=...
VITE_PUSHER_KEY=...
VITE_PUSHER_CLUSTER=eu

# Email
EMAIL_PROVIDER=resend
RESEND_API_KEY=...

# Frontend
FRONTEND_URL=https://fantacontratti.vercel.app
```

---

## Note Tecniche Aggiuntive

### Gestione Schema Prisma Modulare
Il progetto usa uno schema Prisma diviso in moduli (`prisma/schemas/*.prisma`). Il comando `npm run db:build-schema` li combina in `schema.generated.prisma`.

### Lazy Loading Frontend
Le pagine non critiche sono caricate on-demand con `React.lazy()` per migliorare il tempo di caricamento iniziale.

### Indici Database
Indici ottimizzati per:
- `MarketSession(leagueId, status)`
- `Auction(marketSessionId, status)`
- `AuctionBid(auctionId, isWinning)`
- `PlayerRoster(leagueMemberId, status)`

### Rate Limiting
Attualmente non implementato. Da considerare per produzione.

### Logging
Console logging standard. Per produzione considerare servizio logging strutturato.
