interface Member {
  id: string
  username: string
}

interface MemberReadyChipsProps {
  done: Member[]
  pending: Member[]
  /** Label shown in the done chip tooltip, e.g. "pronto" / "confermato" */
  doneLabel?: string
}

/**
 * Lobby-style member status: one chip per manager with monogram avatar.
 * Done members light up green with a check badge; pending ones are dimmed
 * with a pulsing amber dot.
 */
export function MemberReadyChips({ done, pending, doneLabel = 'pronto' }: MemberReadyChipsProps) {
  const members = [
    ...done.map(m => ({ ...m, done: true })),
    ...pending.map(m => ({ ...m, done: false })),
  ]
  if (members.length === 0) return null

  return (
    <div className="bg-surface-200 border border-surface-50 rounded-xl p-3">
      <div className="flex flex-wrap gap-2 justify-center">
        {members.map(m => (
          <span
            key={m.id}
            title={m.done ? `${m.username}: ${doneLabel}` : `${m.username}: in attesa`}
            className={`flex items-center gap-2 pl-1 pr-3 py-1 rounded-full border transition-all ${
              m.done
                ? 'bg-secondary-500/10 border-secondary-500/40'
                : 'bg-surface-300/60 border-surface-50/60'
            }`}
          >
            <span className="relative flex-shrink-0">
              <span className={`w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold ${
                m.done
                  ? 'bg-gradient-to-br from-secondary-500 to-secondary-600 text-white'
                  : 'bg-surface-100 text-gray-400'
              }`}>
                {m.username.slice(0, 2).toUpperCase()}
              </span>
              {m.done ? (
                <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-secondary-500 border-2 border-surface-200 flex items-center justify-center">
                  <svg className="w-2 h-2 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </span>
              ) : (
                <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-amber-400 border-2 border-surface-200 animate-pulse" />
              )}
            </span>
            <span className={`text-sm font-semibold ${m.done ? 'text-secondary-300' : 'text-gray-400'}`}>
              {m.username}
            </span>
          </span>
        ))}
      </div>
    </div>
  )
}
