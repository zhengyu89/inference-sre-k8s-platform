import { useCallback, useEffect, useState } from 'react'
import './App.css'

type ServiceState = 'ok' | 'error'

interface ReadyResponse {
  status: ServiceState
  postgres: ServiceState
  redis: ServiceState
}

type CheckState =
  | { phase: 'loading' }
  | { phase: 'unreachable' }
  | { phase: 'done'; data: ReadyResponse }

const POLL_INTERVAL_MS = 5000

function StatusDot({ state }: { state: ServiceState | 'unknown' }) {
  return <span className={`dot dot-${state}`} aria-hidden="true" />
}

function labelFor(state: ServiceState | 'unknown') {
  if (state === 'ok') return 'Connected'
  if (state === 'error') return 'Unreachable'
  return 'Unknown'
}

function App() {
  const [check, setCheck] = useState<CheckState>({ phase: 'loading' })
  const [checkedAt, setCheckedAt] = useState<Date | null>(null)

  const runCheck = useCallback(async () => {
    try {
      const res = await fetch('/api/health/ready')
      const data = (await res.json()) as ReadyResponse
      setCheck({ phase: 'done', data })
    } catch {
      setCheck({ phase: 'unreachable' })
    }
    setCheckedAt(new Date())
  }, [])

  useEffect(() => {
    runCheck()
    const id = setInterval(runCheck, POLL_INTERVAL_MS)
    return () => clearInterval(id)
  }, [runCheck])

  const backendState: ServiceState | 'unknown' =
    check.phase === 'done' ? 'ok' : check.phase === 'unreachable' ? 'error' : 'unknown'
  const postgresState: ServiceState | 'unknown' =
    check.phase === 'done' ? check.data.postgres : 'unknown'
  const redisState: ServiceState | 'unknown' =
    check.phase === 'done' ? check.data.redis : 'unknown'

  return (
    <section id="status">
      <h1>Inference SRE K8s Platform</h1>
      <p className="subtitle">Frontend → Backend → Postgres / Redis connectivity check</p>

      <ul className="status-list">
        <li>
          <StatusDot state={backendState} />
          <span className="name">Backend</span>
          <span className="label">{labelFor(backendState)}</span>
        </li>
        <li>
          <StatusDot state={postgresState} />
          <span className="name">Postgres</span>
          <span className="label">{labelFor(postgresState)}</span>
        </li>
        <li>
          <StatusDot state={redisState} />
          <span className="name">Redis</span>
          <span className="label">{labelFor(redisState)}</span>
        </li>
      </ul>

      <div className="footer">
        <button type="button" onClick={runCheck}>
          Recheck now
        </button>
        <span className="checked-at">
          {checkedAt ? `Last checked ${checkedAt.toLocaleTimeString()}` : 'Checking…'}
        </span>
      </div>
    </section>
  )
}

export default App
