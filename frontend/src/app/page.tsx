import Link from 'next/link'

export default function HomePage() {
  return (
    <div className="stack" style={{ maxWidth: 820 }}>
      <h1>Trasforma una conversazione con ChatGPT in una valutazione medica indipendente</h1>
      <p className="muted" style={{ fontSize: '1.15rem' }}>
        Hai consultato ChatGPT per i tuoi sintomi? Fai valutare da un medico le ipotesi emerse.
        Carica la conversazione e ricevi una valutazione clinica indipendente: il medico può
        concordare, correggere, chiedere ulteriori informazioni oppure indicare che sono necessari
        visita o accertamenti.
      </p>

      <div className="row">
        <Link href="/register" className="nav-cta">
          Inizia ora
        </Link>
        <Link href="/come-funziona" className="secondary" style={{ padding: '0.55rem 1.1rem', border: '1px solid #ccc', borderRadius: 8, textDecoration: 'none' }}>
          Come funziona
        </Link>
      </div>

      <div className="banner-warning">
        <strong>Attenzione:</strong> questo servizio non è di emergenza. Se stai cercando assistenza
        urgente, contatta il 112 o recati al pronto soccorso più vicino.
      </div>

      <div className="grid-2">
        <div className="card">
          <h2 style={{ marginTop: 0 }}>Nessuna AI nel percorso clinico</h2>
          <p className="muted">
            La piattaforma non interpreta, non riassume e non classifica il contenuto clinico. La
            conversazione ChatGPT è un documento fornito dal paziente, come un referto.
          </p>
        </div>
        <div className="card">
          <h2 style={{ marginTop: 0 }}>Decisione solo medica</h2>
          <p className="muted">
            Un medico abilitato esamina il materiale, può chiedere integrazioni e firma il proprio
            parere. La decisione resta sempre in capo al professionista.
          </p>
        </div>
        <div className="card">
          <h2 style={{ marginTop: 0 }}>Tracciabilità completa</h2>
          <p className="muted">
            Accessi e azioni sono registrati in un audit append-only; i dati sanitari non finiscono
            nei log applicativi né nelle notifiche.
          </p>
        </div>
        <div className="card">
          <h2 style={{ marginTop: 0 }}>Può concludere &quot;non determinabile&quot;</h2>
          <p className="muted">
            Il medico può dichiarare che la valutazione a distanza non è sufficiente e richiedere
            visita o accertamenti.
          </p>
        </div>
      </div>

      <p className="muted">
        Account demo: <span className="mono">paziente@demo.it</span> /{' '}
        <span className="mono">password123</span> —{' '}
        <span className="mono">medico@demo.it</span> / <span className="mono">password123</span>
      </p>
    </div>
  )
}
