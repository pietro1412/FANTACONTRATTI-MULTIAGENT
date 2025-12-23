# Sprint 1 Brief - Utenti & Leghe

**Data:** Dicembre 2025
**Dipendenze:** Sprint 0 completato

---

## 🎯 OBIETTIVO SPRINT

Implementare il sistema completo di autenticazione utenti e la gestione delle leghe. Al termine di questo sprint, gli utenti potranno registrarsi, effettuare login, creare leghe e gestire i membri.

---

## 📖 DESCRIZIONE FUNZIONALE

### Contesto

Con l'infrastruttura tecnica pronta (Sprint 0), possiamo ora costruire le fondamenta applicative: il sistema utenti e leghe. Questi sono prerequisiti per tutte le funzionalità successive (aste, contratti, scambi).

### Cosa realizzeremo

1. **Sistema Autenticazione Completo**
   - Registrazione con email, username e password
   - Login sicuro con JWT (access token + refresh token)
   - Logout con invalidazione token
   - Protezione password con bcrypt

2. **Gestione Profilo Utente**
   - Visualizzazione dati profilo
   - Modifica username e email
   - Cambio password

3. **Sistema Leghe**
   - Creazione lega con parametri configurabili (budget, slot rosa, max partecipanti)
   - Generazione link invito univoco
   - Richiesta partecipazione a lega esistente
   - Gestione membri (accetta, rifiuta, espelli)
   - Ruoli distinti: Admin (creatore) vs Manager (partecipante)

### Flusso Utente Step-by-Step

**Scenario 1: Registrazione e Login**
1. Utente visita la homepage
2. Clicca su "Registrati"
3. Compila form: email, username, password, conferma password
4. Sistema valida i dati e crea l'account
5. Utente viene reindirizzato al login
6. Inserisce credenziali e accede alla dashboard

**Scenario 2: Creazione Lega**
1. Utente autenticato accede a "Le mie leghe"
2. Clicca "Crea nuova lega"
3. Compila form: nome lega, descrizione, budget iniziale (default 500), slot rosa per ruolo
4. Sistema crea la lega e assegna l'utente come Admin
5. Utente riceve link invito da condividere

**Scenario 3: Partecipazione a Lega**
1. Utente riceve link invito
2. Clicca sul link e viene portato alla pagina della lega
3. Vede info lega e clicca "Richiedi partecipazione"
4. Admin riceve notifica della richiesta
5. Admin accetta/rifiuta la richiesta
6. Se accettato, l'utente diventa Manager della lega

### Regole di Business

- **Username**: univoco, 3-20 caratteri, solo lettere, numeri e underscore
- **Email**: univoca, formato valido
- **Password**: minimo 8 caratteri, almeno 1 maiuscola, 1 numero
- **JWT Access Token**: scadenza 15 minuti
- **JWT Refresh Token**: scadenza 7 giorni
- **Lega**: massimo 1 Admin, N Manager (fino a maxParticipants)
- **Budget iniziale**: configurabile, default 500 crediti
- **Slot rosa default**: P=3, D=8, C=8, A=6 (totale 25)

---

## 📝 USER STORIES DETTAGLIATE

### US-1.1: Registrazione Utente

**Come** visitatore
**Voglio** registrarmi con email, username e password
**Così che** possa accedere alla piattaforma

**Acceptance Criteria:**
- [ ] AC1: Form con campi email, username, password, conferma password
- [ ] AC2: Validazione email formato valido
- [ ] AC3: Validazione username univoco (3-20 char, alfanumerico + underscore)
- [ ] AC4: Validazione password (min 8 char, 1 maiuscola, 1 numero)
- [ ] AC5: Conferma password deve corrispondere
- [ ] AC6: Password hashata con bcrypt prima del salvataggio
- [ ] AC7: Messaggio errore chiaro se validazione fallisce
- [ ] AC8: Redirect a login dopo registrazione riuscita

**Esempio concreto:**
> Mario inserisce email "mario@email.com", username "mario_rossi", password "Calcio2025!". Il sistema valida i dati, hash la password, crea l'utente nel DB e mostra "Registrazione completata! Effettua il login."

---

### US-1.2: Login con JWT

**Come** utente registrato
**Voglio** effettuare il login
**Così che** possa accedere alle funzionalità protette

