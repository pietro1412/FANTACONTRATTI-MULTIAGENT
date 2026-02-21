# Audit Codebase — 2026-02-21 (aggiornamento #6 — DB connection audit)

> Audit aggiornato con focus su connessioni database e compatibilita' Neon free tier.

## Scorecard

| Area | Score | Dettagli |
|------|-------|----------|
| **Lint** | 9/10 | 86 errori ESLint (era 0), 1.756 warning |
| **Test** | 10/10 | **2.075 passed**, 0 failed, 111/111 test suite verdi |
| **Types** | 9/10 | 5 errori TS in file test (0 in production code) |
| **Convenzioni** | 9/10 | 2 console.log (intenzionali), 0 deep imports, 3 `any` residui |
| **Coverage** | 7/10 | ~66% statements (invariato) |
| **DB Connections** | 3/10 | **CRITICO** — 27 PrismaClient indipendenti, 0 connection pooling |

**Score complessivo: 7.8/10** (era 9.2/10 — penalizzato dalla scoperta DB connections)

---

## SEZIONE CRITICA: Connessioni Database e Neon Free Tier

### Il Problema

L'app crea **27 istanze indipendenti di PrismaClient** invece di riusare il singleton in `src/lib/prisma.ts`:

| Dove | Istanze | Pattern |
|------|---------|---------|
| `src/services/*.ts` | **24** | `const prisma = new PrismaClient()` |
| `src/api/routes/*.ts` | **3** | `const prisma = new PrismaClient()` (auth, contracts, players) |
| **Totale** | **27** | Ognuna apre il proprio connection pool |

### Neon Free Tier: Limiti

| Risorsa | Limite Free Tier | Uso stimato |
|---------|-----------------|-------------|
| Connessioni simultanee | **10** | Fino a **27 per request** |
| Compute hours/mese | 191h | Dipende dal traffico |
| Storage | 512MB | OK per il progetto |
| Branching | 10 branch | OK |

### Stima Connessioni per Scenario

| Scenario | Prisma pools creati | Connessioni tentate | Risultato |
|----------|-------------------|--------------------|---------|
| 1 request API | ~5-10 services importati | 5-10 | **Borderline** |
| 2 request concorrenti | ~10-20 services | 10-20 | **FAILURE** |
| 5 utenti in rubata live | ~20+ services | 20+ | **Pool exhaustion** |
| Cron sync (ogni 6h) + 1 request | +1 istanza | +1 | Aggrava il problema |

### Perche' Non Crasha Subito?

1. **Neon pooler**: il `DATABASE_URL` punta al pooler di Neon (`-pooler.aws.neon.tech`), che media le connessioni
2. **Serverless cold start**: Vercel riusa il runtime tra request ravvicinate, quindi le istanze PrismaClient gia' create vengono riusate (ma NON condivise tra service diversi)
3. **Traffico basso**: con pochi utenti, le connessioni vengono rilasciate prima che si esaurisca il pool

### Quando Crashera'?

- **Rubata live con 7 manager**: tutti connessi via Pusher, polling frequente, aste in corso — 7+ request concorrenti al secondo. **Rischio alto di `Too many connections` o timeout**.
- **Spike di traffico**: qualsiasi momento con 3+ request API simultanee

### Il Singleton Esiste Ma Non E' Usato

**File `src/lib/prisma.ts`** implementa il pattern corretto:

```typescript
const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined }
export const prisma = globalForPrisma.prisma ?? new PrismaClient({ ... })
if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma  // ← Solo in dev!
}
```

**Problema 1**: i 24 service e 3 route NON lo importano — creano ognuno il proprio.

**Problema 2**: il guard `!== 'production'` impedisce il caching in produzione su Vercel.

### Chi Lo Usa Correttamente

I moduli DDD (`src/modules/*/infrastructure/repositories/`) e i cron jobs importano `@/lib/prisma` — pattern corretto.

### Fix Necessario (Priorita' P0)

1. **Fixare il singleton** — rimuovere il guard `!== 'production'`:
   ```typescript
   // PRIMA (broken in prod)
   if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
   // DOPO (funziona ovunque)
   globalForPrisma.prisma = prisma
   ```

2. **Migrare i 24 service** — sostituire:
   ```typescript
   // PRIMA
   import { PrismaClient } from '@prisma/client'
   const prisma = new PrismaClient()
   // DOPO
   import { prisma } from '@/lib/prisma'
   ```

3. **Migrare le 3 route** — stesso pattern per `auth.ts`, `contracts.ts`, `players.ts`

4. **Aggiungere `connection_limit`** al DATABASE_URL:
   ```
   ?connection_limit=5&connect_timeout=10
   ```

