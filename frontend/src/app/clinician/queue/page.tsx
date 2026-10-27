'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import axios from 'axios'

export default function PhysicianQueuePage() {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : ''
  const [cases, setCases] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchCases = async () => {
      try {
        const res = await axios.get('/v1/cases', {
          headers: { Authorization: `Bearer ${token}` },
          params: { status: 'SUBMITTED' },
        })
        setCases(res.data)
      } catch (err) {
        console.error('Error fetching cases:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchCases()
  }, [token])

  const handleAccept = async (caseId: string) => {
    try {
      await axios.post(
        `/v1/clinical/cases/${caseId}/accept`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      )
      setCases(cases.filter((c) => c.id !== caseId))
    } catch (err) {
      console.error('Error accepting case:', err)
    }
  }

  if (loading) return <div>Loading...</div>

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto' }}>
      <h1>Casi in attesa</h1>
      {cases.length === 0 ? (
        <p>Nessun caso in attesa di revisione.</p>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0 }}>
          {cases.map((caseItem) => (
            <li key={caseItem.id} style={{ padding: '1rem', border: '1px solid #ddd', borderRadius: '8px', marginBottom: '1rem' }}>
              <Link href={`/clinician/cases/${caseItem.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                <strong>Caso #{caseItem.id}</strong>
                <p>{caseItem.patientSummary?.substring(0, 200)}...</p>
                <p><em>Stato: {caseItem.status}</em></p>
              </Link>
              <button onClick={() => handleAccept(caseItem.id)} style={{ padding: '0.5rem 1rem', background: '#28a745', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
                Accetta
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}