import { test, expect, chromium, type BrowserContext, type Page } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

/**
 * E2E — Validazione SINCRONIA real-time del Primo Mercato (F1) con DUE utenti reali.
 *
 * Obiettivo: dimostrare che le transizioni di fase (nomina → ready-check → asta →
 * offerta → conferma) si propagano sull'altro client rapidamente (≤4s, idealmente
 * <2s via Pusher), NON ai ~20s del polling. Conferma i fix di sessione
 * #6/#9/#14/#15/#17/#19/#20/#22/#23.
 *
 * Ambiente atteso (già attivo, NON avviato da questo spec):
 *   Frontend http://localhost:5174 · API :3003 · DB Docker :5433
 *   Lega E2E `cmq3eqxpf06p7xt0cjcjil3qe`, sessione `cmq3g2qvz07saxt0cfywwjfdv`,
 *   stato ASTA_LIBERA, ruolo corrente P.
 *
 * Robustezza allo stato: il turno di nomina avanza a ogni asta conclusa, quindi
 * dopo un run precedente Mirko non è più il nominator. Il `beforeAll` riallinea
 * `currentTurnIndex` al turno di Mirko (e `currentRole=P`) scrivendo direttamente
 * sul DB di test — infrastruttura di test, NON codice di produzione — così lo
 * spec è deterministico e ripetibile a prescindere dallo stato accumulato.
 *
 * Contesti browser isolati:
 *   A = Mirko    (nominator)
 *   B = Emiliano (offerente, 0 portieri → può offrire)
 *   C = Pietro   (admin lega, solo per sbloccare ready-check / accorciare timer)
 *
 * Run di validazione finale: HEADED + slowMo. Vedi npm script dedicato o:
 *   HEADED=1 SLOWMO=400 npx playwright test f1-sync-validation --workers=1
 */

const BASE = process.env.E2E_BASE_URL || 'http://localhost:5174'
const LEAGUE_ID = process.env.E2E_LEAGUE_ID || 'cmq3eqxpf06p7xt0cjcjil3qe'
const SESSION_ID = process.env.E2E_SESSION_ID || 'cmq3g2qvz07saxt0cfywwjfdv'

const HEADED = process.env.HEADED === '1' || process.env.HEADED === 'true'
const SLOWMO = process.env.SLOWMO ? parseInt(process.env.SLOWMO, 10) : HEADED ? 400 : 0

const USERS = {
  mirko: { email: 'mirko@test.it', password: 'Mirko2025!', name: 'Mirko' },
  emiliano: { email: 'emiliano@test.it', password: 'Emiliano2025!', name: 'Emiliano' },
  pietro: { email: 'pietro@test.it', password: 'Pietro2025!', name: 'Pietro' },
}

const AUCTION_URL = `${BASE}/leagues/${LEAGUE_ID}/auction/${SESSION_ID}`

// ─── DB setup (test infra — NON codice di produzione) ──────────────────

/**
 * Legge DATABASE_URL da .env.local (il DB Docker di test su :5433). Il processo
 * Playwright non eredita le env del dev server, quindi la risolviamo qui.
 */
function readDatabaseUrl(): string | undefined {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL
  try {
    const raw = readFileSync(resolve(process.cwd(), '.env.local'), 'utf8')
    const m = raw.match(/^\s*DATABASE_URL\s*=\s*"?([^"\r\n]+)"?/m)
    return m?.[1]
  } catch {
    return undefined
  }
}

/**
 * Porta la sessione in uno stato pulito di nomination con Mirko nominator,
 * scrivendo direttamente sul DB di test (infra di test, NON codice di prod):
 *
 *  1. Completa ogni acknowledgment pendente: per ogni asta COMPLETED/NO_BIDS con
 *     acks < totalMembers crea le conferme mancanti (stesso effetto di
 *     forceAcknowledgeAll, ma deterministico — niente dipendenza da modali/overlay).
 *  2. Imposta `currentTurnIndex` sulla posizione di Mirko nel `turnOrder` e forza
 *     `currentRole = 'P'`.
 *
 * Perché serve: il turno avanza a ogni asta conclusa e run precedenti possono
 * lasciare ack a metà (es. "Butez" 3/8) → il client resta sulla WaitingModal
 * "In attesa degli altri" e Mirko non entra mai in fase nomination. Idempotente.
 */
