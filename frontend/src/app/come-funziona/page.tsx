import Link from 'next/link'

export default function HowItWorksPage() {
  return (
    <div className="stack" style={{ maxWidth: 820 }}>
      <h1>Come funziona</h1>
      <ol>
        <li>
          <strong>Registrati</strong> come paziente e descrivi il tuo problema.
        </li>
        <li>
          <strong>Carica la conversazione</strong> già avuta con ChatGPT: testo incollato oppure
          file PDF/TXT/immagine.
        </li>
        <li>
          <strong>Invia il caso</strong> e attendi la presa in carico di un medico abilitato.
        </li>
        <li>
          <strong>Ricevi il parere</strong> firmato: il medico può concordare, concordare in parte,
          non concordare, chiedere informazioni, richiedere visita o dichiarare che la valutazione a
          distanza non è sufficiente.
        </li>
      </ol>

      <h2>Principi fondamentali</h2>
      <ul>
        <li>Il servizio non certifica automaticamente le risposte di ChatGPT.</li>
        <li>Il medico effettua una valutazione indipendente e firmata.</li>
        <li>La piattaforma non interpreta il contenuto clinico e non produce diagnosi.</li>
        <li>Il servizio non sostituisce la visita medica.</li>
        <li>In caso di emergenza contatta il 112 o recati al pronto soccorso.</li>
      </ul>

      <p>
        <Link href="/">Torna alla homepage</Link>
      </p>
    </div>
  )
}
