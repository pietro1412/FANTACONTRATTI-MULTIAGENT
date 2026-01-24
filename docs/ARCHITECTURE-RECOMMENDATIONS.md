# RACCOMANDAZIONI ARCHITETTURALI - FANTACONTRATTI

> Generato il 24/01/2026 da Claude Code (Architetto Enterprise)

## Domanda: Microservizi + DDD + Kafka?

**Risposta: NO, sarebbe over-engineering per il vostro caso.**

---

## 1. ANALISI PRO e CONTRO

### PRO (Teorici)

| Vantaggio | Realta' per Voi |
|-----------|-----------------|
| Scalabilita' indipendente | Non vi serve: 10K utenti non e' Netflix |
| Isolamento failure | Un monolite ben fatto ha lo stesso effetto |
| Team autonomi | Avete 1-3 dev, non 50 |
| Event sourcing puro | Il dominio non lo richiede (non siete una banca) |

### CONTRO (Concreti)

| Problema | Impatto Reale |
|---------|---------------|
| **Costo Kafka managed** | ~$300-800/mese (Confluent/AWS MSK) per un cluster minimo |
| **Complessita' operativa** | Zookeeper, partizioni, consumer groups, dead letter queues |
| **Latenza aggiunta** | 10-50ms per ogni hop tra servizi |
| **Debugging distribuito** | Tracing, correlation IDs, log aggregation = altro stack |
| **Transazioni distribuite** | Saga pattern per un'asta? Follia |
| **Deploy complexity** | 5-10 servizi da deployare, versionare, monitorare |
| **Curva apprendimento** | 3-6 mesi per un team piccolo |

---

## 2. CONFRONTO NUMERICO

```
SCENARIO: Asta con 8 manager che fanno offerte contemporanee

MICROSERVIZI + KAFKA:
Request -> API Gateway -> Auth Service -> Auction Service
       -> Kafka -> Contract Service -> Notification Service
       -> Kafka -> Wallet Service

Latenza: 150-300ms
Servizi coinvolti: 6
Possibili failure points: 8
Costo infra mensile: ~$500-1000

MODULAR MONOLITH + REDIS + BULLMQ:
Request -> Express -> AuctionModule (con transazione Prisma)
       -> Redis pub/sub -> Pusher
       -> BullMQ job (async)

Latenza: 20-50ms
Servizi coinvolti: 1 (+ Redis + Pusher)
Possibili failure points: 3
Costo infra mensile: ~$50-100
```

---

## 3. ARCHITETTURA CONSIGLIATA: Modular Monolith Event-Driven

```
+-------------------------------------------------------------+
|                    EXPRESS MONOLITH                         |
|  +----------+ +----------+ +----------+ +--------------+    |
|  |  Auth    | |  League  | | Auction  | |   Contract   |    |
|  |  Module  | |  Module  | |  Module  | |    Module    |    |
|  +----+-----+ +----+-----+ +----+-----+ +------+-------+    |
|       |            |            |               |           |
|  +----+------------+------------+---------------+----+      |
|  |              EVENT BUS (in-process)               |      |
|  |         EventEmitter + TypedEvents                |      |
|  +---------------------------+-----------------------+      |
+------------------------------+------------------------------+
                               |
        +----------------------+----------------------+
        v                      v                      v
   +---------+          +-----------+          +-----------+
   |  Redis  |          |  BullMQ   |          |  Pusher   |
   |  Cache  |          |  Queues   |          | Real-time |
   +---------+          +-----------+          +-----------+
```

---

## 4. STACK RACCOMANDATO

| Componente | Tecnologia | Costo/mese |
|------------|------------|------------|
| Runtime | Node.js/Express (o Fastify) | $0 |
| Database | PostgreSQL Neon (Pro) | $19-69 |
| Cache | Redis Upstash | $10-30 |
| Queue | BullMQ su stesso Redis | $0 |
| Real-time | Pusher (o Ably) | $49-99 |
| Hosting | Vercel Pro o Railway | $20-50 |
| **TOTALE** | | **$100-250/mese** |

vs Microservizi + Kafka: **$500-1500/mese**

---

## 5. STRUTTURA MODULAR MONOLITH

