import Link from 'next/link'

export default function Home() {
  return (
    <div style={{ maxWidth: '800px', margin: '0 auto' }}>
      <h1>Ask Your DocAI</h1>
      <p style={{ fontSize: '1.25rem', color: '#555' }}>
        Hai consultato ChatGPT per i tuoi sintomi? Fai valutare da un medico le ipotesi emerse.
      </p>
      <p>
        Carica la conversazione e ricevi una valutazione clinica indipendente. Il medico potrà concordare, correggere le ipotesi, chiedere ulteriori informazioni oppure indicare che sono necessari visita o accertamenti.
      </p>
      <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem' }}>
        <Link href="/register" style={{ padding: '0.75rem 1.5rem', background: '#0066cc', color: 'white', borderRadius: '8px', textDecoration: 'none' }}>
          Inizia ora
        </Link>
        <Link href="/come-funziona" style={{ padding: '0.75rem 1.5rem', border: '1px solid #ccc', borderRadius: '8px', textDecoration: 'none', color: 'inherit' }}>
          Come funziona
        </Link>
      </div>
      <div style={{ marginTop: '2rem', padding: '1rem', background: '#fff3cd', borderRadius: '8px', border: '1px solid #ffc107' }}>
        <strong>⚠️ Attenzione:</strong> Questo servizio non è di emergenza. Se stai cercando assistenza urgente, contatta il 112 o recati al pronto soccorso più vicino.
      </div>
    </div>
  )
}