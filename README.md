# Fantacontratti

Piattaforma web per la gestione dei mercati del fantacalcio "dinastico" - dove le squadre hanno continuità pluriennale invece di ricominciare ogni stagione.

## Stack Tecnologico

- **Frontend**: React 19 + TypeScript + Vite
- **Styling**: TailwindCSS
- **Database**: PostgreSQL + Prisma ORM
- **Testing**: Vitest + React Testing Library + Playwright
- **Linting**: ESLint + Prettier

## Prerequisiti

- Node.js 18+
- PostgreSQL (locale o remoto)
- npm o pnpm

## Setup Locale

### 1. Clona il repository

```bash
git clone https://github.com/pietro1412/FANTACONTRATTI-MULTIAGENT.git
cd FANTACONTRATTI-MULTIAGENT
```

### 2. Installa le dipendenze

```bash
npm install
```

### 3. Configura le variabili d'ambiente

```bash
cp .env.example .env
```

Modifica il file `.env` con le tue credenziali PostgreSQL:

```
DATABASE_URL="postgresql://username:password@localhost:5432/fantacontratti?schema=public"
```

### 4. Configura il database

```bash
# Genera il client Prisma
npm run db:generate

# Crea le tabelle nel database
npm run db:migrate

# (Opzionale) Apri Prisma Studio per visualizzare i dati
npm run db:studio
```

### 5. Avvia il server di sviluppo

```bash
npm run dev
```

L'app sarà disponibile su http://localhost:5173

## Scripts Disponibili

| Comando | Descrizione |
|---------|-------------|
| `npm run dev` | Avvia il server di sviluppo |
| `npm run build` | Compila per produzione |
| `npm run preview` | Preview della build di produzione |
| `npm run lint` | Esegue ESLint |
| `npm run lint:fix` | Corregge errori ESLint |
| `npm run format` | Formatta il codice con Prettier |
| `npm run test` | Esegue i test unitari |
| `npm run test:coverage` | Esegue i test con report coverage |
| `npm run test:ui` | Apre Vitest UI |
| `npm run test:e2e` | Esegue i test E2E con Playwright |
| `npm run db:generate` | Genera il client Prisma |
| `npm run db:migrate` | Esegue le migrazioni |
| `npm run db:push` | Push schema senza migration |
| `npm run db:studio` | Apre Prisma Studio |
| `npm run db:seed` | Popola il database con dati di test |

## Struttura Progetto

```
fantacontratti/
├── docs/                    # Documentazione
│   ├── sprint-briefs/       # Brief degli sprint
│   ├── pm-questions/        # Domande per il PM
│   ├── changes/             # Change Requests
│   └── milestones/          # Report milestone
├── prisma/                  # Schema e migrazioni database
├── public/                  # Asset statici
├── src/
│   ├── components/          # Componenti React
│   │   ├── ui/             # Componenti UI riutilizzabili
│   │   ├── layout/         # Layout components
│   │   ├── auth/           # Componenti autenticazione
│   │   ├── league/         # Componenti leghe
│   │   ├── player/         # Componenti giocatori
│   │   ├── auction/        # Componenti aste
│   │   ├── contract/       # Componenti contratti
│   │   ├── trade/          # Componenti scambi
│   │   ├── rubata/         # Componenti rubata
│   │   └── dashboard/      # Componenti dashboard
│   ├── pages/              # Pagine/route
│   ├── hooks/              # Custom hooks
│   ├── services/           # Logica business e API
│   ├── stores/             # State management
│   ├── types/              # TypeScript types
│   ├── utils/              # Utility functions
│   ├── lib/                # Configurazioni librerie
│   └── api/                # API routes
├── tests/
│   ├── unit/               # Test unitari
│   ├── integration/        # Test integrazione
│   └── e2e/                # Test end-to-end
└── ...config files
```

## Convenzioni

### Commit Messages

Usiamo [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` Nuova funzionalità
- `fix:` Bug fix
- `docs:` Documentazione
- `refactor:` Refactoring
- `test:` Test
- `chore:` Maintenance

### Branch Naming

```
feature/S{sprint}-{id}-{descrizione}
```

Esempio: `feature/S1-1-user-registration`

## Coverage Target

Il progetto punta a una coverage minima del **95%**.

## Licenza

MIT

---

**Sprint 0** - Setup & Infrastruttura completato
