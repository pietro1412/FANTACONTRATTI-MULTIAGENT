# FANTACONTRATTI - Fasi del Refactoring

## Overview

| # | Fase | Descrizione | Criticità | Task |
|---|------|-------------|-----------|------|
| 0 | Setup Infrastruttura | Branch, DB, testing framework | Base | 9 |
| 1 | Shared Infrastructure | Event Bus, Pusher, Error handling | Base | 7 |
| 1.5 | Database Schema | Multi-schema, indici, normalizzazione | Alta | 18 |
| 2 | Identity Module | Auth, User, Login/Register | Media | 9 |
| 3 | League Module | Lega, Members, Inviti | Media | 10 |
| 4 | Roster Module | Rose, Contratti, Clausole | Media | 10 |
| 5 | Auction Module | Aste Primo Mercato | **Critica** | 18 |
| 6 | Rubata Module | Fase Rubata | **Critica** | 13 |
| 7 | Svincolati Module | Asta Svincolati | **Critica** | 13 |
| 8 | Trade Module | Scambi tra Manager | Media | 9 |
| 9 | Prize Module | Assegnazione Premi | Bassa | 9 |
| 10 | Movement Module | Storico Movimenti | Bassa | 9 |
| 11 | Chat Module | Chat Real-time | Media | 9 |
| 12 | Admin Module | Pannello Admin | Bassa | 8 |
| 13 | Integration Testing | Test E2E completi | Alta | 7 |
| 14 | Cleanup | Pulizia e documentazione | Bassa | 5 |

**Totale Task**: ~153

---

## Dettaglio Fasi

### FASE 0: Setup Infrastruttura
**Prerequisito per tutto il resto**

| Task | Descrizione |
|------|-------------|
| Creare branch Git | `refactoring/modular-architecture` |
| Creare REFACTORING_PLAN.md | Piano dettagliato |
| Creare Neon DB branch | Database separato per sviluppo |
| Configurare .env.development | Variabili ambiente nuovo DB |
| Setup struttura cartelle | `src/modules/`, `src/shared/` |
| Setup Vitest | Testing framework + React Testing Library |
| Setup Event Bus | Infrastruttura domain events |
| Definire Domain Events | Types per tutti gli eventi |
| Creare Prisma singleton | Client condiviso |

---

### FASE 1: Shared Infrastructure
**Cross-cutting concerns condivisi**

| Task | Descrizione |
|------|-------------|
| Event Bus con tests | Publish/Subscribe pattern |
| Domain Events types | Tutti i tipi evento |
| Error Handling | Gestione errori centralizzata |
| Pusher service | Client real-time condiviso |
| Event Batching Pusher | Batch eventi ogni 100ms |
| Presence Channel wrapper | Wrapper per online status |
| Cron Job infrastructure | Setup per timer server-side |

---

### FASE 1.5: Database Schema Refactoring
**Ristrutturazione completa del database**

| Task | Descrizione |
|------|-------------|
| build-schema.ts | Script per unire schema files |
| _base.prisma | Enums condivisi |
| identity.prisma | User, Credentials |
| league.prisma | League, LeagueMember, LeagueInvite |
| player.prisma | SerieAPlayer, QuotazioniUpload |
| roster.prisma | PlayerRoster, PlayerContract, DraftContract |
| market-session.prisma | MarketSession (shared) |
| auction.prisma | Auction, AuctionBid, AuctionAppeal |
| rubata.prisma | RubataBoard, RubataOffer (nuove!) |
| svincolati.prisma | SvincolatiTurnOrder, SvincolatiNomination (nuove!) |
| trade.prisma | TradeOffer |
| prize.prisma | Prize, PrizeCategory, SessionPrize |
| movement.prisma | PlayerMovement, Prophecy |
| chat.prisma | ChatMessage |
| admin.prisma | AuditLog |
| Aggiungere indici | 15+ indici per performance |
| Eliminare JSON fields | Normalizzare in tabelle |
| Migration iniziale | Generare e testare |

---

### FASE 2: Identity Module
**Autenticazione e gestione utenti**

| Task | Tipo |
|------|------|
| User entity | Domain |
| UserRepository interface | Domain |
| Login use-case | TDD |
| Register use-case | TDD |
| RefreshToken use-case | TDD |
| UserPrismaRepository | Infrastructure |
| auth.routes.ts | API |
| Login.tsx + Register.tsx | Presentation |
| useAuth hook | Presentation |

---

### FASE 3: League Module
**Gestione leghe e membri**

