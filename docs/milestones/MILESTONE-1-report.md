# Report Milestone Sprint 1

**Data:** Dicembre 2025
**Sprint:** 1 - Utenti & Leghe
**Status:** ✅ COMPLETATO

---

## Checklist Verifica

| Item | Status |
|------|--------|
| Registrazione utente con validazione | ✅ |
| Login/logout con JWT | ✅ |
| Refresh token in httpOnly cookie | ✅ |
| Profilo utente visualizzabile e modificabile | ✅ |
| Cambio password | ✅ |
| Creazione lega con parametri | ✅ |
| Sistema inviti via codice | ✅ |
| Richiesta partecipazione a lega | ✅ |
| Admin accetta/rifiuta/espelle membri | ✅ |
| Ruoli Admin/Manager distinti | ✅ |
| Database schema sincronizzato | ✅ |
| Build senza errori | ✅ |
| Test passing | ✅ (3 test) |

---

## API Implementate

### Autenticazione (`/api/auth`)

| Metodo | Endpoint | Descrizione |
|--------|----------|-------------|
| POST | `/register` | Registrazione nuovo utente |
| POST | `/login` | Login con email/password |
| POST | `/logout` | Logout e invalidazione cookie |
| POST | `/refresh` | Rinnovo access token |
| GET | `/me` | Utente corrente autenticato |

### Utenti (`/api/users`)

| Metodo | Endpoint | Descrizione |
|--------|----------|-------------|
| GET | `/profile` | Visualizza profilo |
| PUT | `/profile` | Modifica username/email |
| PUT | `/password` | Cambio password |

### Leghe (`/api/leagues`)

| Metodo | Endpoint | Descrizione |
|--------|----------|-------------|
| POST | `/` | Crea nuova lega |
| GET | `/` | Lista leghe utente |
| GET | `/:id` | Dettaglio lega |
| PUT | `/:id` | Modifica lega (Admin) |
| GET | `/join/:code` | Info lega da codice invito |
| POST | `/:id/join` | Richiedi partecipazione |
| GET | `/:id/members` | Lista membri lega |
| PUT | `/:id/members/:memberId` | Gestione membri |

**Totale endpoint implementati:** 14

---

## Struttura File Backend

```
src/
├── api/
│   ├── index.ts                 - Express server
│   ├── middleware/
│   │   └── auth.ts              - JWT middleware (auth + optional)
│   └── routes/
│       ├── auth.ts              - Autenticazione routes
│       ├── users.ts             - Profilo utente routes
│       └── leagues.ts           - Gestione leghe routes
├── services/
│   ├── auth.service.ts          - Business logic auth
│   ├── user.service.ts          - Business logic utenti
│   └── league.service.ts        - Business logic leghe
└── utils/
    ├── jwt.ts                   - Generazione/verifica JWT
    └── validation.ts            - Zod schemas
```

---

## Frontend Implementato

### Pagine

| Pagina | Route | Descrizione |
|--------|-------|-------------|
| Login | `/login` | Form login con redirect |
| Register | `/register` | Form registrazione |
| Dashboard | `/dashboard` | Lista leghe utente |
| Create League | `/leagues/new` | Form creazione lega |
| Join League | `/join/:code` | Pagina invito lega |

### Componenti UI

| Componente | File | Funzione |
|------------|------|----------|
| Input | `components/ui/Input.tsx` | Input con label ed errore |
| Button | `components/ui/Button.tsx` | Pulsante con varianti |
| Card | `components/ui/Card.tsx` | Container card |

### Hooks

| Hook | File | Funzione |
|------|------|----------|
| useAuth | `hooks/useAuth.tsx` | Context autenticazione |

---

## Validazioni Implementate

### Schema Registrazione
- Email: formato valido, required
- Username: 3-20 caratteri, alfanumerico + underscore
- Password: min 8 char, 1 maiuscola, 1 numero
- Conferma password: deve corrispondere

### Schema Creazione Lega
- Nome: 2-50 caratteri, required
- Descrizione: max 500 caratteri, opzionale
- Max partecipanti: 2-20 (default 10)
- Budget iniziale: 100-1000 (default 500)
- Slot portieri: 1-5 (default 3)
- Slot difensori: 3-10 (default 8)
- Slot centrocampisti: 3-10 (default 8)
- Slot attaccanti: 2-8 (default 6)

---

## Sicurezza Implementata

| Aspetto | Implementazione |
|---------|-----------------|
| Password hashing | bcrypt con salt rounds |
| Access Token | JWT 15 min expiry |
| Refresh Token | JWT 7 giorni, httpOnly cookie |
| CORS | Configurato per frontend locale |
| Input validation | Zod schema validation server-side |
| Middleware auth | Protezione endpoint autenticati |

---

## Database

Schema sincronizzato con Prisma. Tabelle principali Sprint 1:

| Tabella | Record |
|---------|--------|
| users | 0 (fresh start) |
| leagues | 0 |
| league_members | 0 |

**Nota:** Database resettato per nuova struttura schema durante Sprint 1.

---

## Test

| Tipo | Quantità | Status |
|------|----------|--------|
| Unit tests | 3 | ✅ Passing |
| E2E tests | - | Da implementare |

**Coverage attuale:** Da espandere in sprint futuri

---

## Comandi Disponibili

| Comando | Funzione |
|---------|----------|
| `npm run dev` | Avvia client + API in parallelo |
| `npm run dev:client` | Solo frontend Vite |
| `npm run dev:api` | Solo backend Express |
| `npm run build` | Build produzione |
| `npm run test` | Test unitari |
| `npm run db:generate` | Genera Prisma client |
| `npm run db:push` | Sync schema database |
| `npm run db:studio` | Prisma Studio |

---

## Decisioni Tecniche

| Decisione | Motivazione |
|-----------|-------------|
| Prisma 5 invece di 7 | Breaking changes in v7 |
| TailwindCSS 3 invece di 4 | Maggiore stabilità |
| Zod per validation | Type-safe, ottima integrazione TS |
| httpOnly cookie per refresh | Sicurezza XSS |
| Express 5 | Supporto async handlers |
| Simple router invece di react-router | MVP, semplicità |

---

## Note per il PM

### Come testare

1. **Avvia l'applicazione:**
   ```bash
   npm run dev
   ```

2. **Frontend:** http://localhost:5173
3. **API:** http://localhost:3001
4. **Health check:** http://localhost:3001/api/health

### Flusso da testare

1. Registrazione nuovo utente
2. Login con credenziali
3. Creazione nuova lega
4. (Da altro browser) Registrazione secondo utente
5. Accesso a lega via codice invito
6. Accettazione membro da admin

---

## Prossimi Passi (Sprint 2)

**Obiettivo:** Sessione d'Asta e Rose

- Importazione giocatori Serie A
- Creazione sessione d'asta
- Timer countdown per turni
- Sistema di offerte
- Assegnazione giocatori a rosa
- Contratto iniziale automatico

---

## Validazione PM

- [ ] Ho testato la registrazione
- [ ] Ho testato il login/logout
- [ ] Ho testato la creazione lega
- [ ] Ho testato il sistema inviti
- [ ] Autorizzo a procedere con Sprint 2

**Firma PM:** _______________
**Data validazione:** _______________
