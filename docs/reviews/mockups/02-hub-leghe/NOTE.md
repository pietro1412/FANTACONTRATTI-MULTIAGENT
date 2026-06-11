# Mockup Hub Leghe (Dashboard) — Note di design

> Sezione: **Dashboard come hub di leghe**. L'utente ha tipicamente 1–5 leghe (più spesso 1–3), in alcune Presidente, in altre Membro/DG.
> 3 varianti statiche di presentazione. Nessun codice di produzione toccato.
> Riferimento codice analizzato: `src/pages/Dashboard.tsx`, `src/services/league.service.ts` (`getLeaguesByUser`). Dati realistici: utente Diego (3 leghe reali + 1 "completata" fittizia per coprire lo stato).

## Scopo della pagina

L'hub non deve essere una **vetrina** ("ecco le tue leghe") ma uno **smistatore**: indirizzare l'utente verso la lega in cui vuole operare *adesso*, e dirgli **cosa richiede la sua azione** in ciascuna.

## Diagnosi dell'attuale

La dashboard di oggi mostra card identiche con info generiche (Stato Lega, Budget, Rosa/Contratti/Finanze, Entra). Problemi:

- **Nessun segnale d'azione**: non si capisce dove "tocca a te", dove ci sono offerte di scambio, richieste o ricorsi da gestire. L'hub non orienta.
- **Manca la fase di gioco corrente**: il dato che dice "questa lega è viva, qui sta succedendo qualcosa".
- **Incoerenza per stato**: una lega DRAFT ("In preparazione") mostra comunque "Budget 500M" e quick-actions Rosa/Contratti/Finanze — informazioni *fantasma* (lega non avviata).
- **Nessuna gerarchia/ordinamento**: leghe attive, in preparazione e da gestire hanno lo stesso peso visivo.
- **Riconoscibilità debole**: tutte le card hanno la stessa icona 🏟️; con 3–5 leghe non si distinguono a colpo d'occhio.

Principio guida comune alle 3 varianti: **prima ciò che richiede un'azione**; ogni card coerente con lo stato della lega; identità visiva per lega; 4 segnali resi espliciti (fase corrente, tocca a te, offerte di scambio, azioni da Presidente).

I 4 stati coperti in tutte le varianti:
1. **Lega test E2E** — ACTIVE, DG, fase *Asta in corso*, 🔴 **Tocca a te** (turno).
2. **Fantacontratti Test** — ACTIVE, DG, fase *Offerte pre-rinnovo*, 📨 **2 offerte di scambio**.
3. **Lega Finale** — DRAFT, **Presidente**, 2/8 membri, **1 richiesta di adesione** (no budget/azioni fantasma).
4. **Lega Veterani 2024** — COMPLETED, DG, esito *3° posto* (de-enfatizzata).

---

## v1 — Riordino conservativo (`v1-conservativo.html`)

Stesso tema Stadium Nights, stessi token: zero rischio identità, intervento solo su gerarchia, coerenza e densità. **Mantiene la griglia di card.**

- **Due sezioni**: "Richiede la tua azione" (in cima) e "Concluse" (sotto) → l'ordinamento per urgenza è strutturale.
- **Card state-aware**: striscia-fase slim in testa + riga "segnali di attenzione" (🔴 Tocca a te / 📨 offerte / richiesta admin / esito).
- **Coerenza per stato**: ACTIVE → budget + Rosa/Contratti/Finanze + "Entra"; DRAFT → membri X/Y + "In attesa di avvio" + CTA da Presidente (Avvia/Invita/Admin), niente budget; COMPLETED → solo esito + Storico, de-enfatizzata.
- **Identità lega**: monogramma colorato per lega + badge ruolo oro "Presidente" vs neutro "DG".
- Rischio minimo, implementabile per lo più con i dati già presenti (la fase corrente e i contatori segnali richiedono di ampliare il payload).

## v2 — Evoluzione (`v2-evoluzione.html`)

Dark ripensato (palette più fredda/profonda, titoli in font display Sora, raggi/ombre morbidi). L'hub diventa una **to-do list per lega**.

- **Rotaia "Richiede la tua attenzione"** in cima: emergono come tile prioritarie SOLO le leghe con un'azione pendente, ognuna con la **CTA puntuale** ("Entra nell'asta", "Valuta offerte", "Pannello Admin / Invita").
- **Griglia calma sotto** con tutte le leghe (incluse quelle senza azioni), con indicatore di avanzamento fase.
- Identità lega (monogramma + colore anche come striscia d'accento), ruolo distinto, accesso Admin riservato ai presidenti.
- È il miglior compromesso tra "vedo tutto" e "vedo subito cosa fare".

## v3 — Redesign audace (`v3-audace.html`)

Piena libertà: direzione **mission list / broadcast editoriale** (palette ink/paper, accenti flame-arancio + oro + blu, font Archivo Expanded + Space Mono, bordi spessi/ombre offset). Pensato per il power-user con più leghe.

- **Hero della cosa più urgente** a tutta larghezza: "Tocca a te in **Lega test E2E** — l'asta ti aspetta" + CTA gigante "Entra nell'asta →".
- **Leghe come righe-status** lette da sinistra a destra: identità | ruolo | fase | cosa devi fare ora | CTA, ordinate per urgenza.
- **Codifica visiva del compito**: flame = azione da DG, blu = compito da Presidente, tratteggiato/opaco = lega conclusa.
- Massima scansionabilità e gerarchia; è la rottura più netta con l'attuale.

---

## Come le 3 risolvono i problemi (sintesi)

| Problema attuale | v1 | v2 | v3 |
|---|---|---|---|
| nessun segnale d'azione | riga segnali per card | rotaia "attenzione" in cima | hero urgente + colonna "cosa fare ora" |
| manca la fase corrente | striscia-fase per card | fase + avanzamento | fase nella riga-status |
| incoerenza DRAFT | corpo per stato | corpo per stato | riga per stato |
| nessuna gerarchia | 2 sezioni urgenza/concluse | attenzione vs griglia calma | ordinamento per urgenza + hero |
| riconoscibilità | monogramma colorato | monogramma + accento | monogramma + codifica compito |

## Dipendenza tecnica comune

Fase corrente e contatori dei segnali (turno, offerte, richieste, ricorsi, consolidamento) **non sono nel payload attuale** di `getLeaguesByUser`. Per implementare qualunque variante serve un endpoint/aggregazione `dashboard-summary` per lega (una sola chiamata, no N×M). Il resto (ordinamento, coerenza stato, identità lega, ruolo+admin) è frontend con dati già disponibili.
