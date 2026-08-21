# Sprint 0 Brief - Setup & Infrastruttura

**Data:** Dicembre 2025
**Dipendenze:** Nessuna (primo sprint)

---

## 🎯 OBIETTIVO SPRINT

Costruire le fondamenta tecniche del progetto Fantacontratti: ambiente di sviluppo, database, deployment automatico e framework di testing. Al termine di questo sprint avremo un'applicazione "Hello World" deployata, connessa al database, con pipeline CI/CD funzionante.

---

## 📖 DESCRIZIONE FUNZIONALE

### Contesto

Fantacontratti è una piattaforma web per la gestione dei mercati del fantacalcio "dinastico". Prima di poter sviluppare qualsiasi funzionalità, dobbiamo creare l'infrastruttura tecnica che supporterà tutto il progetto.

### Cosa realizzeremo

In questo sprint **non svilupperemo funzionalità utente**, ma creeremo tutto il "backstage" tecnico:

1. **Progetto React moderno** con TypeScript per type-safety e Vite per build veloci
2. **Sistema di stili** con TailwindCSS per sviluppo UI rapido e consistente
3. **Database PostgreSQL** hostato su Render, pronto per memorizzare tutti i dati della piattaforma
4. **ORM Prisma** per interagire col database in modo type-safe
5. **Deployment automatico** su Vercel - ogni push su main pubblica automaticamente
6. **Pipeline CI/CD** che esegue test automatici prima di ogni deploy
7. **Framework di testing** completo: unit test (Vitest), component test (React Testing Library), E2E test (Playwright)

### Perché è importante

Senza queste fondamenta solide, lo sviluppo successivo sarebbe caotico e rischioso. Investire tempo ora nel setup corretto ci farà risparmiare settimane di debugging e problemi in futuro.

### Flusso "Utente" (Sviluppatore) Step-by-Step

**Scenario: Setup locale nuovo sviluppatore**
1. Sviluppatore clona il repository da GitHub
2. Esegue `npm install` per installare dipendenze
3. Copia `.env.example` in `.env` e configura variabili
4. Esegue `npx prisma generate` per generare client DB
5. Esegue `npm run dev` e vede l'app su http://localhost:5173
6. Vede una pagina "Fantacontratti - Coming Soon" con stili TailwindCSS applicati

**Scenario: Deploy automatico**
1. Sviluppatore pusha codice su branch `main`
2. GitHub Actions esegue automaticamente i test
3. Se i test passano, Vercel deploya automaticamente
4. L'app è visibile su https://fantacontratti.vercel.app

**Scenario: Connessione database**
1. L'app si avvia e si connette a PostgreSQL su Render
2. Prisma Client è disponibile per query
3. Lo schema iniziale è migrato correttamente

---

## 📝 USER STORIES DETTAGLIATE

### US-0.1: Setup Progetto Base

**Come** sviluppatore
**Voglio** un progetto React + TypeScript + Vite configurato
**Così che** possa iniziare a sviluppare con un ambiente moderno e performante

**Acceptance Criteria:**
- [ ] AC1: `npm create vite@latest` con template React + TypeScript completato
- [ ] AC2: `npm run dev` avvia il server di sviluppo senza errori
- [ ] AC3: `npm run build` compila il progetto senza errori TypeScript
- [ ] AC4: TypeScript in strict mode abilitato
- [ ] AC5: ESLint configurato con regole per React e TypeScript
- [ ] AC6: Prettier configurato per formattazione consistente

**Esempio concreto:**
> Eseguo `npm run dev`, apro http://localhost:5173, vedo l'app React renderizzata. Eseguo `npm run build`, la cartella `dist/` viene creata con i file ottimizzati.

---

### US-0.2: Configurazione TailwindCSS

**Come** sviluppatore
**Voglio** TailwindCSS configurato con un tema base
**Così che** possa sviluppare UI rapidamente con utility classes

**Acceptance Criteria:**
- [ ] AC1: TailwindCSS installato e configurato in `tailwind.config.js`
- [ ] AC2: PostCSS configurato correttamente
- [ ] AC3: File `index.css` con direttive Tailwind (@tailwind base, components, utilities)
- [ ] AC4: Tema base definito con colori primari del brand
- [ ] AC5: Una pagina di esempio mostra classi Tailwind funzionanti (es. `bg-blue-500 text-white p-4`)

**Esempio concreto:**
> Aggiungo `className="bg-primary-500 text-white p-4 rounded-lg"` a un div, e vedo uno sfondo colorato con padding e bordi arrotondati.

