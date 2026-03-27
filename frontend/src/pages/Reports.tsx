import React from 'react';

export default function Reports() {
  return (
    <div>
      <h1>📈 Reports</h1>
      <div className="grid">
        <div className="card">
          <h3>Application Health</h3>
          <p>Overall score and gaps</p>
        </div>
        <div className="card">
          <h3>Exploration Digest</h3>
          <p>Weekly summary</p>
        </div>
      </div>
    </div>
  );
}
