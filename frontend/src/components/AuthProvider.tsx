'use client'

import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  api,
  AuthPayload,
  clearSession,
  getStoredUser,
  getToken,
  setSession,
  User,
} from '@/lib/api'

interface AuthContextValue {
  user: User | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  register: (input: RegisterInput) => Promise<void>
  logout: () => void
}

interface RegisterInput {
  email: string
  password: string
  birth_date?: string
  country?: string
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    const token = getToken()
    if (!token) {
      setLoading(false)
      return
    }
    setUser(getStoredUser())
    api<User>('/v1/auth/me')
      .then((me) => setUser(me))
      .catch(() => {
        clearSession()
        setUser(null)
      })
      .finally(() => setLoading(false))
  }, [])

  const login = useCallback(
    async (email: string, password: string) => {
      const payload = await api<AuthPayload>('/v1/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      })
      setSession(payload)
      const { token, ...rest } = payload
      setUser(rest)
      router.push(rest.role === 'PHYSICIAN' ? '/clinician/queue' : '/cases')
    },
    [router],
  )

  const register = useCallback(
    async (input: RegisterInput) => {
      const payload = await api<AuthPayload>('/v1/auth/register', {
        method: 'POST',
        body: JSON.stringify({ ...input, role: 'PATIENT' }),
      })
      setSession(payload)
      const { token, ...rest } = payload
      setUser(rest)
      router.push('/cases')
    },
    [router],
  )

  const logout = useCallback(() => {
    clearSession()
    setUser(null)
    router.push('/')
  }, [router])

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