**Tema colori proposto:**
```javascript
colors: {
  primary: { 500: '#3B82F6', 600: '#2563EB', 700: '#1D4ED8' },
  secondary: { 500: '#10B981', 600: '#059669' },
  accent: { 500: '#F59E0B' },
  danger: { 500: '#EF4444' }
}
```

---

### US-0.3: Setup PostgreSQL su Render

**Come** sviluppatore
**Voglio** un database PostgreSQL hostato su Render
**Così che** i dati dell'applicazione siano persistiti in modo affidabile

**Acceptance Criteria:**
- [ ] AC1: Database PostgreSQL creato su Render
- [ ] AC2: Connection string disponibile e funzionante
- [ ] AC3: Database raggiungibile da ambiente locale (per sviluppo)
- [ ] AC4: Database raggiungibile da Vercel (per produzione)
- [ ] AC5: Credenziali salvate in modo sicuro (variabili ambiente)

**Esempio concreto:**
> Copio la DATABASE_URL da Render, la inserisco nel file `.env`, eseguo un test di connessione con Prisma, la connessione ha successo.

**Edge Cases:**
- IP whitelist: Verificare che Render permetta connessioni da Vercel
- SSL: Assicurarsi che la connessione usi SSL in produzione

---

### US-0.4: Configurazione Prisma ORM

**Come** sviluppatore
**Voglio** Prisma ORM configurato con lo schema iniziale
**Così che** possa interagire col database in modo type-safe

**Acceptance Criteria:**
- [ ] AC1: Prisma installato (`@prisma/client` e `prisma` come devDep)
- [ ] AC2: File `prisma/schema.prisma` creato con configurazione base
- [ ] AC3: Schema iniziale con modello `User` di test
- [ ] AC4: `npx prisma generate` genera il client senza errori
- [ ] AC5: `npx prisma migrate dev` crea migration iniziale
- [ ] AC6: `npx prisma studio` apre l'interfaccia di gestione DB
- [ ] AC7: File `prisma/seed.ts` predisposto per dati di test

**Esempio concreto:**
> Eseguo `npx prisma migrate dev --name init`, Prisma crea la tabella User nel database. Apro Prisma Studio, vedo la tabella User vuota pronta per i dati.

**Schema iniziale (test):**
```prisma
model User {
  id        String   @id @default(cuid())
  email     String   @unique
  username  String   @unique
  createdAt DateTime @default(now())
}
```

---

### US-0.5: Setup Vercel Deployment + CI/CD

**Come** sviluppatore
**Voglio** deployment automatico su Vercel con CI/CD
**Così che** ogni modifica sia automaticamente testata e deployata

**Acceptance Criteria:**
- [ ] AC1: Progetto connesso a Vercel
- [ ] AC2: Push su `main` triggera deploy automatico
- [ ] AC3: Preview deploy per ogni Pull Request
- [ ] AC4: Variabili ambiente configurate su Vercel (DATABASE_URL, etc.)
- [ ] AC5: GitHub Actions workflow per CI (test prima del deploy)
- [ ] AC6: Badge status CI visibile nel README

**Esempio concreto:**
> Pusho un commit su main, GitHub Actions esegue i test (~2 min), se passano Vercel deploya (~1 min), l'app è live su fantacontratti.vercel.app.

**GitHub Actions workflow (.github/workflows/ci.yml):**
```yaml
name: CI
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: npm ci
      - run: npm run lint
      - run: npm run test:coverage
      - run: npm run build
```

---

### US-0.6: Struttura Cartelle e Convenzioni

**Come** sviluppatore
**Voglio** una struttura cartelle chiara e convenzioni documentate
**Così che** il codice sia organizzato e manutenibile

**Acceptance Criteria:**
- [ ] AC1: Struttura cartelle `src/` creata secondo lo schema definito
- [ ] AC2: File `.eslintrc.json` con regole progetto
- [ ] AC3: File `.prettierrc` con configurazione formattazione
- [ ] AC4: File `.env.example` con tutte le variabili necessarie
- [ ] AC5: README.md con istruzioni setup locale
- [ ] AC6: Conventional Commits documentati

**Struttura cartelle:**
```
src/
├── components/     # Componenti React riutilizzabili
│   ├── ui/        # Componenti UI base (Button, Input, Card, etc.)
│   └── layout/    # Layout components (Header, Footer, Sidebar)
├── pages/         # Pagine/route dell'applicazione
├── hooks/         # Custom React hooks
├── services/      # Chiamate API e logica business
├── stores/        # State management (se necessario)
├── types/         # TypeScript types/interfaces
├── utils/         # Utility functions
├── lib/           # Configurazioni librerie (prisma client, etc.)
└── api/           # API routes (se Next.js) o mock
```

