'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@/components/AuthProvider'

export default function LoginPage() {
  const { login } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(email, password)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore durante l\'accesso')
    } finally {
      setLoading(false)
    }
  }

  function fill(kind: 'patient' | 'physician') {
    setEmail(kind === 'patient' ? 'paziente@demo.it' : 'medico@demo.it')
    setPassword('password123')
  }

  return (
    <div className="card stack" style={{ maxWidth: 420, margin: '0 auto' }}>
      <h1 style={{ margin: 0 }}>Accedi</h1>
      {error && <div className="banner-error">{error}</div>}
      <form onSubmit={submit} className="stack">
        <div>
          <label htmlFor="email">Email</label>
          <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
        </div>
        <div>
          <label htmlFor="password">Password</label>
          <input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" />
        </div>
        <button className="primary" type="submit" disabled={loading}>
          {loading ? 'Accesso…' : 'Accedi'}
        </button>
      </form>
      <div className="row">
        <button type="button" className="secondary" onClick={() => fill('patient')}>
          Demo paziente
        </button>
        <button type="button" className="secondary" onClick={() => fill('physician')}>
          Demo medico
        </button>
      </div>
      <p className="muted">
        Non hai un account? <Link href="/register">Registrati come paziente</Link>
      </p>
    </div>
  )
}
