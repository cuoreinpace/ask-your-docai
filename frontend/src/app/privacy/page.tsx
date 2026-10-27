import Link from 'next/link'

export default function PrivacyPage() {
  return (
    <div style={{ maxWidth: '800px', margin: '0 auto' }}>
      <h1>Privacy e protezione dei dati</h1>
      <p>
        Questa piattaforma tratta dati sanitari, che sono categorie particolari di dati personali ai sensi dell'art. 9 del GDPR.
      </p>
      <h2>Principi di trattamento</h2>
      <ul>
        <li>Minimizzazione dei dati: raccogliamo solo i dati necessari</li>
        <li>Separazione dei dati: i dati sanitari sono separati dai dati di identità</li>
        <li>Cifratura: i dati sono cifrati in transito e a riposo</li>
        <li>Audit: ogni accesso ai dati clinici è registrato</li>
        <li>Retention: i dati sono conservati secondo policy differenziate</li>
      </ul>
      <h2>Diritti degli interessati</h2>
      <p>Hai diritto di accesso, rettifica, limitazione, cancellazione e portabilità dei tuoi dati. Per esercitare i tuoi diritti, contatta il nostro DPO.</p>
      <p>
        <Link href="/">Torna alla homepage</Link>
      </p>
    </div>
  )
}