# FANTACONTRATTI - Prompt per Claude Code
## Sistema Multi-Agent Agile per lo Sviluppo della Piattaforma

**Versione:** 2.0  
**Data:** Dicembre 2025  
**Scope:** MVP (Sprint 0-8)

---

## 🎯 OVERVIEW DEL PROGETTO

**Nome Progetto:** Fantacontratti  
**Descrizione:** Piattaforma web per la gestione dei mercati del fantacalcio "dinastico" - dove le squadre hanno continuità pluriennale invece di ricominciare ogni stagione.

**Stack Tecnologico:**
- Frontend: React 18 + TypeScript + Vite + TailwindCSS
- Backend: Node.js + Express (o Next.js API Routes)
- Database: PostgreSQL (Render)
- Auth: JWT + bcrypt (o Auth.js/NextAuth)
- Real-time: Socket.io per aste live
- Hosting: Vercel (frontend) + Render (database + backend se necessario)
- Testing: Vitest + React Testing Library + Playwright (target coverage: 95%)

---

## 👤 RUOLO PROJECT MANAGER

**Il Project Manager (Pietro) supervisiona il progetto e deve essere allineato ad ogni milestone.**

### Comunicazione con il PM

Il LEADER deve:
1. **Allineare il PM ad ogni fine Sprint** con report di milestone
2. **Fornire checklist di verifica** per ogni milestone
3. **Garantire test coverage ≥ 95%** prima di dichiarare completato uno sprint
4. **Tracciare tutte le domande** in file dedicati quando ha dubbi

### Sistema Tracciamento Domande

Quando il LEADER ha dubbi o necessita decisioni dal PM, deve:

1. Creare/aggiornare il file `docs/pm-questions/SPRINT-{N}-questions.md`
2. Usare il formato seguente:

```markdown
# Sprint {N} - Domande per il PM

## Domanda #{ID}
**Data:** {data}
**Stato:** 🟡 IN ATTESA | 🟢 RISPOSTO | 🔴 BLOCCANTE

**Categoria:** [REQUISITO | TECNICA | UX | BUSINESS | PRIORITÀ]

**Contesto:**
{descrizione del contesto che ha generato il dubbio}

**Domanda:**
{domanda specifica per il PM}

**Opzioni proposte (se applicabile):**
- A) {opzione A}
- B) {opzione B}

**Risposta PM:**
{risposta del PM - da compilare}

**Data risposta:** {data}

**Azione risultante:**
{cosa farà il team in base alla risposta}

---
```

3. Notificare il PM quando ci sono domande bloccanti
4. Non procedere su task bloccanti fino a risposta

### Registro Domande Globale

Mantenere anche `docs/pm-questions/INDEX.md` con:

```markdown
# Registro Domande PM - Fantacontratti

| Sprint | ID | Categoria | Stato | Domanda (sintesi) | Data |
|--------|----|-----------| ------|-------------------|------|
| 0 | Q001 | TECNICA | 🟢 | Scelta ORM Prisma vs TypeORM | 2025-01-xx |
| 1 | Q002 | REQUISITO | 🟡 | Validazione email obbligatoria? | 2025-01-xx |
```

---

## 🤖 SISTEMA MULTI-AGENT

Opererai come un **LEADER** che coordina un team Agile virtuale. Ad ogni fase, attiverai il subagent appropriato assumendone il ruolo e le competenze specifiche.

### RUOLI DEL TEAM

```
┌─────────────────────────────────────────────────────────────────┐
│                         🎖️ LEADER                               │
│  Coordina il team, gestisce sprint, prende decisioni finali    │
│  Attiva i subagent appropriati per ogni task                   │
│  Comunica con il PM per allineamenti e domande                 │
└─────────────────────────────────────────────────────────────────┘
        │
        ├──► 🏗️ ARCHITETTO
        │    - Definisce struttura progetto e pattern
        │    - Progetta database schema
        │    - Sceglie librerie e dipendenze
        │    - Garantisce scalabilità e manutenibilità
        │
        ├──► 📋 ANALISTA
        │    - Traduce requisiti in user stories tecniche
        │    - Definisce acceptance criteria
        │    - Identifica edge cases e dipendenze
        │    - Valida completezza delle specifiche
        │
        ├──► 💻 SVILUPPATORE
        │    - Implementa codice seguendo best practices
        │    - Scrive codice pulito, tipizzato, documentato
        │    - Segue pattern stabiliti dall'Architetto
        │    - Implementa error handling robusto
        │
        ├──► 🧪 TESTER
        │    - Definisce test cases per ogni feature
        │    - Scrive unit test e integration test
        │    - Verifica edge cases e error scenarios
        │    - Garantisce coverage ≥ 95%
        │
        ├──► 🎨 UX DESIGNER
        │    - Progetta interfacce intuitive
        │    - Definisce user flows
        │    - Garantisce consistency visiva
        │    - Ottimizza usabilità mobile-first
        │
        ├──► 🔒 SECURITY EXPERT
        │    - Valida implementazioni auth
        │    - Identifica vulnerabilità
        │    - Garantisce protezione dati sensibili
        │    - Implementa rate limiting e sanitization
        │
        └──► 📚 DOCUMENTATORE
             - Scrive documentazione tecnica
             - Mantiene README aggiornato
             - Documenta API endpoints
             - Crea guide per sviluppatori
```

### PROTOCOLLO DI ATTIVAZIONE SUBAGENT

Quando attivi un subagent, usa questo formato:

```
═══════════════════════════════════════════════════════════════
🎖️ LEADER → Attivazione [RUOLO]
Task: [descrizione del task]
Contesto: [informazioni rilevanti]
Output atteso: [cosa deve produrre]
═══════════════════════════════════════════════════════════════

[EMOJI RUOLO] [RUOLO] - [Task]
────────────────────────────────────────────────────────────────
[Output del subagent]
────────────────────────────────────────────────────────────────
```

---

## 📋 BACKLOG MVP (Sprint 0-8)

### SPRINT 0: Setup & Infrastruttura
**Obiettivo:** Fondamenta tecniche del progetto

| ID | User Story | Priorità | Subagent |
|----|------------|----------|----------|
| S0.1 | Setup progetto Vite + React + TypeScript | Critical | Architetto → Sviluppatore |
| S0.2 | Configurazione TailwindCSS + tema base | Critical | Sviluppatore → UX Designer |
| S0.3 | Setup PostgreSQL su Render | Critical | Architetto → Sviluppatore |
| S0.4 | Configurazione Prisma ORM + schema iniziale | Critical | Architetto → Sviluppatore |
| S0.5 | Setup Vercel deployment + CI/CD | Critical | Architetto → Sviluppatore |
| S0.6 | Struttura cartelle e convenzioni codice | High | Architetto → Documentatore |
| S0.7 | Setup Vitest + React Testing Library | Critical | Tester → Sviluppatore |
| S0.8 | Configurazione Playwright per E2E | High | Tester → Sviluppatore |

