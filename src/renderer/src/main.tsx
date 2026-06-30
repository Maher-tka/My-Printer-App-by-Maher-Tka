import React from 'react'
import ReactDOM from 'react-dom/client'
import { App } from './app/App'
import './styles.css'

interface RendererErrorBoundaryProps {
  children: React.ReactNode
}

interface RendererErrorBoundaryState {
  error: Error | null
  componentStack: string | null
}

class RendererErrorBoundary extends React.Component<
  RendererErrorBoundaryProps,
  RendererErrorBoundaryState
> {
  state: RendererErrorBoundaryState = {
    error: null,
    componentStack: null
  }

  static getDerivedStateFromError(error: Error): RendererErrorBoundaryState {
    return { error, componentStack: null }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    console.error('[renderer:react-error-boundary]', {
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack
    })
    this.setState({ componentStack: errorInfo.componentStack ?? null })
  }

  render(): React.ReactNode {
    const { error, componentStack } = this.state

    if (!error) {
      return this.props.children
    }

    return (
      <main
        style={{
          minHeight: '100vh',
          display: 'grid',
          placeItems: 'center',
          padding: '32px',
          background: '#f6f8fb',
          color: '#172033',
          fontFamily:
            'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
        }}
      >
        <section
          style={{
            width: 'min(920px, 100%)',
            border: '1px solid #d6deea',
            borderRadius: '12px',
            background: '#ffffff',
            padding: '28px',
            boxShadow: '0 24px 70px rgba(15, 23, 42, 0.14)'
          }}
        >
          <p style={{ margin: '0 0 8px', color: '#64748b', fontWeight: 700 }}>
            My Printer App could not finish opening.
          </p>
          <h1 style={{ margin: '0 0 16px', fontSize: '28px', lineHeight: 1.2 }}>
            Renderer error
          </h1>
          <p style={{ margin: '0 0 16px', lineHeight: 1.6 }}>{error.message}</p>
          {(error.stack || componentStack) && (
            <pre
              style={{
                maxHeight: '360px',
                overflow: 'auto',
                borderRadius: '8px',
                background: '#111827',
                color: '#f9fafb',
                padding: '16px',
                whiteSpace: 'pre-wrap'
              }}
            >
              {error.stack ?? componentStack}
            </pre>
          )}
          <p style={{ margin: '16px 0 0', color: '#475569' }}>Check terminal for details.</p>
        </section>
      </main>
    )
  }
}

window.addEventListener('error', (event) => {
  console.error('[renderer:error]', {
    message: event.message,
    filename: event.filename,
    lineNumber: event.lineno,
    columnNumber: event.colno,
    error: event.error
  })
})

window.addEventListener('unhandledrejection', (event) => {
  console.error('[renderer:unhandledrejection]', {
    reason: event.reason
  })
})

const rootElement = document.getElementById('root')

if (!rootElement) {
  throw new Error('Renderer root element was not found.')
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <RendererErrorBoundary>
      <App />
    </RendererErrorBoundary>
  </React.StrictMode>
)
