import { useState, useEffect, useCallback, useMemo } from 'react'
import { leagueApi, auctionApi, tradeApi } from '@/services/api'
import { Modal, ModalHeader, ModalBody } from '@/components/ui/Modal'
import { BottomSheet } from '@/components/ui/BottomSheet'
import { DealRosterPanel, DealTable } from '@/components/trades/deal-room'
import { useToast } from '@/components/ui/Toast'
import haptic from '@/utils/haptics'
import type { RosterEntry, LeagueMember } from '@/components/trades/types'
import type { FinancialsData } from '@/components/finance/types'

interface ProposeTradeModalProps {
  leagueId: string
  isOpen: boolean
  onClose: () => void
  /** Manager pre-selezionato come destinatario (es. si sta sfogliando la sua rosa). */
  initialPartnerMemberId?: string
  /** Roster id del giocatore da preselezionare come richiesto (rosa altrui). */
  initialRequestedRosterId?: string
  /** Roster id del giocatore da preselezionare come offerto (propria rosa). */
  initialOfferedRosterId?: string
  onSuccess?: () => void
}

/**
 * Modale self-contained per proporre uno scambio da Rose (Fase 1.1b, step 1).
 * A differenza di Trades.tsx non carica inbox/outbox/storico: solo i dati
 * necessari a costruire UNA offerta (rose, membri, budget/monte ingaggi).
 */
