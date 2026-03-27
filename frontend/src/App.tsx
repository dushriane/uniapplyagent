import React, { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import Setup from './pages/Setup';
import Universities from './pages/Universities';
import Essays from './pages/Essays';
import Tasks from './pages/Tasks';
import Interests from './pages/Interests';
import Reports from './pages/Reports';
import Layout from './components/Layout';
import './styles/App.css';

export default function App() {
  const [setupComplete, setSetupComplete] = useState<boolean>(() => {
    return localStorage.getItem('uniapply-setup') === 'true';
  });

  if (!setupComplete) {
    return <Setup onComplete={() => {
      setSetupComplete(true);
      localStorage.setItem('uniapply-setup', 'true');
    }} />;
  }

  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/universities" element={<Universities />} />
          <Route path="/essays" element={<Essays />} />
          <Route path="/tasks" element={<Tasks />} />
          <Route path="/interests" element={<Interests />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}
