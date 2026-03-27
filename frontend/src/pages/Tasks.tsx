import React from 'react';

export default function Tasks() {
  return (
    <div>
      <h1>✅ Tasks</h1>
      <div className="grid">
        <div className="card">
          <h3>Due This Week</h3>
          <p>0 tasks</p>
        </div>
        <div className="card">
          <h3>Overdue</h3>
          <p>0 tasks</p>
        </div>
      </div>
    </div>
  );
}
