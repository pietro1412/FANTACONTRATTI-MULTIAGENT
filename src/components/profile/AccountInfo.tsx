import { Lock } from 'lucide-react'

interface AccountInfoProps {
  username: string
  email: string
}

interface ReadonlyFieldProps {
  label: string
  value: string
}

function ReadonlyField({ label, value }: ReadonlyFieldProps) {
  return (
    <div>
      <span className="micro-label text-gray-400 block mb-1.5">{label}</span>
      <div className="flex items-center gap-2 bg-surface-300 border border-surface-50/20 rounded-lg px-3.5 py-2.5 text-sm text-gray-300">
        <span className="truncate">{value}</span>
        <Lock size={13} className="ml-auto text-gray-500 flex-shrink-0" aria-hidden="true" />
      </div>
    </div>
  )
}

/** Informazioni account in sola lettura (username + email). */
export function AccountInfo({ username, email }: AccountInfoProps) {
  return (
    <section className="bg-surface-200 border border-surface-50/20 rounded-2xl p-5">
      <h3 className="micro-label text-gray-400 mb-4">Informazioni account</h3>
      <div className="space-y-3">
        <ReadonlyField label="Username" value={username} />
        <ReadonlyField label="Email" value={email} />
      </div>
    </section>
  )
}
