import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const LEAGUE_ID = 'cmjyfpykm0005kaz9okuqmbxg'; // Lega Test Pusher
const SESSION_ID = 'cmk40puzi0001xhl5dxsj57d0'; // MERCATO_RICORRENTE

async function main() {
  console.log('=== SIMULAZIONE SCAMBI FASE OFFERTE_PRE_RINNOVO ===\n');

  // Recupera tutti i membri con i loro roster
  const members = await prisma.leagueMember.findMany({
    where: { leagueId: LEAGUE_ID, status: 'ACTIVE' },
    include: {
      user: { select: { id: true, username: true } },
      roster: {
        where: { status: 'ACTIVE' },
        include: {
          player: { select: { id: true, name: true, position: true, team: true } },
          contract: true
        }
      }
    }
  });

  // Crea una mappa per facile accesso
  const memberMap = {};
  for (const m of members) {
    memberMap[m.user.username] = m;
    console.log(`${m.user.username}: Budget ${m.currentBudget}, ${m.roster.length} giocatori`);
  }

  console.log('\n--- Dettaglio giocatori interessanti per gli scambi ---\n');

  // Mostra alcuni giocatori interessanti per ogni manager
  for (const m of members) {
    const interessanti = m.roster.filter(r =>
      ['C', 'A'].includes(r.player.position) || r.player.name.includes('Perin') || r.player.name.includes('Modric')
    ).slice(0, 3);

    if (interessanti.length > 0) {
      console.log(`${m.user.username}:`);
      interessanti.forEach(r => {
        console.log(`  - ${r.player.name} (${r.player.position}) | RosterID: ${r.id} | PlayerID: ${r.player.id}`);
        if (r.contract) {
          console.log(`    Contratto: Salary ${r.contract.salary}, Durata ${r.contract.duration}, Clausola ${r.contract.rescissionClause}`);
        }
      });
    }
  }

  // Definiamo 3 scambi
  const trades = [];

  // SCAMBIO 1: Manager3 (Modric) <-> Manager7 (un centrocampista) + 25 crediti
  const manager3 = memberMap['Manager3'];
  const manager7 = memberMap['Manager7'];

  if (manager3 && manager7) {
    const modric = manager3.roster.find(r => r.player.name.includes('Modric'));
    const playerFrom7 = manager7.roster.find(r => r.player.position === 'C');

    if (modric && playerFrom7) {
      trades.push({
        name: 'Scambio 1',
        sender: manager3,
        receiver: manager7,
        offeredPlayers: [modric],
        requestedPlayers: [playerFrom7],
        offeredBudget: 0,
        requestedBudget: 25,
        message: 'Modric è un fuoriclasse, ne vale la pena!'
      });
    }
  }

  // SCAMBIO 2: Manager5 (Zaniolo) -> Manager1 per 40 crediti
  const manager5 = memberMap['Manager5'];
  const manager1 = memberMap['Manager1'];

  if (manager5 && manager1) {
    const zaniolo = manager5.roster.find(r => r.player.name.includes('Zaniolo'));

    if (zaniolo) {
      trades.push({
        name: 'Scambio 2',
        sender: manager5,
        receiver: manager1,
        offeredPlayers: [zaniolo],
        requestedPlayers: [],
        offeredBudget: 0,
        requestedBudget: 40,
        message: 'Zaniolo in cambio di crediti'
      });
    }
  }

  // SCAMBIO 3: Manager2 (un portiere) <-> Manager4 (Sohm) + 15 crediti a Manager2
  const manager2 = memberMap['Manager2'];
  const manager4 = memberMap['Manager4'];

  if (manager2 && manager4) {
    const portiere2 = manager2.roster.find(r => r.player.position === 'P');
    const sohm = manager4.roster.find(r => r.player.name.includes('Sohm'));

    if (portiere2 && sohm) {
      trades.push({
        name: 'Scambio 3',
        sender: manager2,
        receiver: manager4,
        offeredPlayers: [portiere2],
        requestedPlayers: [sohm],
        offeredBudget: 0,
        requestedBudget: 15,
        message: 'Portiere solido per centrocampista + crediti'
      });
    }
  }

  console.log('\n=== ESECUZIONE SCAMBI ===\n');

  for (const trade of trades) {
    console.log(`\n--- ${trade.name} ---`);
    console.log(`${trade.sender.user.username} offre:`);
    trade.offeredPlayers.forEach(p => console.log(`  - ${p.player.name} (${p.player.position})`));
    if (trade.offeredBudget > 0) console.log(`  - ${trade.offeredBudget} crediti`);

    console.log(`${trade.receiver.user.username} offre:`);
    trade.requestedPlayers.forEach(p => console.log(`  - ${p.player.name} (${p.player.position})`));
    if (trade.requestedBudget > 0) console.log(`  - ${trade.requestedBudget} crediti`);

    // Esegui la transazione
    await prisma.$transaction(async (tx) => {
      // 1. Crea TradeOffer con status ACCEPTED
      const tradeOffer = await tx.tradeOffer.create({
        data: {
          marketSessionId: SESSION_ID,
          senderId: trade.sender.userId,
          receiverId: trade.receiver.userId,
          offeredPlayers: trade.offeredPlayers.map(p => p.id),
          requestedPlayers: trade.requestedPlayers.map(p => p.id),
          offeredBudget: trade.offeredBudget,
          requestedBudget: trade.requestedBudget,
          involvedPlayers: [
            ...trade.offeredPlayers.map(p => p.player.id),
            ...trade.requestedPlayers.map(p => p.player.id)
          ],
          message: trade.message,
          status: 'ACCEPTED',
          respondedAt: new Date(),
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
        }
      });

      console.log(`  TradeOffer creato: ${tradeOffer.id}`);

      // 2. Trasferisci giocatori offerti (sender -> receiver)
      for (const roster of trade.offeredPlayers) {
        await tx.playerRoster.update({
          where: { id: roster.id },
          data: { leagueMemberId: trade.receiver.id }
        });

        if (roster.contract) {
          await tx.playerContract.update({
            where: { id: roster.contract.id },
            data: { leagueMemberId: trade.receiver.id }
          });
        }

        // Crea PlayerMovement
        await tx.playerMovement.create({
          data: {
            leagueId: LEAGUE_ID,
            playerId: roster.player.id,
            movementType: 'TRADE',
            fromMemberId: trade.sender.id,
            toMemberId: trade.receiver.id,
            oldSalary: roster.contract?.salary,
            oldDuration: roster.contract?.duration,
            oldClause: roster.contract?.rescissionClause,
            newSalary: roster.contract?.salary,
            newDuration: roster.contract?.duration,
            newClause: roster.contract?.rescissionClause,
            tradeId: tradeOffer.id,
            marketSessionId: SESSION_ID
          }
        });
        console.log(`  -> ${roster.player.name} trasferito da ${trade.sender.user.username} a ${trade.receiver.user.username}`);
      }

      // 3. Trasferisci giocatori richiesti (receiver -> sender)
      for (const roster of trade.requestedPlayers) {
        await tx.playerRoster.update({
          where: { id: roster.id },
          data: { leagueMemberId: trade.sender.id }
        });

        if (roster.contract) {
          await tx.playerContract.update({
            where: { id: roster.contract.id },
            data: { leagueMemberId: trade.sender.id }
          });
        }

        // Crea PlayerMovement
        await tx.playerMovement.create({
          data: {
            leagueId: LEAGUE_ID,
            playerId: roster.player.id,
            movementType: 'TRADE',
            fromMemberId: trade.receiver.id,
            toMemberId: trade.sender.id,
            oldSalary: roster.contract?.salary,
            oldDuration: roster.contract?.duration,
            oldClause: roster.contract?.rescissionClause,
            newSalary: roster.contract?.salary,
            newDuration: roster.contract?.duration,
            newClause: roster.contract?.rescissionClause,
            tradeId: tradeOffer.id,
            marketSessionId: SESSION_ID
          }
        });
        console.log(`  <- ${roster.player.name} trasferito da ${trade.receiver.user.username} a ${trade.sender.user.username}`);
      }

      // 4. Trasferisci budget
      if (trade.offeredBudget > 0) {
        await tx.leagueMember.update({
          where: { id: trade.sender.id },
          data: { currentBudget: { decrement: trade.offeredBudget } }
        });
        await tx.leagueMember.update({
          where: { id: trade.receiver.id },
          data: { currentBudget: { increment: trade.offeredBudget } }
        });
        console.log(`  Budget: ${trade.sender.user.username} -${trade.offeredBudget} | ${trade.receiver.user.username} +${trade.offeredBudget}`);
      }

      if (trade.requestedBudget > 0) {
        await tx.leagueMember.update({
          where: { id: trade.receiver.id },
          data: { currentBudget: { decrement: trade.requestedBudget } }
        });
        await tx.leagueMember.update({
          where: { id: trade.sender.id },
          data: { currentBudget: { increment: trade.requestedBudget } }
        });
        console.log(`  Budget: ${trade.receiver.user.username} -${trade.requestedBudget} | ${trade.sender.user.username} +${trade.requestedBudget}`);
      }
    });

    console.log(`  ✓ ${trade.name} completato!`);
  }

  // Mostra riepilogo finale
  console.log('\n=== RIEPILOGO FINALE ===\n');

  const updatedMembers = await prisma.leagueMember.findMany({
    where: { leagueId: LEAGUE_ID, status: 'ACTIVE' },
    include: { user: { select: { username: true } } },
    orderBy: { user: { username: 'asc' } }
  });

  console.log('Budget aggiornati:');
  for (const m of updatedMembers) {
    const original = members.find(om => om.id === m.id);
    const diff = m.currentBudget - (original?.currentBudget || 0);
    const diffStr = diff !== 0 ? ` (${diff > 0 ? '+' : ''}${diff})` : '';
    console.log(`  ${m.user.username}: ${m.currentBudget}${diffStr}`);
  }

  // Mostra movimenti creati
  const movements = await prisma.playerMovement.findMany({
    where: {
      leagueId: LEAGUE_ID,
      movementType: 'TRADE'
    },
    include: {
      player: { select: { name: true, position: true } },
      fromMember: { include: { user: { select: { username: true } } } },
      toMember: { include: { user: { select: { username: true } } } }
    },
    orderBy: { createdAt: 'desc' },
    take: 10
  });

  console.log('\nStorico movimenti (ultimi 10):');
  for (const mov of movements) {
    console.log(`  ${mov.player.name} (${mov.player.position}): ${mov.fromMember?.user.username} -> ${mov.toMember?.user.username}`);
  }

  // Mostra trade offers
  const tradeOffers = await prisma.tradeOffer.findMany({
    where: { marketSessionId: SESSION_ID },
    include: {
      sender: { select: { username: true } },
      receiver: { select: { username: true } }
    },
    orderBy: { createdAt: 'desc' }
  });

  console.log('\nTrade Offers registrati:');
  for (const t of tradeOffers) {
    console.log(`  ${t.sender.username} -> ${t.receiver.username} | Status: ${t.status} | Budget: +${t.requestedBudget}/-${t.offeredBudget}`);
  }
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
