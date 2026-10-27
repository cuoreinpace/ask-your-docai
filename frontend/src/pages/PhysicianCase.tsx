import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth, API_URL } from '../hooks/useAuth';
import axios from 'axios';

export function PhysicianCase() {
  const { id } = useParams<{ id: string }>();
  const { token } = useAuth();
  const [caseData, setCaseData] = useState<any>(null);
  const [opinion, setOpinion] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [caseRes, messagesRes] = await Promise.all([
          axios.get(`${API_URL}/v1/cases/${id}`, { headers: { Authorization: `Bearer ${token}` } }),
          axios.get(`${API_URL}/v1/cases/${id}/messages`, { headers: { Authorization: `Bearer ${token}` } }),
        ]);
        setCaseData(caseRes.data);
        setMessages(messagesRes.data);
      } catch (err) {
        console.error('Error fetching data:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [id, token]);

  const handleRequestInformation = async () => {
    try {
      await axios.post(
        `${API_URL}/v1/clinical/cases/${id}/request-information`,
        { questions: [{ text: 'Puoi fornire ulteriori dettagli sui sintomi?' }] },
        { headers: { Authorization: `Bearer ${token}` } }
      );
    } catch (err) {
      console.error('Error requesting information:', err);
    }
  };

  const handleEscalate = async () => {
    try {
      await axios.post(
        `${API_URL}/v1/clinical/cases/${id}/escalate`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
    } catch (err) {
      console.error('Error escalating:', err);
    }
  };

  if (loading) return <div>Loading...</div>;
  if (!caseData) return <div>Case not found</div>;

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto' }}>
      <h1>Caso #{id}</h1>
      <p><strong>Stato:</strong> {caseData.status}</p>

      <h2>Dati del paziente</h2>
      <div style={{ padding: '1rem', background: '#f5f5f5', borderRadius: '8px', marginBottom: '1rem' }}>
        <p>{caseData.patientSummary}</p>
      </div>

      <h2>Messaggi</h2>
      {messages.map((msg) => (
        <div key={msg.id} style={{ padding: '0.5rem', borderBottom: '1px solid #eee' }}>
          <strong>{msg.senderRole === 'PHYSICIAN' ? 'Medico' : 'Paziente'}:</strong> {msg.content}
        </div>
      ))}

      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
        <input
          type="text"
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          placeholder="Scrivi un messaggio..."
          style={{ flex: 1, padding: '0.5rem' }}
        />
        <button onClick={() => {
          axios.post(`${API_URL}/v1/cases/${id}/messages`, { content: newMessage }, { headers: { Authorization: `Bearer ${token}` } })
            .then((res) => { setMessages([...messages, res.data]); setNewMessage(''); });
        }} style={{ padding: '0.5rem 1rem', background: '#0066cc', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
          Invia
        </button>
      </div>

      <h2>Azioni cliniche</h2>
      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
        <button onClick={handleRequestInformation} style={{ padding: '0.5rem 1rem', background: '#ffc107', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
          Richiedi informazioni
        </button>
        <button onClick={handleEscalate} style={{ padding: '0.5rem 1rem', background: '#dc3545', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
          Escalation
        </button>
      </div>

      <p style={{ marginTop: '2rem' }}>
        <Link to="/clinician/queue">Torna alla coda</Link>
      </p>
    </div>
  );
}