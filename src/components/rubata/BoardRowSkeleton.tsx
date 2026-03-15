import { memo } from 'react'

export const BoardRowSkeleton = memo(function BoardRowSkeleton() {
  return (
    <div className="px-3 py-2.5 md:p-4 flex items-center gap-2 md:gap-4 animate-pulse">
      {/* Index circle */}
      <div className="w-6 h-6 rounded-full bg-surface-300 flex-shrink-0" />
      {/* Photo placeholder */}
      <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-surface-300 flex-shrink-0" />
      {/* Name + info */}
      <div className="flex-1 min-w-0 space-y-1.5">
        <div className="h-4 bg-surface-300 rounded w-3/5" />
        <div className="h-3 bg-surface-300/60 rounded w-2/5 md:hidden" />
      </div>
      {/* Price */}
      <div className="h-5 w-12 bg-surface-300 rounded flex-shrink-0" />
      {/* Desktop extras */}
      <div className="hidden md:block h-4 w-20 bg-surface-300 rounded flex-shrink-0" />
      <div className="hidden md:block h-4 w-16 bg-surface-300 rounded flex-shrink-0" />
    </div>
  )
})
