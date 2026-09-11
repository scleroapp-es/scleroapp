import React, { useState, useEffect } from 'react';
import { collection, addDoc, query, where, orderBy, getDocs, deleteDoc, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../hooks/useAuth';
import { format, differenceInDays, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { HospitalSelector } from '../components/HospitalSelector';
import { useNavigate } from 'react-router-dom';

const ESPECIALIDADES = ['Reumatología', 'Cardiología', 'Neumología', 'Dermatología', 'Nefrología', 'Digestivo', 'Neurología', 'Medicina Interna', 'Fisioterapia', 'Otra'];
const FORM_VACIO = { doctor: '', especialidad: '', lugar: '', fecha: '', hora: '', pruebas_solicitadas: '', detalles: '' };

function diasRestantes(fecha) {
  const diff = differenceInDays(parseISO(fecha), new Date());
  if (diff === 0) return 'Hoy';
  if (diff === 1) return 'Mañana';
  return `En ${diff} días`;
}

// ── Definido FUERA del componente principal para evitar pérdida de foco ──
function FormCita({ form, setForm, onSubmit, onCancel, guardando, editando }) {
  return (
    <form onSubmit={onSubmit} className="card" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <p className="section-header">{editando ? 'Editar cita' : 'Nueva cita'}</p>
      <div>
        <label style={{ fontSize: 12, color: 'var(--slate-400)', display: 'block', marginBottom: 5 }}>Doctor / Doctora</label>
        <input className="input-field" value={form.doctor}
          onChange={e => setForm(f => ({ ...f, doctor: e.target.value }))}
          placeholder="Dra. Martínez" required />
      </div>
      <div>
        <label style={{ fontSize: 12, color: 'var(--slate-400)', display: 'block', marginBottom: 5 }}>Especialidad</label>
        <select className="input-field" value={form.especialidad}
          onChange={e => setForm(f => ({ ...f, especialidad: e.target.value }))}
          required style={{ appearance: 'none' }}>
          <option value="">Seleccionar...</option>
          {ESPECIALIDADES.map(e => <option key={e} value={e}>{e}</option>)}
        </select>
      </div>
      <div>
        <label style={{ fontSize: 12, color: 'var(--slate-400)', display: 'block', marginBottom: 5 }}>Centro / Hospital</label>
        <HospitalSelector value={form.lugar} onChange={v => setForm(f => ({ ...f, lugar: v }))} />
      </div>
      <div style={{ display: 'flex', gap: 10 }}>
        <div style={{ flex: 1 }}>
          <label style={{ fontSize: 12, color: 'var(--slate-400)', display: 'block', marginBottom: 5 }}>Fecha</label>
          <input className="input-field" type="date" value={form.fecha}
            onChange={e => setForm(f => ({ ...f, fecha: e.target.value }))} required />
        </div>
        <div style={{ width: 120 }}>
          <label style={{ fontSize: 12, color: 'var(--slate-400)', display: 'block', marginBottom: 5 }}>Hora</label>
          <input className="input-field" type="time" value={form.hora}
            onChange={e => setForm(f => ({ ...f, hora: e.target.value }))} />
        </div>
      </div>
      <div>
        <label style={{ fontSize: 12, color: 'var(--slate-400)', display: 'block', marginBottom: 5 }}>Pruebas solicitadas</label>
        <input className="input-field" value={form.pruebas_solicitadas}
          onChange={e => setForm(f => ({ ...f, pruebas_solicitadas: e.target.value }))}
          placeholder="Analítica completa, ECG..." />
      </div>
      <div>
        <label style={{ fontSize: 12, color: 'var(--slate-400)', display: 'block', marginBottom: 5 }}>Detalles / Notas</label>
        <textarea className="input-field" value={form.detalles}
          onChange={e => setForm(f => ({ ...f, detalles: e.target.value }))}
          placeholder="Motivo de la consulta, lo que quiero preguntar..." rows={3} style={{ resize: 'none' }} />
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button className="btn-primary" type="submit" disabled={guardando} style={{ flex: 1 }}>
          {guardando ? 'Guardando...' : editando ? 'Guardar cambios' : 'Guardar cita'}
        </button>
        <button type="button" onClick={onCancel}
          style={{ padding: '12px 16px', borderRadius: 8, fontSize: 14, background: 'var(--slate-100)', color: 'var(--slate-600)', border: 'none', cursor: 'pointer' }}>
          Cancelar
        </button>
      </div>
    </form>
  );
}

function CitaCard({ cita, onEditar, onEliminar }) {
  const navigate = useNavigate();
  const hoy = format(new Date(), 'yyyy-MM-dd');
  const pasada = cita.fecha < hoy;
  return (
    <div className="card" style={{ padding: '14px 16px', borderLeft: `3px solid ${pasada ? 'var(--slate-200)' : 'var(--teal-500)'}`, opacity: pasada ? 0.85 : 1 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ flex: 1 }}>
          <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--slate-800)' }}>{cita.doctor}</p>
          <p style={{ fontSize: 13, color: 'var(--teal-600)', fontWeight: 500, marginTop: 2 }}>{cita.especialidad}</p>
          <p style={{ fontSize: 12, color: 'var(--slate-400)', marginTop: 4 }}>
            {cita.fecha}{cita.hora ? ` · ${cita.hora}` : ''}{cita.lugar ? ` · ${cita.lugar}` : ''}
          </p>
          {!pasada && (
            <span style={{ display: 'inline-block', marginTop: 6, fontSize: 11, fontWeight: 600, padding: '3px 9px', borderRadius: 10, background: 'var(--teal-50)', color: 'var(--teal-700)', border: '1px solid var(--teal-100)' }}>
              {diasRestantes(cita.fecha)}
            </span>
          )}
          {cita.pruebas_solicitadas && (
            <p style={{ fontSize: 12, color: 'var(--slate-600)', marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--slate-100)' }}>
              <strong>Pruebas:</strong> {cita.pruebas_solicitadas}
            </p>
          )}
          {cita.detalles && (
            <p style={{ fontSize: 12, color: 'var(--slate-500)', marginTop: 4, fontStyle: 'italic' }}>{cita.detalles}</p>
          )}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, paddingLeft: 10, flexShrink: 0 }}>
          <button onClick={() => onEditar(cita)}
            style={{ background: 'var(--teal-50)', border: '1px solid var(--teal-100)', borderRadius: 8, padding: '5px 10px', fontSize: 11, fontWeight: 500, color: 'var(--teal-700)', cursor: 'pointer' }}>
            Editar
          </button>
          <button onClick={() => onEliminar(cita.id)}
            style={{ background: 'none', border: 'none', color: 'var(--slate-300)', cursor: 'pointer', textAlign: 'center' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/>
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Citas() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [citas, setCitas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [editando, setEditando] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [verPasadas, setVerPasadas] = useState(false);
  const [form, setForm] = useState(FORM_VACIO);

  async function cargar() {
    try {
      const q = query(collection(db, 'citas'), where('uid', '==', user.uid), orderBy('fecha', 'asc'));
      const snap = await getDocs(q);
      setCitas(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (e) {}
    setLoading(false);
  }

  useEffect(() => { cargar(); }, []);

  function abrirNueva() {
    setEditando(null);
    setForm(FORM_VACIO);
    setMostrarForm(true);
  }

  function abrirEditar(cita) {
    setEditando(cita.id);
    setForm({
      doctor: cita.doctor || '',
      especialidad: cita.especialidad || '',
      lugar: cita.lugar || '',
      fecha: cita.fecha || '',
      hora: cita.hora || '',
      pruebas_solicitadas: cita.pruebas_solicitadas || '',
      detalles: cita.detalles || '',
    });
    setMostrarForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function cancelar() {
    setMostrarForm(false);
    setEditando(null);
    setForm(FORM_VACIO);
  }

  async function guardar(e) {
    e.preventDefault();
    setGuardando(true);
    try {
      if (editando) {
        await updateDoc(doc(db, 'citas', editando), { ...form });
      } else {
        await addDoc(collection(db, 'citas'), { uid: user.uid, ...form, timestamp: serverTimestamp() });
      }
      cancelar();
      cargar();
    } catch (e) { alert('Error: ' + e.message); }
    setGuardando(false);
  }

  async function eliminar(id) {
    if (!window.confirm('¿Eliminar esta cita?')) return;
    await deleteDoc(doc(db, 'citas', id));
    cargar();
  }

  const hoy = format(new Date(), 'yyyy-MM-dd');
  const proximas = citas.filter(c => c.fecha >= hoy).sort((a, b) => a.fecha.localeCompare(b.fecha));
  const pasadas = citas.filter(c => c.fecha < hoy).sort((a, b) => b.fecha.localeCompare(a.fecha));
  const siguiente = proximas[0] || null;

  return (
    <div style={{ paddingBottom: 100 }}>
      <div style={{ background: 'var(--teal-500)', padding: '48px 20px 24px', position: 'relative' }}>
        <button onClick={() => navigate('/')} style={{ position: 'absolute', top: 16, right: 16, background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: 8, padding: '6px 12px', color: 'white', fontSize: 12, cursor: 'pointer', fontWeight: 500 }}>← Inicio</button>
        <h1 style={{ color: 'white', fontSize: 22, fontWeight: 600 }}>Citas médicas</h1>
        <div style={{ display: 'flex', gap: 12, marginTop: 12 }}>
          <div style={{ background: 'rgba(255,255,255,0.2)', borderRadius: 10, padding: '8px 14px', textAlign: 'center' }}>
            <p style={{ fontSize: 22, fontWeight: 700, color: 'white', lineHeight: 1 }}>{proximas.length}</p>
            <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.8)', marginTop: 2 }}>Próximas</p>
          </div>
          <div style={{ background: 'rgba(255,255,255,0.15)', borderRadius: 10, padding: '8px 14px', textAlign: 'center' }}>
            <p style={{ fontSize: 22, fontWeight: 700, color: 'white', lineHeight: 1 }}>{pasadas.length}</p>
            <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.8)', marginTop: 2 }}>Pasadas</p>
          </div>
          {siguiente && (
            <div style={{ flex: 1, background: 'rgba(255,255,255,0.2)', borderRadius: 10, padding: '8px 14px' }}>
              <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.8)', marginBottom: 2 }}>Próxima cita</p>
              <p style={{ fontSize: 13, fontWeight: 600, color: 'white' }}>{siguiente.doctor}</p>
              <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.85)' }}>
                {siguiente.fecha}{siguiente.hora ? ` · ${siguiente.hora}` : ''} · {diasRestantes(siguiente.fecha)}
              </p>
            </div>
          )}
        </div>
      </div>

      <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {mostrarForm
          ? <FormCita form={form} setForm={setForm} onSubmit={guardar} onCancel={cancelar} guardando={guardando} editando={editando} />
          : <button className="btn-primary" onClick={abrirNueva}>+ Nueva cita</button>
        }

        {loading && <p style={{ color: 'var(--slate-400)', textAlign: 'center', padding: 20 }}>Cargando...</p>}

        {proximas.length > 0 && (
          <>
            <p className="section-header">Próximas ({proximas.length})</p>
            {proximas.map(c => <CitaCard key={c.id} cita={c} onEditar={abrirEditar} onEliminar={eliminar} />)}
          </>
        )}

        {pasadas.length > 0 && (
          <>
            <button onClick={() => setVerPasadas(!verPasadas)}
              style={{ background: 'none', border: 'none', textAlign: 'left', padding: '4px 0', fontSize: 13, color: 'var(--teal-500)', cursor: 'pointer', fontWeight: 500 }}>
              {verPasadas ? '▾' : '▸'} Citas pasadas ({pasadas.length})
            </button>
            {verPasadas && pasadas.map(c => <CitaCard key={c.id} cita={c} onEditar={abrirEditar} onEliminar={eliminar} />)}
          </>
        )}

        {!loading && citas.length === 0 && (
          <div style={{ textAlign: 'center', padding: '32px 20px', color: 'var(--slate-400)' }}>
            <p style={{ fontSize: 15 }}>Sin citas registradas</p>
          </div>
        )}
      </div>
    </div>
  );
}
