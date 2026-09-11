import React, { useState, useEffect } from 'react';
import { collection, addDoc, query, where, orderBy, getDocs, serverTimestamp, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../hooks/useAuth';
import { HospitalSelector } from '../components/HospitalSelector';
import PageHeader from '../components/PageHeader';
import { format } from 'date-fns';

function clasificar(s, d) {
  if (s < 90 || d < 60) return { label: 'Baja', color: 'var(--teal-300)' };
  if (s < 120 && d < 80) return { label: 'Normal', color: 'var(--teal-500)' };
  if (s < 130 && d < 80) return { label: 'Elevada', color: '#f59e0b' };
  if (s < 140 || (d >= 80 && d < 90)) return { label: 'Alta I', color: '#f97316' };
  return { label: 'Alta II', color: '#dc2626' };
}

function LeyendaRangos() {
  const rangos = [
    { label: 'Baja', rango: '< 90 / 60 mmHg', color: 'var(--teal-300)', desc: 'Hipotensión' },
    { label: 'Normal', rango: '< 120 / 80 mmHg', color: 'var(--teal-500)', desc: 'Óptima' },
    { label: 'Elevada', rango: '120–129 / < 80 mmHg', color: '#f59e0b', desc: 'Prehipertensión' },
    { label: 'Alta I', rango: '130–139 / 80–89 mmHg', color: '#f97316', desc: 'Hipertensión grado 1' },
    { label: 'Alta II', rango: '≥ 140 / ≥ 90 mmHg', color: '#dc2626', desc: 'Hipertensión grado 2' },
  ];
  return (
    <div style={{ background: 'white', borderRadius: 14, border: '1px solid var(--teal-100)', padding: '14px 16px' }}>
      <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--teal-700)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Guía de rangos tensionales</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
        {rangos.map(r => (
          <div key={r.label} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: r.color, flexShrink: 0 }} />
            <div style={{ width: 52, flexShrink: 0 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: r.color }}>{r.label}</span>
            </div>
            <div style={{ flex: 1 }}>
              <span style={{ fontSize: 11, color: 'var(--slate-500)' }}>{r.rango}</span>
              <span style={{ fontSize: 11, color: 'var(--slate-400)', marginLeft: 6 }}>· {r.desc}</span>
            </div>
          </div>
        ))}
      </div>
      <p style={{ fontSize: 10, color: 'var(--slate-400)', marginTop: 10, lineHeight: 1.5 }}>
        Sistólica / Diastólica en mmHg. Basado en guías ESC/ESH 2023.
      </p>
    </div>
  );
}

const MOMENTOS = ['Mañana', 'Tarde', 'Noche'];
const FORM_VACIO = { sistolica: '', diastolica: '', frecuencia_cardiaca: '', momento: '', lugar: '', notas: '' };

