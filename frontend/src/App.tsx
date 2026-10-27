import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Landing } from './pages/Landing';
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { NewCase } from './pages/NewCase';
import { CaseDetail } from './pages/CaseDetail';
import { PhysicianQueue } from './pages/PhysicianQueue';
import { PhysicianCase } from './pages/PhysicianCase';
import { SafetyPage } from './pages/SafetyPage';
import { HowItWorks } from './pages/HowItWorks';
import { PrivacyPage } from './pages/PrivacyPage';
import { Layout } from './components/Layout';
import { AuthProvider, useAuth } from './hooks/useAuth';

function ProtectedRoute({ children, requiredRole }: { children: React.ReactNode; requiredRole?: string }) {
  const { user, loading } = useAuth();
  if (loading) return <div>Loading...</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (requiredRole && user.role !== requiredRole && user.role !== 'ADMIN') {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
}

function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/come-funziona" element={<HowItWorks />} />
        <Route path="/sicurezza" element={<SafetyPage />} />
        <Route path="/privacy" element={<PrivacyPage />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route
          path="/cases/new"
          element={
            <ProtectedRoute requiredRole="PATIENT">
              <NewCase />
            </ProtectedRoute>
          }
        />
        <Route
          path="/cases/:id"
          element={
            <ProtectedRoute>
              <CaseDetail />
            </ProtectedRoute>
          }
        />
        <Route
          path="/clinician/queue"
          element={
            <ProtectedRoute requiredRole="PHYSICIAN">
              <PhysicianQueue />
            </ProtectedRoute>
          }
        />
        <Route
          path="/clinician/cases/:id"
          element={
            <ProtectedRoute requiredRole="PHYSICIAN">
              <PhysicianCase />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  );
}

export default App;