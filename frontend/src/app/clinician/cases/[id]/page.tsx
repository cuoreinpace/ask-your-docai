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
  assigned_physician_id: string | null
}

interface Source {
  id: string
  declared_provider: string | null
  source_type: string | null
  media_type: string | null
  pasted_text: string | null
  malware_scan_status: string
}

interface Message {
  id: string
  sender_role: string
  content: string
  created_at: string
}

interface Opinion {
  id: string
  status: 'DRAFT' | 'FINALIZED' | 'SIGNED'
  assessment_of_ai_output: string
  clinical_assessment: string
  limitations: string[]
  recommendations: string[]
  requires_in_person_assessment: boolean
  physician_assigned_urgency: string
}

const ASSESSMENTS = [
  ['AGREE', 'Concordo'],
  ['PARTIALLY_AGREE', 'Concordo parzialmente'],
  ['DISAGREE', 'Non concordo'],
  ['INSUFFICIENT_INFORMATION', 'Informazioni insufficienti'],
  ['CANNOT_ASSESS', 'Non valutabile a distanza'],
] as const

const URGENCIES = [
  ['ROUTINE', 'Routine'],
  ['URGENT', 'Urgente'],
  ['EMERGENCY', 'Emergenza'],
  ['UNDETERMINED', 'Non determinata'],
] as const