```typescript
// src/modules/auction/auction.module.ts
export class AuctionModule {
  constructor(
    private db: PrismaClient,
    private cache: RedisClient,
    private eventBus: EventEmitter,
    private queue: BullMQ
  ) {}

  async placeBid(data: BidInput): Promise<BidResult> {
    // 1. Validazione (sincrona)
    await this.validateBid(data);

    // 2. Transazione atomica (il vero problema attuale)
    const result = await this.db.$transaction(async (tx) => {
      const auction = await tx.auction.findUnique({...});
      // Lock ottimistico con version
      if (auction.version !== data.expectedVersion) {
        throw new ConcurrencyError();
      }
      // Aggiorna offerta
      return tx.bid.create({...});
    });

    // 3. Invalida cache
    await this.cache.del(`auction:${data.auctionId}`);

    // 4. Evento interno (sincrono, in-process)
    this.eventBus.emit('bid.placed', result);

    // 5. Job asincrono per side-effects
    await this.queue.add('notify-bid', result);

    return result;
  }
}
```

---

## 6. QUANDO MICROSERVIZI AVREBBERO SENSO

Passate a microservizi **SOLO SE**:

1. Superate **100.000 utenti concorrenti** (non 10K)
2. Avete **10+ sviluppatori** che si pestano i piedi
3. Parti del sistema hanno **requisiti di scala radicalmente diversi**
4. Avete **budget DevOps dedicato** (~$2000+/mese)
5. Il monolite diventa **impossibile da deployare** (build > 30min)

---

## 7. ROADMAP PRAGMATICA

```
FASE 1 (Ora - 2 mesi): Fix Critici
+-- Transazioni atomiche Prisma
+-- Redis cache per sessioni/aste attive
+-- BullMQ per job asincroni
+-- Heartbeat su Redis (non in-memory)

FASE 2 (3-6 mesi): Ottimizzazione
+-- Connection pooling (PgBouncer)
+-- Rate limiting distribuito
+-- Monitoring (Sentry + Prometheus)
+-- Load testing fino a 10K

FASE 3 (Solo se necessario): Estrazione
+-- Se notification diventa bottleneck -> servizio separato
+-- Se analytics pesante -> read replica dedicata
+-- Valutare Kafka SOLO per event streaming analytics
```

---

## 8. CONFRONTO ALTERNATIVE A KAFKA

| Soluzione | Complessita' | Costo | Use Case |
|-----------|--------------|-------|----------|
| **BullMQ** | Bassa | $0 (usa Redis) | Job queue, background tasks |
| **Redis Pub/Sub** | Bassa | Incluso | Real-time events semplici |
| **AWS SQS** | Media | ~$1-10/mese | Queue managed senza gestione |
| **RabbitMQ** | Media | ~$50-100/mese | Message broker tradizionale |
| **Kafka** | Alta | ~$300-800/mese | Event streaming ad alto volume |

**Per FANTACONTRATTI:** BullMQ + Redis Pub/Sub coprono il 100% dei casi d'uso.

---

## 9. I VERI 4 PROBLEMI DA RISOLVERE

| Problema | Soluzione | Effort |
|----------|-----------|--------|
| Transazioni non atomiche | Prisma `$transaction` | 1-2 giorni |
| Stato in-memory | Redis per heartbeat | 2-3 giorni |
| Nessuna cache | Redis cache layer | 1 settimana |
| Pusher limits | Upgrade piano o Ably | Configurazione |

---

## 10. CONCLUSIONE

**Kafka + Microservizi + DDD per 10K utenti con 1-3 dev = come usare un TIR per portare la spesa a casa.**

Funziona? Si.
E' efficiente? No.
E' mantenibile? Assolutamente no.

Il vostro vero problema non e' l'architettura, sono:
1. **Transazioni non atomiche** (fix con Prisma transactions)
2. **Stato in-memory** (fix con Redis)
3. **Nessuna cache** (fix con Redis)
4. **Pusher limits** (fix con piano adeguato o Ably)

**Risolvete questi 4 punti e arrivate a 10K utenti con il monolite attuale, spendendo 1/5 e con 1/10 della complessita'.**

---

## Riferimenti

- [Modular Monolith vs Microservices](https://www.kamilgrzybek.com/design/modular-monolith-primer/)
- [BullMQ Documentation](https://docs.bullmq.io/)
- [Redis Pub/Sub](https://redis.io/docs/manual/pubsub/)
- [Prisma Transactions](https://www.prisma.io/docs/concepts/components/prisma-client/transactions)