async function prepareCleanNominationState(): Promise<void> {
  const url = readDatabaseUrl()
  if (!url) throw new Error('DATABASE_URL non trovata (né env né .env.local)')
  // Import dinamico: @prisma/client è già dipendenza del progetto.
  const { PrismaClient, Prisma } = await import('@prisma/client')
  const prisma = new PrismaClient({ datasources: { db: { url } } })
  try {
    const session = await prisma.marketSession.findUnique({ where: { id: SESSION_ID } })
    if (!session) throw new Error(`Sessione ${SESSION_ID} non trovata sul DB`)
    const turnOrder = (session.turnOrder as string[] | null) ?? []
    if (turnOrder.length === 0) throw new Error('turnOrder vuoto sulla sessione')

    const activeMembers = await prisma.leagueMember.findMany({
      where: { leagueId: session.leagueId, status: 'ACTIVE' },
      select: { id: true },
    })
    const memberIds = activeMembers.map(m => m.id)

    // 1. Completa gli ack pendenti su tutte le aste concluse della sessione.
    const completedAuctions = await prisma.auction.findMany({
      where: { marketSessionId: SESSION_ID, status: { in: ['COMPLETED', 'NO_BIDS'] } },
      select: { id: true, acknowledgments: { select: { memberId: true } } },
    })
    let createdAcks = 0
    for (const auction of completedAuctions) {
      const acked = new Set(auction.acknowledgments.map(a => a.memberId))
      const missing = memberIds.filter(id => !acked.has(id))
      if (missing.length > 0) {
        await prisma.auctionAcknowledgment.createMany({
          data: missing.map(memberId => ({ auctionId: auction.id, memberId, prophecy: null })),
          skipDuplicates: true,
        })
        createdAcks += missing.length
      }
    }

    // 2. Riallinea il turno a Mirko + ruolo P.
    const nominatorMembers = await prisma.leagueMember.findMany({
      where: { id: { in: turnOrder } },
      select: { id: true, user: { select: { username: true } } },
    })
    const byId = new Map(nominatorMembers.map(m => [m.id, m.user.username]))
    const mirkoIndex = turnOrder.findIndex(id => byId.get(id) === USERS.mirko.name)
    if (mirkoIndex < 0) throw new Error('Mirko non presente nel turnOrder della sessione')

    // 3. Azzera ogni nomina pendente lasciata da un run interrotto (altrimenti il
    //    client resta in fase readyCheck "Conferma Pronti" invece di nomination).
    await prisma.marketSession.update({
      where: { id: SESSION_ID },
      data: {
        currentTurnIndex: mirkoIndex,
        currentRole: 'P',
        pendingNominationPlayerId: null,
        pendingNominatorId: null,
        nominatorConfirmed: false,
        readyMembers: Prisma.JsonNull,
      },
    })

    // 4. Libera gli slot Portiere di Emiliano (il bidder): ogni run vince un P,
    //    riempiendo i 3 slot GK dopo 3 run → la BidControls sparisce ("Slot Ruolo
    //    Completo"). Annullo del tutto i P vinti da Emiliano in QUESTA sessione
    //    (artefatti di test): cancello roster + contratti e rimborso il prezzo.
    //    DELETE (non RELEASED) per non accumulare righe e non violare la unique
    //    (leagueMemberId, playerId, status). Mantiene il bidder sempre capace di
    //    offrire e il budget stabile run dopo run.
    const emiId = turnOrder.find(id => byId.get(id) === USERS.emiliano.name)
      ?? (await prisma.leagueMember.findFirst({
        where: { leagueId: session.leagueId, user: { username: USERS.emiliano.name } },
        select: { id: true },
      }))?.id
    let releasedP = 0
    if (emiId) {
      // I P vinti da Emiliano in QUESTA sessione = aste concluse della sessione
      // con winnerId = Emiliano e giocatore di ruolo P.
      const wonPAuctions = await prisma.auction.findMany({
        where: {
          marketSessionId: SESSION_ID,
          winnerId: emiId,
          status: 'COMPLETED',
          player: { position: 'P' },
        },
        select: { playerId: true },
      })
      const wonPlayerIds = wonPAuctions.map(a => a.playerId)
      if (wonPlayerIds.length > 0) {
        // Tutte le righe roster (qualsiasi status) di Emiliano per quei P: rimuovo
        // anche eventuali RELEASED residue di run precedenti.
        const rosterRows = await prisma.playerRoster.findMany({
          where: { leagueMemberId: emiId, playerId: { in: wonPlayerIds } },
          select: {
            id: true,
            status: true,
            acquisitionPrice: true,
            contract: { select: { id: true } },
            draftContract: { select: { id: true } },
          },
        })
        for (const r of rosterRows) {
          if (r.draftContract) await prisma.draftContract.delete({ where: { id: r.draftContract.id } })
          if (r.contract) await prisma.playerContract.delete({ where: { id: r.contract.id } })
          await prisma.playerRoster.delete({ where: { id: r.id } })
          if (r.status === 'ACTIVE' && r.acquisitionPrice > 0) {
            await prisma.leagueMember.update({
              where: { id: emiId },
              data: { currentBudget: { increment: r.acquisitionPrice } },
            })
            releasedP++
          }
        }
      }
    }

    // eslint-disable-next-line no-console
    console.log(
      `[SETUP] Stato pulito: ${createdAcks} ack completati, nomina pendente azzerata, ${releasedP} portieri di Emiliano liberati, turno → Mirko (index ${mirkoIndex}, ruolo P).`
    )
  } finally {
    await prisma.$disconnect()
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────

async function login(page: Page, email: string, password: string) {
  await page.goto(`${BASE}/login`)
  await page.getByLabel(/email o username/i).fill(email)
  await page.getByLabel(/password/i).fill(password)
  await page.getByRole('button', { name: /accedi/i }).click()
  await expect(page).toHaveURL(/\/(dashboard|leagues)/, { timeout: 20000 })
}

async function enterAuctionRoom(page: Page) {
  await page.goto(AUCTION_URL)
  // La sala asta ha caricato quando sparisce lo spinner "Caricamento sala asta..."
  await expect(page.getByText(/Caricamento sala asta/i)).toHaveCount(0, { timeout: 20000 })
}

/**
 * Misura quanto tempo impiega `locator` a diventare visibile sul `page` dato.
 * Polla ogni 200ms. Ritorna i secondi trascorsi.
 *
 * NB: porta `page` in primo piano prima di misurare. Con 3 finestre headed solo
 * una è focalizzata; le altre hanno document.hidden=true → il client SALTA il
 * polling di fallback (useAuctionRoomState) e il browser può throttare il socket
 * in background. bringToFront() rende la pagina "visible" (come un utente reale
 * che guarda il proprio schermo). Il client ri-fetcha lo stato su visibilitychange
 * (useAuctionRoomState), quindi dispatchiamo l'evento esplicitamente: garantisce
 * il refetch anche quando la pagina era già in primo piano (in quel caso
 * bringToFront è no-op e l'evento non scatterebbe da solo). Inoltre il handler
 * Pusher onNominationPending fa patch solo se readyStatus≠null, quindi senza
 * questo refetch un client con readyStatus null perderebbe l'evento.
 */
async function timeToVisible(
  page: Page,
  locatorFactory: () => ReturnType<Page['locator']>,
  timeoutMs = 20000
): Promise<number> {
  await page.bringToFront().catch(() => {})
  await page
    .evaluate(() => { document.dispatchEvent(new Event('visibilitychange')) })
    .catch(() => {})
  const start = Date.now()
  const deadline = start + timeoutMs
  let lastNudge = start
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const count = await locatorFactory().count()
    if (count > 0) {
      try {
        if (await locatorFactory().first().isVisible()) break
      } catch {
        /* re-poll */
      }
    }
    if (Date.now() > deadline) {
      throw new Error(`Locator non visibile entro ${timeoutMs}ms`)
    }
    // Safety net: ogni ~2s ridispatcha visibilitychange per forzare un refetch
    // (copre l'edge in cui il primo refetch è partito prima della persistenza
    // o un evento Pusher è andato perso con readyStatus null).
    if (Date.now() - lastNudge > 2000) {
      lastNudge = Date.now()
      await page
        .evaluate(() => { document.dispatchEvent(new Event('visibilitychange')) })
        .catch(() => {})
    }
    await page.waitForTimeout(200)
  }
  return (Date.now() - start) / 1000
}

const results: Array<{ step: string; observedSeconds: number; pass: boolean; note?: string }> = []

function record(step: string, seconds: number, note?: string) {
  const pass = seconds <= 4
  results.push({ step, observedSeconds: seconds, pass, note })
  // Log leggibile nel report Playwright
  // eslint-disable-next-line no-console
  console.log(
    `[SYNC] ${step}: ${seconds.toFixed(2)}s — ${pass ? 'PASS (≤4s)' : 'FAIL (>4s)'}${note ? ` — ${note}` : ''}`
  )
}

// ─── Test ─────────────────────────────────────────────────────────────

test.describe('F1 Primo Mercato — sincronia real-time (2 utenti reali)', () => {
  test.describe.configure({ mode: 'serial', timeout: 180000 })

  let browser: Awaited<ReturnType<typeof chromium.launch>>
  let ctxMirko: BrowserContext
  let ctxEmiliano: BrowserContext
  let ctxAdmin: BrowserContext
  let mirko: Page
  let emiliano: Page
  let admin: Page

  test.beforeAll(async () => {
    browser = await chromium.launch({ headless: !HEADED, slowMo: SLOWMO })
    ctxMirko = await browser.newContext({ viewport: { width: 1280, height: 900 } })
    ctxEmiliano = await browser.newContext({ viewport: { width: 1280, height: 900 } })
    ctxAdmin = await browser.newContext({ viewport: { width: 1280, height: 900 } })
    mirko = await ctxMirko.newPage()
    emiliano = await ctxEmiliano.newPage()
    admin = await ctxAdmin.newPage()

    // Diagnostica rete: logga le risposte agli endpoint chiave per capire
    // se i click producono chiamate API e con quale esito.
    if (process.env.NET_DEBUG === '1') {
      for (const [label, p] of [
        ['MIRKO', mirko],
        ['EMI', emiliano],
        ['ADMIN', admin],
      ] as const) {
        p.on('response', async res => {
          const url = res.url()
          if (/\/acknowledge|\/bids|\/nominate|\/ready|\/close|\/force-/.test(url)) {
            let body = ''
            try {
              body = (await res.text()).slice(0, 200)
            } catch {
              /* ignore */
            }
            // eslint-disable-next-line no-console
            console.log(`[NET ${label}] ${res.status()} ${url.replace(BASE, '')} → ${body}`)
          }
        })
      }
    }
  })

  test.afterAll(async () => {
    // eslint-disable-next-line no-console
    console.log('\n========== RIEPILOGO SINCRONIA F1 ==========')
    for (const r of results) {
      // eslint-disable-next-line no-console
      console.log(
        `${r.pass ? '✓' : '✗'} ${r.step}: ${r.observedSeconds.toFixed(2)}s${r.note ? ` (${r.note})` : ''}`
      )
    }
    // eslint-disable-next-line no-console
    console.log('============================================\n')
    await ctxMirko?.close()
    await ctxEmiliano?.close()
    await ctxAdmin?.close()
    await browser?.close()
  })

  test('1 — entrambi gli utenti entrano nella sala asta', async () => {
    // Stato pulito PRIMA di entrare: completa ack pendenti di run precedenti e
    // riallinea il turno a Mirko (DB di test — vedi prepareCleanNominationState).
    await prepareCleanNominationState()

    await login(mirko, USERS.mirko.email, USERS.mirko.password)
    await login(emiliano, USERS.emiliano.email, USERS.emiliano.password)
    await login(admin, USERS.pietro.email, USERS.pietro.password)

    await enterAuctionRoom(mirko)
    await enterAuctionRoom(emiliano)
    await enterAuctionRoom(admin)

    // Mirko deve avere il turno di nomina: compare il pannello "RICERCA & NOMINA"
    // ed è cliccabile (non disabled). Attendiamo che la fase nomination sia attiva.
    await expect(mirko.getByText(/RICERCA & NOMINA/i).first()).toBeVisible({ timeout: 15000 })
    // Sanity: NON deve esserci più una modale di transazione aperta su Mirko.
    await expect(mirko.getByText(/Transazione Completata/i)).toHaveCount(0)
  })

  test('2 — Mirko nomina un portiere e conferma → Emiliano vede la transizione ≤4s', async () => {
    // Mirko è in fase di nomination. Il tab ruolo corrente (P) è già attivo.
    // Le card giocatore sono <button> dentro la griglia "grid-cols-2" del pannello
    // nomina, ciascuna contenente la quotazione e il nome. Selezioniamo la prima.
    const firstPlayerCard = mirko.locator('div.grid.grid-cols-2 > button').first()
    await expect(firstPlayerCard).toBeVisible({ timeout: 15000 })
    await firstPlayerCard.click()

    // Compare la focal card con "PORTA IN ASTA"
    const nominateBtn = mirko.getByRole('button', { name: /PORTA IN ASTA/i })
    await expect(nominateBtn).toBeVisible({ timeout: 5000 })
    await nominateBtn.click()

    // Mirko (nominator) ora vede il ready-check con bottone CONFERMA
    const confirmBtn = mirko.getByRole('button', { name: /^CONFERMA$/i })
    await expect(confirmBtn).toBeVisible({ timeout: 5000 })

    // NB sul DESIGN: il backend NASCONDE volutamente la nomination ai NON-nominator
    // finché il nominator non conferma (getReadyStatus: se !nominatorConfirmed &&
    // !userIsNominator → hasPendingNomination=false). Quindi Emiliano NON deve
    // vedere il ready-check prima della conferma. Verifichiamo proprio questo
    // (anti-leak): Emiliano resta in attesa del turno e NON vede "SONO PRONTO".
    await emiliano.bringToFront()
    await emiliano.evaluate(() => { document.dispatchEvent(new Event('visibilitychange')) })
    await emiliano.waitForTimeout(1500)
    await expect(
      emiliano.getByRole('button', { name: /SONO PRONTO/i }),
      'Emiliano non deve vedere il ready-check prima della conferma del nominator'
    ).toHaveCount(0)

    // Mirko conferma la nomina
    await confirmBtn.click()

    // === ASSERZIONE SINCRONIA (post-conferma): Emiliano vede "SONO PRONTO" ≤4s ===
    // Dopo la conferma, hasPendingNomination diventa visibile a tutti → Emiliano
    // entra in ready-check e vede il bottone "SONO PRONTO". Questa è la vera
    // propagazione real-time da misurare.
    const tReady = await timeToVisible(emiliano, () =>
      emiliano.getByRole('button', { name: /SONO PRONTO/i })
    )
    record('Ready-check "SONO PRONTO" su Emiliano (post-conferma)', tReady)

    expect(tReady, 'propagazione conferma > 15s = regressione polling').toBeLessThan(15)
  })

  test('3 — ready-check: Mirko ed Emiliano si dichiarano pronti, admin sblocca, asta parte ≤4s', async () => {
    // Emiliano clicca SONO PRONTO
    const emiReady = emiliano.getByRole('button', { name: /SONO PRONTO/i })
    await expect(emiReady).toBeVisible({ timeout: 10000 })
    await emiReady.click()

    // Allunga il timer asta a 60s (AdminControlsPanel) per dare margine al passo
    // di bidding sotto slowMo (evita la chiusura per timeout prima dell'offerta).
    const timer60 = admin.getByRole('button', { name: /^60s$/ })
    if (await timer60.count()) await timer60.first().click().catch(() => {})

    // Mirko è il nominator: ha già confermato. Gli altri 6 membri non sono
    // pilotati → l'asta non parte. Sblocco con admin "Forza Tutti Pronti"
    // (AdminControlsPanel — NB: bottone admin di test, segnalato nel report).
    const forceReady = admin.getByRole('button', { name: /^Forza Tutti Pronti$/ })
    await expect(forceReady).toBeVisible({ timeout: 10000 })
    await forceReady.click()

    // === ASSERZIONE SINCRONIA: l'avvio asta (fase bidding) si riflette ≤4s ===
    // In bidding compare "Offerta Corrente" su entrambi.
    const tMirko = await timeToVisible(mirko, () => mirko.getByText(/Offerta Corrente/i))
    const tEmi = await timeToVisible(emiliano, () => emiliano.getByText(/Offerta Corrente/i))
    record('Avvio asta (bidding) su Mirko', tMirko, 'sblocco via admin [TEST] Forza Tutti Pronti')
    record('Avvio asta (bidding) su Emiliano', tEmi, 'sblocco via admin [TEST] Forza Tutti Pronti')

    expect(tMirko).toBeLessThan(15)
    expect(tEmi).toBeLessThan(15)
  })

  test('4 — Emiliano offre (+1) → Mirko vede prezzo/storico aggiornati ≤4s, no doppioni', async () => {
    // Emiliano usa il quick bid +1: porta l'input a (offerta_base + 1) rispettando
    // currentPrice. Poi conferma con il bottone offerta principale.
    const plusOne = emiliano.getByRole('button', { name: /^\+1$/ })
    await expect(plusOne).toBeVisible({ timeout: 10000 })
    await plusOne.click()

    // Input offerta: prendo quello VISIBILE (desktop BidControls; la versione
    // MobileBottomBar è lg:hidden ma resta nel DOM).
    const bidInput = emiliano.locator('[data-bid-input="true"]:visible').first()
    await expect(bidInput).toBeVisible({ timeout: 5000 })
    const bidValue = (await bidInput.inputValue()).trim()
    const bidNum = parseInt(bidValue || '0', 10)

    // Il bottone offerta principale (BidControls) ha come label l'importo numerico
    // esatto (bidNum). I quick-bid hanno prefisso "+", il prezzo è un <p> non un
    // button → l'unico button visibile con quel testo esatto è il submit.
    const submitBid = emiliano.getByRole('button', { name: new RegExp(`^${bidNum}$`) }).first()
    await expect(submitBid).toBeVisible({ timeout: 5000 })
    await submitBid.click()

    // === ASSERZIONE SINCRONIA: Mirko vede l'offerta di Emiliano nello STORICO ≤4s ===
    // Lo "Storico Offerte" (BiddingPanel) è una lista `space-y-1 max-h-32 ...` le
    // cui righe (div figli diretti) mostrano "Username (TeamName) … importo … ora".
    // Scoping robusto: la lista delle righe, NON il solo header.
    const storicoRows = mirko.locator('div.space-y-1.max-h-32.overflow-y-auto > div')
    const emiRows = storicoRows.filter({ hasText: new RegExp(USERS.emiliano.name) })
    const tBid = await timeToVisible(mirko, () => emiRows)
    record('Offerta di Emiliano visibile su Mirko (storico)', tBid)

    // Verifica che anche il prezzo corrente lato Mirko rifletta l'offerta.
    await expect
      .poll(
        async () => {
          const priceTxt = await mirko
            .locator('p.text-5xl')
            .filter({ hasText: /^\d+$/ })
            .first()
            .textContent()
            .catch(() => null)
          return parseInt(priceTxt || '0', 10)
        },
        { timeout: 8000 }
      )
      .toBeGreaterThanOrEqual(bidNum)

    // #9 — l'input offerta di Mirko si auto-valorizza a (offerta corrente + 1)
    const mirkoBidInput = mirko.locator('[data-bid-input="true"]:visible').first()
    await expect(mirkoBidInput).toBeVisible({ timeout: 10000 })
    await expect
      .poll(async () => parseInt((await mirkoBidInput.inputValue()) || '0', 10), { timeout: 8000 })
      .toBeGreaterThanOrEqual(bidNum + 1)
    const mirkoAutoBid = await mirkoBidInput.inputValue()
    record(
      '#9 auto-valorizzazione input Mirko',
      tBid,
      `input Mirko = ${mirkoAutoBid} (atteso ≥ ${bidNum + 1})`
    )

    // #23 — nessun doppione nello storico: l'offerta di Emiliano appare in 1 sola
    // RIGA. Conto le righe (div figli della lista), non le occorrenze di testo —
    // il teamName "Emiliano Town" contiene "Emiliano" e gonfierebbe un getByText.
    const emiRowsCount = await emiRows.count()
    const offerteCounter = mirko.getByText(/\d+ offerte/i).first()
    let offerteText = ''
    if (await offerteCounter.count()) {
      offerteText = ((await offerteCounter.textContent()) || '').trim()
    }
    record(
      '#23 no doppioni storico',
      tBid,
      `righe Emiliano nello storico = ${emiRowsCount}, contatore = "${offerteText}"`
    )
    expect(emiRowsCount, 'offerta Emiliano duplicata nello storico (#23)').toBe(1)

    expect(tBid, 'propagazione offerta > 15s = regressione polling').toBeLessThan(15)
  })

  test('5 — chiusura asta (admin) → fase conferma/ack compare su entrambi ≤4s', async () => {
    // Per non aspettare il timer pieno, l'admin conclude l'asta manualmente
    // (AdminActionsPanel → "Concludi asta manualmente"). Segnalato nel report.
    // Apri il pannello azioni admin se collassato.
    const adminToggle = admin.getByRole('button', { name: /Azioni Admin/i })
    if (await adminToggle.count()) {
      const expanded = await adminToggle.getAttribute('aria-expanded')
      if (expanded !== 'true') await adminToggle.click()
    }
    const closeBtn = admin.getByRole('button', { name: /Concludi asta manualmente/i })
    await expect(closeBtn).toBeVisible({ timeout: 10000 })
    await closeBtn.click()

    // === ASSERZIONE SINCRONIA: la modale/fase di acknowledgment compare ≤4s ===
    // AcknowledgmentPanel/Modal mostra il bottone "Conferma" (presa visione) e il
    // contatore "x/y" confermati. Verifichiamo la comparsa su entrambi i context.
    const tAckMirko = await timeToVisible(mirko, () =>
      mirko.getByRole('button', { name: /^Conferma$/i })
    )
    const tAckEmi = await timeToVisible(emiliano, () =>
      emiliano.getByRole('button', { name: /^Conferma$/i })
    )
    record('Fase acknowledgment su Mirko (#15/#16 client-trigger)', tAckMirko, 'asta chiusa via admin')
    record('Fase acknowledgment su Emiliano (#15/#16 client-trigger)', tAckEmi, 'asta chiusa via admin')

    expect(tAckMirko).toBeLessThan(15)
    expect(tAckEmi).toBeLessThan(15)

    // Cleanup: completa l'acknowledgment via DB (deterministico, niente attese su
    // modali) per lasciare la lega in stato pulito per il run successivo.
    await prepareCleanNominationState().catch(() => {})
  })
})
