## Workflow: Bug Fix

### FASE 1 — Riproduzione
1. Cerca nei log/codice dove potrebbe originarsi il bug
2. Identifica il file e la funzione coinvolta
3. Scrivi un test che riproduce il bug (deve FALLIRE)

### FASE 2 — Fix
1. Correggi il codice minimale per far passare il test
2. Verifica che non hai rotto altri test: `npm run test:all`
3. Verifica lint: `npm run lint`

### FASE 3 — Commit
```
fix(scope): descrizione breve del fix
```

**Non introdurre refactoring insieme al fix.** Un commit = un fix.
