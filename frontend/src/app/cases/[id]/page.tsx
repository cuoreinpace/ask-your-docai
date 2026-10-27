'use client'

import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { api } from '@/lib/api'
import { RequireAuth } from '@/components/RequireAuth'

interface CaseDetail {
  id: string
  status: string
  patient_summary: string
  created_at: string
  submitted_at: string | null
  signed_at: string | null
  has_opinion: boolean
}

interface Source {
  id: string
  category: string
  declared_provider: string | null
  source_type: string | null
  media_type: string | null
  pasted_text: string | null
  risk?: string
  malware_scan_status: string
  uploaded_at: string
}

interface Message {
  id: string
  sender_role: string
  content: string
  created_at: string
}

interface Opinion {
  id: string
  status: string
  assessment_of_ai_output: string
  clinical_assessment: string
  limitations: string[]
  recommendations: string[]
  requires_in_person_assessment: boolean
  physician_assigned_urgency: string
  signed_at: string | null
}

const ASSESSMENT_LABEL: Record<string, string> = {
  AGREE: 'Concorda',
  PARTIALLY_AGREE: 'Concorda parzialmente',
  DISAGREE: 'Non concorda',
  INSUFFICIENT_INFORMATION: 'Informazioni insufficienti',
  CANNOT_ASSESS: 'Non valutabile a distanza',
}

const URGENCY_LABEL: Record<string, string> = {
  EMERGENCY: 'Emergenza',
  URGENT: 'Urgente',
  ROUTINE: 'Routine',
  UNDETERMINED: 'Non determinata',
}

export default function CaseDetailPage() {
  const params = useParams<{ id: string }>()
  const id = params.id
  const [caseData, setCaseData] = useState<CaseDetail | null>(null)
  const [sources, setSources] = useState<Source[]>([])
  const [messages, setMessages] = useState<Message[]>([])
  const [opinion, setOpinion] = useState<Opinion | null>(null)
  const [newMessage, setNewMessage] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      const [c, s, m, o] = await Promise.all([
        api<CaseDetail>(`/v1/cases/${id}`),
        api<Source[]>(`/v1/cases/${id}/sources`),
        api<Message[]>(`/v1/cases/${id}/messages`),
        api<Opinion | null>(`/v1/clinical/cases/${id}/opinion`),
      ])
      setCaseData(c)
      setSources(s)
      setMessages(m)
      setOpinion(o)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Errore di caricamento')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    load()
  }, [load])

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault()
    if (!newMessage.trim()) return
    try {
      const msg = await api<Message>(`/v1/cases/${id}/messages`, {
        method: 'POST',
        body: JSON.stringify({ content: newMessage }),
      })
      setMessages((prev) => [...prev, msg])
      setNewMessage('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invio non riuscito')
    }
  }

  if (loading) return <p className="muted">Caricamento…</p>
  if (error) return <div className="banner-error">{error}</div>
  if (!caseData) return <div className="banner-error">Caso non trovato</div>

  return (
    <RequireAuth>
      <div className="stack">
        <div className="spread">
          <h1 style={{ margin: 0 }}>
            Caso <span className="mono">{caseData.id}</span>
          </h1>
          <span className="badge">{caseData.status}</span>
        </div>

        <div className="card">
          <h2 style={{ marginTop: 0 }}>La tua descrizione</h2>
          <p style={{ marginBottom: 0 }}>{caseData.patient_summary}</p>
        </div>

        <div className="card stack">
          <h2 style={{ marginTop: 0 }}>Documenti e conversazione</h2>
          {sources.length === 0 && <p className="muted">Nessun documento caricato.</p>}
          {sources.map((s) => (
            <div key={s.id} className="stack" style={{ gap: '0.25rem' }}>
              <div className="row">
                <span className="badge">{s.declared_provider || s.category}</span>
                <span className="muted">
                  {s.source_type === 'USER_UPLOAD'
                    ? `file ${s.media_type || ''}`
                    : 'testo incollato'}
                </span>
                <span className="muted">scan: {s.malware_scan_status}</span>
              </div>
              {s.pasted_text && (
                <pre className="mono" style={{ whiteSpace: 'pre-wrap', background: '#f7f7f8', padding: '0.75rem', borderRadius: 8, margin: 0 }}>
                  {s.pasted_text}
                </pre>
              )}
            </div>
          ))}
        </div>

        {opinion && (
          <div className="card stack" style={{ borderColor: opinion.status === 'SIGNED' ? '#1b7f4b' : undefined }}>
            <div className="spread">
              <h2 style={{ margin: 0 }}>Parere medico</h2>
              <span className="badge">{opinion.status}</span>
            </div>
            <p style={{ margin: 0 }}>
              <strong>Valutazione delle ipotesi AI:</strong>{' '}
              {ASSESSMENT_LABEL[opinion.assessment_of_ai_output] ?? opinion.assessment_of_ai_output}
            </p>
            <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{opinion.clinical_assessment}</p>
            {opinion.limitations.length > 0 && (
              <div>
                <strong>Limiti</strong>
                <ul style={{ margin: '0.25rem 0 0' }}>
                  {opinion.limitations.map((l) => (
                    <li key={l}>{l}</li>
                  ))}
                </ul>
              </div>
            )}
            {opinion.recommendations.length > 0 && (
              <div>
                <strong>Indicazioni</strong>
                <ul style={{ margin: '0.25rem 0 0' }}>
                  {opinion.recommendations.map((r) => (
                    <li key={r}>{r}</li>
                  ))}
                </ul>
              </div>
            )}
            <p className="muted" style={{ margin: 0 }}>
              Urgenza assegnata dal medico:{' '}
              {URGENCY_LABEL[opinion.physician_assigned_urgency] ?? opinion.physician_assigned_urgency}
              {opinion.requires_in_person_assessment && ' · visita in presenza indicata'}
              {opinion.signed_at && ` · firmato il ${new Date(opinion.signed_at).toLocaleString('it-IT')}`}
            </p>
          </div>
        )}

        <div className="card stack">
          <h2 style={{ marginTop: 0 }}>Messaggi con il medico</h2>
          <div className="chat-log">
            {messages.length === 0 && <p className="muted">Nessun messaggio.</p>}
            {messages.map((m) => (
              <div key={m.id} className={`chat-row ${m.sender_role === 'PHYSICIAN' ? 'physician' : ''}`}>
                <div className="row" style={{ justifyContent: 'space-between' }}>
                  <strong>{m.sender_role === 'PHYSICIAN' ? 'Medico' : 'Tu'}</strong>
                  <span className="muted">{new Date(m.created_at).toLocaleString('it-IT')}</span>
                </div>
                <div style={{ whiteSpace: 'pre-wrap' }}>{m.content}</div>
              </div>
            ))}
          </div>
          <form className="row" onSubmit={sendMessage}>
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Scrivi un messaggio…"
              style={{ flex: 1 }}
            />
            <button className="primary" type="submit">
              Invia
            </button>
          </form>
        </div>

        <p>
          <Link href="/cases">Torna ai miei casi</Link>
        </p>
      </div>
    </RequireAuth>
  )
}
