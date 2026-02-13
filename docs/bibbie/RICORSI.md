# BIBBIA: Sistema Ricorsi (Appeal)

> Fonte di verita per il sistema di ricorsi durante l'asta.
> Permette ai manager di contestare un'assegnazione e all'admin di annullarla o confermarla.
> Ultima revisione: 2026-02-11

---

## 1. PANORAMICA

Il sistema di ricorsi consente a qualsiasi manager di contestare l'esito di un'asta completata. L'admin puo accettare il ricorso (annullando la transazione) o rifiutarlo (confermando il risultato). In entrambi i casi, tutti i manager devono confermare prima di proseguire.

### 1.1 Quando si Puo Presentare Ricorso

- Solo su aste con status `COMPLETED` (dopo che il vincitore e stato determinato)
- Il ricorso si presenta dalla modale di conferma (acknowledgment)
- Funziona sia nel Primo Mercato sia nella fase Svincolati

### 1.2 Chi Puo Presentare Ricorso

- Qualsiasi membro attivo della lega (non solo chi ha partecipato all'asta)

---

## 2. FLUSSO COMPLETO

### 2.1 Presentazione del Ricorso

1. Il manager clicca "Presenta Ricorso" nella modale di conferma
2. Inserisce una motivazione testuale (obbligatoria)
3. Il ricorso viene creato con status `PENDING`
4. L'asta passa a status `APPEAL_REVIEW`
5. L'intera sessione si blocca fino alla risoluzione

### 2.2 Revisione Admin

L'admin visualizza i ricorsi pendenti nel pannello admin con:
- Motivazione del ricorso e chi l'ha presentato
- Dettagli dell'asta: giocatore, vincitore, prezzo finale
- Storico ultime 5 offerte

L'admin puo:
- **Accettare** il ricorso (annulla la transazione)
- **Rifiutare** il ricorso (conferma il risultato)

Puo aggiungere una nota di motivazione alla decisione.

### 2.3 Se il Ricorso Viene ACCETTATO

Viene eseguito un rollback completo:

1. **Rimozione acquisto**: cancellazione PlayerRoster e PlayerContract del vincitore
2. **Ripristino budget**: il vincitore recupera il prezzo pagato
3. **Pulizia**: cancellazione movimenti e acknowledgment precedenti
4. **Reset asta**: status → `AWAITING_RESUME`, winnerId → null, timer azzerato
5. **Altri ricorsi**: eventuali altri ricorsi pendenti sulla stessa asta vengono auto-rifiutati

Dopo il rollback, tutti i manager devono confermare di essere pronti a riprendere l'asta.

### 2.4 Se il Ricorso Viene RIFIUTATO

1. Il ricorso viene marcato `REJECTED`
2. L'asta passa a status `AWAITING_APPEAL_ACK`
3. Tutti i manager devono prendere atto della decisione
4. Una volta che tutti hanno confermato, l'asta torna a `COMPLETED` e si prosegue

---

## 3. CONFERME POST-DECISIONE

### 3.1 Conferma Decisione (Ricorso Rifiutato)

- Ogni manager deve cliccare "Ho capito" per confermare di aver preso atto
- Status asta: `AWAITING_APPEAL_ACK`
- Quando tutti confermano → asta torna `COMPLETED`
- Nella fase Svincolati, i manager che hanno passato il turno vengono auto-confermati

### 3.2 Pronti a Riprendere (Ricorso Accettato)

- Ogni manager deve cliccare "Pronto" per confermare di essere pronto a riprendere
- Status asta: `AWAITING_RESUME`
- Quando tutti confermano → l'asta riprende con il timer che riparte
- Le offerte precedenti restano visibili

---

## 4. STATI E TRANSIZIONI

```
COMPLETED (asta conclusa normalmente)
    │
    ├── Manager presenta ricorso
    ▼
APPEAL_REVIEW (admin sta valutando)
    │
    ├── Admin ACCETTA ──────────────────┐
    │                                   ▼
    │                          AWAITING_RESUME
    │                          (tutti confermano "pronto")
    │                                   │
    │                                   ▼
    │                          Asta riprende → ACTIVE → COMPLETED
    │
    └── Admin RIFIUTA ──────────────────┐
                                        ▼
                               AWAITING_APPEAL_ACK
                               (tutti confermano "ho capito")
                                        │
                                        ▼
                                   COMPLETED (finale)
```

---

## 5. REGOLE IMPORTANTI

| Regola | Dettaglio |
|--------|-----------|
| Blocco sessione | Durante `APPEAL_REVIEW` nessuna altra operazione e possibile |
| Un ricorso alla volta | Se un ricorso viene accettato, gli altri pendenti vengono auto-rifiutati |
| Rollback completo | L'accettazione annulla tutto: roster, contratto, movimento, budget |
| Tutti devono confermare | Sia per "presa d'atto" che per "pronto a riprendere" |
| Offerte preservate | In caso di ripresa, le offerte precedenti restano come storico |
| Motivazione obbligatoria | Il manager deve fornire una spiegazione testuale |

---

## 6. OPERAZIONI ADMIN FORZATE

Per situazioni di emergenza o test, l'admin puo forzare:

- **Forza tutte le conferme decisione**: tutti i manager risultano aver preso atto
- **Forza tutti pronti a riprendere**: tutti i manager risultano pronti

Queste operazioni sono disponibili solo per l'admin e servono a sbloccare situazioni dove un manager e assente o non risponde.

---

## 7. ENDPOINTS API

| Operazione | Metodo | Endpoint |
|-----------|--------|----------|
| Presenta ricorso | POST | `/auctions/:auctionId/appeal` |
| Lista ricorsi | GET | `/leagues/:leagueId/appeals?status=...` |
| Risolvi ricorso | PUT | `/appeals/:appealId/resolve` |
| Status ricorso | GET | `/auctions/:auctionId/appeal-status` |
| Conferma decisione | POST | `/auctions/:auctionId/acknowledge-appeal-decision` |
| Pronto a riprendere | POST | `/auctions/:auctionId/ready-to-resume` |
| Forza conferme | POST | `/auctions/:auctionId/force-all-appeal-acks` |
| Forza pronti | POST | `/auctions/:auctionId/force-all-ready-resume` |
