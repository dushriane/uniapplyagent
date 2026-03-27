import React from 'react';

export default function Dashboard() {
  return (
    <div>
      <h1>📊 Dashboard</h1>
      <div className="grid">
        <div className="card">
          <h2>Top Schools</h2>
          <p>Your highest-fit universities</p>
        </div>
        <div className="card">
          <h2>Essays Due</h2>
          <p>Upcoming deadlines</p>
        </div>
        <div className="card">
          <h2>Overall Health</h2>
          <p>Application progress score</p>
        </div>
      </div>
    </div>
  );
}
