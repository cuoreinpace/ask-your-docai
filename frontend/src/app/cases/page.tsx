'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { api } from '@/lib/api'
import { RequireAuth } from '@/components/RequireAuth'

interface CaseRow {
  id: string
  status: string
  patient_summary: string
  created_at: string
  submitted_at: string | null
  has_opinion: boolean
}

function statusLabel(status: string): string {
  const map: Record<string, string> = {
    DRAFT: 'Bozza',
    PAYMENT_AUTHORIZED: 'Pagamento autorizzato',
    SUBMITTED: 'Inviato',
    IN_REVIEW: 'In revisione',
    NEEDS_INFORMATION: 'Integrazione richiesta',
    OPINION_DRAFT: 'Parere in bozza',
    SIGNED: 'Parere firmato',
    CLINICAL_ESCALATION: 'Escalation clinica',
    CLOSED: 'Chiuso',
  }
  return map[status] ?? status
}

export default function CasesPage() {
  const [cases, setCases] = useState<CaseRow[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api<CaseRow[]>('/v1/cases')
      .then(setCases)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  return (
    <RequireAuth>
      <div className="stack">
        <div className="spread">
          <h1 style={{ margin: 0 }}>I miei casi</h1>
          <Link href="/cases/new" className="nav-cta">
            Nuovo caso
          </Link>
        </div>

        {error && <div className="banner-error">{error}</div>}
        {loading && <p className="muted">Caricamento…</p>}
        {!loading && cases.length === 0 && (
          <div className="card">
            <p style={{ margin: 0 }}>
              Non hai ancora casi. <Link href="/cases/new">Crea il primo caso</Link>.
            </p>
          </div>
        )}

        {cases.length > 0 && (
          <table>
            <thead>
              <tr>
                <th>Caso</th>
                <th>Stato</th>
                <th>Creato</th>
                <th>Parere</th>
              </tr>
            </thead>
            <tbody>
              {cases.map((c) => (
                <tr key={c.id}>
                  <td>
                    <Link href={`/cases/${c.id}`} className="mono">
                      {c.id}
                    </Link>
                  </td>
                  <td>
                    <span className="badge">{statusLabel(c.status)}</span>
                  </td>
                  <td className="muted">{new Date(c.created_at).toLocaleString('it-IT')}</td>
                  <td className="muted">{c.has_opinion ? 'presente' : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </RequireAuth>
  )
}
