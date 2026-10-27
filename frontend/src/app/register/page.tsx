'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@/components/AuthProvider'

export default function RegisterPage() {
  const { register } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [birthDate, setBirthDate] = useState('')
  const [country, setCountry] = useState('ITA')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await register({ email, password, birth_date: birthDate, country })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore durante la registrazione')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="card stack" style={{ maxWidth: 460, margin: '0 auto' }}>
      <h1 style={{ margin: 0 }}>Registrati come paziente</h1>
      <p className="muted" style={{ margin: 0 }}>
        Gli account medici sono creati da clinical operations dopo la verifica dei requisiti
        professionali. Per provare il flusso medico usa l&apos;account demo.
      </p>
      {error && <div className="banner-error">{error}</div>}
      <form onSubmit={submit} className="stack">
        <div>
          <label htmlFor="email">Email</label>
          <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
        <div>
          <label htmlFor="password">Password (min. 8 caratteri)</label>
          <input id="password" type="password" minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} required />
        </div>
        <div>
          <label htmlFor="birthDate">Data di nascita</label>
          <input id="birthDate" type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} required />
        </div>
        <div>
          <label htmlFor="country">Paese di residenza</label>
          <select id="country" value={country} onChange={(e) => setCountry(e.target.value)}>
            <option value="ITA">Italia</option>
          </select>
        </div>
        <button className="primary" type="submit" disabled={loading}>
          {loading ? 'Registrazione…' : 'Registrati'}
        </button>
      </form>
      <p className="muted">
        Hai già un account? <Link href="/login">Accedi</Link>
      </p>
    </div>
  )
}
