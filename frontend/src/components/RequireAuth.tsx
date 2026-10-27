'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/AuthProvider'

export function RequireAuth({
  children,
  role,
}: {
  children: React.ReactNode
  role?: 'PATIENT' | 'PHYSICIAN'
}) {
  const { user, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && !user) router.replace('/login')
  }, [loading, user, router])

  if (loading) return <p className="muted">Caricamento…</p>
  if (!user) return null
  if (role && user.role !== role) {
    return (
      <div className="banner-error">
        Questa area è riservata agli utenti con ruolo {role === 'PHYSICIAN' ? 'medico' : 'paziente'}.
      </div>
    )
  }
  return <>{children}</>
}
