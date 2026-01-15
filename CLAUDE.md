# CLAUDE.md - Linee Guida Progetto

## GitHub Project Management

### Progetto: EVOLUTIVE
Repository: `pietro1412/FANTACONTRATTI-MULTIAGENT`

### Workflow Evolutive

1. **Quando l'utente propone un'evolutiva:**
   - Creare una Issue su GitHub
   - Aggiungerla al project EVOLUTIVE nella colonna **Backlog**
   - NON iniziare lo sviluppo

2. **Quando l'utente dice di attivare l'evolutiva:**
   - Spostare la Issue da Backlog a **Todo**
   - Creare il branch feature da `develop`
   - Iniziare lo sviluppo
   - Spostare la Issue in **In Progress**

3. **Quando lo sviluppo è completato:**
   - Creare PR verso `develop`
   - Spostare la Issue in **Done**

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
