import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import PlayerPage from './pages/PlayerPage';
import AnalyticsPage from './pages/AnalyticsPage';

function AppRouter() {
  const { user, loading } = useAuth();
  const [page, setPage]         = useState('dashboard'); // dashboard | player | analytics
  const [activeVideo, setActiveVideo]       = useState(null);
  const [activeMetadata, setActiveMetadata] = useState(null);
  const [activeCompliance, setActiveCompliance] = useState(null);

  if (loading) return <BootScreen />;
  if (!user)   return <LoginPage />;

  if (page === 'analytics') {
    return (
      <AnalyticsPage
        video={activeVideo}
        metadata={activeMetadata}
        compliance={activeCompliance}
        onBack={() => setPage('player')}
      />
    );
  }

  if (page === 'player' && activeVideo) {
    return (
      <PlayerPage
        video={activeVideo}
        onBack={() => setPage('dashboard')}
        onViewAnalytics={(video, metadata, compliance) => {
          setActiveVideo(video);
          setActiveMetadata(metadata);
          setActiveCompliance(compliance);
          setPage('analytics');
        }}
      />
    );
  }

  return (
    <DashboardPage
      onOpenVideo={(video) => {
        setActiveVideo(video);
        setPage('player');
      }}
    />
  );
}

function BootScreen() {
  return (
    <div style={{
      height: '100vh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      background: '#fff', gap: 16,
      fontFamily: "'Space Grotesk', sans-serif",
    }}>
      <div style={{
        width: 32, height: 32,
        border: '2px solid #ede9ff',
        borderTopColor: '#7c3aed',
        borderRadius: '50%',
        animation: 'spin 0.8s linear infinite',
      }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <span style={{ fontSize: 12, color: '#9b8ec4', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
        Loading KERV
      </span>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppRouter />
    </AuthProvider>
  );
}