| Task | Tipo |
|------|------|
| League entity | Domain |
| LeagueMember entity | Domain |
| LeagueRepository interface | Domain |
| CreateLeague use-case | TDD |
| JoinLeague use-case | TDD |
| GetLeagueDetails use-case | TDD |
| InviteMember use-case | TDD |
| LeaguePrismaRepository | Infrastructure |
| league.routes.ts | API |
| Dashboard.tsx, LeagueDetail.tsx, CreateLeague.tsx | Presentation |

---

### FASE 4: Roster Module
**Rose e contratti giocatori**

| Task | Tipo |
|------|------|
| Roster aggregate | Domain |
| Contract entity | Domain |
| RosterRepository interface | Domain |
| GetRoster use-case | TDD |
| RenewContract use-case | TDD |
| CalculateRescission use-case | TDD |
| ConsolidateContracts use-case | TDD |
| RosterPrismaRepository | Infrastructure |
| roster.routes.ts, contracts.routes.ts | API |
| Roster.tsx, Contracts.tsx, AllRosters.tsx | Presentation |

---

### FASE 5: Auction Module (Primo Mercato) - CRITICAL PERFORMANCE
**Aste libere primo mercato assoluto**

| Task | Tipo |
|------|------|
| Auction aggregate | Domain |
| Bid value object | Domain |
| Appeal entity | Domain |
| AuctionRepository interface | Domain |
| CreateAuction use-case | TDD |
| **PlaceBid con Transaction atomica** | TDD + PERF |
| **Server-side timer cron job** | PERF |
| **Event batching per bid updates** | PERF |
| **Timer reset notification via Pusher** | PERF |
| CloseAuction use-case | TDD |
| HandleAppeal use-case | TDD |
| NominatePlayer use-case | TDD |
| ReadyCheck use-case | TDD |
| AuctionPrismaRepository | Infrastructure |
| auction.routes.ts | API |
| **AuctionRoom.tsx con Presence Channel** | Presentation + PERF |
| **Consolidare polling in unico interval** | PERF |
| **Optimistic UI updates** | PERF |

---

### FASE 6: Rubata Module - CRITICAL PERFORMANCE
**Fase rubata mercato ricorrente**

| Task | Tipo |
|------|------|
| RubataSession aggregate | Domain |
| RubataBoard entity (normalizzato) | Domain |
| RubataReadyStatus entity | Domain |
| RubataRepository interface | Domain |
| SetupRubata use-case | TDD |
| **PlaceOffer con Transaction atomica** | TDD + PERF |
| **StartRubataAuction con bid locking** | TDD + PERF |
| **Server-side timer per rubata** | PERF |
| **Event batching per rubata updates** | PERF |
| RubataPrismaRepository | Infrastructure |
| rubata.routes.ts | API |
| **Rubata.tsx con Presence Channel** | Presentation + PERF |
| **Eliminare adaptive polling, Pusher-first** | PERF |

---

### FASE 7: Svincolati Module - CRITICAL PERFORMANCE
**Asta svincolati**

| Task | Tipo |
|------|------|
| SvincolatiSession aggregate | Domain |
| SvincolatiTurnOrder entity (normalizzato) | Domain |
| SvincolatiNomination entity | Domain |
| SvincolatiRepository interface | Domain |
| SetupSvincolati use-case | TDD |
| **NominateFreeAgent con Transaction** | TDD + PERF |
| **SvincolatiBid con bid locking** | TDD + PERF |
| **Server-side timer per svincolati** | PERF |
| **Event batching per svincolati updates** | PERF |
| SvincolatiPrismaRepository | Infrastructure |
| svincolati.routes.ts | API |
| **Svincolati.tsx con Presence Channel** | Presentation + PERF |
| **Optimistic UI per nomination** | PERF |

---

### FASE 8: Trade Module
**Scambi tra manager**

| Task | Tipo |
|------|------|
| TradeOffer aggregate | Domain |
| TradeRepository interface | Domain |
| CreateTrade use-case | TDD |
| AcceptTrade use-case | TDD |
| CounterOffer use-case | TDD |
| ValidateAntiLoop use-case | TDD |
| TradePrismaRepository | Infrastructure |
| trade.routes.ts | API |
| Trades.tsx | Presentation |

---

### FASE 9: Prize Module
**Assegnazione premi budget**

| Task | Tipo |
|------|------|
| Prize aggregate | Domain |
| PrizeCategory entity | Domain |
| PrizeRepository interface | Domain |
| SetupPrizes use-case | TDD |
| AssignPrize use-case | TDD |
| FinalizePrizes use-case | TDD |
| PrizePrismaRepository | Infrastructure |
| prize.routes.ts | API |
| PrizePhasePage.tsx, PrizePhaseManager.tsx | Presentation |

