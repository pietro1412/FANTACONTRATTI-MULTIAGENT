# Note di Sviluppo - Fantacontratti

## Stato Attuale (30 Dic 2025)

### Server
- **API**: porta **3003** (cambiata da 3001 per conflitto con altro progetto)
- **Client**: porta 5173
- Avvio: `npm run dev`

### Modifiche Recenti

#### 1. CORS Fix
- File: `src/api/index.ts`
- Aggiunta configurazione esplicita con `methods` e `allowedHeaders`

#### 2. Modale Transazione Completata (Asta)
- File: `src/pages/AuctionRoom.tsx`
- Rimosso toggle confuso "Conferma/Ricorso"
- Ora mostra 2 bottoni chiari: **Conferma** (verde) e **Ricorso** (rosso outline)
- Cliccando "Ricorso" appare il campo testo e il bottone diventa "Invia Ricorso"
- Aggiunto pulsante **"[TEST] Simula ricorso di un manager"** visibile solo per admin lega

#### 3. Simulazione Ricorso
- Files: `src/services/auction.service.ts`, `src/api/routes/auctions.ts`, `src/services/api.ts`
- La funzione `simulateAppeal` ora accetta un `auctionId` opzionale
- Se fornito, simula il ricorso su quell'asta specifica (anche se non COMPLETED)
- Utile per testare il flusso di gestione ricorsi

#### 4. Cambio Porta API
- Files: `src/api/index.ts`, `src/services/api.ts`, `.env`
- Porta cambiata da 3001 a **3003**
- Motivo: conflitto con altro progetto (narrator-studio) sulla porta 3001

### File Nuovi (non committati precedentemente)
- `src/api/routes/chat.ts` - Route per chat sessione
- `src/components/Chat.tsx` - Componente chat
- `src/services/chat.service.ts` - Service chat
- `scripts/` - Vari script di utilità per database

### Prossimi Passi Suggeriti
- Testare il flusso completo: asta -> modale conferma -> ricorso -> gestione admin
- Verificare che la chat funzioni nelle sessioni d'asta

### Comandi Utili
```bash
# Avviare i servizi
npm run dev

# Database
npm run db:studio    # Prisma Studio
npm run db:push      # Push schema changes
```
