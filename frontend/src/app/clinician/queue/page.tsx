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
}

export default function PhysicianQueuePage() {
  const [cases, setCases] = useState<CaseRow[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  async function load() {
    setLoading(true)
    try {
      setCases(await api<CaseRow[]>('/v1/cases?status=SUBMITTED'))
      setError('')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Errore di caricamento')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  async function accept(caseId: string) {
    try {
      await api(`/v1/clinical/cases/${caseId}/accept`, { method: 'POST' })
      setCases((prev) => prev.filter((c) => c.id !== caseId))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Presa in carico non riuscita')
    }
  }

  return (
    <RequireAuth role="PHYSICIAN">
      <div className="stack">
        <div className="spread">
          <h1 style={{ margin: 0 }}>Coda clinica</h1>
          <button type="button" className="secondary" onClick={load}>
            Aggiorna
          </button>
        </div>
        <p className="muted" style={{ marginTop: 0 }}>
          I casi sono ordinati per arrivo. Nessuna priorità clinica è calcolata automaticamente.
        </p>

        {error && <div className="banner-error">{error}</div>}
        {loading && <p className="muted">Caricamento…</p>}
        {!loading && cases.length === 0 && <div className="card">Nessun caso in attesa.</div>}

        {cases.map((c) => (
          <div className="card stack" key={c.id}>
            <div className="spread">
              <Link href={`/clinician/cases/${c.id}`} className="mono">
                {c.id}
              </Link>
              <span className="badge">{c.status}</span>
            </div>
            <p style={{ margin: 0 }}>{c.patient_summary.slice(0, 280)}</p>
            <div className="row">
              <button type="button" className="success" onClick={() => accept(c.id)}>
                Prendi in carico
              </button>
              <Link href={`/clinician/cases/${c.id}`}>Apri</Link>
            </div>
          </div>
        ))}
      </div>
    </RequireAuth>
  )
}