---

### FASE 10: Movement Module
**Storico movimenti e profezie**

| Task | Tipo |
|------|------|
| Movement aggregate | Domain |
| Prophecy entity | Domain |
| MovementRepository interface | Domain |
| RecordMovement event handler | TDD |
| GetMovementHistory use-case | TDD |
| CreateProphecy use-case | TDD |
| MovementPrismaRepository | Infrastructure |
| movement.routes.ts | API |
| Movements.tsx | Presentation |

---

### FASE 11: Chat Module - PERFORMANCE FIX
**Chat real-time sessione**

| Task | Tipo |
|------|------|
| ChatMessage entity | Domain |
| ChatRepository interface | Domain |
| SendMessage use-case | TDD |
| GetMessages use-case | TDD |
| ChatPrismaRepository | Infrastructure |
| chat.routes.ts | API |
| **Pusher channel dedicato per chat** | PERF |
| **Eliminare polling 2s, solo Pusher** | PERF |
| **Chat.tsx con real-time Pusher** | Presentation + PERF |

---

### FASE 12: Admin Module
**Pannello amministrazione**

| Task | Tipo |
|------|------|
| AuditLog entity | Domain |
| AdminRepository interface | Domain |
| GetStatistics use-case | TDD |
| ManagePhase use-case | TDD |
| ImportPlayers use-case | TDD |
| AdminPrismaRepository | Infrastructure |
| admin.routes.ts | API |
| AdminPanel.tsx, SuperAdmin.tsx | Presentation |

---

### FASE 13: Integration & E2E Testing
**Test di integrazione completi**

| Task | Descrizione |
|------|-------------|
| Integration: Complete auction flow | Flusso asta completo |
| Integration: Complete rubata flow | Flusso rubata completo |
| Integration: Complete svincolati flow | Flusso svincolati completo |
| Integration: Complete trade flow | Flusso scambi completo |
| E2E: User registration to first auction | Registrazione → Prima asta |
| E2E: Complete market session | Sessione mercato completa |
| Verify 99% coverage | Controllo copertura |

---

### FASE 14: Cleanup & Documentation
**Pulizia finale**

| Task | Descrizione |
|------|-------------|
| Rimuovere vecchio codice | Eliminare src/services, src/api vecchi |
| Aggiornare README | Nuova architettura |
| Documentare API endpoints | OpenAPI/Swagger |
| Documentare Domain Events | Event catalog |
| Setup per nuovi sviluppatori | Guida onboarding |

---

## Dipendenze tra Fasi

```
FASE 0 ──▶ FASE 1 ──▶ FASE 1.5 ──┬──▶ FASE 2 ──▶ FASE 3 ──▶ FASE 4
                                  │
                                  ├──▶ FASE 5 (Auction) ──┐
                                  │                        │
                                  ├──▶ FASE 6 (Rubata)  ──┼──▶ FASE 10 (Movement)
                                  │                        │
                                  ├──▶ FASE 7 (Svincolati)┘
                                  │
                                  ├──▶ FASE 8 (Trade) ────────▶ FASE 10 (Movement)
                                  │
                                  ├──▶ FASE 9 (Prize)
                                  │
                                  ├──▶ FASE 11 (Chat)
                                  │
                                  └──▶ FASE 12 (Admin)

                                           │
                                           ▼
                                  FASE 13 (Testing)
                                           │
                                           ▼
                                  FASE 14 (Cleanup)
```

## Fasi Parallelizzabili

Dopo le fasi 0, 1, 1.5 (che sono sequenziali), queste fasi possono essere sviluppate **in parallelo**:

| Gruppo | Fasi | Chat Claude Code |
|--------|------|------------------|
| A | 2 (Identity) + 3 (League) + 4 (Roster) | Chat 1 |
| B | 5 (Auction) | Chat 2 |
| C | 6 (Rubata) | Chat 3 |
| D | 7 (Svincolati) | Chat 4 |
| E | 8 (Trade) + 9 (Prize) | Chat 5 |
| F | 11 (Chat) + 12 (Admin) | Chat 6 |

**Nota**: Fase 10 (Movement) dipende da 5, 6, 7, 8 quindi va fatta dopo.

---

## Legenda

| Simbolo | Significato |
|---------|-------------|
| TDD | Test-Driven Development (test prima del codice) |
| PERF | Ottimizzazione performance critica |
| Domain | Layer dominio (business logic pura) |
| Infrastructure | Layer infrastruttura (DB, API) |
| Presentation | Layer presentazione (React UI) |
