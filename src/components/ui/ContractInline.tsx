export interface ContractInlineProps {
  /** Salary (ingaggio) in credits. */
  salary: number
  /** Contract duration in SEMESTERS (domain unit). */
  duration: number
  /** Rescission clause in credits. Optional. */
  clause?: number | null
  /** Rubata price in credits (clause + salary). Optional. */
  rubataPrice?: number | null
  /**
   * 'full' (default): extended labels for desktop.
   * 'compact': abbreviated labels for dense lists/mobile (with title/aria).
   */
  variant?: 'full' | 'compact'
  /** Extra classes on the wrapper. */
  className?: string
}

// Credit unit: across the app credit values render with an 'M' suffix
// (salary/clause/rubata). Duration is in semesters: 'sem' (full) / 's' (compact).
const CREDIT_UNIT = 'M'

interface FieldLabels {
  /** Visible label. */
  short: string
  /** Accessible / title label (extended). */
  full: string
}

interface FieldConfig {
  salary: FieldLabels
  duration: FieldLabels
  clause: FieldLabels
  rubata: FieldLabels
  durationUnit: string
}

const LABELS: Record<'full' | 'compact', FieldConfig> = {
  full: {
    salary: { short: 'Ingaggio', full: 'Ingaggio' },
    duration: { short: 'Durata', full: 'Durata' },
    clause: { short: 'Clausola', full: 'Clausola rescissoria' },
    rubata: { short: 'Rubata', full: 'Prezzo rubata' },
    durationUnit: 'sem',
  },
  compact: {
    salary: { short: 'Ing', full: 'Ingaggio' },
    duration: { short: 'Dur', full: 'Durata' },
    clause: { short: 'Cls', full: 'Clausola rescissoria' },
    rubata: { short: 'Rub', full: 'Prezzo rubata' },
    durationUnit: 's',
  },
}

function Field({
  label,
  value,
  className = '',
}: {
  label: FieldLabels
  value: string
  className?: string
}) {
  return (
    <span className={`inline-flex items-baseline gap-1 ${className}`} title={`${label.full} ${value}`}>
      <span className="text-gray-400">{label.short}</span>
      <span className="font-mono font-semibold text-white" aria-label={`${label.full} ${value}`}>
        {value}
      </span>
    </span>
  )
}

/**
 * Axioms 9 + 4: salary + duration (+ optional clause & rubata price) always
 * shown WITH identifying labels — never bare numbers. Credit values carry the
 * 'M' unit; duration is in semesters. Shared component (no per-page markup).
 */
export function ContractInline({
  salary,
  duration,
  clause,
  rubataPrice,
  variant = 'full',
  className = '',
}: ContractInlineProps) {
  const labels = LABELS[variant]
  const sep = <span className="text-gray-600">·</span>

  return (
    <span className={`inline-flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5 text-sm ${className}`}>
      <Field label={labels.salary} value={`${salary}${CREDIT_UNIT}`} />
      {sep}
      <Field label={labels.duration} value={`${duration} ${labels.durationUnit}`} />
      {clause != null && (
        <>
          {sep}
          <Field label={labels.clause} value={`${clause}${CREDIT_UNIT}`} />
        </>
      )}
      {rubataPrice != null && (
        <>
          {sep}
          <Field label={labels.rubata} value={`${rubataPrice}${CREDIT_UNIT}`} />
        </>
      )}
    </span>
  )
}

export default ContractInline
