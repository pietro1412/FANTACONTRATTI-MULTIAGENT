import { Component } from 'react'
import type { ErrorInfo, ReactNode } from 'react'

interface ErrorBoundaryProps {
  children: ReactNode
}

interface ErrorBoundaryState {
  hasError: boolean
}

export default class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    const apiUrl = (import.meta.env.VITE_API_URL as string | undefined) ?? ''

    // Fire-and-forget log to backend — use fetch directly to avoid circular deps with api.ts
    fetch(`${apiUrl}/api/logs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        severity: 'CRITICAL',
        category: 'ERROR',
        message: `React ErrorBoundary: ${error.message}`,
        metadata: {
          stack: error.stack,
          componentStack: errorInfo.componentStack,
        },
      }),
    }).catch(() => {
      // Fire-and-forget — never crash the fallback UI
    })
  }

  private handleReload = (): void => {
    window.location.reload()
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-gray-950 p-4">
          <div className="w-full max-w-md rounded-lg bg-gray-900 p-8 text-center shadow-xl">
            <div className="mb-4 text-4xl text-red-400">!</div>
            <h1 className="mb-2 text-xl font-bold text-white">
              Si e&apos; verificato un errore imprevisto
            </h1>
            <p className="mb-6 text-sm text-gray-400">
              Il team tecnico e&apos; stato notificato. Prova a ricaricare la pagina.
            </p>
            <button
              onClick={this.handleReload}
              className="rounded-lg bg-blue-600 px-6 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
            >
              Ricarica pagina
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
