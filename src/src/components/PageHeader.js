import React from 'react';
import { useNavigate } from 'react-router-dom';

export default function PageHeader({ title, subtitle }) {
  const navigate = useNavigate();
  return (
    <div style={{ background: 'var(--teal-500)', padding: '48px 20px 24px', position: 'relative' }}>
      <button onClick={() => navigate('/')}
        style={{ position: 'absolute', top: 16, right: 16, background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: 8, padding: '6px 12px', color: 'white', fontSize: 12, cursor: 'pointer', fontWeight: 500 }}>
        ← Inicio
      </button>
      <h1 style={{ color: 'white', fontSize: 22, fontWeight: 600 }}>{title}</h1>
      {subtitle && <p style={{ color: 'rgba(255,255,255,0.75)', fontSize: 14, marginTop: 4 }}>{subtitle}</p>}
    </div>
  );
}
