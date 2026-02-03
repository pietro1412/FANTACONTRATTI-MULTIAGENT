# CLAUDE.md - Linee Guida Progetto

## GitHub Project Management

### Progetto: EVOLUTIVE
Repository: `pietro1412/FANTACONTRATTI-MULTIAGENT`

### Workflow Evolutive

#### Fase 1: Raccolta Rapida (Backlog)
Quando l'utente propone evolutive, raccoglierle **velocemente**:
- Creare Issue su GitHub con titolo sintetico
- Aggiungerla al project EVOLUTIVE → **Backlog**
- Conferma rapida: "✅ #N in Backlog"
- **NON iniziare sviluppo**, permettere all'utente di continuare con la prossima

Se ci sono dubbi sulla classificazione o comprensione, chiedere **prima** di creare l'issue.

#### Fase 2: Attivazione (Todo → In Progress)
**Solo quando l'utente indica** quali evolutive attivare:
- Spostare Issue da Backlog a **Todo**
- Creare branch feature da `develop`
- Spostare in **In Progress**
- Iniziare sviluppo

#### Fase 3: Completamento (Done)
Quando lo sviluppo è completato:
- Committare con riferimento all'issue
- Spostare Issue in **Done**
- Chiudere Issue

### Colonne Project
| Colonna | Descrizione |
|---------|-------------|
| Backlog | Evolutive proposte, in attesa di priorità |
| Todo | Evolutive approvate, pronte per sviluppo |
| In Progress | Evolutive in lavorazione |
| Done | Evolutive completate |

### Labels Issue
- `1.x-web` = Evolutiva Web App
- `2.x-mobile` = Evolutiva Mobile App
- `enhancement` = Miglioramento
- `bug` = Bug fix

---

## Branching Strategy

### Branch Principali
| Branch | Scopo | Deploy |
|--------|-------|--------|
| `master` | Produzione stabile | Vercel Production |
| `main` | Allineato a master | - |
| `develop` | Integrazione nuove feature | Vercel Preview |

### Versioning
- **1.x** = Evolutive Web App
- **2.x** = Evolutive Mobile App

### Workflow per Nuove Feature

1. **Creare feature branch da develop:**
   ```bash
   git checkout develop
   git pull origin develop
   git checkout -b feature/1.x-nome-feature   # per web
   git checkout -b feature/2.x-nome-feature   # per mobile
   ```

2. **Lavorare sulla feature e committare:**
   ```bash
   git add .
   git commit -m "feat: descrizione"
   git push origin feature/1.x-nome-feature
   ```

3. **Aprire PR verso develop**

4. **Per rilascio in produzione:**
   ```bash
   develop → PR verso master → Tag versione (v1.1, v1.2, etc.)
   ```

### Convenzioni Commit
- `feat:` nuova funzionalità
- `fix:` correzione bug
- `refactor:` refactoring codice
- `docs:` documentazione
- `style:` formattazione
- `test:` test

## Credenziali Test (Locale)

### Super Admin
- Email: `superadmin@test.com`
- Password: `super123`

### Admin Lega (Prima Lega)
- Email: `pietro@test.com`
- Password: `admin123`

### Manager Lega
| Email | Password | Team |
|-------|----------|------|
| mario@test.com | test123 | FC Mario |
| luigi@test.com | test123 | AC Luigi |
| peach@test.com | test123 | AS Peach |
| toad@test.com | test123 | US Toad |
| yoshi@test.com | test123 | SS Yoshi |
| bowser@test.com | test123 | Inter Bowser |
| wario@test.com | test123 | Juventus Wario |

## Comandi Utili

### Avvio Locale
```bash
npm run dev
```
- Frontend: http://localhost:5173
- API: http://localhost:3003

### Database
```bash
npx prisma generate --schema=prisma/schema.generated.prisma
npx prisma db push --schema=prisma/schema.generated.prisma
npx prisma studio --schema=prisma/schema.generated.prisma
```

### Build
```bash
npm run build
```

---

## CI/CD Pipeline

### GitHub Actions Workflows

Il progetto utilizza GitHub Actions per CI/CD automatizzata.

#### Workflow Disponibili

| Workflow | Trigger | Descrizione |
|----------|---------|-------------|
| **CI** (`ci.yml`) | Push/PR su develop, master, main | Lint, TypeCheck, Unit Tests, Build |
| **E2E** (`e2e.yml`) | PR + Manual | Test Playwright end-to-end |
| **PR Check** (`pr-check.yml`) | PR aperte | Validazione PR, security, bundle size |
| **Release** (`release.yml`) | Push master + Tags | Validazione release, changelog |

#### CI Workflow
Eseguito automaticamente su ogni push e PR:
1. **Lint** - ESLint check
2. **TypeCheck** - Compilazione TypeScript
3. **Unit Tests** - Vitest con coverage
4. **Build** - Build frontend e API

#### E2E Workflow
Test end-to-end con Playwright:
- Database PostgreSQL in container
- Eseguibile manualmente con scelta browser
- Report HTML degli errori

#### PR Check Workflow
Validazione qualità delle PR:
- Formato titolo PR (conventional commits)
- Check file sensibili (.env, credentials)
- Dependency review (vulnerabilità)
- Report dimensioni bundle

#### Release Workflow
Gestione release automatica:
- Validazione completa build
- Generazione changelog
- Creazione GitHub Release
- Integrazione con Vercel deploy

### Dependabot
Aggiornamento automatico dipendenze:
- NPM: settimanale (lunedì 09:00)
- GitHub Actions: settimanale
- Gruppi separati per dev/prod dependencies

### Secrets Richiesti
| Secret | Descrizione |
|--------|-------------|
| `CODECOV_TOKEN` | (Opzionale) Upload coverage reports |
| `GITHUB_TOKEN` | Automatico, per release |

### Status Checks Richiesti per Merge
Per proteggere i branch principali, configurare:
- `CI / Lint`
- `CI / Type Check`
- `CI / Unit Tests`
- `CI / Build`
