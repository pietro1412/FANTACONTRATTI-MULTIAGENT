# ANALISI DI SCALABILITA' - FANTACONTRATTI

> Generato il 24/01/2026 da Claude Code (Architetto Enterprise)

## EXECUTIVE SUMMARY

Ho analizzato l'intera codebase di FANTACONTRATTI, una piattaforma fantasy football con aste real-time. La risposta alla domanda principale e':

**La piattaforma attuale NON puo' gestire 10.000 utenti concorrenti in aste simultanee.**

L'architettura attuale e' pensata per un utilizzo a scala ridotta (1-50 utenti per lega, poche leghe attive contemporaneamente). Esistono numerosi colli di bottiglia architetturali che richiedono interventi significativi prima di poter scalare.

**Capacita' stimata attuale: 500-1.000 utenti concorrenti MAX**

---

## 1. ANALISI ARCHITETTURA ATTUALE

### 1.1 Stack Tecnologico

| Layer | Tecnologia | Limiti Scalabilita' |
|-------|------------|---------------------|
| Frontend | React 19 + Vite | CDN/Edge OK |
| Backend | Express.js + Vercel Serverless | Single region, cold start |
| Database | PostgreSQL (Neon) | Connection pooling limited |
| Real-time | Pusher (servizio esterno) | 100 connections/sec limit (free tier) |
| Cache | Nessuna | Bottleneck critico |

### 1.2 Architettura Attuale

```
Browser (React)
    |
    v
Vercel Serverless (fra1 region)
    |
    v
PostgreSQL Neon (connection pooler)
    |
    v
Pusher (WebSocket relay)
```

### 1.3 File Critici Analizzati

1. **`src/services/auction.service.ts`** - Core logic aste (2000+ righe)
2. **`src/services/pusher.service.ts`** - Real-time server-side
3. **`src/services/pusher.client.ts`** - Real-time client-side
4. **`src/lib/prisma.ts`** - Database singleton
5. **`vercel.json`** - Deploy config (1024MB RAM, 30s timeout)
6. **`prisma/schema.generated.prisma`** - Schema DB con indici

---

## 2. COLLI DI BOTTIGLIA IDENTIFICATI

### 2.1 CRITICO - Nessuna Gestione Concorrenza nelle Offerte

**File:** `src/services/auction.service.ts` (linee 1106-1256)

```typescript
export async function placeBid(
  auctionId: string,
  userId: string,
  amount: number
): Promise<ServiceResult> {
  // PROBLEMA: Nessuna transazione atomica!
  const auction = await prisma.auction.findUnique({...})

  if (amount <= auction.currentPrice) {
    return { success: false, message: `Offerta minima: ${auction.currentPrice + 1}` }
  }

  // RACE CONDITION: tra la verifica e la scrittura un'altra offerta potrebbe arrivare
  await prisma.auctionBid.updateMany({...})  // Remove previous winning
  const bid = await prisma.auctionBid.create({...})
  await prisma.auction.update({...})
}
```

**Impatto:** Con 100 utenti che fanno offerte simultanee, possibili:
- Offerte accettate con importo inferiore al corrente
- Dati inconsistenti nel database
- Perdita di offerte

### 2.2 CRITICO - Assenza di Caching

**File:** `src/services/auction.service.ts`

Ogni operazione esegue query dirette al database:
- `getAuctionSessions` - Query completa ogni volta
- `getCurrentAuction` - Query + include relations ogni volta
- `getReadyStatus` - Query per ogni utente che controlla

**Impatto:** 10.000 utenti = 10.000+ query/secondo solo per polling stato

### 2.3 ALTO - Connection Pool Database Limitato

**File:** `prisma/schema.generated.prisma`

```prisma
datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DATABASE_URL_UNPOOLED")
}
```

Neon PostgreSQL con connection pooler:
- Default: 50-100 connessioni pooled
- Serverless functions = nuova connessione ogni cold start
- No configurazione pool nel codice

**Impatto:** Superato il limite, connessioni rifiutate o timeout