export function ProposeTradeModal({
  leagueId,
  isOpen,
  onClose,
  initialPartnerMemberId,
  initialRequestedRosterId,
  initialOfferedRosterId,
  onSuccess,
}: ProposeTradeModalProps) {
  const { toast } = useToast()
  const [isLoading, setIsLoading] = useState(true)
  const [members, setMembers] = useState<LeagueMember[]>([])
  const [myRoster, setMyRoster] = useState<RosterEntry[]>([])
  const [allOtherPlayers, setAllOtherPlayers] = useState<RosterEntry[]>([])
  const [myBudget, setMyBudget] = useState(0)
  const [myAnnualCost, setMyAnnualCost] = useState(0)

  const [selectedMemberId, setSelectedMemberId] = useState(initialPartnerMemberId ?? '')
  const [selectedOfferedPlayers, setSelectedOfferedPlayers] = useState<string[]>(
    initialOfferedRosterId ? [initialOfferedRosterId] : []
  )
  const [selectedRequestedPlayers, setSelectedRequestedPlayers] = useState<string[]>(
    initialRequestedRosterId ? [initialRequestedRosterId] : []
  )
  const [offeredBudget, setOfferedBudget] = useState(0)
  const [requestedBudget, setRequestedBudget] = useState(0)
  const [message, setMessage] = useState('')
  const [offerDuration, setOfferDuration] = useState(24)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterRole, setFilterRole] = useState('')
  const [showMyRosterModal, setShowMyRosterModal] = useState(false)
  const [showPartnerRosterModal, setShowPartnerRosterModal] = useState(false)

  const loadData = useCallback(async () => {
    setIsLoading(true)
    try {
      const [membersRes, rosterRes, allRostersRes, financialsRes] = await Promise.all([
        leagueApi.getMembers(leagueId),
        auctionApi.getRoster(leagueId),
        auctionApi.getLeagueRosters(leagueId),
        leagueApi.getFinancials(leagueId),
      ])

      const rosterData = rosterRes.data as { member?: { id: string; currentBudget: number } } | undefined
      const currentMemberId = rosterData?.member?.id || ''

      const financialsMap = new Map<string, { budget: number; annualContractCost: number }>()
      if (financialsRes.success && financialsRes.data) {
        const fData = financialsRes.data as FinancialsData
        for (const t of fData.teams || []) {
          financialsMap.set(t.memberId, { budget: t.budget, annualContractCost: t.annualContractCost })
        }
      }

      if (membersRes.success && membersRes.data) {
        const allMembers = (membersRes.data as { members: (LeagueMember & { teamName?: string })[] }).members || []
        const enriched = allMembers.map(m => {
          const fin = financialsMap.get(m.id)
          return fin ? { ...m, currentBudget: fin.budget, annualContractCost: fin.annualContractCost } : m
        })
        setMembers(enriched.filter(m => m.id !== currentMemberId))
      }

      if (currentMemberId && financialsMap.has(currentMemberId)) {
        const myFin = financialsMap.get(currentMemberId)!
        setMyBudget(myFin.budget)
        setMyAnnualCost(myFin.annualContractCost)
      } else if (rosterData?.member) {
        setMyBudget(rosterData.member.currentBudget)
      }

      if (rosterRes.success && rosterRes.data) {
        interface RosterApiEntry {
          id: string
          player: RosterEntry['player']
          contract?: RosterEntry['player']['contract']
        }
        const data = rosterRes.data as {
          roster: { P: RosterApiEntry[]; D: RosterApiEntry[]; C: RosterApiEntry[]; A: RosterApiEntry[] }
        }
        const mapEntry = (r: RosterApiEntry): RosterEntry => ({
          id: r.id,
          player: { ...r.player, contract: r.contract },
          acquisitionPrice: 0,
        })
        setMyRoster([
          ...data.roster.P.map(mapEntry),
          ...data.roster.D.map(mapEntry),
          ...data.roster.C.map(mapEntry),
          ...data.roster.A.map(mapEntry),
        ])
      }

      if (allRostersRes.success && allRostersRes.data) {
        interface MemberRosterApi {
          id?: string
          memberId?: string
          username?: string
          user?: { username: string }
          roster?: Array<{ id: string; player: RosterEntry['player']; contract?: RosterEntry['player']['contract'] }>
        }
        const raw = allRostersRes.data as MemberRosterApi[] | { members: MemberRosterApi[] }
        const rostersData: MemberRosterApi[] = Array.isArray(raw) ? raw : raw.members || []

        const otherPlayers: RosterEntry[] = []
        for (const memberRoster of rostersData) {
          const memberId = memberRoster.memberId || memberRoster.id || ''
          if (memberId === currentMemberId) continue
          const username = memberRoster.username || memberRoster.user?.username || ''
          for (const r of memberRoster.roster || []) {
            otherPlayers.push({
              id: r.id,
              player: { ...r.player, contract: r.contract },
              acquisitionPrice: 0,
              memberId,
              memberUsername: username,
            })
          }
        }
        setAllOtherPlayers(otherPlayers)
      }
    } catch {
      toast.error('Errore nel caricamento dei dati per lo scambio')
    }
    setIsLoading(false)
  }, [leagueId, toast])

  useEffect(() => {
    if (isOpen) void loadData()
  }, [isOpen, loadData])

  const targetMember = members.find(m => m.id === selectedMemberId)

  const filteredOtherPlayers = allOtherPlayers.filter(entry => {
    if (selectedMemberId && entry.memberId !== selectedMemberId) return false
    if (filterRole && entry.player.position !== filterRole) return false
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      if (!entry.player.name.toLowerCase().includes(q) && !entry.player.team.toLowerCase().includes(q)) return false
    }
    return true
  })

  function togglePlayer(list: string[], setList: (l: string[]) => void, id: string) {
    setList(list.includes(id) ? list.filter(x => x !== id) : [...list, id])
  }

  function handleSelectRequestedPlayer(entry: RosterEntry) {
    if (!entry.memberId) return
    if (!selectedMemberId || selectedMemberId === entry.memberId) {
      setSelectedMemberId(entry.memberId)
      togglePlayer(selectedRequestedPlayers, setSelectedRequestedPlayers, entry.id)
    } else {
      setSelectedMemberId(entry.memberId)
      setSelectedRequestedPlayers([entry.id])
    }
  }

  const offeredSalaryTotal = useMemo(
    () => selectedOfferedPlayers.reduce((sum, id) => sum + (myRoster.find(e => e.id === id)?.player.contract?.salary || 0), 0),
    [selectedOfferedPlayers, myRoster]
  )
  const requestedSalaryTotal = useMemo(
    () => selectedRequestedPlayers.reduce((sum, id) => sum + (allOtherPlayers.find(e => e.id === id)?.player.contract?.salary || 0), 0),
    [selectedRequestedPlayers, allOtherPlayers]
  )
  const myPostTradeBudget = myBudget - offeredBudget + requestedBudget
  const myPostTradeSalary = myAnnualCost - offeredSalaryTotal + requestedSalaryTotal
  const myRosterNext = myRoster.length - selectedOfferedPlayers.length + selectedRequestedPlayers.length

  const canSubmit = !!(
    selectedMemberId &&
    (selectedOfferedPlayers.length > 0 || offeredBudget > 0 || selectedRequestedPlayers.length > 0 || requestedBudget > 0)
  )

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setIsSubmitting(true)
    const res = await tradeApi.create(leagueId, {
      toMemberId: selectedMemberId,
      offeredPlayerIds: selectedOfferedPlayers,
      requestedPlayerIds: selectedRequestedPlayers,
      offeredBudget,
      requestedBudget,
      message: message || undefined,
      durationHours: offerDuration,
    })
    setIsSubmitting(false)
    if (res.success) {
      haptic.send()
      toast.success('Offerta inviata!')
      onSuccess?.()
      onClose()
    } else {
      toast.error(res.message || "Errore nell'invio dell'offerta")
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="full">
      <ModalHeader>Proponi scambio</ModalHeader>
      <ModalBody className="px-3 py-3">
        {isLoading ? (
          <div className="h-[60vh] flex items-center justify-center text-gray-500 text-sm">Caricamento…</div>
        ) : (
          <div className="h-[75vh]">
            <div className="h-full lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.12fr)_minmax(0,1fr)] lg:gap-3">
              <div className="hidden lg:block lg:min-h-0 lg:h-full">
                <DealRosterPanel
                  side="mine"
                  myRoster={myRoster}
                  selectedOfferedPlayers={selectedOfferedPlayers}
                  onToggleOffered={id => { togglePlayer(selectedOfferedPlayers, setSelectedOfferedPlayers, id); }}
                  myBudget={myBudget}
                />
              </div>

              <div className="lg:min-h-0 lg:h-full">
                <DealTable
                  members={members}
                  selectedMemberId={selectedMemberId}
                  targetMember={targetMember}
                  onMemberChange={id => {
                    if (id !== selectedMemberId) {
                      setSelectedMemberId(id)
                      setSelectedRequestedPlayers([])
                    }
                  }}
                  myBudget={myBudget}
                  selectedOfferedPlayers={selectedOfferedPlayers}
                  myRoster={myRoster}
                  onRemoveOffered={id => { togglePlayer(selectedOfferedPlayers, setSelectedOfferedPlayers, id); }}
                  offeredBudget={offeredBudget}
                  onOfferedBudgetChange={setOfferedBudget}
                  selectedRequestedPlayers={selectedRequestedPlayers}
                  allOtherPlayers={allOtherPlayers}
                  onRemoveRequested={id => { togglePlayer(selectedRequestedPlayers, setSelectedRequestedPlayers, id); }}
                  requestedBudget={requestedBudget}
                  onRequestedBudgetChange={setRequestedBudget}
                  offerDuration={offerDuration}
                  onDurationChange={setOfferDuration}
                  message={message}
                  onMessageChange={setMessage}
                  budgetNow={myBudget}
                  budgetNext={myPostTradeBudget}
                  salaryNow={myAnnualCost}
                  salaryNext={myPostTradeSalary}
                  rosterNow={myRoster.length}
                  rosterNext={myRosterNext}
                  isSubmitting={isSubmitting}
                  canSubmit={canSubmit}
                  onSubmit={e => { void handleSubmit(e); }}
                  onOpenMyRoster={() => { setShowMyRosterModal(true); }}
                  onOpenPartnerRoster={() => { setShowPartnerRosterModal(true); }}
                />
              </div>

              <div className="hidden lg:block lg:min-h-0 lg:h-full">
                <DealRosterPanel
                  side="partner"
                  filteredPlayers={filteredOtherPlayers}
                  selectedRequestedPlayers={selectedRequestedPlayers}
                  onToggleRequested={handleSelectRequestedPlayer}
                  searchQuery={searchQuery}
                  onSearchChange={setSearchQuery}
                  filterRole={filterRole}
                  onFilterRoleChange={setFilterRole}
                  targetMember={targetMember}
                  members={members}
                  selectedMemberId={selectedMemberId}
                  onMemberChange={id => { setSelectedMemberId(id); setSelectedRequestedPlayers([]); }}
                />
              </div>
            </div>

            {/* Mobile: sheet triggers per selezionare dalle rose */}
            <BottomSheet
              isOpen={showMyRosterModal}
              onClose={() => { setShowMyRosterModal(false); }}
              title="La Mia Rosa"
              maxHeight="85vh"
            >
              <DealRosterPanel
                side="mine"
                variant="sheet"
                myRoster={myRoster}
                selectedOfferedPlayers={selectedOfferedPlayers}
                onToggleOffered={id => { togglePlayer(selectedOfferedPlayers, setSelectedOfferedPlayers, id); }}
                myBudget={myBudget}
              />
            </BottomSheet>
            <BottomSheet
              isOpen={showPartnerRosterModal}
              onClose={() => { setShowPartnerRosterModal(false); }}
              title={targetMember ? `Rosa di ${targetMember.user.username}` : 'Rosa partner'}
              maxHeight="85vh"
            >
              <DealRosterPanel
                side="partner"
                variant="sheet"
                filteredPlayers={filteredOtherPlayers}
                selectedRequestedPlayers={selectedRequestedPlayers}
                onToggleRequested={handleSelectRequestedPlayer}
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                filterRole={filterRole}
                onFilterRoleChange={setFilterRole}
                targetMember={targetMember}
                members={members}
                selectedMemberId={selectedMemberId}
                onMemberChange={id => { setSelectedMemberId(id); setSelectedRequestedPlayers([]); }}
              />
            </BottomSheet>
          </div>
        )}
      </ModalBody>
    </Modal>
  )
}

export default ProposeTradeModal
