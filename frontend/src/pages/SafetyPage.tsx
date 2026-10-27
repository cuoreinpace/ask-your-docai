import React from 'react';
import { Link } from 'react-router-dom';

export function SafetyPage() {
  return (
    <div style={{ maxWidth: '800px', margin: '0 auto' }}>
      <h1>Sicurezza e limiti del servizio</h1>
      <h2>Limiti del servizio</h2>
      <ul>
        <li>Questo servizio <strong>non è un servizio di emergenza</strong></li>
        <li>Se hai un'emergenza medica, contatta il 112 o recati al pronto soccorso più vicino</li>
        <li>Il parere medico si basa esclusivamente sulle informazioni fornite dal paziente</li>
        <li>La revisione a distanza ha limiti rispetto alla visita di persona</li>
        <li>Il medico potrebbe non essere in grado di confermare una diagnosi senza esame obiettivo</li>
      </ul>
      <h2>Informazioni sull'AI</h2>
      <ul>
        <li>ChatGPT è un servizio esterno alla nostra piattaforma</li>
        <li>Noi non utilizziamo AI per interpretare o analizzare i tuoi dati clinici</li>
        <li>La conversazione ChatGPT è un documento fornito dal paziente, come potrebbe essere un referto</li>
        <li>Il medico legge la conversazione e formula il proprio giudizio autonomo</li>
      </ul>
      <p>
        <Link to="/">Torna alla homepage</Link>
      </p>
    </div>
  );
}