**📊 MILESTONE 0 - Checklist Verifica PM:**
```
□ Progetto React+TS compila senza errori
□ TailwindCSS funzionante con tema base
□ Database PostgreSQL connesso e raggiungibile
□ Prisma migrations funzionanti
□ Deploy Vercel automatico su push main
□ CI/CD pipeline verde
□ Test framework configurato e funzionante
□ Almeno 1 test di esempio passing
□ README con istruzioni setup locale
□ Coverage report generabile
```

**🔗 Servizi Running:**
- Vercel: https://fantacontratti.vercel.app (placeholder)
- Render DB: PostgreSQL connesso
- GitHub Actions: CI/CD attivo

---

### SPRINT 1: Utenti & Leghe
**Obiettivo:** Sistema di autenticazione e gestione leghe

| ID | User Story | Priorità | Subagent |
|----|------------|----------|----------|
| S1.1 | Registrazione utente (email, username, password) | Critical | Analista → Sviluppatore → Tester |
| S1.2 | Login con JWT + refresh token | Critical | Security Expert → Sviluppatore → Tester |
| S1.3 | Logout e gestione sessione | Critical | Sviluppatore → Tester |
| S1.4 | Profilo utente (visualizza/modifica) | High | UX Designer → Sviluppatore |
| S1.5 | Creazione lega (admin) con parametri configurabili | Critical | Analista → Sviluppatore → Tester |
| S1.6 | Sistema inviti a lega (link/email) | High | Sviluppatore → Tester |
| S1.7 | Richiesta partecipazione a lega | High | Sviluppatore → Tester |
| S1.8 | Gestione membri lega (accetta/rifiuta/espelli) | High | Sviluppatore → Tester |
| S1.9 | Ruoli lega: Admin vs Manager | High | Security Expert → Sviluppatore |

**📊 MILESTONE 1 - Checklist Verifica PM:**
```
□ Registrazione utente funzionante con validazione
□ Login/logout funzionante con JWT
□ Refresh token implementato
□ Profilo utente visualizzabile e modificabile
□ Creazione lega con tutti i parametri
□ Invito a lega via link funzionante
□ Richiesta partecipazione funzionante
□ Admin può accettare/rifiutare/espellere membri
□ Distinzione ruoli Admin/Manager funzionante
□ Test coverage ≥ 95% per auth e leghe
□ API documentate (Swagger/OpenAPI)
```

