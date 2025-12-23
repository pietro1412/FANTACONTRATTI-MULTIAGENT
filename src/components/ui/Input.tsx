import { useId, type InputHTMLAttributes } from 'react'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
}

export function Input({ label, error, className = '', id, ...props }: InputProps) {
  const generatedId = useId()
  const inputId = id || props.name || generatedId

  return (
    <div className="w-full">
      {label && (
        <label htmlFor={inputId} className="block text-sm font-semibold text-gray-300 mb-2 uppercase tracking-wide">
          {label}
        </label>
      )}
      <input
        id={inputId}
        className={`w-full px-4 py-3 text-base bg-surface-300 border-2 rounded-lg text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 transition-all duration-200 ${
          error ? 'border-danger-500' : 'border-surface-50/30'
        } ${className}`}
        {...props}
      />
      {error && <p className="mt-2 text-sm font-medium text-danger-400">{error}</p>}
    </div>
  )
}
