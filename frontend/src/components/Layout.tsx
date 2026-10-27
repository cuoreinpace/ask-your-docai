import React from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export function Layout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <header style={{ padding: '1rem 2rem', borderBottom: '1px solid #e5e5e5', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Link to="/" style={{ textDecoration: 'none', color: 'inherit', fontWeight: 'bold', fontSize: '1.25rem' }}>
          Ask Your DocAI
        </Link>
        <nav style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <Link to="/come-funziona" style={{ textDecoration: 'none', color: 'inherit' }}>Come funziona</Link>
          <Link to="/sicurezza" style={{ textDecoration: 'none', color: 'inherit' }}>Sicurezza</Link>
          {user ? (
            <>
              <span style={{ fontSize: '0.875rem', color: '#666' }}>{user.email}</span>
              {user.role === 'PHYSICIAN' && (
                <Link to="/clinician/queue" style={{ textDecoration: 'none', color: 'inherit' }}>Coda</Link>
              )}
              <button onClick={handleLogout} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#666' }}>
                Esci
              </button>
            </>
          ) : (
            <>
              <Link to="/login" style={{ textDecoration: 'none', color: 'inherit' }}>Accedi</Link>
              <Link to="/register" style={{ textDecoration: 'none', color: 'inherit' }}>Registrati</Link>
            </>
          )}
        </nav>
      </header>
      <main style={{ flex: 1, padding: '2rem', maxWidth: '1200px', margin: '0 auto', width: '100%' }}>
        {children}
      </main>
      <footer style={{ padding: '1rem 2rem', borderTop: '1px solid #e5e5e5', textAlign: 'center', fontSize: '0.875rem', color: '#666' }}>
        Ask Your DocAI — Piattaforma di revisione clinica documentale
      </footer>
    </div>
  );
}