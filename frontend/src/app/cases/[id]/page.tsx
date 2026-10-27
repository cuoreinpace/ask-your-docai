'use client'

import { useState, useEffect } from 'react'
import { useParams, Link } from 'next/link'
import axios from 'axios'

export default function CaseDetailPage() {
  const params = useParams()
  const id = params.id as string
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : ''
  const [caseData, setCaseData] = useState<any>(null)
  const [messages, setMessages] = useState<any[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [caseRes, messagesRes] = await Promise.all([
          axios.get(`/v1/cases/${id}`, { headers: { Authorization: `Bearer ${token}` } }),
          axios.get(`/v1/cases/${id}/messages`, { headers: { Authorization: `Bearer ${token}` } }),
        ])
        setCaseData(caseRes.data)
        setMessages(messagesRes.data)
      } catch (err: any) {
        setError(err.response?.data?.message || 'Errore durante il caricamento')
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [id, token])

  const handleSendMessage = async () => {
    if (!newMessage.trim()) return
    try {
      const res = await axios.post(
        `/v1/cases/${id}/messages`,
        { content: newMessage },
        { headers: { Authorization: `Bearer ${token}` } }
      )
      setMessages([...messages, res.data])
      setNewMessage('')
    } catch (err: any) {
      setError(err.response?.data?.message || 'Errore durante l\'invio')
    }
  }

  if (loading) return <div>Loading...</div>
  if (error) return <div style={{ color: 'red' }}>{error}</div>
  if (!caseData) return <div>Case not found</div>

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto' }}>
      <h1>Caso #{id}</h1>
      <p><strong>Stato:</strong> {caseData.status}</p>
      <p><strong>Riassunto del paziente:</strong></p>
      <div style={{ padding: '1rem', background: '#f5f5f5', borderRadius: '8px', marginBottom: '1rem' }}>
        {caseData.patientSummary}
      </div>

      <h2>Messaggi</h2>
      <div style={{ maxHeight: '400px', overflowY: 'auto', border: '1px solid #ddd', borderRadius: '8px', padding: '1rem', marginBottom: '1rem' }}>
        {messages.map((msg) => (
          <div key={msg.id} style={{ marginBottom: '0.5rem', padding: '0.5rem', background: msg.senderRole === 'PHYSICIAN' ? '#e8f4fd' : '#f9f9f9', borderRadius: '4px' }}>
            <strong>{msg.senderRole === 'PHYSICIAN' ? 'Medico' : 'Paziente'}:</strong> {msg.content}
            <br />
            <small style={{ color: '#666' }}>{new Date(msg.createdAt).toLocaleString('it-IT')}</small>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <input
          type="text"
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          placeholder="Scrivi un messaggio..."
          style={{ flex: 1, padding: '0.5rem' }}
          onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
        />
        <button onClick={handleSendMessage} style={{ padding: '0.5rem 1rem', background: '#0066cc', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>
          Invia
        </button>
      </div>

      <p style={{ marginTop: '2rem' }}>
        <Link href="/">Torna alla homepage</Link>
      </p>
    </div>
  )
}