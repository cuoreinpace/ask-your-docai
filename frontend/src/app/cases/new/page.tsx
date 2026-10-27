'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { api, getToken } from '@/lib/api'
import { RequireAuth } from '@/components/RequireAuth'

interface CreatedCase {
  id: string
}

export default function NewCasePage() {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [summary, setSummary] = useState('')
  const [sourceType, setSourceType] = useState<'USER_PASTED_TEXT' | 'USER_UPLOAD'>('USER_PASTED_TEXT')
  const [pastedText, setPastedText] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [acknowledged, setAcknowledged] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const created = await api<CreatedCase>('/v1/cases', {
        method: 'POST',
        body: JSON.stringify({
          patient_summary: summary,
          source: {
            declared_provider: 'ChatGPT',
            source_type: sourceType,
            provenance_verified: false,
            pasted_text: sourceType === 'USER_PASTED_TEXT' ? pastedText : null,
          },
          service_scope_acknowledged: acknowledged,
        }),
      })

      if (sourceType === 'USER_UPLOAD') {
        if (!file) throw new Error('Seleziona un file da caricare')
        const session = await api<{ upload_id: string }>(`/v1/cases/${created.id}/uploads`, {
          method: 'POST',
        })
        const form = new FormData()
        form.append('file', file)
        const uploadRes = await fetch(
          `/v1/cases/${created.id}/uploads/${session.upload_id}/complete`,
          {
            method: 'POST',
            headers: { Authorization: `Bearer ${getToken()}` },
            body: form,
          },
        )
        if (!uploadRes.ok) {
          const body = await uploadRes.json().catch(() => null)
          throw new Error(body?.message || 'Caricamento del file non riuscito')
        }
      }

      await api(`/v1/cases/${created.id}/submit`, { method: 'POST' })
      router.push(`/cases/${created.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore durante l\'invio del caso')
    } finally {
      setLoading(false)
    }
  }

  return (
    <RequireAuth role="PATIENT">
      <div className="stack" style={{ maxWidth: 720, margin: '0 auto' }}>
        <div className="spread">
          <h1 style={{ margin: 0 }}>Nuovo caso</h1>
          <span className="muted">Passo {step} di 3</span>
        </div>

        {error && <div className="banner-error">{error}</div>}

        {step === 1 && (
          <form
            className="card stack"
            onSubmit={(e) => {
              e.preventDefault()
              setStep(2)
            }}
          >
            <div>
              <h2 style={{ marginTop: 0 }}>Descrivi il tuo problema</h2>
              <p className="muted">
                Scrivi direttamente tu la descrizione: la piattaforma non la interpreta.
              </p>
            </div>
            <div>
              <label htmlFor="summary">Descrizione</label>
              <textarea
                id="summary"
                rows={7}
                maxLength={10000}
                required
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                placeholder="Sintomi, durata, cosa hai già fatto, domanda che ti interessa…"
              />
              <p className="muted" style={{ margin: '0.25rem 0 0' }}>
                {summary.length}/10000 caratteri
              </p>
            </div>
            <div className="row">
              <button className="primary" type="submit">
                Avanti
              </button>
            </div>
          </form>
        )}

        {step === 2 && (
          <form
            className="card stack"
            onSubmit={(e) => {
              e.preventDefault()
              setStep(3)
            }}
          >
            <h2 style={{ marginTop: 0 }}>Conversazione ChatGPT</h2>
            <div className="stack">
              <label className="row" style={{ fontWeight: 400 }}>
                <input
                  type="radio"
                  name="source"
                  checked={sourceType === 'USER_PASTED_TEXT'}
                  onChange={() => setSourceType('USER_PASTED_TEXT')}
                />
                Incollo il testo della conversazione
              </label>
              <label className="row" style={{ fontWeight: 400 }}>
                <input
                  type="radio"
                  name="source"
                  checked={sourceType === 'USER_UPLOAD'}
                  onChange={() => setSourceType('USER_UPLOAD')}
                />
                Carico un file (PDF, TXT, PNG, JPEG)
              </label>
            </div>

            {sourceType === 'USER_PASTED_TEXT' && (
              <div>
                <label htmlFor="pasted">Testo della conversazione</label>
                <textarea
                  id="pasted"
                  rows={8}
                  value={pastedText}
                  onChange={(e) => setPastedText(e.target.value)}
                  placeholder="Incolla qui la conversazione con ChatGPT…"
                />
              </div>
            )}

            {sourceType === 'USER_UPLOAD' && (
              <div>
                <label htmlFor="file">File</label>
                <input
                  id="file"
                  type="file"
                  accept="application/pdf,text/plain,image/png,image/jpeg,image/webp"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                />
                <p className="muted">Dimensione massima 10 MB. Il file entra in quarantena.</p>
              </div>
            )}

            <div className="row">
              <button className="secondary" type="button" onClick={() => setStep(1)}>
                Indietro
              </button>
              <button className="primary" type="submit">
                Avanti
              </button>
            </div>
          </form>
        )}

        {step === 3 && (
          <form className="card stack" onSubmit={submit}>
            <h2 style={{ marginTop: 0 }}>Conferma e invia</h2>
            <div>
              <p style={{ marginTop: 0 }}>
                <strong>Descrizione:</strong> {summary}
              </p>
              <p>
                <strong>Fonte:</strong>{' '}
                {sourceType === 'USER_PASTED_TEXT'
                  ? 'testo incollato'
                  : file?.name || 'nessun file selezionato'}
              </p>
            </div>

            <label className="row" style={{ fontWeight: 400 }}>
              <input
                type="checkbox"
                checked={acknowledged}
                onChange={(e) => setAcknowledged(e.target.checked)}
                required
              />
              Comprendo che il servizio non è di emergenza, che non certifica automaticamente le
              risposte di ChatGPT e che un medico effettuerà una valutazione indipendente.
            </label>

            <div className="row">
              <button className="secondary" type="button" onClick={() => setStep(2)}>
                Indietro
              </button>
              <button className="primary" type="submit" disabled={loading}>
                {loading ? 'Invio…' : 'Invia caso'}
              </button>
            </div>
          </form>
        )}

        <p>
          <Link href="/cases">Torna ai miei casi</Link>
        </p>
      </div>
    </RequireAuth>
  )
}