export default function Tension() {
  const { user } = useAuth();
  const [registros, setRegistros] = useState([]);
  const [loading, setLoading] = useState(true);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [form, setForm] = useState(FORM_VACIO);

  async function cargarRegistros() {
    try {
      const q = query(collection(db, 'tension'), where('uid', '==', user.uid), orderBy('timestamp', 'desc'));
      const snap = await getDocs(q);
      setRegistros(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (e) {}
    setLoading(false);
  }

  useEffect(() => { cargarRegistros(); }, []);

  async function guardar(e) {
    e.preventDefault();
    setGuardando(true);
    await addDoc(collection(db, 'tension'), {
      uid: user.uid,
      sistolica: parseInt(form.sistolica),
      diastolica: parseInt(form.diastolica),
      frecuencia_cardiaca: form.frecuencia_cardiaca ? parseInt(form.frecuencia_cardiaca) : null,
      momento: form.momento,
      lugar: form.lugar,
      notas: form.notas,
      timestamp: serverTimestamp(),
      fecha: format(new Date(), 'yyyy-MM-dd'),
      hora: format(new Date(), 'HH:mm'),
    });
    setForm(FORM_VACIO);
    setMostrarForm(false);
    setGuardando(false);
    cargarRegistros();
  }

  async function eliminar(id) {
    if (!window.confirm('¿Eliminar este registro?')) return;
    await deleteDoc(doc(db, 'tension', id));
    cargarRegistros();
  }

  return (
    <div style={{ paddingBottom: 100 }}>
      <PageHeader title="Tensión arterial" subtitle={`${registros.length} registros totales`} />

      <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <LeyendaRangos />

        <button className="btn-primary" onClick={() => setMostrarForm(!mostrarForm)}>
          {mostrarForm ? 'Cancelar' : '+ Registrar nueva toma'}
        </button>

        {mostrarForm && (
          <form onSubmit={guardar} className="card" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <p className="section-header">Nueva toma</p>
            <div style={{ display: 'flex', gap: 10 }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 12, color: 'var(--slate-400)', display: 'block', marginBottom: 5 }}>Sistólica</label>
                <input className="input-field" type="number" value={form.sistolica}
                  onChange={e => setForm(f => ({ ...f, sistolica: e.target.value }))}
                  placeholder="120" required min="60" max="250" />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 12, color: 'var(--slate-400)', display: 'block', marginBottom: 5 }}>Diastólica</label>
                <input className="input-field" type="number" value={form.diastolica}
                  onChange={e => setForm(f => ({ ...f, diastolica: e.target.value }))}
                  placeholder="80" required min="40" max="150" />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 12, color: 'var(--slate-400)', display: 'block', marginBottom: 5 }}>F. Card.</label>
                <input className="input-field" type="number" value={form.frecuencia_cardiaca}
                  onChange={e => setForm(f => ({ ...f, frecuencia_cardiaca: e.target.value }))}
                  placeholder="70" min="40" max="200" />
              </div>
            </div>

            <div>
              <label style={{ fontSize: 12, color: 'var(--slate-400)', display: 'block', marginBottom: 8 }}>Momento del día</label>
              <div style={{ display: 'flex', gap: 8 }}>
                {MOMENTOS.map(m => (
                  <button type="button" key={m}
                    onClick={() => setForm(f => ({ ...f, momento: m }))}
                    style={{ flex: 1, padding: '10px 4px', borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: 'pointer', transition: 'all 0.15s', border: `1.5px solid ${form.momento === m ? 'var(--teal-500)' : 'var(--slate-200)'}`, background: form.momento === m ? 'var(--teal-500)' : 'white', color: form.momento === m ? 'white' : 'var(--slate-600)' }}>
                    {m}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label style={{ fontSize: 12, color: 'var(--slate-400)', display: 'block', marginBottom: 5 }}>Centro / Hospital</label>
              <HospitalSelector value={form.lugar} onChange={v => setForm(f => ({ ...f, lugar: v }))} />
            </div>

            <div>
              <label style={{ fontSize: 12, color: 'var(--slate-400)', display: 'block', marginBottom: 5 }}>Notas (opcional)</label>
              <textarea className="input-field" value={form.notas}
                onChange={e => setForm(f => ({ ...f, notas: e.target.value }))}
                placeholder="Ej: después de ejercicio, en reposo..." rows={2} style={{ resize: 'none' }} />
            </div>
            <button className="btn-primary" type="submit" disabled={guardando}>
              {guardando ? 'Guardando...' : 'Guardar toma'}
            </button>
          </form>
        )}

        <p className="section-header">Historial</p>
        {loading && <p style={{ color: 'var(--slate-400)', fontSize: 14, textAlign: 'center', padding: 20 }}>Cargando...</p>}
        {!loading && registros.length === 0 && (
          <div style={{ textAlign: 'center', padding: '32px 20px', color: 'var(--slate-400)' }}>
            <p style={{ fontSize: 15 }}>Sin registros todavía</p>
          </div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {registros.map(r => {
            const cls = clasificar(r.sistolica, r.diastolica);
            return (
              <div key={r.id} className="card" style={{ padding: '13px 16px', display: 'flex', alignItems: 'center', gap: 12, borderLeft: `3px solid ${cls.color}` }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                    <span style={{ fontSize: 18, fontWeight: 600, color: 'var(--slate-800)' }}>{r.sistolica}/{r.diastolica}</span>
                    <span style={{ fontSize: 12, color: 'var(--slate-400)' }}>mmHg</span>
                    {r.frecuencia_cardiaca && <span style={{ fontSize: 12, color: 'var(--slate-400)' }}>· FC {r.frecuencia_cardiaca}</span>}
                  </div>
                  <p style={{ fontSize: 12, color: 'var(--slate-400)', marginTop: 3 }}>
                    {r.fecha} · {r.hora}{r.momento ? ` · ${r.momento}` : ''}{r.lugar ? ` · ${r.lugar}` : ''}
                  </p>
                  {r.notas && <p style={{ fontSize: 12, color: 'var(--slate-600)', marginTop: 4, fontStyle: 'italic' }}>{r.notas}</p>}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
                  <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 9px', borderRadius: 10, background: cls.color + '20', color: cls.color, border: `1px solid ${cls.color}40` }}>{cls.label}</span>
                  <button onClick={() => eliminar(r.id)} style={{ background: 'none', border: 'none', color: 'var(--slate-300)', cursor: 'pointer', padding: 4 }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/></svg>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