### 2.4 ALTO - Pusher Limits

**File:** `src/services/pusher.service.ts`

Limiti Pusher (dipende dal piano):
- Free: 100 connections/day, 200K messages/day
- Startup: 500 concurrent, 1M messages
- Pro: 10K concurrent, 10M messages

**Impatto:** Con aste simultanee, limiti raggiunti rapidamente

### 2.5 MEDIO - Heartbeat In-Memory

**File:** `src/services/auction.service.ts` (linee 23-48)

```typescript
// In-memory storage for heartbeats
const heartbeats = new Map<string, Map<string, number>>()
```

**Problema:** In ambiente serverless:
- Ogni istanza ha la propria Map
- Stato non condiviso tra function invocations
- Cold start = perdita heartbeat

### 2.6 MEDIO - Serverless Cold Start

**File:** `vercel.json`

```json
{
  "functions": {
    "api/index.mjs": {
      "memory": 1024,
      "maxDuration": 30
    }
  }
}
```

- Cold start tipico: 500-2000ms
- Durante aste real-time = latenza inaccettabile
- Nessun warmup configurato

### 2.7 MEDIO - Assenza Rate Limiting

> "Rate Limiting: Attualmente non implementato. Da considerare per produzione."

**Impatto:**
- Vulnerabile a DoS
- Un utente malintenzionato puo' saturare il sistema
- Nessuna protezione API

---

## 3. STIMA CAPACITA' ATTUALE

### Scenario: 10 Leghe con 10 Manager Ciascuna (100 utenti)

| Operazione | Frequenza/utente | Totale/sec | Sostenibile? |
|------------|------------------|------------|--------------|
| Polling stato asta | 1/sec | 100 | SI |
| Heartbeat | 1/10sec | 10 | SI |
| Place bid (picco) | 0.1/sec | 10 | SI |
| Pusher events | 10/sec | 1000 | SI |

**Risultato:** 100 utenti = OK

### Scenario: 1000 Leghe con 10 Manager Ciascuna (10.000 utenti)

| Operazione | Frequenza/utente | Totale/sec | Sostenibile? |
|------------|------------------|------------|--------------|
| Polling stato asta | 1/sec | 10,000 | NO |
| Heartbeat | 1/10sec | 1,000 | FORSE |
| Place bid (picco) | 0.1/sec | 1,000 | NO |
| Pusher events | 10/sec | 100,000 | NO |

**Risultato:** 10.000 utenti = SYSTEM FAILURE

### Punto di Rottura Stimato

- **Database:** ~500 connessioni concorrenti (connection pool exhaustion)
- **Pusher:** ~500-1000 connessioni (dipende dal piano)
- **Serverless:** ~100 cold starts simultanei (latenza degradata)
- **Overall:** **~500-1000 utenti concorrenti MAX**

---

## 4. PIANO ARCHITETTURALE DI SCALABILITA'

### 4.1 Architettura Target (10K+ utenti)

```
                        CDN (Vercel Edge)
                              |
                    +---------+---------+
                    |                   |
            Static Assets         API Gateway
            (React build)         (rate limiting)
                                      |
                    +---------+---------+---------+
                    |         |         |         |
                 Region1   Region2   Region3   Region4
                 (API)     (API)     (API)     (API)
                    |         |         |         |
                    +---------+---------+---------+
                              |
                         Redis Cluster
                     (session, cache, pub/sub)
                              |
              +---------------+---------------+
              |                               |
        PostgreSQL Primary          PostgreSQL Read Replicas
        (writes only)               (reads distributed)
              |
        Redis Pub/Sub
        (real-time events)
              |
    +----+----+----+----+
    |    |    |    |    |
   WS1  WS2  WS3  WS4  WS5
   (WebSocket servers - dedicated)
```

### 4.2 Componenti Chiave da Implementare

1. **Redis Cache Layer**
   - Stato aste in Redis (non polling DB)
   - Session management
   - Rate limiting con Redis

