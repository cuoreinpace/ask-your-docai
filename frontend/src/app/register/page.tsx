'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import axios from 'axios'

export default function RegisterPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState('PATIENT')
  const [birthDate, setBirthDate] = useState('')
  const [country, setCountry] = useState('ITA')
  const [error, setError] = useState('')
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await axios.post('/api/auth/register', { email, password, role, birthDate: birthDate || undefined, country })
      router.push('/')
    } catch (err: any) {
      setError(err.response?.data?.message || 'Errore durante la registrazione')
    }
  }

  return (
    <div style={{ maxWidth: '400px', margin: '0 auto' }}>
      <h1>Registrati</h1>
      {error && <div style={{ color: 'red', marginBottom: '1rem' }}>{error}</div>}
      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: '1rem' }}>
          <label>Email</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required style={{ width: '100%', padding: '0.5rem' }} />
        </div>
        <div style={{ marginBottom: '1rem' }}>
          <label>Password</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} style={{ width: '100%', padding: '0.5rem' }} />
        </div>
        <div style={{ marginBottom: '1rem' }}>
          <label>Ruolo</label>
          <select value={role} onChange={(e) => setRole(e.target.value)} style={{ width: '100%', padding: '0.5rem' }}>
            <option value="PATIENT">Paziente</option>
            <option value="PHYSICIAN">Medico</option>
          </select>
        </div>
        {role === 'PATIENT' && (
          <>
            <div style={{ marginBottom: '1rem' }}>
              <label>Data di nascita</label>
              <input type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} required style={{ width: '100%', padding: '0.5rem' }} />
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <label>Paese</label>
              <select value={country} onChange={(e) => setCountry(e.target.value)} style={{ width: '100%', padding: '0.5rem' }}>
                <option value="ITA">Italia</option>
              </select>
            </div>
          </>
        )}
        <button type="submit" style={{ padding: '0.75rem 1.5rem', background: '#0066cc', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>
          Registrati
        </button>
      </form>
      <p style={{ marginTop: '1rem' }}>
        Hai già un account? <Link href="/login">Accedi</Link>
      </p>
    </div>
  )
}