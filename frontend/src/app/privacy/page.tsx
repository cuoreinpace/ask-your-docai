import Link from 'next/link'

export default function PrivacyPage() {
  return (
    <div className="stack" style={{ maxWidth: 820 }}>
      <h1>Privacy e protezione dei dati</h1>
      <p>
        La piattaforma tratta dati sanitari, categorie particolari di dati personali ai sensi
        dell&apos;art. 9 GDPR. La valutazione clinica è svolta dal medico; la piattaforma fornisce
        funzioni tecniche e amministrative di raccolta, archiviazione e conservazione della
        documentazione.
      </p>

      <h2>Principi di trattamento</h2>
      <ul>
        <li>Minimizzazione: raccogliamo solo i dati necessari alla prestazione.</li>
        <li>Separazione tra dati di identità e contenuto clinico.</li>
        <li>Cifratura in transito e a riposo; chiavi gestite separatamente.</li>
        <li>Audit append-only degli accessi, senza contenuto clinico nei log.</li>
        <li>Retention differenziata per categoria di dato.</li>
        <li>Nessun dato sanitario in URL, email, SMS o metadati dei pagamenti.</li>
      </ul>

      <h2>Diritti degli interessati</h2>
      <p>
        Accesso, rettifica, limitazione, cancellazione e portabilità. La cancellazione è gestita per
        categoria, nel rispetto degli obblighi di conservazione documentale e medico-legale.
      </p>

      <h2>Fornitori</h2>
      <p className="muted">
        In produzione: Google Cloud Run, Cloud SQL e Cloud Storage in regione Milano
        (<span className="mono">europe-west8</span>), con DPA e valutazione dei trasferimenti. Nessun
        modello AI è integrato nel percorso clinico.
      </p>

      <p>
        <Link href="/">Torna alla homepage</Link>
      </p>
    </div>
  )
}