---

### US-0.7: Setup Vitest + React Testing Library

**Come** sviluppatore
**Voglio** framework di unit/component testing configurato
**Così che** possa scrivere test automatizzati per il codice

**Acceptance Criteria:**
- [ ] AC1: Vitest installato e configurato (`vitest.config.ts`)
- [ ] AC2: React Testing Library installata
- [ ] AC3: jsdom configurato per test componenti
- [ ] AC4: Script `npm run test` esegue i test
- [ ] AC5: Script `npm run test:coverage` genera report coverage
- [ ] AC6: Almeno 1 test di esempio passing (es. test componente App)
- [ ] AC7: Coverage threshold configurato al 95%

**Esempio concreto:**
> Eseguo `npm run test`, vedo output verde "1 test passed". Eseguo `npm run test:coverage`, vedo report con percentuale coverage.

**Test di esempio:**
```typescript
// src/App.test.tsx
import { render, screen } from '@testing-library/react'
import App from './App'

describe('App', () => {
  it('renders welcome message', () => {
    render(<App />)
    expect(screen.getByText(/Fantacontratti/i)).toBeInTheDocument()
  })
})
```

---

### US-0.8: Configurazione Playwright E2E

**Come** sviluppatore
**Voglio** Playwright configurato per test end-to-end
**Così che** possa testare flussi utente completi

**Acceptance Criteria:**
- [ ] AC1: Playwright installato (`@playwright/test`)
- [ ] AC2: File `playwright.config.ts` configurato
- [ ] AC3: Script `npm run test:e2e` esegue test E2E
- [ ] AC4: Almeno 1 test E2E di esempio (visita homepage, verifica titolo)
- [ ] AC5: Test E2E integrati in CI (opzionale per Sprint 0)

**Esempio concreto:**
> Eseguo `npm run test:e2e`, Playwright apre un browser, visita localhost:5173, verifica che il titolo contenga "Fantacontratti", test passa.

**Test di esempio:**
```typescript
// tests/e2e/home.spec.ts
import { test, expect } from '@playwright/test'

test('homepage has correct title', async ({ page }) => {
  await page.goto('/')
  await expect(page).toHaveTitle(/Fantacontratti/)
})
```

---

## 🖼️ MOCKUP HOMEPAGE (Placeholder)

```
┌─────────────────────────────────────────────────────────────┐
│                      FANTACONTRATTI                         │
│                                                             │
│                    ⚽ Coming Soon ⚽                         │
│                                                             │
│         La piattaforma per il fantacalcio dinastico         │
│                                                             │
│              [  Setup completato! v0.1.0  ]                 │
│                                                             │
│                    Environment: {dev/prod}                  │
│                    DB Connected: {yes/no}                   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## ⚠️ DIPENDENZE E RISCHI

| Dipendenza/Rischio | Impatto | Mitigazione |
|--------------------|---------|-------------|
| Account Render non configurato | Alto | PM deve creare account e condividere credenziali |
| Account Vercel non configurato | Alto | PM deve creare account e connettere repo |
| Repository GitHub non creato | Alto | Creare repo prima di iniziare |
| Limiti free tier Render | Medio | Monitorare uso, upgrade se necessario |
| Network issues da Vercel a Render | Medio | Testare connessione, configurare SSL |

---

## ❓ DOMANDE APERTE PER IL PM

1. **Repository GitHub**: Hai già creato il repository? Se sì, qual è l'URL? Se no, vuoi che ti guidi nella creazione?

2. **Account Render**: Hai un account Render? Posso procedere con la creazione del database PostgreSQL?

3. **Account Vercel**: Hai un account Vercel collegato al tuo GitHub?

4. **Nome dominio**: Vuoi usare `fantacontratti.vercel.app` o hai un dominio personalizzato?

5. **Colori brand**: I colori proposti (blu primario, verde secondario, giallo accent) vanno bene o hai preferenze diverse?

---

## ✅ CONFERMA PM

- [ ] Ho letto e compreso lo Sprint Brief
- [ ] Le user stories sono corrette e complete
- [ ] Ho risposto alle domande aperte
- [ ] Autorizzo a procedere con l'implementazione

**Firma PM:** _______________
**Data approvazione:** _______________

---

## 📊 CHECKLIST MILESTONE 0 (per riferimento)

Al termine dello sprint verificheremo:

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
