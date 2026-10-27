export interface User {
  id: string
  email: string
  role: 'PATIENT' | 'PHYSICIAN' | 'ADMIN' | string
  email_verified: boolean
  identity_level: string
  created_at: string
}

export interface AuthPayload extends User {
  token: string
}

const TOKEN_KEY = 'token'
const USER_KEY = 'user'

export function getToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(TOKEN_KEY)
}

export function setSession(payload: AuthPayload): void {
  localStorage.setItem(TOKEN_KEY, payload.token)
  const { token, ...user } = payload
  localStorage.setItem(USER_KEY, JSON.stringify(user))
}

export function getStoredUser(): User | null {
  if (typeof window === 'undefined') return null
  const raw = localStorage.getItem(USER_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as User
  } catch {
    return null
  }
}

export function clearSession(): void {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(USER_KEY)
}

export function authHeaders(): Record<string, string> {
  const token = getToken()
  return token ? { Authorization: `Bearer ${token}` } : {}
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders(),
      ...(init.headers || {}),
    },
    cache: 'no-store',
  })

  const text = await res.text()
  const data = text ? JSON.parse(text) : null

  if (!res.ok) {
    const message = data?.message || data?.detail || `Request failed (${res.status})`
    throw new Error(message)
  }
  return data as T
}
