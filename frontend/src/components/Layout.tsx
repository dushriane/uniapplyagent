import React from 'react';
import { Link } from 'react-router-dom';
import '../styles/Layout.css';

interface LayoutProps {
  children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  return (
    <div className="layout">
      <nav className="sidebar">
        <div className="logo">
          <h1>🎓 UniApply</h1>
        </div>
        <ul className="nav-links">
          <li><Link to="/">Dashboard</Link></li>
          <li><Link to="/universities">Universities</Link></li>
          <li><Link to="/essays">Essays</Link></li>
          <li><Link to="/tasks">Tasks</Link></li>
          <li><Link to="/interests">Interests</Link></li>
          <li><Link to="/reports">Reports</Link></li>
        </ul>
      </nav>
      <main className="content">
        {children}
      </main>
    </div>
  );
}
