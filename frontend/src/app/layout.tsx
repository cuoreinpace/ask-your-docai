export const metadata = {
  title: 'Ask Your DocAI',
  description: 'Piattaforma italiana di verifica medica delle ipotesi diagnostiche emerse da ChatGPT',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="it">
      <body>
        <header style={{ padding: '1rem 2rem', borderBottom: '1px solid #e5e5e5', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <a href="/" style={{ textDecoration: 'none', color: 'inherit', fontWeight: 'bold', fontSize: '1.25rem' }}>
            Ask Your DocAI
          </a>
          <nav style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <a href="/come-funziona" style={{ textDecoration: 'none', color: 'inherit' }}>Come funziona</a>
            <a href="/sicurezza" style={{ textDecoration: 'none', color: 'inherit' }}>Sicurezza</a>
            <a href="/privacy" style={{ textDecoration: 'none', color: 'inherit' }}>Privacy</a>
          </nav>
        </header>
        <main style={{ flex: 1, padding: '2rem', maxWidth: '1200px', margin: '0 auto', width: '100%' }}>
          {children}
        </main>
        <footer style={{ padding: '1rem 2rem', borderTop: '1px solid #e5e5e5', textAlign: 'center', fontSize: '0.875rem', color: '#666' }}>
          Ask Your DocAI — Piattaforma di revisione clinica documentale
        </footer>
      </body>
    </html>
  )
}