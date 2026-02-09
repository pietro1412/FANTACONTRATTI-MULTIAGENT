import { useState, useEffect } from 'react'
import { ChevronUp } from 'lucide-react'

export function ScrollToTop() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 400)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  if (!visible) return null

  return (
    <button
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      aria-label="Torna in cima"
      className="fixed bottom-6 right-6 z-50 w-11 h-11 rounded-full bg-primary-500 text-white shadow-lg hover:bg-primary-600 transition-all duration-200 flex items-center justify-center md:hidden"
    >
      <ChevronUp size={20} />
    </button>
  )
}
