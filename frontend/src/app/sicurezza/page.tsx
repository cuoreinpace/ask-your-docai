import Link from 'next/link'

export default function SafetyPage() {
  return (
    <div className="stack" style={{ maxWidth: 820 }}>
      <h1>Sicurezza e limiti del servizio</h1>

      <div className="banner-warning">
        <strong>Questo non è un servizio di emergenza.</strong> Se hai un&apos;emergenza medica
        contatta il 112 o recati al pronto soccorso più vicino.
      </div>

      <h2>Limiti</h2>
      <ul>
        <li>Il parere si basa esclusivamente sulle informazioni fornite dal paziente.</li>
        <li>La revisione documentale a distanza ha limiti rispetto alla visita in presenza.</li>
        <li>
          Il medico può dichiarare che la diagnosi non è determinabile a distanza e richiedere visita
          o accertamenti.
        </li>
        <li>Il servizio non gestisce urgenze e non assegna priorità cliniche automatiche.</li>
      </ul>

      <h2>Ruolo dell&apos;AI</h2>
      <ul>
        <li>ChatGPT è un servizio esterno alla piattaforma.</li>
        <li>La piattaforma non interroga modelli AI e non interpreta il contenuto clinico.</li>
        <li>La conversazione AI è trattata come documento fornito dal paziente.</li>
        <li>La valutazione è redatta e firmata dal medico assegnato.</li>
      </ul>

      <p>
        <Link href="/">Torna alla homepage</Link>
      </p>
    </div>
  )
}