5. **Rimuovere i `diagPrisma`** in `api/index.ts` e `vercel-entry.ts` — usare il singleton

**Impatto stimato**: da 27 pool separati a **1 pool condiviso con 5 connessioni**. Compatibile con Neon free tier.

---

## Step 1 — Qualita' Codice

### ESLint: 86 errori, 1.756 warning

86 errori (era 0). Regressione in file test:
- 63 `no-non-null-assertion` (file test)
- 14 `TS2532` object possibly undefined (file test)
- 9 vari (spread args, unused vars in test)

**0 errori in production code.** Solo file test.

### Test: 2.075 passed, 0 failed

**111 test suite, 2.075 test totali** (era 108 suite, 2.068 test).
+3 suite, +7 test dalla sessione precedente.

### TypeScript: 5 errori (solo in test)

- `src/__tests__/Svincolati.test.tsx`: 1 errore tipo
- `src/__tests__/trade.service.test.ts`: 4 errori (undefined vs boolean, possibly undefined)

**0 errori in production code.**

---

## Step 2 — Inconsistenze

| Metrica | Precedente | Attuale | Delta |
|---------|-----------|---------|-------|
| ServiceResult ridichiarati | 0 | 0 | = |
| console.log/error in services | 2 | 2 | = |
| Deep imports (`../../..+`) | 0 | 0 | = |
| `: any` in production | 0 | 3 | +3 (1 in contracts route, 2 in movement test) |
| PrismaClient indipendenti | non misurato | **27** | **NEW** |

---

## Step 3 — Coverage

Non rieseguita in questa sessione. Stimata invariata (~66% lines) dato che i cambiamenti sono stati UI/UX senza nuovi test di coverage.

---

## Step 4 — Top 10 Issue per Priorita'

| # | Priorita' | Issue | Impatto | Status |
|---|-----------|-------|---------|--------|
| 1 | **P0** | **27 PrismaClient indipendenti** | **Crash DB in produzione con carico** | **DA FARE** |
| 2 | **P0** | **Singleton non attivo in prod** | **`globalThis.prisma` non cached** | **DA FARE** |
| 3 | **P1** | 86 errori ESLint in test | CI lint rotta | DA FARE |
| 4 | **P1** | 5 errori TS in test | CI types rotta | DA FARE |
| 5 | **P1** | Coverage 66% (target 95%) | Gap significativo | IN PROGRESSO |
| 6 | **P2** | No `connection_limit` nel DATABASE_URL | Pool non limitato esplicitamente | DA FARE |
| 7 | **P2** | No `$disconnect()` in API handlers | Connessioni non rilasciate | DA FARE |
| 8 | **P2** | 2 `diagPrisma` extra in debug endpoints | Istanze PrismaClient inutili | DA FARE |
| 9 | ~~P3~~ | ~~Nessun ErrorBoundary React~~ | Crash non gestiti | NOTO |
| 10 | ~~P3~~ | ~~Nessuna logging library~~ | Log non strutturati | NOTO |

---

## Suggerimenti per il Prossimo Sprint

### Sprint DB Connections (P0 — urgente)

1. **Fixare `src/lib/prisma.ts`** — rimuovere guard `!== 'production'`
2. **Migrare 24 service** a `import { prisma } from '@/lib/prisma'`
3. **Migrare 3 route** (auth, contracts, players) allo stesso pattern
4. **Aggiungere `?connection_limit=5`** al DATABASE_URL in Vercel env
5. **Rimuovere `diagPrisma`** da api/index.ts e vercel-entry.ts
6. **Testare** con carico simulato (7 utenti rubata)

**Effort stimato**: ~1h di lavoro meccanico, impatto critico sulla stabilita'.

### Sprint Lint/Types Cleanup (P1)

1. Fixare 86 errori ESLint nei test
2. Fixare 5 errori TS nei test
3. Verificare che la CI passi

---

## Confronto con Audit Precedente

| Metrica | Audit #5 (17/02) | Audit #6 (21/02) | Delta |
|---------|-----------------|-----------------|-------|
| ESLint errori | 0 | 86 | +86 (regressione test) |
| ESLint warning | 1.436 | 1.756 | +320 |
| Test passed | 2.068 | **2.075** | **+7** |
| Test failed | 0 | 0 | = |
| Test suite | 108 | **111** | **+3** |
| TS errori (prod) | 0 | 0 | = |
| TS errori (test) | non misurato | 5 | NEW |
| console.log/error | 2 | 2 | = |
| Deep imports | 0 | 0 | = |
| `: any` (prod) | 0 | 3 | +3 |
| PrismaClient indip. | non misurato | **27** | **CRITICO** |
| Coverage (lines) | 68.48% | ~66% | ~stabile |
