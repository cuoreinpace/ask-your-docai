'use client'

import Link from 'next/link'
import { useAuth } from '@/components/AuthProvider'

export function NavBar() {
  const { user, loading, logout } = useAuth()

  return (
    <header className="site-header">
      <Link href="/" className="brand">
        Ask Your DocAI
      </Link>
      <nav className="site-nav">
        <Link href="/come-funziona">Come funziona</Link>
        <Link href="/sicurezza">Sicurezza</Link>
        <Link href="/privacy">Privacy</Link>
        {!loading && user ? (
          <>
            {user.role === 'PATIENT' && <Link href="/cases">I miei casi</Link>}
            {user.role === 'PATIENT' && <Link href="/cases/new">Nuovo caso</Link>}
            {user.role === 'PHYSICIAN' && <Link href="/clinician/queue">Coda clinica</Link>}
            <span className="muted">{user.email}</span>
            <button type="button" className="link-button" onClick={logout}>
              Esci
            </button>
          </>
        ) : (
          !loading && (
            <>
              <Link href="/login">Accedi</Link>
              <Link href="/register" className="nav-cta">
                Registrati
              </Link>
            </>
          )
        )}
      </nav>
    </header>
  )
}