**Acceptance Criteria:**
- [ ] AC1: Form con campi email/username e password
- [ ] AC2: Verifica credenziali contro DB
- [ ] AC3: Genera access token JWT (scadenza 15 min)
- [ ] AC4: Genera refresh token JWT (scadenza 7 giorni)
- [ ] AC5: Salva refresh token in httpOnly cookie
- [ ] AC6: Ritorna access token nel body response
- [ ] AC7: Messaggio errore generico se credenziali errate (sicurezza)
- [ ] AC8: Redirect a dashboard dopo login riuscito

**Esempio concreto:**
> Mario inserisce "mario@email.com" e "Calcio2025!". Il sistema verifica le credenziali, genera i token, imposta il cookie refresh e ritorna l'access token. Mario viene portato alla sua dashboard.

---

### US-1.3: Logout e Gestione Sessione

**Come** utente autenticato
**Voglio** poter effettuare il logout
**Così che** la mia sessione sia terminata in sicurezza

**Acceptance Criteria:**
- [ ] AC1: Endpoint POST /api/auth/logout
- [ ] AC2: Invalida refresh token (blacklist o delete)
- [ ] AC3: Cancella cookie refresh token
- [ ] AC4: Client rimuove access token dalla memoria
- [ ] AC5: Redirect a homepage dopo logout
- [ ] AC6: Endpoint POST /api/auth/refresh per rinnovare access token

**Edge Cases:**
- Token scaduto: ritorna 401, client usa refresh token
- Refresh token scaduto: ritorna 401, redirect a login

---

### US-1.4: Profilo Utente

**Come** utente autenticato
**Voglio** visualizzare e modificare il mio profilo
**Così che** possa gestire i miei dati personali

**Acceptance Criteria:**
- [ ] AC1: Pagina /profile mostra dati utente
- [ ] AC2: Visualizza: email, username, data registrazione
- [ ] AC3: Form modifica username (stesse validazioni registrazione)
- [ ] AC4: Form modifica email (stesse validazioni)
- [ ] AC5: Form cambio password (vecchia password + nuova + conferma)
- [ ] AC6: Messaggio conferma dopo modifica riuscita

---

### US-1.5: Creazione Lega

**Come** utente autenticato
**Voglio** creare una nuova lega
**Così che** possa organizzare il mio fantacalcio dinastico

**Acceptance Criteria:**
- [ ] AC1: Form creazione lega con tutti i parametri
- [ ] AC2: Campi: nome (required), descrizione, maxParticipants, initialBudget
- [ ] AC3: Campi slot rosa: goalkeeperSlots, defenderSlots, midfielderSlots, forwardSlots
- [ ] AC4: Valori default pre-compilati
- [ ] AC5: Creatore diventa automaticamente Admin
- [ ] AC6: Creatore riceve budget iniziale assegnato
- [ ] AC7: Genera link invito univoco
- [ ] AC8: Redirect a pagina lega dopo creazione

**Esempio concreto:**
> Mario crea "Lega Amici 2025" con budget 600, max 10 partecipanti, slot 3-8-8-6. Diventa Admin, riceve 600 crediti, e ottiene link fantacontratti.app/join/abc123xyz.

---

### US-1.6: Sistema Inviti a Lega

**Come** Admin di una lega
**Voglio** invitare altri utenti
**Così che** possano unirsi alla mia lega

**Acceptance Criteria:**
- [ ] AC1: Link invito univoco generato alla creazione lega
- [ ] AC2: Link formato: /join/{inviteCode}
- [ ] AC3: Pagina invito mostra info lega (nome, descrizione, partecipanti attuali)
- [ ] AC4: Utente non autenticato: redirect a login, poi torna all'invito
- [ ] AC5: Utente autenticato: vede pulsante "Richiedi partecipazione"
- [ ] AC6: Admin può rigenerare link invito
- [ ] AC7: Admin può disabilitare inviti

---

### US-1.7: Richiesta Partecipazione

**Come** utente autenticato con link invito
**Voglio** richiedere di partecipare a una lega
**Così che** possa giocare con altri

