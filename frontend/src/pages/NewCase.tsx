import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth, API_URL } from '../hooks/useAuth';
import axios from 'axios';

export function NewCase() {
  const { user, token } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    patientSummary: '',
    declaredProvider: '',
    sourceType: 'USER_PASTED_TEXT' as const,
    serviceScopeAcknowledged: false,
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await axios.post(
        `${API_URL}/v1/cases`,
        formData,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const caseId = res.data.id;

      if (formData.sourceType === 'USER_PASTED_TEXT') {
        await axios.post(
          `${API_URL}/v1/cases/${caseId}/uploads`,
          {},
          { headers: { Authorization: `Bearer ${token}` } }
        );
      }

      navigate(`/cases/${caseId}`);
    } catch (err: any) {
      setError(err.response?.data?.message ?? 'Errore durante la creazione del caso');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto' }}>
      <h1>Nuovo caso</h1>
      <p style={{ color: '#666' }}>Passo {step} di 3</p>

      {error && <div style={{ color: 'red', marginBottom: '1rem', padding: '1rem', background: '#fee', borderRadius: '8px' }}>{error}</div>}

      {step === 1 && (
        <form onSubmit={(e) => { e.preventDefault(); setStep(2); }}>
          <h2>Descrivi il tuo problema</h2>
          <p>Scrivi una descrizione dei tuoi sintomi e della tua situazione sanitaria.</p>
          <textarea
            value={formData.patientSummary}
            onChange={(e) => setFormData({ ...formData, patientSummary: e.target.value })}
            required
            maxLength={10000}
            rows={6}
            style={{ width: '100%', padding: '0.75rem', fontSize: '1rem' }}
            placeholder="Descrivi i tuoi sintomi, da quanto tempo li hai, ecc."
          />
          <p style={{ color: '#666', fontSize: '0.875rem' }}>{formData.patientSummary.length}/10000 caratteri</p>
          <button type="submit" style={{ marginTop: '1rem', padding: '0.75rem 1.5rem', background: '#0066cc', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>
            Avanti
          </button>
        </form>
      )}

      {step === 2 && (
        <form onSubmit={(e) => { e.preventDefault(); setStep(3); }}>
          <h2>Conversazione ChatGPT</h2>
          <p>Seleziona il tipo di fonte della conversazione.</p>
          <div style={{ marginBottom: '1rem' }}>
            <label>
              <input
                type="radio"
                value="USER_PASTED_TEXT"
                checked={formData.sourceType === 'USER_PASTED_TEXT'}
                onChange={(e) => setFormData({ ...formData, sourceType: e.target.value as any })}
              />
              {' '}Ho incollato il testo della conversazione
            </label>
          </div>
          <div style={{ marginBottom: '1rem' }}>
            <label>
              <input
                type="radio"
                value="USER_UPLOAD"
                checked={formData.sourceType === 'USER_UPLOAD'}
                onChange={(e) => setFormData({ ...formData, sourceType: e.target.value as any })}
              />
              {' '}Ho caricato un file (PDF, TXT, immagine)
            </label>
          </div>
          {formData.sourceType === 'USER_UPLOAD' && (
            <div style={{ marginBottom: '1rem' }}>
              <label>Provider della conversazione</label>
              <input
                type="text"
                value={formData.declaredProvider}
                onChange={(e) => setFormData({ ...formData, declaredProvider: e.target.value })}
                placeholder="es. ChatGPT"
                style={{ width: '100%', padding: '0.5rem' }}
              />
            </div>
          )}
          <button type="submit" style={{ marginTop: '1rem', padding: '0.75rem 1.5rem', background: '#0066cc', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>
            Avanti
          </button>
        </form>
      )}

      {step === 3 && (
        <form onSubmit={handleSubmit}>
          <h2>Conferma e invia</h2>
          <div style={{ marginBottom: '1rem', padding: '1rem', background: '#f5f5f5', borderRadius: '8px' }}>
            <p><strong>Riepilogo:</strong></p>
            <p>{formData.patientSummary}</p>
            <p><strong>Fonte:</strong> {formData.sourceType === 'USER_PASTED_TEXT' ? 'Testo incollato' : 'File caricato'}</p>
          </div>
          <div style={{ marginBottom: '1rem' }}>
            <label>
              <input
                type="checkbox"
                checked={formData.serviceScopeAcknowledged}
                onChange={(e) => setFormData({ ...formData, serviceScopeAcknowledged: e.target.checked })}
                required
              />
              {' '}Ho letto e accetto i termini del servizio. Comprendo che questo non è un servizio di emergenza e che un medico effettuerà una valutazione indipendente.
            </label>
          </div>
          <button type="submit" disabled={loading} style={{ padding: '0.75rem 1.5rem', background: '#0066cc', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>
            {loading ? 'Invio in corso...' : 'Invia caso'}
          </button>
        </form>
      )}

      <p style={{ marginTop: '2rem' }}>
        <Link to="/">Torna alla homepage</Link>
      </p>
    </div>
  );
}