2. **Redis Pub/Sub per Real-time**
   - Sostituisce/affianca Pusher
   - Eventi broadcast a WebSocket servers

3. **WebSocket Servers Dedicati**
   - Non serverless per WS
   - Sticky sessions per connessioni
   - Auto-scaling basato su connessioni

4. **Database Sharding**
   - Shard per league_id
   - Read replicas per query pesanti

5. **Message Queue**
   - Bid processing asincrono
   - Garantisce ordine e atomicita'

---

## 5. ROADMAP IMPLEMENTAZIONE

### FASE 1: Quick Wins (1-2 settimane)

| Azione | Impatto | Effort | File da Modificare |
|--------|---------|--------|-------------------|
| **Transazioni atomiche per bid** | CRITICO | Basso | `auction.service.ts` |
| **Aggiungere rate limiting** | ALTO | Basso | `api/index.ts`, nuovo middleware |
| **Ottimizzare query con select** | MEDIO | Basso | Tutti i service |
| **Aumentare Pusher plan** | ALTO | Nullo | Configurazione |
| **Cold start warmup** | MEDIO | Basso | `vercel.json`, cron |

#### Esempio Fix Transazione Atomica:

```typescript
export async function placeBid(
  auctionId: string,
  userId: string,
  amount: number
): Promise<ServiceResult> {
  return prisma.$transaction(async (tx) => {
    // Lock per update previene race conditions
    const auction = await tx.auction.findUnique({
      where: { id: auctionId },
      // FOR UPDATE implicito in transaction
    })

    if (!auction || auction.status !== 'ACTIVE') {
      throw new Error('Asta non attiva')
    }

    if (amount <= auction.currentPrice) {
      throw new Error(`Offerta minima: ${auction.currentPrice + 1}`)
    }

    // Tutto atomico ora
    await tx.auctionBid.updateMany({...})
    const bid = await tx.auctionBid.create({...})
    await tx.auction.update({...})

    return bid
  }, {
    isolationLevel: 'Serializable' // Massima sicurezza
  })
}
```

### FASE 2: Medium Term (2-4 settimane)

| Azione | Impatto | Effort | Descrizione |
|--------|---------|--------|-------------|
| **Introdurre Redis caching** | CRITICO | Medio | Cache stato aste, ready status |
| **Migrare heartbeat a Redis** | ALTO | Medio | Stato condiviso tra istanze |
| **Database connection pooling** | ALTO | Medio | Prisma Data Proxy o PgBouncer |
| **Implementare queue per bid** | ALTO | Medio | Bull/BullMQ con Redis |
| **Monitoring e alerting** | MEDIO | Medio | Datadog/NewRelic/Sentry |

#### Struttura Redis Cache:

```
# Stato asta corrente
auction:{auctionId}:state -> JSON {currentPrice, winnerId, timerExpires}

# Ready members per sessione
session:{sessionId}:ready -> SET [memberId1, memberId2, ...]

# Heartbeat
session:{sessionId}:heartbeat:{memberId} -> timestamp (TTL 10s)

# Rate limiting
ratelimit:user:{userId} -> counter (TTL 1min)
```

### FASE 3: Long Term (1-3 mesi)

| Azione | Impatto | Effort | Descrizione |
|--------|---------|--------|-------------|
| **WebSocket server dedicato** | CRITICO | Alto | Sostituisce polling + Pusher |
| **Horizontal scaling API** | CRITICO | Alto | Multi-region deployment |
| **Database read replicas** | ALTO | Alto | Query read separate |
| **Event sourcing per aste** | ALTO | Alto | Audit trail completo |
| **Load testing framework** | MEDIO | Medio | k6/Artillery continuous |
| **Auto-scaling policies** | ALTO | Medio | Basato su metriche |

### FASE 4: Enterprise Scale (3-6 mesi)

