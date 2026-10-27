import type { Metadata } from 'next'
import './globals.css'
import { AuthProvider } from '@/components/AuthProvider'
import { NavBar } from '@/components/NavBar'

export const metadata: Metadata = {
  title: 'Ask Your DocAI',
  description:
    'Piattaforma italiana di revisione clinica documentale delle ipotesi diagnostiche emerse da ChatGPT',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="it">
      <body>
        <AuthProvider>
          <NavBar />
          <main>{children}</main>
          <footer className="site-footer">
            Ask Your DocAI — piattaforma di revisione clinica documentale. Non è un servizio di
            emergenza.
          </footer>
        </AuthProvider>
      </body>
    </html>
  )
}
