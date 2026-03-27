import React, { useState } from 'react';
import { apiClient } from '../api/client';

interface SetupProps {
  onComplete: () => void;
}

export default function Setup({ onComplete }: SetupProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSetup = async () => {
    setLoading(true);
    setError(null);
    try {
      await apiClient.setup();
      onComplete();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="card" style={{ maxWidth: 400 }}>
        <h1>🎓 UniApply</h1>
        <p>Welcome! This is your first time using UniApply. Let's get set up.</p>
        <p style={{ fontSize: 14, color: '#666' }}>
          This will create all necessary Notion databases and prompt for your preferences.
        </p>
        {error && <div className="alert error">{error}</div>}
        <button onClick={handleSetup} disabled={loading} style={{ width: '100%', marginTop: 20 }}>
          {loading ? 'Setting up...' : 'Start Setup'}
        </button>
      </div>
    </div>
  );
}
