import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import CuestionarioForm from '../components/CuestionarioForm';

export default function Cuestionarios() {
  const navigate = useNavigate();
  const [tab, setTab] = useState('manana');

  return (
    <div style={{ paddingBottom: 90 }}>
      <div style={{ background: 'var(--teal-500)', padding: '48px 20px 0', position: 'relative' }}>
        <button onClick={() => navigate('/')} style={{ position: 'absolute', top: 16, right: 16, background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: 8, padding: '6px 12px', color: 'white', fontSize: 12, cursor: 'pointer', fontWeight: 500 }}>← Inicio</button>
        <h1 style={{ color: 'white', fontSize: 22, fontWeight: 600, marginBottom: 20 }}>Cuestionarios</h1>
        <div style={{ display: 'flex', gap: 0 }}>
          {['manana', 'noche'].map(t => (
            <button key={t} onClick={() => setTab(t)}
              style={{ flex: 1, padding: '12px', background: tab === t ? 'white' : 'transparent', color: tab === t ? 'var(--teal-500)' : 'rgba(255,255,255,0.7)', border: 'none', fontSize: 14, fontWeight: 600, cursor: 'pointer', borderRadius: tab === t ? '10px 10px 0 0' : 0, transition: 'all 0.15s' }}>
              {t === 'manana' ? 'Mañana' : 'Noche'}
            </button>
          ))}
        </div>
      </div>
      <CuestionarioForm tipo={tab} key={tab} />
    </div>
  );
}
