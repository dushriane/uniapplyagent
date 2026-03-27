import React from 'react';

export default function Universities() {
  return (
    <div>
      <h1>🎓 Universities</h1>
      <button>+ Add University</button>
      <div style={{ marginTop: 20 }}>
        <p className="card">No universities yet. Add one by clipping a URL or manually entering details.</p>
      </div>
    </div>
  );
}
