import Link from 'next/link'

export default function HowItWorks() {
  return (
    <div style={{ maxWidth: '800px', margin: '0 auto' }}>
      <h1>Come funziona</h1>
      <ol>
        <li><strong>Registrati</strong> — Crea un account come paziente o medico</li>
        <li><strong>Carica la conversazione</strong> — Il paziente carica la conversazione ChatGPT o la incolla come testo</li>
        <li><strong>Ricevi un parere</strong> — Un medico effettua una revisione clinica indipendente e rilascia un parere firmato</li>
      </ol>
      <h2>Principi fondamentali</h2>
      <ul>
        <li>Il servizio <strong>non certifica automaticamente</strong> le risposte di ChatGPT</li>
        <li>Un medico effettua una <strong>valutazione indipendente</strong></li>
        <li>Il medico può concordare, correggere o non poter confermare le ipotesi</li>
        <li>Il servizio <strong>non è un sostituto della visita medica</strong></li>
        <li>In caso di emergenza, contatta il 112 o recati al pronto soccorso</li>
      </ul>
      <p>
        <Link href="/">Torna alla homepage</Link>
      </p>
    </div>
  )
}