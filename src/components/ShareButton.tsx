import { useState, useCallback } from 'react'
import { Share2, Check } from 'lucide-react'

interface ShareButtonProps {
  title?: string
  text?: string
  url?: string
  className?: string
  compact?: boolean
}

export function ShareButton({
  title = document.title,
  text,
  url = window.location.href,
  className = '',
  compact = false,
}: ShareButtonProps) {
  const [copied, setCopied] = useState(false)

  const handleShare = useCallback(async () => {
    // Try native Web Share API first (mobile)
    if (navigator.share) {
      try {
        await navigator.share({ title, text, url })
        return
      } catch {
        // User cancelled or error — fall through to clipboard
      }
    }

    // Fallback: copy link to clipboard
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => { setCopied(false); }, 2000)
    } catch {
      // Last resort fallback for older browsers without Clipboard API
      const textarea = document.createElement('textarea')
      textarea.value = url
      textarea.style.position = 'fixed'
      textarea.style.opacity = '0'
      document.body.appendChild(textarea)
      textarea.focus()
      textarea.select()
      // eslint-disable-next-line @typescript-eslint/no-deprecated -- only fallback for browsers without Clipboard API
      document.execCommand('copy')
      document.body.removeChild(textarea)
      setCopied(true)
      setTimeout(() => { setCopied(false); }, 2000)
    }
  }, [title, text, url])

  if (compact) {
    return (
      <button
        onClick={() => void handleShare()}
        className={`p-2 rounded-lg text-gray-400 hover:text-white hover:bg-surface-300/50 transition-colors ${className}`}
        title={copied ? 'Link copiato!' : 'Condividi'}
      >
        {copied ? <Check size={16} className="text-green-400" /> : <Share2 size={16} />}
      </button>
    )
  }

  return (
    <button
      onClick={() => void handleShare()}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors ${
        copied
          ? 'bg-green-500/20 text-green-400'
          : 'bg-surface-300 text-gray-400 hover:text-white hover:bg-surface-50/20'
      } ${className}`}
    >
      {copied ? (
        <>
          <Check size={14} />
          <span>Copiato!</span>
        </>
      ) : (
        <>
          <Share2 size={14} />
          <span>Condividi</span>
        </>
      )}
    </button>
  )
}
