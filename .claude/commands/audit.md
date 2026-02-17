## Workflow: Audit Codebase

Analisi completa del codebase. **NON modificare nulla.**

### Step 1 — Qualità codice
```bash
npm run lint 2>&1 | tail -20
npm run test:all 2>&1 | tail -20
npx tsc --noEmit 2>&1 | tail -20
```

### Step 2 — Inconsistenze
Cerca:
- ServiceResult ridichiarate (`grep -r "interface ServiceResult" src/services/ | wc -l`)
- console.log nei services (`grep -rn "console\.\(log\|error\)" src/services/ | head -20`)
- Import path relativi profondi (`grep -rn "from '\.\./\.\./\.\." src/ | wc -l`)
- Uso di `any` (`grep -rn ": any" src/ --include="*.ts" --include="*.tsx" | wc -l`)

### Step 3 — Coverage
```bash
npm run test:coverage 2>&1 | tail -30
```

### Step 4 — Report
Genera un report con:
- Score per area (lint, test, types, convenzioni)
- Top 10 issue per priorità
- Suggerimenti concreti per il prossimo sprint
- Confronto con audit precedente (se esiste in docs/AUDIT.md)

Salva in `docs/AUDIT.md`.