**Acceptance Criteria:**
- [ ] AC1: Pulsante "Richiedi partecipazione" su pagina invito
- [ ] AC2: Crea record LeagueMember con status PENDING
- [ ] AC3: Messaggio "Richiesta inviata, attendi approvazione Admin"
- [ ] AC4: Non può richiedere se già membro o già richiesta pending
- [ ] AC5: Non può richiedere se lega piena (maxParticipants raggiunto)

---

### US-1.8: Gestione Membri Lega

**Come** Admin di una lega
**Voglio** gestire le richieste e i membri
**Così che** possa controllare chi partecipa

**Acceptance Criteria:**
- [ ] AC1: Lista richieste pending visibile ad Admin
- [ ] AC2: Pulsanti Accetta/Rifiuta per ogni richiesta
- [ ] AC3: Accetta: status diventa ACTIVE, assegna budget iniziale
- [ ] AC4: Rifiuta: status diventa LEFT (o elimina record)
- [ ] AC5: Lista membri attivi con ruolo
- [ ] AC6: Admin può espellere Manager (status = LEFT)
- [ ] AC7: Admin NON può essere espulso
- [ ] AC8: Admin può promuovere Manager a Admin (trasferimento)

---

### US-1.9: Ruoli Lega

**Come** sistema
**Voglio** distinguere Admin e Manager
**Così che** le autorizzazioni siano rispettate

**Acceptance Criteria:**
- [ ] AC1: Admin può: gestire membri, configurare lega, aprire/chiudere mercati
- [ ] AC2: Manager può: partecipare ad aste, gestire rosa, fare offerte
- [ ] AC3: Middleware verifica ruolo per endpoint protetti
- [ ] AC4: UI mostra/nasconde azioni in base al ruolo

---

## 🏗️ ARCHITETTURA TECNICA

### Backend API Routes

```
POST   /api/auth/register     - Registrazione
POST   /api/auth/login        - Login
POST   /api/auth/logout       - Logout
POST   /api/auth/refresh      - Refresh access token
GET    /api/auth/me           - Utente corrente

GET    /api/users/profile     - Profilo utente
PUT    /api/users/profile     - Modifica profilo
PUT    /api/users/password    - Cambio password

POST   /api/leagues           - Crea lega
GET    /api/leagues           - Lista leghe utente
GET    /api/leagues/:id       - Dettaglio lega
PUT    /api/leagues/:id       - Modifica lega (Admin)
GET    /api/leagues/join/:code - Info lega da invito

POST   /api/leagues/:id/join  - Richiedi partecipazione
GET    /api/leagues/:id/members - Lista membri
PUT    /api/leagues/:id/members/:memberId - Accetta/Rifiuta/Espelli
```

### Struttura File Backend

```
src/
├── api/
│   ├── middleware/
│   │   ├── auth.ts          - Verifica JWT
│   │   ├── requireAuth.ts   - Protegge route
│   │   └── requireAdmin.ts  - Verifica ruolo Admin
│   ├── routes/
│   │   ├── auth.ts
│   │   ├── users.ts
│   │   └── leagues.ts
│   └── index.ts             - Express app
├── services/
│   ├── auth.service.ts
│   ├── user.service.ts
│   └── league.service.ts
└── utils/
    ├── jwt.ts
    ├── password.ts
    └── validation.ts
```

---

## ⚠️ DIPENDENZE E RISCHI

| Dipendenza/Rischio | Impatto | Mitigazione |
|--------------------|---------|-------------|
| PostgreSQL non configurato | Alto | Verificato in Sprint 0 |
| Sicurezza JWT | Alto | Seguire best practices, httpOnly cookies |
| Validazione input | Medio | Usare zod per schema validation |

---

## ✅ CONFERMA PM

Poiché il PM ha già approvato ("SI E SI"), procedo direttamente con l'implementazione.

---

## 📊 CHECKLIST MILESTONE 1

```
□ Registrazione utente funzionante con validazione
□ Login/logout funzionante con JWT
□ Refresh token implementato
□ Profilo utente visualizzabile e modificabile
□ Creazione lega con tutti i parametri
□ Invito a lega via link funzionante
□ Richiesta partecipazione funzionante
□ Admin può accettare/rifiutare/espellere membri
□ Distinzione ruoli Admin/Manager funzionante
□ Test coverage ≥ 95% per auth e leghe
□ API documentate
```