| Azione | Impatto | Effort | Descrizione |
|--------|---------|--------|-------------|
| **Database sharding** | CRITICO | Alto | Shard per league |
| **CQRS pattern** | ALTO | Alto | Separate read/write models |
| **Kubernetes deployment** | ALTO | Alto | Full orchestration |
| **Global CDN + Edge** | MEDIO | Medio | Latenza globale |
| **Disaster recovery** | ALTO | Alto | Multi-region failover |

---

## 6. METRICHE E MONITORING

### KPI da Tracciare

| Metrica | Target | Alert Threshold |
|---------|--------|-----------------|
| API Response Time (p95) | <200ms | >500ms |
| Database Query Time (p95) | <50ms | >200ms |
| WebSocket Latency | <100ms | >300ms |
| Error Rate | <0.1% | >1% |
| Concurrent Connections | N/A | >80% capacity |
| Database Connections | N/A | >70% pool |
| Memory Usage | <70% | >85% |

### Tools Consigliati

1. **Application Performance:** New Relic / Datadog
2. **Error Tracking:** Sentry
3. **Logging:** LogRocket / Logtail
4. **Uptime:** BetterUptime / PagerDuty
5. **Load Testing:** k6 / Artillery

---

## 7. STIMA COSTI INFRASTRUTTURA

### Scenario 1: 1.000 utenti concorrenti

| Servizio | Piano | Costo/mese |
|----------|-------|------------|
| Vercel | Pro | $20 |
| Neon PostgreSQL | Launch | $19 |
| Pusher | Startup | $49 |
| Redis (Upstash) | Pay-as-you-go | ~$10 |
| **Totale** | | **~$100/mese** |

### Scenario 2: 10.000 utenti concorrenti

| Servizio | Piano | Costo/mese |
|----------|-------|------------|
| Vercel | Enterprise | Custom (~$200+) |
| Neon PostgreSQL | Scale | $69+ |
| Pusher | Pro | $399 |
| Redis (Upstash) | Pro | $60+ |
| WebSocket Server (Fly.io) | 2x instances | ~$50 |
| Monitoring (Datadog) | Pro | ~$100 |
| **Totale** | | **~$900-1200/mese** |

### Scenario 3: 100.000 utenti concorrenti

| Servizio | Piano | Costo/mese |
|----------|-------|------------|
| AWS/GCP Full Stack | Managed | ~$3000-5000 |
| Dedicated WebSocket | 10+ instances | ~$500 |
| PostgreSQL Cluster | Managed | ~$500+ |
| Redis Cluster | Enterprise | ~$300+ |
| CDN | Enterprise | ~$200+ |
| Monitoring | Enterprise | ~$300+ |
| **Totale** | | **~$5000-8000/mese** |

---

## 8. CONCLUSIONI E RACCOMANDAZIONI

### Azioni Immediate (Prima di Scalare)

1. **URGENTE:** Implementare transazioni atomiche per placeBid
2. **URGENTE:** Aggiungere rate limiting base
3. **IMPORTANTE:** Upgrade Pusher plan (o valutare alternative)
4. **IMPORTANTE:** Configurare monitoring base

### Decisioni Architetturali da Prendere

1. **WebSocket:** Self-hosted vs Pusher vs Ably vs Socket.io?
2. **Hosting:** Rimanere su Vercel o migrare a container-based?
3. **Database:** Neon, Supabase, o managed PostgreSQL?
4. **Cache:** Upstash Redis, Vercel KV, o self-hosted?

### Rischi se Non Si Interviene

| Rischio | Probabilita' | Impatto | Mitigazione |
|---------|--------------|---------|-------------|
| Race condition offerte | Alta | Critico | Transazioni atomiche |
| System down durante aste | Media | Critico | Scaling + fallback |
| Data corruption | Media | Critico | Transaction isolation |
| User experience degradata | Alta | Alto | Caching + optimization |

---

## File Critici per Implementazione

1. `src/services/auction.service.ts` - Logica core delle aste
2. `src/services/pusher.service.ts` - Gestione real-time server-side
3. `src/lib/prisma.ts` - Singleton database
4. `src/api/index.ts` - Entry point API
5. `vercel.json` - Configurazione deploy
