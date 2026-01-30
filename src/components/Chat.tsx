import { useState, useEffect, useRef, useCallback } from 'react'
import { chatApi } from '../services/api'

interface ChatMessage {
  id: string
  content: string
  isSystem: boolean
  createdAt: string
  member: {
    id: string
    username: string
    teamName: string | null
  }
}

interface ChatProps {
  sessionId: string
  currentMemberId?: string
  isAdmin?: boolean
}

export function Chat({ sessionId, currentMemberId, isAdmin }: ChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const lastMessageTime = useRef<string | undefined>(undefined)

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  const loadMessages = useCallback(async () => {
    const result = await chatApi.getMessages(sessionId, lastMessageTime.current)
    if (result.success && result.data) {
      const data = result.data as { messages: ChatMessage[] }
      if (data.messages.length > 0) {
        setMessages(prev => {
          const existingIds = new Set(prev.map(m => m.id))
          const newMsgs = data.messages.filter(m => !existingIds.has(m.id))
          if (newMsgs.length > 0) {
            lastMessageTime.current = newMsgs[newMsgs.length - 1]!.createdAt
            if (isCollapsed) {
              setUnreadCount(c => c + newMsgs.length)
            }
            return [...prev, ...newMsgs]
          }
          return prev
        })
      }
    }
  }, [sessionId, isCollapsed])

  useEffect(() => {
    loadMessages()
    // Poll every 5 seconds for new messages (only when tab is visible)
    const interval = setInterval(() => {
      if (!document.hidden) {
        loadMessages()
      }
    }, 5000)

    // Also reload when tab becomes visible again
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        loadMessages()
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      clearInterval(interval)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [loadMessages])

  useEffect(() => {
    if (!isCollapsed) {
      scrollToBottom()
    }
  }, [messages, isCollapsed, scrollToBottom])

  useEffect(() => {
    if (!isCollapsed) {
      setUnreadCount(0)
    }
  }, [isCollapsed])

  async function handleSend(e: React.FormEvent) {
    e.preventDefault()
    if (!newMessage.trim() || isSending) return

    setIsSending(true)
    const result = await chatApi.sendMessage(sessionId, newMessage.trim())
    setIsSending(false)

    if (result.success) {
      setNewMessage('')
      loadMessages()
    }
  }

  async function handleSimulate() {
    const result = await chatApi.simulateMessage(sessionId)
    if (result.success) {
      loadMessages()
    }
  }

  function formatTime(dateStr: string) {
    const date = new Date(dateStr)
    return date.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div className="bg-surface-200 rounded-xl border border-surface-50/20 overflow-hidden flex flex-col">
      {/* Header */}
      <div
        className="p-3 border-b border-surface-50/20 flex items-center justify-between bg-surface-300 cursor-pointer"
        onClick={() => setIsCollapsed(!isCollapsed)}
      >
        <div className="flex items-center gap-2">
          <span className="text-lg">💬</span>
          <h3 className="font-bold text-white text-sm">Chat</h3>
          {unreadCount > 0 && isCollapsed && (
            <span className="bg-danger-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {isAdmin && !isCollapsed && (
            <button
              onClick={(e) => { e.stopPropagation(); handleSimulate() }}
              className="p-1.5 rounded hover:bg-surface-50/20 text-gray-400 hover:text-purple-400 transition-colors"
              title="Simula messaggio random da altro DG"
            >
              <span className="text-sm">🤖</span>
            </button>
          )}
          <button
            onClick={(e) => { e.stopPropagation(); setIsCollapsed(!isCollapsed) }}
            className="p-1.5 rounded hover:bg-surface-50/20 text-gray-400 hover:text-white transition-colors"
          >
            <svg className={`w-4 h-4 transition-transform ${isCollapsed ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>
      </div>

      {!isCollapsed && (
        <>
          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2 h-80 max-h-80">
            {messages.length === 0 ? (
              <p className="text-center text-gray-500 text-sm py-4">Nessun messaggio</p>
            ) : (
              messages.map(msg => {
                const isOwn = msg.member.id === currentMemberId
                return (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${isOwn ? 'items-end' : 'items-start'}`}
                  >
                    {!isOwn && (
                      <span className="text-xs text-gray-500 mb-0.5 ml-1">
                        {msg.member.username}
                      </span>
                    )}
                    <div
                      className={`max-w-[85%] rounded-lg px-3 py-1.5 ${
                        msg.isSystem
                          ? 'bg-surface-300 text-gray-400 text-xs italic'
                          : isOwn
                            ? 'bg-primary-500 text-white'
                            : 'bg-surface-300 text-gray-200'
                      }`}
                    >
                      <p className="text-sm break-words">{msg.content}</p>
                    </div>
                    <span className="text-xs text-gray-600 mt-0.5 mx-1">
                      {formatTime(msg.createdAt)}
                    </span>
                  </div>
                )
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <form onSubmit={handleSend} className="p-2 border-t border-surface-50/20">
            <div className="flex gap-2">
              <input
                type="text"
                value={newMessage}
                onChange={e => setNewMessage(e.target.value)}
                placeholder="Scrivi..."
                maxLength={500}
                className="flex-1 bg-surface-300 border border-surface-50/30 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-primary-500"
              />
              <button
                type="submit"
                disabled={!newMessage.trim() || isSending}
                className="bg-primary-500 hover:bg-primary-600 disabled:bg-surface-300 disabled:text-gray-500 text-white rounded-lg px-3 py-2 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              </button>
            </div>
          </form>
        </>
      )}
    </div>
  )
}
