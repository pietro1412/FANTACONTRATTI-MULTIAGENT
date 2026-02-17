## Workflow: Nuova Feature

Segui queste fasi in ordine. NON saltare fasi.

### FASE 1 — Esplorazione (usa "think hard")
Analizza il codebase per capire:
- Quali componenti/servizi esistono già per questa area
- Quali pattern sono usati in feature simili
- Quali test coprono l'area coinvolta
- Se serve modificare schema Prisma

Output: breve summary di cosa hai trovato.

### FASE 2 — Piano
Produci un piano con:
- File da creare (con path completo)
- File da modificare (con descrizione delle modifiche)
- Schema Prisma changes (se necessarie)
- Test da scrivere
- Ordine di implementazione

**Chiedi conferma prima di procedere.**

### FASE 3 — Implementazione
Per ogni file, nell'ordine del piano:
1. Se serve un test, scrivilo PRIMA (TDD)
2. Implementa il codice
3. `npm run lint` + `npm run test:all`
4. Commit atomico con conventional commit

### FASE 4 — Review
Lancia il subagent `code-reviewer` per validare.
Se ci sono bloccanti, correggi e ripeti.

### FASE 5 — Wrap-up
- Aggiorna CLAUDE.md se hai introdotto nuovi pattern o file critici
- Summary delle modifiche per il PM
