import React, { useState, useEffect } from 'react';
import { collection, addDoc, query, where, orderBy, getDocs, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../hooks/useAuth';
import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { getOpcionesConfig } from '../services/opcionesExtra';

const FARMACOS_DEFAULT = [
  'Omeprazol', 'Acxxel', 'Inmunosupresor', 'Symbicort', 'Antihistamínico',
  'Paracetamol', 'Aciclovir', 'Curcumina', 'Metotrexato', 'Micofenolato',
  'Prednisona', 'Hidroxicloroquina', 'Bosentan', 'Sildenafilo', 'Nifedipino',
];

const MOMENTOS = ['Mañana', 'Mediodía', 'Tarde', 'Noche', 'Con el desayuno', 'Con la comida', 'Con la cena', 'En ayunas'];

export default function Medicacion() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [registros, setRegistros] = useState([]);
  const [loading, setLoading] = useState(true);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [farmacosExtra, setFarmacosExtra] = useState([]);
  const [farmacosOcultos, setFarmacosOcultos] = useState([]);
  const [form, setForm] = useState({ farmaco: '', farmaco_otro: '', dosis: '', momento: '', notas: '' });
  const fechaHoy = format(new Date(), 'yyyy-MM-dd');

  async function cargar() {
    try {
      const q = query(collection(db, 'medicacion'), where('uid', '==', user.uid), orderBy('timestamp', 'desc'));
      const snap = await getDocs(q);
      setRegistros(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (e) {}
    setLoading(false);
  }

  async function cargarFarmacos() {
    const config = await getOpcionesConfig(user.uid);
    setFarmacosExtra(config.extras['farmacos'] || []);
    setFarmacosOcultos(config.ocultas['farmacos'] || []);
  }

  useEffect(() => { cargar(); cargarFarmacos(); }, []);

  const farmacos = [...FARMACOS_DEFAULT, ...farmacosExtra].filter(f => !farmacosOcultos.includes(f));

  async function guardar(e) {
    e.preventDefault();
    const nombreFarmaco = form.farmaco === 'Otro' ? form.farmaco_otro : form.farmaco;
    if (!nombreFarmaco) { alert('Selecciona o escribe un fármaco'); return; }
    setGuardando(true);
    await addDoc(collection(db, 'medicacion'), {
      uid: user.uid,
      farmaco: nombreFarmaco,
      dosis: form.dosis,
      momento: form.momento,
      notas: form.notas,
      fecha: fechaHoy,
      hora: format(new Date(), 'HH:mm'),
      timestamp: serverTimestamp(),
    });
    setForm({ farmaco: '', farmaco_otro: '', dosis: '', momento: '', notas: '' });
    setMostrarForm(false);
    setGuardando(false);
    cargar();
  }

  async function eliminar(id) {
    if (!window.confirm('¿Eliminar este registro?')) return;
    await deleteDoc(doc(db, 'medicacion', id));
    cargar();
  }

  const hoy = registros.filter(r => r.fecha === fechaHoy);
  const anteriores = registros.filter(r => r.fecha !== fechaHoy);

  return (
    <div style={{ paddingBottom: 100 }}>
      <div style={{ background: 'var(--teal-500)', padding: '48px 20px 24px', position: 'relative' }}>
        <button onClick={() => navigate('/')} style={{ position: 'absolute', top: 16, right: 16, background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: 8, padding: '6px 12px', color: 'white', fontSize: 12, cursor: 'pointer', fontWeight: 500 }}>← Inicio</button>
        <h1 style={{ color: 'white', fontSize: 22, fontWeight: 600 }}>Medicación</h1>
        <p style={{ color: 'rgba(255,255,255,0.75)', fontSize: 14, marginTop: 4 }}>{hoy.length} tomas registradas hoy</p>
      </div>

      <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <button className="btn-primary" onClick={() => setMostrarForm(!mostrarForm)}>
          {mostrarForm ? 'Cancelar' : '+ Registrar toma'}
        </button>

        {mostrarForm && (
          <form onSubmit={guardar} className="card" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <p className="section-header">Nueva toma</p>
            <div>
              <label style={{ fontSize: 12, color: 'var(--slate-400)', display: 'block', marginBottom: 8 }}>Fármaco</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {farmacos.map(f => (
                  <button type="button" key={f} onClick={() => setForm({ ...form, farmaco: f })}
                    style={{ padding: '6px 12px', borderRadius: 20, fontSize: 12, fontWeight: 500, cursor: 'pointer', border: `1.5px solid ${form.farmaco === f ? 'var(--teal-500)' : 'var(--slate-200)'}`, background: form.farmaco === f ? 'var(--teal-500)' : 'white', color: form.farmaco === f ? 'white' : 'var(--slate-600)', transition: 'all 0.12s' }}>
                    {f}
                  </button>
                ))}
                <button type="button" onClick={() => setForm({ ...form, farmaco: 'Otro' })}
                  style={{ padding: '6px 12px', borderRadius: 20, fontSize: 12, fontWeight: 500, cursor: 'pointer', border: `1.5px solid ${form.farmaco === 'Otro' ? 'var(--teal-500)' : 'var(--slate-200)'}`, background: form.farmaco === 'Otro' ? 'var(--teal-500)' : 'white', color: form.farmaco === 'Otro' ? 'white' : 'var(--slate-600)' }}>
                  Otro
                </button>
              </div>
              {form.farmaco === 'Otro' && (
                <input className="input-field" value={form.farmaco_otro} onChange={e => setForm({ ...form, farmaco_otro: e.target.value })}
                  placeholder="Nombre del fármaco..." style={{ marginTop: 8 }} />
              )}
            </div>
            <div>
              <label style={{ fontSize: 12, color: 'var(--slate-400)', display: 'block', marginBottom: 5 }}>Dosis</label>
              <input className="input-field" value={form.dosis} onChange={e => setForm({ ...form, dosis: e.target.value })} placeholder="Ej: 20mg, 1 comprimido..." />
            </div>
            <div>
              <label style={{ fontSize: 12, color: 'var(--slate-400)', display: 'block', marginBottom: 8 }}>Momento</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {MOMENTOS.map(m => (
                  <button type="button" key={m} onClick={() => setForm({ ...form, momento: m })}
                    style={{ padding: '6px 12px', borderRadius: 20, fontSize: 12, fontWeight: 500, cursor: 'pointer', border: `1.5px solid ${form.momento === m ? 'var(--teal-500)' : 'var(--slate-200)'}`, background: form.momento === m ? 'var(--teal-500)' : 'white', color: form.momento === m ? 'white' : 'var(--slate-600)', transition: 'all 0.12s' }}>
                    {m}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label style={{ fontSize: 12, color: 'var(--slate-400)', display: 'block', marginBottom: 5 }}>Notas</label>
              <textarea className="input-field" value={form.notas} onChange={e => setForm({ ...form, notas: e.target.value })} placeholder="Observaciones..." rows={2} style={{ resize: 'none' }} />
            </div>
            <button className="btn-primary" type="submit" disabled={guardando || !form.farmaco}>
              {guardando ? 'Guardando...' : 'Guardar toma'}
            </button>
          </form>
        )}

        {loading && <p style={{ color: 'var(--slate-400)', textAlign: 'center', padding: 20 }}>Cargando...</p>}

        {hoy.length > 0 && (
          <>
            <p className="section-header">Hoy · {fechaHoy}</p>
            {hoy.map(r => (
              <div key={r.id} className="card" style={{ padding: '13px 16px', display: 'flex', alignItems: 'center', gap: 12, borderLeft: '3px solid var(--teal-500)' }}>
                <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--teal-50)', border: '1px solid var(--teal-100)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--teal-500)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--slate-800)' }}>{r.farmaco}{r.dosis ? ` · ${r.dosis}` : ''}</p>
                  <p style={{ fontSize: 12, color: 'var(--slate-400)', marginTop: 2 }}>{r.hora}{r.momento ? ` · ${r.momento}` : ''}</p>
                  {r.notas && <p style={{ fontSize: 11, color: 'var(--slate-500)', marginTop: 2, fontStyle: 'italic' }}>{r.notas}</p>}
                </div>
                <button onClick={() => eliminar(r.id)} style={{ background: 'none', border: 'none', color: 'var(--slate-300)', cursor: 'pointer' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/></svg>
                </button>
              </div>
            ))}
          </>
        )}

        {anteriores.length > 0 && (
          <>
            <p className="section-header" style={{ marginTop: 8 }}>Historial</p>
            {anteriores.slice(0, 30).map(r => (
              <div key={r.id} className="card" style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12, opacity: 0.85 }}>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--slate-800)' }}>{r.farmaco}{r.dosis ? ` · ${r.dosis}` : ''}</p>
                  <p style={{ fontSize: 12, color: 'var(--slate-400)', marginTop: 2 }}>{r.fecha} · {r.hora}{r.momento ? ` · ${r.momento}` : ''}</p>
                </div>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