export default function PhysicianCasePage() {
  const params = useParams<{ id: string }>()
  const id = params.id

  const [caseData, setCaseData] = useState<CaseDetail | null>(null)
  const [sources, setSources] = useState<Source[]>([])
  const [messages, setMessages] = useState<Message[]>([])
  const [opinion, setOpinion] = useState<Opinion | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const [assessment, setAssessment] = useState('PARTIALLY_AGREE')
  const [clinicalAssessment, setClinicalAssessment] = useState('')
  const [limitations, setLimitations] = useState('Valutazione effettuata a distanza\nEsame obiettivo non disponibile')
  const [recommendations, setRecommendations] = useState('')
  const [inPerson, setInPerson] = useState(false)
  const [urgency, setUrgency] = useState('ROUTINE')

  const [newMessage, setNewMessage] = useState('')
  const [questions, setQuestions] = useState('')

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
      if (o) {
        setAssessment(o.assessment_of_ai_output)
        setClinicalAssessment(o.clinical_assessment)
        setLimitations(o.limitations.join('\n'))
        setRecommendations(o.recommendations.join('\n'))
        setInPerson(o.requires_in_person_assessment)
        setUrgency(o.physician_assigned_urgency)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Errore di caricamento')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    load()
  }, [load])

  function opinionPayload() {
    return {
      assessment_of_ai_output: assessment,
      clinical_assessment: clinicalAssessment,
      limitations: limitations.split('\n').map((x) => x.trim()).filter(Boolean),
      recommendations: recommendations.split('\n').map((x) => x.trim()).filter(Boolean),
      requires_in_person_assessment: inPerson,
      physician_assigned_urgency: urgency,
    }
  }

  async function saveDraft() {
    setError('')
    setNotice('')
    try {
      if (!opinion) {
        await api(`/v1/clinical/cases/${id}/opinions`, {
          method: 'POST',
          body: JSON.stringify(opinionPayload()),
        })
      } else {
        await api(`/v1/clinical/opinions/${opinion.id}`, {
          method: 'PUT',
          body: JSON.stringify(opinionPayload()),
        })
      }
      setNotice('Bozza salvata')
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Salvataggio non riuscito')
    }
  }

  async function finalize() {
    if (!opinion) {
      setError('Salva prima la bozza')
      return
    }
    try {
      await api(`/v1/clinical/opinions/${opinion.id}/finalize`, { method: 'POST' })
      setNotice('Parere finalizzato e bloccato')
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Finalizzazione non riuscita')
    }
  }

  async function sign() {
    if (!opinion) return
    try {
      await api(`/v1/clinical/opinions/${opinion.id}/sign`, { method: 'POST' })
      setNotice('Parere firmato (firma qualificata simulata)')
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Firma non riuscita')
    }
  }

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

  async function requestInformation() {
    const list = questions.split('\n').map((q) => q.trim()).filter(Boolean)
    if (list.length === 0) {
      setError('Inserisci almeno una domanda')
      return
    }
    try {
      await api(`/v1/clinical/cases/${id}/request-information`, {
        method: 'POST',
        body: JSON.stringify({ questions: list.map((text) => ({ text })) }),
      })
      setQuestions('')
      setNotice('Richiesta di integrazione inviata al paziente')
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Richiesta non inviata')
    }
  }

  async function escalate() {
    try {
      await api(`/v1/clinical/cases/${id}/escalate`, {
        method: 'POST',
        body: JSON.stringify({ reason: 'CLINICAL_ESCALATION_TRIGGERED' }),
      })
      setNotice('Caso in escalation clinica')
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Escalation non riuscita')
    }
  }

  if (loading) return <p className="muted">Caricamento…</p>
  if (!caseData) return <div className="banner-error">{error || 'Caso non trovato'}</div>

  const readOnly = opinion?.status === 'SIGNED'

  return (
    <RequireAuth role="PHYSICIAN">
      <div className="stack">
        <div className="spread">
          <h1 style={{ margin: 0 }}>
            Caso <span className="mono">{caseData.id}</span>
          </h1>
          <span className="badge">{caseData.status}</span>
        </div>

        {error && <div className="banner-error">{error}</div>}
        {notice && <div className="card" style={{ borderColor: '#1b7f4b' }}>{notice}</div>}

        <div className="card">
          <h2 style={{ marginTop: 0 }}>Descrizione del paziente</h2>
          <p style={{ marginBottom: 0, whiteSpace: 'pre-wrap' }}>{caseData.patient_summary}</p>
        </div>

        <div className="card stack">
          <h2 style={{ marginTop: 0 }}>Documenti forniti</h2>
          {sources.length === 0 && <p className="muted">Nessun documento.</p>}
          {sources.map((s) => (
            <div key={s.id} className="stack" style={{ gap: '0.25rem' }}>
              <div className="row">
                <span className="badge">{s.declared_provider || 'documento'}</span>
                <span className="muted">{s.source_type === 'USER_UPLOAD' ? s.media_type : 'testo incollato'}</span>
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

        <div className="card stack">
          <h2 style={{ marginTop: 0 }}>Parere</h2>
          <div className="grid-2">
            <div>
              <label htmlFor="assessment">Valutazione delle ipotesi AI</label>
              <select id="assessment" value={assessment} onChange={(e) => setAssessment(e.target.value)} disabled={readOnly}>
                {ASSESSMENTS.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="urgency">Urgenza assegnata dal medico</label>
              <select id="urgency" value={urgency} onChange={(e) => setUrgency(e.target.value)} disabled={readOnly}>
                {URGENCIES.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label htmlFor="clinical">Valutazione clinica</label>
            <textarea
              id="clinical"
              rows={7}
              value={clinicalAssessment}
              onChange={(e) => setClinicalAssessment(e.target.value)}
              disabled={readOnly}
              placeholder="Testo redatto autonomamente dal medico."
            />
          </div>
          <div className="grid-2">
            <div>
              <label htmlFor="limitations">Limiti (una riga ciascuno)</label>
              <textarea id="limitations" rows={4} value={limitations} onChange={(e) => setLimitations(e.target.value)} disabled={readOnly} />
            </div>
            <div>
              <label htmlFor="recommendations">Indicazioni (una riga ciascuna)</label>
              <textarea id="recommendations" rows={4} value={recommendations} onChange={(e) => setRecommendations(e.target.value)} disabled={readOnly} />
            </div>
          </div>

          <label className="row" style={{ fontWeight: 400 }}>
            <input type="checkbox" checked={inPerson} onChange={(e) => setInPerson(e.target.checked)} disabled={readOnly} />
            Ritengo necessaria una visita in presenza
          </label>

          <div className="row">
            <button type="button" className="secondary" onClick={saveDraft} disabled={readOnly}>
              {opinion ? 'Salva bozza' : 'Crea bozza'}
            </button>
            <button type="button" className="primary" onClick={finalize} disabled={!opinion || opinion.status !== 'DRAFT'}>
              Finalizza
            </button>
            <button type="button" className="success" onClick={sign} disabled={opinion?.status !== 'FINALIZED'}>
              Firma
            </button>
            <span className="muted">Stato parere: {opinion?.status ?? 'assente'}</span>
          </div>
        </div>

        <div className="card stack">
          <h2 style={{ marginTop: 0 }}>Richiedi integrazione</h2>
          <textarea
            rows={3}
            value={questions}
            onChange={(e) => setQuestions(e.target.value)}
            placeholder={'Una domanda per riga…'}
          />
          <div className="row">
            <button type="button" className="secondary" onClick={requestInformation}>
              Invia richiesta
            </button>
            <button type="button" className="danger" onClick={escalate}>
              Escalation clinica
            </button>
          </div>
        </div>

        <div className="card stack">
          <h2 style={{ marginTop: 0 }}>Messaggi</h2>
          <div className="chat-log">
            {messages.length === 0 && <p className="muted">Nessun messaggio.</p>}
            {messages.map((m) => (
              <div key={m.id} className={`chat-row ${m.sender_role === 'PHYSICIAN' ? 'physician' : ''}`}>
                <div className="row" style={{ justifyContent: 'space-between' }}>
                  <strong>{m.sender_role === 'PHYSICIAN' ? 'Medico' : 'Paziente'}</strong>
                  <span className="muted">{new Date(m.created_at).toLocaleString('it-IT')}</span>
                </div>
                <div style={{ whiteSpace: 'pre-wrap' }}>{m.content}</div>
              </div>
            ))}
          </div>
          <form className="row" onSubmit={sendMessage}>
            <input type="text" value={newMessage} onChange={(e) => setNewMessage(e.target.value)} placeholder="Messaggio al paziente…" style={{ flex: 1 }} />
            <button className="primary" type="submit">
              Invia
            </button>
          </form>
        </div>

        <p>
          <Link href="/clinician/queue">Torna alla coda</Link>
        </p>
      </div>
    </RequireAuth>
  )
}
