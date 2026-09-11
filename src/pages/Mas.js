import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export default function Mas() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const secciones = [
    { label: 'Pruebas médicas', sub: 'Analíticas, exploraciones y PDFs', to: '/pruebas' },
    { label: 'Medicación', sub: 'Registro diario de tomas', to: '/medicacion' },
    { label: 'Configuración', sub: 'Backup, restaurar y exportar datos', to: '/configuracion' },
  ];

  return (
    <div style={{ paddingBottom: 100 }}>
      <div style={{ background: 'var(--teal-500)', padding: '48px 20px 24px', position: 'relative' }}>
        <button onClick={() => navigate('/')} style={{ position: 'absolute', top: 16, right: 16, background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: 8, padding: '6px 12px', color: 'white', fontSize: 12, cursor: 'pointer', fontWeight: 500 }}>← Inicio</button>
        <h1 style={{ color: 'white', fontSize: 22, fontWeight: 600 }}>Más secciones</h1>
        <p style={{ color: 'rgba(255,255,255,0.75)', fontSize: 13, marginTop: 4 }}>{user?.email}</p>
      </div>

      <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {secciones.map(s => (
          <button key={s.to} onClick={() => navigate(s.to)} className="card"
            style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', width: '100%', background: 'white', textAlign: 'left', cursor: 'pointer' }}>
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--teal-500)', flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 15, fontWeight: 500, color: 'var(--slate-800)' }}>{s.label}</p>
              <p style={{ fontSize: 12, color: 'var(--slate-400)', marginTop: 2 }}>{s.sub}</p>
            </div>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--slate-300)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
          </button>
        ))}

        <div style={{ marginTop: 8, padding: '14px 16px' }} className="card">
          <p style={{ fontSize: 12, color: 'var(--slate-400)', marginBottom: 4 }}>Cuenta</p>
          <p style={{ fontSize: 14, color: 'var(--slate-700)', marginBottom: 12 }}>{user?.email}</p>
          <button onClick={logout} style={{ background: 'var(--red-50)', border: '1px solid #fecaca', color: 'var(--red-600)', borderRadius: 8, padding: '10px 16px', fontSize: 14, fontWeight: 500, cursor: 'pointer', width: '100%' }}>
            Cerrar sesión
          </button>
        </div>

        <p style={{ fontSize: 12, color: 'var(--slate-400)', textAlign: 'center', marginTop: 8 }}>
          Scleroapp · v1.2 · Datos en Firebase · PDFs locales
        </p>
      </div>
    </div>
  );
}
