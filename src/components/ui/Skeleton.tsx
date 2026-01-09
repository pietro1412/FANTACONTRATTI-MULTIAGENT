import { type HTMLAttributes } from 'react'

interface SkeletonProps extends HTMLAttributes<HTMLDivElement> {
  className?: string
}

/**
 * Base skeleton component for loading states
 * Provides a pulsing animation placeholder
 */
export function Skeleton({ className = '', ...props }: SkeletonProps) {
  return (
    <div
      className={`animate-pulse bg-surface-100 rounded ${className}`}
      aria-hidden="true"
      {...props}
    />
  )
}

/**
 * Skeleton for card layouts
 */
export function SkeletonCard() {
  return (
    <div className="bg-surface-200 rounded-xl p-4 space-y-3 border border-surface-50/20">
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-4 w-1/2" />
      <Skeleton className="h-8 w-full" />
    </div>
  )
}

/**
 * Skeleton for player row in lists
 */
export function SkeletonPlayerRow() {
  return (
    <div className="flex items-center gap-3 p-3 bg-surface-200/50 rounded-lg">
      <Skeleton className="w-10 h-10 rounded-full" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-3 w-20" />
      </div>
      <Skeleton className="h-6 w-16" />
    </div>
  )
}

/**
 * Skeleton for manager cards in auction room
 */
export function SkeletonManagerCard() {
  return (
    <div className="bg-surface-200 rounded-lg p-4 border border-surface-50/20">
      <div className="flex items-center gap-3 mb-3">
        <Skeleton className="w-10 h-10 rounded-lg" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-3 w-16" />
        </div>
      </div>
      <div className="flex gap-2">
        <Skeleton className="h-6 w-20" />
        <Skeleton className="h-6 w-16" />
      </div>
    </div>
  )
}

/**
 * Skeleton for auction player display
 */
export function SkeletonAuctionPlayer() {
  return (
    <div className="text-center p-5 bg-surface-300 rounded-xl">
      <div className="flex items-center justify-center gap-4 mb-3">
        <Skeleton className="w-16 h-8 rounded-full" />
        <Skeleton className="w-12 h-12 rounded-lg" />
      </div>
      <Skeleton className="h-10 w-48 mx-auto mb-2" />
      <Skeleton className="h-5 w-32 mx-auto" />
    </div>
  )
}

/**
 * Skeleton for timer display
 */
export function SkeletonTimer() {
  return (
    <div className="timer-container p-6 text-center">
      <Skeleton className="h-3 w-24 mx-auto mb-3" />
      <Skeleton className="h-20 w-32 mx-auto mb-2" />
      <Skeleton className="h-4 w-16 mx-auto" />
    </div>
  )
}

/**
 * Skeleton for bid history
 */
export function SkeletonBidHistory({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex items-center justify-between py-2 px-3 bg-surface-300/50 rounded-lg">
          <div className="flex items-center gap-2">
            <Skeleton className="w-5 h-5 rounded-full" />
            <Skeleton className="h-4 w-20" />
          </div>
          <Skeleton className="h-5 w-12" />
        </div>
      ))}
    </div>
  )
}

/**
 * Skeleton for table rows
 */
export function SkeletonTableRow({ columns = 4 }: { columns?: number }) {
  return (
    <tr className="border-b border-surface-50/10">
      {Array.from({ length: columns }).map((_, i) => (
        <td key={i} className="py-3 px-4">
          <Skeleton className="h-4 w-full" />
        </td>
      ))}
    </tr>
  )
}

/**
 * Skeleton for navigation/breadcrumbs
 */
export function SkeletonNav() {
  return (
    <div className="flex items-center gap-2">
      <Skeleton className="h-6 w-16" />
      <Skeleton className="h-4 w-4" />
      <Skeleton className="h-6 w-24" />
      <Skeleton className="h-4 w-4" />
      <Skeleton className="h-6 w-20" />
    </div>
  )
}

/**
 * Full page skeleton for initial loading
 */
export function SkeletonPage() {
  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-10 w-32" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>
      <div className="space-y-2">
        <SkeletonPlayerRow />
        <SkeletonPlayerRow />
        <SkeletonPlayerRow />
      </div>
    </div>
  )
}

export default Skeleton