**🔗 Servizi Running:**
- Auth API: /api/auth/* (register, login, logout, refresh)
- Users API: /api/users/*
- Leagues API: /api/leagues/*

**📈 Test Coverage Target:** 95%

---

### SPRINT 2: Database Giocatori
**Obiettivo:** Import e gestione anagrafica giocatori Serie A

| ID | User Story | Priorità | Subagent |
|----|------------|----------|----------|
| S2.1 | Schema database giocatori (nome, ruolo, squadra, quotazione) | Critical | Architetto → Sviluppatore |
| S2.2 | Import giocatori da file Excel/CSV | Critical | Analista → Sviluppatore → Tester |
| S2.3 | Interfaccia lista giocatori con filtri (ruolo, squadra, prezzo) | High | UX Designer → Sviluppatore |
| S2.4 | Ricerca giocatori per nome | High | Sviluppatore |
| S2.5 | Dettaglio giocatore (statistiche base) | Medium | UX Designer → Sviluppatore |
| S2.6 | Aggiornamento massivo quotazioni | Medium | Sviluppatore → Tester |

**📊 MILESTONE 2 - Checklist Verifica PM:**
```
□ Schema giocatori completo in DB
□ Import CSV/Excel funzionante (testare con file reale)
□ Lista giocatori con paginazione
□ Filtri per ruolo funzionanti (P, D, C, A)
□ Filtri per squadra funzionanti
□ Filtri per range prezzo funzionanti
□ Ricerca per nome funzionante (case-insensitive)
□ Pagina dettaglio giocatore
□ Aggiornamento massivo quotazioni testato
□ Test coverage ≥ 95% per modulo players
```

**🔗 Servizi Running:**
- Players API: /api/players/* (list, detail, import, update)
- Import endpoint: /api/admin/players/import

**📈 Test Coverage Target:** 95%

---

### SPRINT 3: PRIMO MERCATO (Asta Libera)
**Obiettivo:** Sistema aste per allestimento rose iniziali

| ID | User Story | Priorità | Subagent |
|----|------------|----------|----------|
| S3.1 | Configurazione PRIMO MERCATO (budget iniziale, slot rosa) | Critical | Analista → Sviluppatore |
| S3.2 | Apertura/chiusura PRIMO MERCATO (admin) | Critical | Sviluppatore → Tester |
| S3.3 | Asta libera real-time (rilanci, timer, aggiudicazione) | Critical | Architetto → Sviluppatore → Tester |
| S3.4 | WebSocket per aggiornamenti live aste | Critical | Architetto → Sviluppatore |
| S3.5 | Gestione budget manager (detrazione acquisti) | Critical | Sviluppatore → Tester |
| S3.6 | Vincoli rosa (min/max per ruolo: P, D, C, A) | High | Analista → Sviluppatore → Tester |
| S3.7 | Assegnazione giocatore a rosa post-asta | Critical | Sviluppatore → Tester |
| S3.8 | Dashboard rosa manager (giocatori posseduti) | High | UX Designer → Sviluppatore |
| S3.9 | Storico aste completate | Medium | Sviluppatore |

**📊 MILESTONE 3 - Checklist Verifica PM:**
```
□ Admin può configurare PRIMO MERCATO (budget, slot)
□ Admin può aprire/chiudere PRIMO MERCATO
□ Asta libera funzionante in real-time
□ WebSocket stabile (testare con 8 utenti simultanei)
□ Rilanci visualizzati istantaneamente
□ Timer asta funzionante
□ Aggiudicazione automatica a fine timer
□ Budget decrementato correttamente post-acquisto
□ Vincoli rosa rispettati (blocco se slot pieni)
□ Giocatore assegnato a rosa post-asta
□ Dashboard rosa mostra giocatori posseduti
□ Storico aste consultabile
□ Test coverage ≥ 95% per modulo auctions
□ Test E2E per flusso asta completo
```

**🔗 Servizi Running:**
- Market API: /api/market/* (config, open, close)
- Auctions API: /api/auctions/* (create, bid, complete)
- WebSocket: wss://fantacontratti.../auctions
- Roster API: /api/roster/*

**📈 Test Coverage Target:** 95%

---

### SPRINT 4: Sistema Contratti
**Obiettivo:** Meccanica core del sistema dinastico

| ID | User Story | Priorità | Subagent |
|----|------------|----------|----------|
| S4.1 | Schema contratto (ingaggio, durata 1-4, clausola) | Critical | Architetto → Sviluppatore |
| S4.2 | Calcolo clausola rescissione: Ingaggio × Moltiplicatore | Critical | Analista → Sviluppatore → Tester |
| S4.3 | Moltiplicatori durata: 4→11, 3→9, 2→7, 1→4 | Critical | Sviluppatore → Tester |
| S4.4 | Fase CONTRATTI nel mercato (apertura/chiusura admin) | Critical | Sviluppatore → Tester |
| S4.5 | Interfaccia impostazione contratti per rosa | Critical | UX Designer → Sviluppatore |
| S4.6 | Validazione budget sufficiente per ingaggi totali | Critical | Sviluppatore → Tester |
| S4.7 | Decremento automatico durata a nuovo mercato | Critical | Sviluppatore → Tester |
| S4.8 | Sistema rinnovi (no ribasso ingaggio/durata) | High | Analista → Sviluppatore → Tester |
| S4.9 | Regola SPALMAINGAGGI (durata=1 → spalma su più anni) | High | Analista → Sviluppatore → Tester |
| S4.10 | Scadenza contratto (durata=0 → giocatore svincolato) | High | Sviluppatore → Tester |

**📊 MILESTONE 4 - Checklist Verifica PM:**
```
□ Schema contratto completo in DB
□ Clausola calcolata correttamente (verificare formula)
□ Test moltiplicatori: 4→11, 3→9, 2→7, 1→4
□ Admin può aprire/chiudere fase CONTRATTI
□ UI impostazione contratti intuitiva
□ Validazione budget: blocco se ingaggi > budget
□ Decremento durata automatico testato
□ Rinnovo bloccato se ribasso (test edge cases)
□ SPALMAINGAGGI funzionante (20x1 → 10x2 o 5x4)
□ Giocatore svincolato automaticamente se durata=0
□ Test coverage ≥ 95% per modulo contracts
□ Test edge cases SPALMAINGAGGI
```

**🔗 Servizi Running:**
- Contracts API: /api/contracts/* (create, renew, calculate)
- Phase API: /api/market/phase/contracts

**📈 Test Coverage Target:** 95%

---

### SPRINT 5: Scambi/Offerte
**Obiettivo:** Trattative tra manager

| ID | User Story | Priorità | Subagent |
|----|------------|----------|----------|
| S5.1 | Fase SCAMBI/OFFERTE nel mercato (apertura/chiusura admin) | Critical | Sviluppatore → Tester |
| S5.2 | Creazione offerta (giocatori + budget offerti/richiesti) | Critical | Analista → Sviluppatore |
| S5.3 | Visualizzazione offerte ricevute/inviate | High | UX Designer → Sviluppatore |
| S5.4 | Accetta/Rifiuta offerta | Critical | Sviluppatore → Tester |
| S5.5 | Controofferta | High | Sviluppatore → Tester |
| S5.6 | Esecuzione scambio (trasferimento giocatori + budget) | Critical | Sviluppatore → Tester |
| S5.7 | Vincolo anti-scambi a ritroso (nella stessa sessione) | High | Analista → Sviluppatore → Tester |
| S5.8 | Storico scambi completati | Medium | Sviluppatore |

**📊 MILESTONE 5 - Checklist Verifica PM:**
```
□ Admin può aprire/chiudere fase SCAMBI/OFFERTE
□ Creazione offerta con giocatori + budget
□ Lista offerte ricevute visibile
□ Lista offerte inviate visibile
□ Accetta offerta funzionante
□ Rifiuta offerta funzionante
□ Controofferta funzionante
□ Scambio eseguito correttamente (giocatori + budget)
□ Vincolo anti-ritroso: test scenario A→B poi B→A bloccato
□ Storico scambi consultabile
□ Test coverage ≥ 95% per modulo trades
□ Test E2E per flusso scambio completo
```

**🔗 Servizi Running:**
- Trades API: /api/trades/* (create, accept, reject, counter)
- Phase API: /api/market/phase/trades

**📈 Test Coverage Target:** 95%

---

### SPRINT 6: Rubata
**Obiettivo:** Sistema aste forzate per riequilibrio competitivo

| ID | User Story | Priorità | Subagent |
|----|------------|----------|----------|
| S6.1 | Fase RUBATA nel mercato (apertura/chiusura admin) | Critical | Sviluppatore → Tester |
| S6.2 | Impostazione ordine rubata manuale (admin) | Critical | Analista → Sviluppatore → Tester |
| S6.3 | Interfaccia admin per definire ordine squadre | Critical | UX Designer → Sviluppatore |
| S6.4 | Sequenza rubata per squadra: P→D→C→A, ordine alfabetico | Critical | Analista → Sviluppatore → Tester |
| S6.5 | Selezione giocatori "sul piatto" da squadra di turno | Critical | UX Designer → Sviluppatore |
| S6.6 | Asta per giocatore rubabile (base = clausola + ingaggio) | Critical | Sviluppatore → Tester |
| S6.7 | Impossibilità rifiuto offerte (meccanismo forzato) | Critical | Analista → Sviluppatore → Tester |
| S6.8 | Trasferimento giocatore a vincitore asta | Critical | Sviluppatore → Tester |
| S6.9 | Gestione budget rubata (incasso clausola+ingaggio al cedente) | Critical | Sviluppatore → Tester |
| S6.10 | Skip turno se nessun giocatore rubabile | Medium | Sviluppatore |
| S6.11 | Avanzamento automatico al prossimo turno | High | Sviluppatore → Tester |

**📊 MILESTONE 6 - Checklist Verifica PM:**
```
□ Admin può aprire/chiudere fase RUBATA
□ Admin può impostare ordine rubata manualmente
□ UI ordinamento squadre drag&drop o simile
□ Sequenza giocatori corretta: P→D→C→A, poi alfabetico
□ Squadra di turno può mettere giocatori "sul piatto"
□ Asta parte con base = clausola + ingaggio
□ Asta rubata funzionante in real-time
□ Proprietario NON può rifiutare (test forzatura)
□ Giocatore trasferito al vincitore
□ Cedente incassa clausola + ingaggio
□ Budget aggiornati correttamente
□ Skip turno se rosa vuota o non rubabili
□ Avanzamento automatico al turno successivo
□ Test coverage ≥ 95% per modulo rubata
□ Test E2E per flusso rubata completo
```

**🔗 Servizi Running:**
- Rubata API: /api/rubata/* (order, turn, auction)
- Phase API: /api/market/phase/rubata
- WebSocket: wss://fantacontratti.../rubata

**📈 Test Coverage Target:** 95%

---

### SPRINT 7: Svincolati
**Obiettivo:** Acquisizione giocatori non assegnati

| ID | User Story | Priorità | Subagent |
|----|------------|----------|----------|
| S7.1 | Fase SVINCOLATI nel mercato (apertura/chiusura admin) | Critical | Sviluppatore → Tester |
| S7.2 | Pool svincolati (giocatori Serie A non in nessuna rosa) | Critical | Sviluppatore → Tester |
| S7.3 | Interfaccia browsing svincolati con filtri | High | UX Designer → Sviluppatore |
| S7.4 | Asta libera per svincolati | Critical | Sviluppatore → Tester |
| S7.5 | Prezzo base svincolato = quotazione | High | Analista → Sviluppatore |
| S7.6 | Finestra temporale svincolati (gestita da admin) | High | Sviluppatore → Tester |
| S7.7 | Assegnazione svincolato a vincitore + contratto | High | Sviluppatore → Tester |

**📊 MILESTONE 7 - Checklist Verifica PM:**
```
□ Admin può aprire/chiudere fase SVINCOLATI
□ Pool svincolati calcolato correttamente
□ Lista svincolati con filtri (ruolo, squadra, prezzo)
□ Asta libera per svincolati funzionante
□ Prezzo base = quotazione giocatore
□ WebSocket per aste svincolati
□ Admin controlla apertura/chiusura finestra
□ Vincitore riceve giocatore in rosa
□ Obbligo impostare contratto per nuovo acquisto
□ Test coverage ≥ 95% per modulo freeagents
```

**🔗 Servizi Running:**
- FreeAgents API: /api/freeagents/* (list, auction)
- Phase API: /api/market/phase/freeagents

**📈 Test Coverage Target:** 95%

---

### SPRINT 8: Dashboard & Admin
**Obiettivo:** Pannelli di controllo e gestione

| ID | User Story | Priorità | Subagent |
|----|------------|----------|----------|
| S8.1 | Dashboard manager completa | Critical | UX Designer → Sviluppatore |
| S8.2 | Vista rosa con contratti e scadenze | Critical | Sviluppatore |
| S8.3 | Vista budget dettagliato (entrate/uscite) | High | Sviluppatore |
| S8.4 | Pannello admin lega completo | Critical | UX Designer → Sviluppatore |
| S8.5 | Gestione sessioni mercato (crea, configura fasi) | Critical | Analista → Sviluppatore → Tester |
| S8.6 | Sequenza fasi mercato ricorrente | High | Sviluppatore → Tester |
| S8.7 | Log operazioni per audit | Medium | Security Expert → Sviluppatore |
| S8.8 | Export dati lega (CSV) | Low | Sviluppatore |

**📊 MILESTONE 8 (FINALE MVP) - Checklist Verifica PM:**
```
□ Dashboard manager mostra:
  □ Rosa completa con dettagli
  □ Contratti con scadenze
  □ Budget disponibile
  □ Storico movimenti
□ Pannello admin mostra:
  □ Lista membri con ruoli
  □ Configurazione lega
  □ Gestione sessioni mercato
□ Admin può creare nuova sessione mercato
□ Admin può configurare sequenza fasi
□ Fasi mercato ricorrente: SCAMBI→CONTRATTI→RUBATA→SVINCOLATI→SCAMBI
□ Log operazioni registrato
□ Export CSV funzionante
□ Test coverage GLOBALE ≥ 95%
□ Tutti i servizi API documentati
□ README completo con guida utente
□ Deploy production stabile
```

**🔗 Servizi Running (MVP Completo):**
- Frontend: https://fantacontratti.vercel.app
- Auth API: /api/auth/*
- Users API: /api/users/*
- Leagues API: /api/leagues/*
- Players API: /api/players/*
- Market API: /api/market/*
- Auctions API: /api/auctions/*
- Contracts API: /api/contracts/*
- Trades API: /api/trades/*
- Rubata API: /api/rubata/*
- FreeAgents API: /api/freeagents/*
- Admin API: /api/admin/*
- WebSocket: wss://fantacontratti.vercel.app/ws

**📈 Test Coverage Target FINALE:** 95%

---

## 🗄️ DATABASE SCHEMA (Prisma)

```prisma
// schema.prisma - Schema completo Fantacontratti MVP

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ==================== UTENTI ====================
model User {
  id            String   @id @default(cuid())
  email         String   @unique
  username      String   @unique
  passwordHash  String
  emailVerified Boolean  @default(false)
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  // Relazioni
  leagueMemberships LeagueMember[]
  sentOffers        TradeOffer[]     @relation("OfferSender")
  receivedOffers    TradeOffer[]     @relation("OfferReceiver")
  auctionBids       AuctionBid[]
  auditLogs         AuditLog[]
}

// ==================== LEGHE ====================
model League {
  id               String   @id @default(cuid())
  name             String
  description      String?
  maxParticipants  Int      @default(8)
  initialBudget    Int      @default(500)
  
  // Slot rosa
  goalkeeperSlots  Int      @default(3)
  defenderSlots    Int      @default(8)
  midfielderSlots  Int      @default(8)
  forwardSlots     Int      @default(6)
  
  // Stato
  status           LeagueStatus @default(DRAFT)
  currentSeason    Int          @default(1)
  
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt

  // Relazioni
  members          LeagueMember[]
  marketSessions   MarketSession[]
  auctions         Auction[]
  auditLogs        AuditLog[]
}

enum LeagueStatus {
  DRAFT
  ACTIVE
  ARCHIVED
}

// ==================== MEMBRI LEGA ====================
model LeagueMember {
  id          String   @id @default(cuid())
  
  userId      String
  user        User     @relation(fields: [userId], references: [id])
  
  leagueId    String
  league      League   @relation(fields: [leagueId], references: [id])
  
  role        MemberRole @default(MANAGER)
  teamName    String?
  status      MemberStatus @default(PENDING)
  
  // Budget
  currentBudget Int    @default(0)
  
  // Ordine Rubata (impostato da admin)
  rubataOrder   Int?
  
  joinedAt    DateTime @default(now())
  
  // Relazioni
  roster      PlayerRoster[]
  contracts   PlayerContract[]
  wonAuctions Auction[]        @relation("AuctionWinner")
  bids        AuctionBid[]

  @@unique([userId, leagueId])
}

enum MemberRole {
  ADMIN
  MANAGER
}

enum MemberStatus {
  PENDING
  ACTIVE
  SUSPENDED
  LEFT
}

// ==================== GIOCATORI SERIE A ====================
model SerieAPlayer {
  id           String   @id @default(cuid())
  externalId   String?  @unique
  name         String
  team         String
  position     Position
  quotation    Int      @default(1)
  age          Int?
  isActive     Boolean  @default(true)
  
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  // Relazioni
  rosters      PlayerRoster[]
  auctions     Auction[]
}

enum Position {
  P  // Portiere
  D  // Difensore
  C  // Centrocampista
  A  // Attaccante
}

// ==================== ROSA MANAGER ====================
model PlayerRoster {
  id              String   @id @default(cuid())
  
  leagueMemberId  String
  leagueMember    LeagueMember @relation(fields: [leagueMemberId], references: [id])
  
  playerId        String
  player          SerieAPlayer @relation(fields: [playerId], references: [id])
  
  acquisitionPrice Int
  acquisitionType  AcquisitionType
  
  status          RosterStatus @default(ACTIVE)
  acquiredAt      DateTime     @default(now())
  releasedAt      DateTime?

  // Relazioni
  contract        PlayerContract?

  @@unique([leagueMemberId, playerId, status])
}

enum AcquisitionType {
  FIRST_MARKET
  RUBATA
  SVINCOLATI
  TRADE
}

enum RosterStatus {
  ACTIVE
  RELEASED
  TRADED
}

// ==================== CONTRATTI ====================
model PlayerContract {
  id              String   @id @default(cuid())
  
  rosterId        String   @unique
  roster          PlayerRoster @relation(fields: [rosterId], references: [id])
  
  leagueMemberId  String
  leagueMember    LeagueMember @relation(fields: [leagueMemberId], references: [id])
  
  // Parametri contratto
  salary          Int      // Ingaggio
  duration        Int      // Durata (1-4 semestri)
  initialSalary   Int      // Per validazione rinnovi
  initialDuration Int      // Per validazione rinnovi
  
  // Calcolato
  rescissionClause Int     // salary * multiplier
  
  signedAt        DateTime @default(now())
  expiresAt       DateTime?
  
  // Storico rinnovi
  renewalHistory  Json?    // [{salary, duration, renewedAt}]
}

// ==================== SESSIONI MERCATO ====================
model MarketSession {
  id          String   @id @default(cuid())
  
  leagueId    String
  league      League   @relation(fields: [leagueId], references: [id])
  
  type        MarketType
  season      Int
  semester    Int      // 1 = estivo, 2 = invernale
  
  status      SessionStatus @default(SCHEDULED)
  currentPhase MarketPhase?
  
  // Ordine rubata per questa sessione (JSON array di leagueMemberId)
  rubataOrder  Json?
  
  startsAt    DateTime?
  endsAt      DateTime?
  
  createdAt   DateTime @default(now())

  // Relazioni
  auctions    Auction[]
  trades      TradeOffer[]
}

enum MarketType {
  PRIMO_MERCATO
  MERCATO_RICORRENTE
}

enum SessionStatus {
  SCHEDULED
  ACTIVE
  COMPLETED
  CANCELLED
}

enum MarketPhase {
  ASTA_LIBERA         // Solo per PRIMO_MERCATO
  SCAMBI_OFFERTE_1
  CONTRATTI
  RUBATA
  SVINCOLATI
  SCAMBI_OFFERTE_2
}

// ==================== ASTE ====================
model Auction {
  id              String   @id @default(cuid())
  
  leagueId        String
  league          League   @relation(fields: [leagueId], references: [id])
  
  marketSessionId String?
  marketSession   MarketSession? @relation(fields: [marketSessionId], references: [id])
  
  playerId        String
  player          SerieAPlayer @relation(fields: [playerId], references: [id])
  
  type            AuctionType
  basePrice       Int
  currentPrice    Int
  
  winnerId        String?
  winner          LeagueMember? @relation("AuctionWinner", fields: [winnerId], references: [id])
  
  // Per rubata: chi sta cedendo
  sellerId        String?
  
  status          AuctionStatus @default(PENDING)
  
  startsAt        DateTime?
  endsAt          DateTime?
  
  createdAt       DateTime @default(now())

  // Relazioni
  bids            AuctionBid[]
}

enum AuctionType {
  FREE_BID        // Asta libera (PRIMO MERCATO e SVINCOLATI)
  RUBATA          // Asta rubata (forzata)
}

enum AuctionStatus {
  PENDING
  ACTIVE
  COMPLETED
  CANCELLED
  NO_BIDS
}

model AuctionBid {
  id          String   @id @default(cuid())
  
  auctionId   String
  auction     Auction  @relation(fields: [auctionId], references: [id])
  
  bidderId    String
  bidder      LeagueMember @relation(fields: [bidderId], references: [id])
  
  userId      String
  user        User     @relation(fields: [userId], references: [id])
  
  amount      Int
  isWinning   Boolean  @default(false)
  
  placedAt    DateTime @default(now())
}

// ==================== SCAMBI ====================
model TradeOffer {
  id              String   @id @default(cuid())
  
  marketSessionId String
  marketSession   MarketSession @relation(fields: [marketSessionId], references: [id])
  
  senderId        String
  sender          User     @relation("OfferSender", fields: [senderId], references: [id])
  
  receiverId      String
  receiver        User     @relation("OfferReceiver", fields: [receiverId], references: [id])
  
  // Offerta
  offeredPlayers  Json     // [playerId, ...]
  offeredBudget   Int      @default(0)
  
  // Richiesta
  requestedPlayers Json    // [playerId, ...]
  requestedBudget  Int     @default(0)
  
  status          TradeStatus @default(PENDING)
  
  // Per vincolo anti-ritroso
  involvedPlayers Json     // tutti i playerId coinvolti
  
  message         String?
  
  createdAt       DateTime @default(now())
  respondedAt     DateTime?
  
  // Controproposta
  parentOfferId   String?
  parentOffer     TradeOffer?  @relation("CounterOffers", fields: [parentOfferId], references: [id])
  counterOffers   TradeOffer[] @relation("CounterOffers")
}

enum TradeStatus {
  PENDING
  ACCEPTED
  REJECTED
  COUNTERED
  CANCELLED
  EXPIRED
}

// ==================== AUDIT LOG ====================
model AuditLog {
  id          String   @id @default(cuid())
  
  userId      String?
  user        User?    @relation(fields: [userId], references: [id])
  
  leagueId    String?
  league      League?  @relation(fields: [leagueId], references: [id])
  
  action      String
  entityType  String?
  entityId    String?
  oldValues   Json?
  newValues   Json?
  
  ipAddress   String?
  userAgent   String?
  
  createdAt   DateTime @default(now())
}
```

---

## 📁 STRUTTURA PROGETTO

```
fantacontratti/
├── .github/
│   └── workflows/
│       ├── ci.yml              # Test + Coverage check
│       └── deploy.yml          # Deploy Vercel
├── docs/
│   ├── sprint-briefs/          # 📋 Brief pre-sprint (approvazione PM)
│   │   ├── SPRINT-0-brief.md
│   │   ├── SPRINT-1-brief.md
│   │   └── ...
│   ├── pm-questions/           # ❓ Domande per il PM
│   │   ├── INDEX.md
│   │   ├── SPRINT-0-questions.md
│   │   └── ...
│   ├── changes/                # 🔄 Change Requests
│   │   ├── INDEX.md
│   │   ├── CR-001.md
│   │   └── ...
│   ├── milestones/             # 📊 Report Milestone
│   │   ├── MILESTONE-0-report.md
│   │   └── ...
│   ├── api/                    # 📚 Documentazione API
│   └── architecture/           # 🏗️ Diagrammi architettura
├── prisma/
│   ├── schema.prisma
│   ├── migrations/
│   └── seed.ts
├── public/
├── src/
│   ├── components/
│   │   ├── ui/
│   │   ├── layout/
│   │   ├── auth/
│   │   ├── league/
│   │   ├── player/
│   │   ├── auction/
│   │   ├── contract/
│   │   ├── trade/
│   │   ├── rubata/
│   │   └── dashboard/
│   ├── pages/
│   ├── hooks/
│   ├── services/
│   ├── stores/
│   ├── types/
│   ├── utils/
│   ├── lib/
│   ├── api/
│   ├── App.tsx
│   ├── main.tsx
│   └── index.css
├── tests/
│   ├── unit/
│   ├── integration/
│   └── e2e/
├── .env.example
├── .eslintrc.json
├── .prettierrc
├── tailwind.config.js
├── tsconfig.json
├── vite.config.ts
├── vitest.config.ts
├── playwright.config.ts
├── package.json
├── CHANGELOG.md                # 📝 Storico modifiche
└── README.md
```

---

## ⚙️ REGOLE DI BUSINESS CRITICHE

### Sistema Contratti

```typescript
// Moltiplicatori per calcolo clausola rescissione
const DURATION_MULTIPLIERS: Record<number, number> = {
  4: 11,  // 4 semestri = moltiplicatore 11
  3: 9,   // 3 semestri = moltiplicatore 9
  2: 7,   // 2 semestri = moltiplicatore 7
  1: 4,   // 1 semestre = moltiplicatore 4
};

// Calcolo clausola
export const calculateRescissionClause = (salary: number, duration: number): number => {
  const multiplier = DURATION_MULTIPLIERS[duration];
  if (!multiplier) throw new Error(`Invalid duration: ${duration}`);
  return salary * multiplier;
};

// Validazione rinnovo (no ribasso)
export const isValidRenewal = (
  currentSalary: number,
  currentDuration: number,
  newSalary: number,
  newDuration: number,
  initialSalary: number
): { valid: boolean; reason?: string } => {
  // Caso SPALMAINGAGGI: durata corrente = 1
  if (currentDuration === 1) {
    // Può spalmare: newSalary * newDuration >= initialSalary
    const isValid = newSalary * newDuration >= initialSalary;
    return {
      valid: isValid,
      reason: isValid ? undefined : `Spalma non valido: ${newSalary}x${newDuration} < ${initialSalary}`
    };
  }
  
  // Caso normale: no ribasso
  if (newSalary < currentSalary) {
    return { valid: false, reason: `Ingaggio non può diminuire: ${newSalary} < ${currentSalary}` };
  }
  if (newDuration < currentDuration) {
    return { valid: false, reason: `Durata non può diminuire: ${newDuration} < ${currentDuration}` };
  }
  
  return { valid: true };
};
```

### Sistema Rubata

```typescript
// Sequenza giocatori per squadra: P → D → C → A, poi alfabetico
const POSITION_ORDER: Record<Position, number> = { P: 1, D: 2, C: 3, A: 4 };

export const getPlayerRubataSequence = (roster: PlayerWithContract[]): PlayerWithContract[] => {
  return [...roster].sort((a, b) => {
    // Prima per ruolo
    if (POSITION_ORDER[a.position] !== POSITION_ORDER[b.position]) {
      return POSITION_ORDER[a.position] - POSITION_ORDER[b.position];
    }
    // Poi alfabetico
    return a.name.localeCompare(b.name, 'it');
  });
};

// Prezzo base asta rubata
export const getRubataBasePrice = (contract: Contract): number => {
  return contract.rescissionClause + contract.salary;
};

// L'ordine delle squadre è MANUALE (deciso dall'admin)
// Salvato in MarketSession.rubataOrder come JSON array di leagueMemberId
```

### Vincolo Anti-Scambi a Ritroso

```typescript
// Verifica se uno scambio viola il vincolo anti-ritroso
export const isTradeBlocked = (
  sessionId: string,
  playerId: string,
  fromManagerId: string,
  toManagerId: string,
  sessionTrades: CompletedTrade[]
): { blocked: boolean; reason?: string } => {
  // Cerca se in questa sessione il giocatore è già passato da toManager a fromManager
  const conflictingTrade = sessionTrades.find(trade => 
    trade.sessionId === sessionId &&
    trade.involvedPlayers.includes(playerId) &&
    trade.senderId === toManagerId &&
    trade.receiverId === fromManagerId &&
    trade.status === 'ACCEPTED'
  );
  
  if (conflictingTrade) {
    return {
      blocked: true,
      reason: `Giocatore già ceduto da ${toManagerId} a ${fromManagerId} in questa sessione`
    };
  }
  
  return { blocked: false };
};
```

---

## 📋 SPRINT PLANNING & APPROVAZIONE PM

### Processo Pre-Sprint

**PRIMA di iniziare qualsiasi implementazione**, il LEADER deve:

1. **Produrre lo Sprint Brief** per approvazione PM
2. **Attendere OK esplicito** dal PM prima di procedere
3. **Tracciare eventuali modifiche** richieste dal PM

### Documento Sprint Brief

Il LEADER produce `docs/sprint-briefs/SPRINT-{N}-brief.md`:

```markdown
# Sprint {N} Brief - {Nome Sprint}

**Data:** {data}
**Durata stimata:** {giorni}
**Dipendenze:** Sprint {N-1} completato

---

## 🎯 OBIETTIVO SPRINT

{Descrizione chiara dell'obiettivo in 2-3 frasi}

---

## 📖 DESCRIZIONE FUNZIONALE

### Contesto
{Dove ci troviamo nel flusso della piattaforma, cosa è già stato fatto}

### Cosa realizzeremo
{Descrizione discorsiva delle funzionalità, scritta per essere comprensibile
anche a chi non è tecnico. Deve spiegare il "cosa" e il "perché".}

### Flusso Utente Step-by-Step

**Scenario principale:**
1. {Utente fa X}
2. {Sistema risponde Y}
3. {Utente vede Z}
4. ...

**Scenario alternativo (se applicabile):**
1. ...

### Regole di Business
- {Regola 1 con esempio concreto}
- {Regola 2 con esempio concreto}
- ...

---

## 📝 USER STORIES DETTAGLIATE

### US-{N}.1: {Titolo}

**Come** {ruolo utente}
**Voglio** {azione}
**Così che** {beneficio}

**Acceptance Criteria:**
- [ ] AC1: {criterio verificabile}
- [ ] AC2: {criterio verificabile}
- [ ] AC3: {criterio verificabile}

**Esempio concreto:**
> {Scenario reale con nomi e numeri specifici}

**Edge Cases:**
- {caso limite 1}: {comportamento atteso}
- {caso limite 2}: {comportamento atteso}

---

### US-{N}.2: {Titolo}
{...stesso formato...}

---

## 🖼️ MOCKUP/WIREFRAME (se necessario)

{Descrizione testuale delle schermate principali o ASCII art}

---

## ⚠️ DIPENDENZE E RISCHI

| Dipendenza/Rischio | Impatto | Mitigazione |
|--------------------|---------|-------------|
| {item} | {alto/medio/basso} | {azione} |

---

## ❓ DOMANDE APERTE PER IL PM

{Se ci sono dubbi, listarli qui PRIMA di procedere}

1. {Domanda 1}
2. {Domanda 2}

---

## ✅ CONFERMA PM

- [ ] Ho letto e compreso lo Sprint Brief
- [ ] Le user stories sono corrette e complete
- [ ] Le regole di business sono corrette
- [ ] Posso procedere con l'implementazione

**Firma PM:** _______________
**Data approvazione:** _______________
```

---

## 🔄 CHANGE MANAGEMENT

### Gestione Modifiche in Corso d'Opera

Quando emergono modifiche durante lo sviluppo (richieste dal PM o identificate dal team):

1. **Creare Change Request** in `docs/changes/CR-{XXX}.md`
2. **Valutare impatto** con il team
3. **Sottoporre al PM** per approvazione
4. **Propagare al team** una volta approvato

### Documento Change Request

```markdown
# Change Request CR-{XXX}

**Data:** {data}
**Sprint:** {N}
**Richiedente:** PM | Leader | {Ruolo}
**Stato:** 🟡 PROPOSTA | 🟢 APPROVATA | 🔴 RIFIUTATA | ⏸️ POSTICIPATA

---

## Descrizione Modifica

**Cosa cambia:**
{Descrizione chiara della modifica}

**Motivazione:**
{Perché serve questa modifica}

---

## Impatto

**User Stories impattate:**
- US-{X}.{Y}: {tipo impatto}
- US-{X}.{Z}: {tipo impatto}

**Codice impattato:**
- {modulo/file}: {tipo modifica}

**Database impattato:**
- [ ] Sì → {descrizione migrazione}
- [ ] No

**Effort stimato:** {ore/giorni}

**Rischio:** Alto | Medio | Basso

---

## Prima vs Dopo

**PRIMA:**
{Come funziona/funzionava}

**DOPO:**
{Come funzionerà}

---

## Decisione PM

- [ ] ✅ Approvata → Procedere
- [ ] ❌ Rifiutata → Motivo: ___
- [ ] ⏸️ Posticipata a Sprint {N}

**Note PM:**
{eventuali note}

**Data decisione:** _______________
```

### Registro Change Requests

Mantenere `docs/changes/INDEX.md`:

```markdown
# Registro Change Requests - Fantacontratti

| ID | Sprint | Descrizione | Stato | Data | Impatto |
|----|--------|-------------|-------|------|---------|
| CR-001 | 3 | Timer asta configurabile | 🟢 | 2025-01-xx | Medio |
| CR-002 | 4 | Nuovo moltiplicatore durata 5 | 🔴 | 2025-01-xx | Alto |
```

### Propagazione Modifiche al Team

Quando una CR viene approvata, il LEADER:

1. **Aggiorna lo Sprint Brief** con le modifiche
2. **Aggiorna le User Stories** impattate
3. **Comunica al team** con formato:

```
═══════════════════════════════════════════════════════════════
🎖️ LEADER → TEAM UPDATE
Change Request: CR-{XXX} APPROVATA
═══════════════════════════════════════════════════════════════

📌 MODIFICA:
{Descrizione breve}

📋 IMPATTO SU USER STORIES:
- US-{X}.{Y}: {modifica}
- US-{X}.{Z}: {modifica}

💻 AZIONI RICHIESTE:
- 🏗️ ARCHITETTO: {azione se necessaria}
- 💻 SVILUPPATORE: {azione}
- 🧪 TESTER: {test da aggiornare}

⏰ PRIORITÀ: {Alta/Media/Bassa}
═══════════════════════════════════════════════════════════════
```

4. **Aggiorna il backlog** se necessario
5. **Traccia nel CHANGELOG** del progetto

---

## 🚀 WORKFLOW DI SVILUPPO

### Per ogni Sprint:

```
┌─────────────────────────────────────────────────────────────┐
│                    FASE 1: PLANNING                         │
└─────────────────────────────────────────────────────────────┘
   │
   ├─► 🎖️ LEADER produce Sprint Brief
   │      - Descrizione funzionale dettagliata
   │      - User stories con acceptance criteria
   │      - Flussi step-by-step
   │      - Regole di business con esempi
   │
   ├─► 🎖️ LEADER presenta Brief al PM
   │
   ├─► 👤 PM revisiona e:
   │      - ✅ Approva → si procede
   │      - ❓ Chiede chiarimenti → LEADER risponde
   │      - 🔄 Richiede modifiche → LEADER aggiorna Brief
   │
   └─► ⏸️ STOP finché PM non approva
   
┌─────────────────────────────────────────────────────────────┐
│                  FASE 2: IMPLEMENTAZIONE                    │
└─────────────────────────────────────────────────────────────┘
   │
   ├─► 📋 ANALISTA dettaglia aspetti tecnici
   │
   ├─► 🏗️ ARCHITETTO definisce struttura
   │
   ├─► 🎨 UX DESIGNER progetta interfacce
   │
   ├─► 💻 SVILUPPATORE implementa
   │      │
   │      └─► Se emergono dubbi/modifiche:
   │            - Crea Change Request
   │            - Attende approvazione PM
   │            - Propaga modifiche al team
   │
   ├─► 🧪 TESTER scrive test (target 95%)
   │
   └─► 🔒 SECURITY EXPERT valida sicurezza

┌─────────────────────────────────────────────────────────────┐
│                    FASE 3: MILESTONE                        │
└─────────────────────────────────────────────────────────────┘
   │
   ├─► 🎖️ LEADER verifica checklist completa
   │
   ├─► 🧪 TESTER conferma coverage ≥ 95%
   │
   ├─► 📚 DOCUMENTATORE aggiorna docs
   │
   ├─► 🎖️ LEADER produce Report Milestone
   │
   └─► 👤 PM valida e autorizza Sprint successivo
```

### Report Milestone per PM

Al termine di ogni sprint, il LEADER produce:

```markdown
# Report Milestone Sprint {N}

**Data:** {data}
**Sprint:** {N} - {nome}
**Status:** ✅ COMPLETATO | ⚠️ PARZIALE | ❌ BLOCCATO

## Checklist Verifica
{checklist con ✅/❌ per ogni item}

## Test Coverage
- Coverage attuale: {X}%
- Target: 95%
- Status: ✅ RAGGIUNTO | ❌ NON RAGGIUNTO

## Servizi Deployati
{lista servizi con URL}

## Domande Aperte
{riferimento a file domande se presenti}

## Note per il PM
{eventuali note o decisioni richieste}

## Prossimi Passi
{preview sprint successivo}
```

### Convenzioni Codice

- **Naming**: camelCase per variabili/funzioni, PascalCase per componenti/types
- **Commit**: Conventional Commits (`feat:`, `fix:`, `docs:`, `refactor:`, `test:`)
- **Branch**: `feature/S{sprint}-{id}-{descrizione}` (es. `feature/S1-1-user-registration`)
- **PR**: Template con checklist (test, docs, review)
- **Test**: Ogni feature DEVE avere test prima del merge

---

## 🎯 ISTRUZIONI DI AVVIO

Quando inizi lo sviluppo, segui questa sequenza:

```
1. Crea struttura base del progetto
   - docs/pm-questions/ con INDEX.md
   - docs/sprint-briefs/
   - docs/changes/ con INDEX.md

2. Per ogni sprint:

   ┌─ PLANNING (OBBLIGATORIO) ─────────────────────────────┐
   │                                                        │
   │  a. Produci Sprint Brief dettagliato                  │
   │     - Descrizione funzionale completa                 │
   │     - Flussi step-by-step                             │
   │     - User stories con acceptance criteria            │
   │     - Regole di business con esempi concreti          │
   │     - Edge cases identificati                         │
   │                                                        │
   │  b. PRESENTA AL PM e attendi approvazione             │
   │     ⚠️ NON PROCEDERE senza OK esplicito del PM        │
   │                                                        │
   │  c. Se PM richiede modifiche → aggiorna e ripresenta  │
   │                                                        │
   └────────────────────────────────────────────────────────┘
   
   ┌─ IMPLEMENTAZIONE (post-approvazione) ─────────────────┐
   │                                                        │
   │  d. Attiva i subagent appropriati in sequenza         │
   │                                                        │
   │  e. Implementa una feature alla volta                 │
   │                                                        │
   │  f. Se emergono dubbi/modifiche:                      │
   │     - Crea Change Request                             │
   │     - Attendi approvazione PM                         │
   │     - Propaga al team                                 │
   │                                                        │
   │  g. Scrivi test per ogni feature (target 95%)         │
   │                                                        │
   │  h. Verifica coverage prima di procedere              │
   │                                                        │
   │  i. Committa con messaggi descrittivi                 │
   │                                                        │
   └────────────────────────────────────────────────────────┘
   
   ┌─ MILESTONE ───────────────────────────────────────────┐
   │                                                        │
   │  j. Verifica TUTTA la checklist milestone             │
   │                                                        │
   │  k. Genera report coverage                            │
   │                                                        │
   │  l. Prepara Report Milestone per PM                   │
   │                                                        │
   │  m. Attendi validazione PM prima del prossimo sprint  │
   │                                                        │
   └────────────────────────────────────────────────────────┘
```

### Struttura Directory Documenti

```
docs/
├── sprint-briefs/           # 📋 Brief pre-sprint
│   ├── SPRINT-0-brief.md
│   ├── SPRINT-1-brief.md
│   └── ...
├── pm-questions/            # ❓ Domande per il PM
│   ├── INDEX.md
│   ├── SPRINT-0-questions.md
│   └── ...
├── changes/                 # 🔄 Change Requests
│   ├── INDEX.md
│   ├── CR-001.md
│   └── ...
├── milestones/              # 📊 Report Milestone
│   ├── MILESTONE-0-report.md
│   ├── MILESTONE-1-report.md
│   └── ...
├── api/                     # 📚 Documentazione API
└── architecture/            # 🏗️ Diagrammi architettura
```

---

## 📝 NOTE FINALI

### Principi di Sviluppo
- **MVP First**: Sprint 0-8, no notifiche avanzate e chat per ora
- **Mobile-First**: Progetta sempre pensando prima al mobile
- **Type Safety**: Usa TypeScript strict mode, evita `any`
- **Error Handling**: Gestisci sempre gli errori con feedback utente
- **Loading States**: Mostra sempre stati di caricamento

### Principi di Processo
- **Planning First**: MAI implementare senza Sprint Brief approvato
- **Test Coverage**: 95% MINIMO prima di chiudere ogni sprint
- **Change Management**: Ogni modifica tracciata e approvata
- **Comunicazione PM**: Domande tracciate, milestone validate
- **Trasparenza**: Il PM deve sempre sapere cosa sta succedendo

### Regola d'Oro

```
╔═══════════════════════════════════════════════════════════════╗
║  🛑 STOP: Prima di scrivere codice, il PM deve aver capito    ║
║     e approvato COSA stiamo costruendo e PERCHÉ.              ║
║                                                               ║
║  Se il PM ha dubbi sulle funzionalità → FERMATI e chiarisci   ║
║  Se emergono modifiche → Change Request prima di procedere    ║
║  Se lo sprint è completato → Report + validazione PM          ║
╚═══════════════════════════════════════════════════════════════╝
```

Buon lavoro! 🚀
