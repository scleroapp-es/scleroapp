import React, { useState, useEffect } from 'react';
import { collection, addDoc, query, where, getDocs, deleteDoc, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { usePerfil } from '../hooks/usePerfil';
import { getOpcionesConfig } from '../services/opcionesExtra';
import { format } from 'date-fns';
import { exportarExcelTomas } from '../services/reporteMedicacion';
import { es } from 'date-fns/locale';

const FARMACOS_DEFAULT = [
  'Omeprazol', 'Acxxel', 'Inmunosupresor', 'Symbicort', 'Antihistamínico',
  'Paracetamol', 'Aciclovir', 'Curcumina', 'Metotrexato', 'Micofenolato',
  'Prednisona', 'Hidroxicloroquina', 'Bosentan', 'Sildenafilo', 'Nifedipino',
];

const MOMENTOS = [
  'Mañana', 'Mediodía', 'Tarde', 'Noche',
  'Con el desayuno', 'Con la comida', 'Con la cena',
  '30 min antes del desayuno', '30 min antes de la comida', '30 min antes de la cena',
  'En ayunas', 'Al acostarse',
];

const DIAS_SEMANA = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
const DIAS_NOMBRES = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

const FORM_VACIO = {
  farmaco: '', farmaco_otro: '', dosis: '', momentos: [], dias: [0,1,2,3,4,5,6], notas: '', activo: true
};

// Get today's day index (0=Mon ... 6=Sun)
function getDiaHoy() {
  const d = new Date().getDay(); // 0=Sun
  return d === 0 ? 6 : d - 1;   // convert to Mon=0
}

// Group treatments by moment for today
function agruparPorMomento(tratamientos) {
  const diaHoy = getDiaHoy();
  const activos = tratamientos.filter(t => t.activo && t.dias?.includes(diaHoy));
  const grupos = {};
  for (const t of activos) {
    for (const m of (t.momentos || [])) {
      if (!grupos[m]) grupos[m] = [];
      grupos[m].push(t);
    }
  }
  return grupos;
}

function ChipBtn({ label, selected, onClick }) {
  return (
    <button type="button" onClick={onClick}
      style={{ padding: '6px 12px', borderRadius: 20, fontSize: 12, fontWeight: 500, cursor: 'pointer', border: `1.5px solid ${selected ? 'var(--teal-500)' : 'var(--slate-200)'}`, background: selected ? 'var(--teal-500)' : 'white', color: selected ? 'white' : 'var(--slate-600)', transition: 'all 0.12s' }}>
      {label}
    </button>
  );
}

function DiaBtn({ label, selected, onClick }) {
  return (
    <button type="button" onClick={onClick}
      style={{ width: 36, height: 36, borderRadius: '50%', fontSize: 12, fontWeight: 600, cursor: 'pointer', border: `1.5px solid ${selected ? 'var(--teal-500)' : 'var(--slate-200)'}`, background: selected ? 'var(--teal-500)' : 'white', color: selected ? 'white' : 'var(--slate-600)', transition: 'all 0.12s', flexShrink: 0 }}>
      {label}
    </button>
  );
}

function TratamientoForm({ form, setForm, farmacos, onSubmit, onCancel, guardando, editando }) {
  function toggleMomento(m) {
    setForm(f => ({
      ...f, momentos: f.momentos.includes(m) ? f.momentos.filter(x => x !== m) : [...f.momentos, m]
    }));
  }
  function toggleDia(idx) {
    setForm(f => ({
      ...f, dias: f.dias.includes(idx) ? f.dias.filter(x => x !== idx) : [...f.dias, idx]
    }));
  }
  function toggleTodosDias() {
    setForm(f => ({ ...f, dias: f.dias.length === 7 ? [] : [0,1,2,3,4,5,6] }));
  }
  function toggleLaborables() {
    setForm(f => ({ ...f, dias: [0,1,2,3,4] }));
  }

  return (
    <form onSubmit={onSubmit} className="card" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
      <p className="section-header">{editando ? 'Editar tratamiento' : 'Nuevo tratamiento'}</p>

      {/* Fármaco */}
      <div>
        <label style={{ fontSize: 12, color: 'var(--slate-400)', display: 'block', marginBottom: 8 }}>Medicamento</label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {farmacos.map(f => (
            <ChipBtn key={f} label={f} selected={form.farmaco === f} onClick={() => setForm(prev => ({ ...prev, farmaco: f, farmaco_otro: '' }))} />
          ))}
          <ChipBtn label="Otro" selected={form.farmaco === 'Otro'} onClick={() => setForm(prev => ({ ...prev, farmaco: 'Otro' }))} />
        </div>
        {form.farmaco === 'Otro' && (
          <input className="input-field" value={form.farmaco_otro}
            onChange={e => setForm(f => ({ ...f, farmaco_otro: e.target.value }))}
            placeholder="Nombre del medicamento..." style={{ marginTop: 8 }} />
        )}
      </div>

      {/* Dosis */}
      <div>
        <label style={{ fontSize: 12, color: 'var(--slate-400)', display: 'block', marginBottom: 5 }}>Dosis</label>
        <input className="input-field" value={form.dosis}
          onChange={e => setForm(f => ({ ...f, dosis: e.target.value }))}
          placeholder="Ej: 1 comprimido, 20mg, 2 inhalaciones..." />
      </div>

      {/* Momentos del día */}
      <div>
        <label style={{ fontSize: 12, color: 'var(--slate-400)', display: 'block', marginBottom: 8 }}>Cuándo tomarlo</label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {MOMENTOS.map(m => (
            <ChipBtn key={m} label={m} selected={form.momentos.includes(m)} onClick={() => toggleMomento(m)} />
          ))}
        </div>
      </div>

      {/* Días de la semana */}
      <div>
        <label style={{ fontSize: 12, color: 'var(--slate-400)', display: 'block', marginBottom: 8 }}>Días de la semana</label>
        <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
          {DIAS_SEMANA.map((d, idx) => (
            <DiaBtn key={idx} label={d} selected={form.dias.includes(idx)} onClick={() => toggleDia(idx)} />
          ))}
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button type="button" onClick={toggleTodosDias}
            style={{ fontSize: 11, padding: '5px 10px', borderRadius: 8, border: '1px solid var(--teal-200)', background: form.dias.length === 7 ? 'var(--teal-50)' : 'white', color: 'var(--teal-700)', cursor: 'pointer' }}>
            {form.dias.length === 7 ? '✓ Todos los días' : 'Todos los días'}
          </button>
          <button type="button" onClick={toggleLaborables}
            style={{ fontSize: 11, padding: '5px 10px', borderRadius: 8, border: '1px solid var(--teal-200)', background: JSON.stringify(form.dias.slice().sort()) === JSON.stringify([0,1,2,3,4]) ? 'var(--teal-50)' : 'white', color: 'var(--teal-700)', cursor: 'pointer' }}>
            Solo laborables
          </button>
        </div>
      </div>

      {/* Notas */}
      <div>
        <label style={{ fontSize: 12, color: 'var(--slate-400)', display: 'block', marginBottom: 5 }}>Notas (opcional)</label>
        <textarea className="input-field" value={form.notas}
          onChange={e => setForm(f => ({ ...f, notas: e.target.value }))}
          placeholder="Instrucciones especiales, observaciones..." rows={2} style={{ resize: 'none' }} />
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        <button className="btn-primary" type="submit" disabled={guardando || !form.farmaco || form.momentos.length === 0 || form.dias.length === 0} style={{ flex: 1 }}>
          {guardando ? 'Guardando...' : editando ? 'Guardar cambios' : 'Añadir tratamiento'}
        </button>
        <button type="button" onClick={onCancel}
          style={{ padding: '12px 16px', borderRadius: 8, fontSize: 14, background: 'var(--slate-100)', color: 'var(--slate-600)', border: 'none', cursor: 'pointer' }}>
          Cancelar
        </button>
      </div>
    </form>
  );
}

export default function Medicacion() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { nombre } = usePerfil();
  const [tratamientos, setTratamientos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [editando, setEditando] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [form, setForm] = useState(FORM_VACIO);
  const [farmacos, setFarmacos] = useState(FARMACOS_DEFAULT);
  const [verInactivos, setVerInactivos] = useState(false);
  const [mostrarExport, setMostrarExport] = useState(false);
  const [exportDesde, setExportDesde] = useState('');
  const [exportHasta, setExportHasta] = useState('');
  const [exportando, setExportando] = useState(false);
  const [exportMsg, setExportMsg] = useState('');

  async function cargar() {
    try {
      const q = query(collection(db, 'tratamientos'), where('uid', '==', user.uid));
      const snap = await getDocs(q);
      setTratamientos(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (e) {}
    setLoading(false);
  }

  async function cargarFarmacos() {
    const config = await getOpcionesConfig(user.uid);
    const extras = config.extras['farmacos'] || [];
    const ocultos = config.ocultas['farmacos'] || [];
    setFarmacos([...FARMACOS_DEFAULT, ...extras].filter(f => !ocultos.includes(f)));
  }

  useEffect(() => { cargar(); cargarFarmacos(); }, []);

  function abrirNuevo() {
    setEditando(null);
    setForm(FORM_VACIO);
    setMostrarForm(true);
  }

  function abrirEditar(t) {
    setEditando(t.id);
    setForm({
      farmaco: t.farmaco || '',
      farmaco_otro: '',
      dosis: t.dosis || '',
      momentos: t.momentos || [],
      dias: t.dias || [0,1,2,3,4,5,6],
      notas: t.notas || '',
      activo: t.activo !== false,
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
    const nombreFarmaco = form.farmaco === 'Otro' ? form.farmaco_otro : form.farmaco;
    const data = {
      uid: user.uid,
      farmaco: nombreFarmaco,
      dosis: form.dosis,
      momentos: form.momentos,
      dias: form.dias,
      notas: form.notas,
      activo: true,
    };
    try {
      if (editando) {
        await updateDoc(doc(db, 'tratamientos', editando), data);
      } else {
        await addDoc(collection(db, 'tratamientos'), { ...data, timestamp: serverTimestamp() });
      }
      cancelar();
      cargar();
    } catch (err) { alert('Error: ' + err.message); }
    setGuardando(false);
  }

  async function toggleActivo(t) {
    await updateDoc(doc(db, 'tratamientos', t.id), { activo: !t.activo });
    cargar();
  }

  async function eliminar(id) {
    if (!window.confirm('¿Eliminar este tratamiento permanentemente?')) return;
    await deleteDoc(doc(db, 'tratamientos', id));
    cargar();
  }

  async function onExportarExcel() {
    if (!exportDesde || !exportHasta) { setExportMsg('Selecciona las dos fechas.'); return; }
    setExportando(true); setExportMsg('');
    try {
      const total = await exportarExcelTomas(user.uid, nombre, new Date(exportDesde), new Date(exportHasta));
      setExportMsg(`CSV descargado con ${total} tomas.`);
    } catch (err) { setExportMsg('Error: ' + err.message); }
    setExportando(false);
  }

  const activos = tratamientos.filter(t => t.activo !== false);
  const inactivos = tratamientos.filter(t => t.activo === false);
  const diaHoy = getDiaHoy();
  const hoyNombre = DIAS_NOMBRES[diaHoy];

  function diasTexto(dias) {
    if (!dias || dias.length === 0) return 'Ningún día';
    if (dias.length === 7) return 'Todos los días';
    if (JSON.stringify([...dias].sort()) === JSON.stringify([0,1,2,3,4])) return 'Lunes a viernes';
    return dias.sort().map(d => DIAS_SEMANA[d]).join(' · ');
  }

  return (
    <div style={{ paddingBottom: 100 }}>
      <div style={{ background: 'var(--teal-500)', padding: '48px 20px 24px', position: 'relative' }}>
        <button onClick={() => navigate('/')}
          style={{ position: 'absolute', top: 16, right: 16, background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: 8, padding: '6px 12px', color: 'white', fontSize: 12, cursor: 'pointer', fontWeight: 500 }}>
          ← Inicio
        </button>
        <h1 style={{ color: 'white', fontSize: 22, fontWeight: 600 }}>Medicación</h1>
        <p style={{ color: 'rgba(255,255,255,0.75)', fontSize: 14, marginTop: 4 }}>
          {activos.length} tratamiento{activos.length !== 1 ? 's' : ''} activo{activos.length !== 1 ? 's' : ''}
        </p>
      </div>

      <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: 12 }}>

        {mostrarForm
          ? <TratamientoForm form={form} setForm={setForm} farmacos={farmacos} onSubmit={guardar} onCancel={cancelar} guardando={guardando} editando={editando} />
          : <button className="btn-primary" onClick={abrirNuevo}>+ Añadir tratamiento</button>
        }

        {loading && <p style={{ color: 'var(--slate-400)', textAlign: 'center', padding: 20 }}>Cargando...</p>}

        {/* Tratamiento de hoy */}
        {!loading && activos.length > 0 && !mostrarForm && (() => {
          const deHoy = activos.filter(t => t.dias?.includes(diaHoy));
          if (deHoy.length === 0) return (
            <div className="card" style={{ padding: '14px 16px' }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--teal-700)', marginBottom: 4 }}>Hoy · {hoyNombre}</p>
              <p style={{ fontSize: 13, color: 'var(--slate-400)' }}>Sin medicación programada para hoy</p>
            </div>
          );

          const grupos = agruparPorMomento(tratamientos);
          const momentosDeHoy = MOMENTOS.filter(m => grupos[m] && grupos[m].length > 0);

          return (
            <div className="card" style={{ padding: '14px 16px' }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--teal-700)', marginBottom: 12 }}>
                Hoy · {hoyNombre}
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {momentosDeHoy.map(m => (
                  <div key={m}>
                    <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--teal-500)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>{m}</p>
                    {grupos[m].map((t, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: '1px solid var(--teal-50)' }}>
                        <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--teal-500)', flexShrink: 0 }} />
                        <span style={{ fontSize: 13, color: 'var(--slate-800)', fontWeight: 500 }}>{t.farmaco}</span>
                        {t.dosis && <span style={{ fontSize: 12, color: 'var(--slate-400)' }}>· {t.dosis}</span>}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          );
        })()}

        {/* Lista de tratamientos activos */}
        {!loading && activos.length > 0 && !mostrarForm && (
          <>
            <p className="section-header">Tratamientos activos ({activos.length})</p>
            {activos.map(t => (
              <div key={t.id} className="card" style={{ padding: '14px 16px', borderLeft: '3px solid var(--teal-500)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--slate-800)' }}>{t.farmaco}</p>
                    {t.dosis && <p style={{ fontSize: 12, color: 'var(--teal-600)', marginTop: 2 }}>{t.dosis}</p>}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 6 }}>
                      {(t.momentos || []).map(m => (
                        <span key={m} style={{ fontSize: 10, padding: '2px 7px', borderRadius: 10, background: 'var(--teal-50)', color: 'var(--teal-700)', border: '1px solid var(--teal-100)' }}>{m}</span>
                      ))}
                    </div>
                    <p style={{ fontSize: 11, color: 'var(--slate-400)', marginTop: 6 }}>{diasTexto(t.dias)}</p>
                    {t.notas && <p style={{ fontSize: 11, color: 'var(--slate-500)', marginTop: 4, fontStyle: 'italic' }}>{t.notas}</p>}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, paddingLeft: 10, flexShrink: 0 }}>
                    <button onClick={() => abrirEditar(t)}
                      style={{ background: 'var(--teal-50)', border: '1px solid var(--teal-100)', borderRadius: 8, padding: '5px 10px', fontSize: 11, fontWeight: 500, color: 'var(--teal-700)', cursor: 'pointer' }}>
                      Editar
                    </button>
                    <button onClick={() => toggleActivo(t)}
                      style={{ background: 'var(--amber-50)', border: '1px solid #fde68a', borderRadius: 8, padding: '5px 10px', fontSize: 11, fontWeight: 500, color: '#92400e', cursor: 'pointer' }}>
                      Pausar
                    </button>
                    <button onClick={() => eliminar(t.id)}
                      style={{ background: 'none', border: 'none', color: 'var(--slate-300)', cursor: 'pointer', textAlign: 'center', padding: 4 }}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/></svg>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </>
        )}

        {/* Tratamientos pausados */}
        {!loading && inactivos.length > 0 && !mostrarForm && (
          <>
            <button onClick={() => setVerInactivos(!verInactivos)}
              style={{ background: 'none', border: 'none', textAlign: 'left', padding: '4px 0', fontSize: 13, color: 'var(--teal-500)', cursor: 'pointer', fontWeight: 500 }}>
              {verInactivos ? '▾' : '▸'} Tratamientos pausados ({inactivos.length})
            </button>
            {verInactivos && inactivos.map(t => (
              <div key={t.id} className="card" style={{ padding: '14px 16px', borderLeft: '3px solid var(--slate-200)', opacity: 0.75 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--slate-600)' }}>{t.farmaco}</p>
                    {t.dosis && <p style={{ fontSize: 12, color: 'var(--slate-400)', marginTop: 2 }}>{t.dosis}</p>}
                    <p style={{ fontSize: 11, color: 'var(--slate-400)', marginTop: 4 }}>{diasTexto(t.dias)}</p>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, paddingLeft: 10, flexShrink: 0 }}>
                    <button onClick={() => abrirEditar(t)}
                      style={{ background: 'var(--slate-100)', border: '1px solid var(--slate-200)', borderRadius: 8, padding: '5px 10px', fontSize: 11, color: 'var(--slate-600)', cursor: 'pointer' }}>
                      Editar
                    </button>
                    <button onClick={() => toggleActivo(t)}
                      style={{ background: 'var(--teal-50)', border: '1px solid var(--teal-100)', borderRadius: 8, padding: '5px 10px', fontSize: 11, fontWeight: 500, color: 'var(--teal-700)', cursor: 'pointer' }}>
                      Reactivar
                    </button>
                    <button onClick={() => eliminar(t.id)}
                      style={{ background: 'none', border: 'none', color: 'var(--slate-300)', cursor: 'pointer', textAlign: 'center', padding: 4 }}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/></svg>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </>
        )}

        {/* Panel de exportación */}
        {!mostrarForm && tratamientos.length > 0 && (
          <div style={{ marginTop: 8 }}>
            <button onClick={() => { setMostrarExport(!mostrarExport); setExportMsg(''); }}
              style={{ width: '100%', padding: '11px', borderRadius: 8, fontSize: 13, fontWeight: 500, background: 'var(--slate-100)', color: 'var(--slate-600)', border: '1px solid var(--slate-200)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/></svg>
              {mostrarExport ? 'Cerrar exportación' : 'Exportar histórico de medicación'}
            </button>

            {mostrarExport && (
              <div className="card" style={{ padding: 16, marginTop: 8, display: 'flex', flexDirection: 'column', gap: 12 }}>
                <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--slate-700)' }}>Exportar histórico de tomas</p>
                <p style={{ fontSize: 12, color: 'var(--slate-400)', lineHeight: 1.5 }}>
                  Se generará un informe con todas las tomas previstas según los tratamientos activos en el rango de fechas seleccionado.
                </p>
                <div style={{ display: 'flex', gap: 10 }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: 12, color: 'var(--slate-400)', display: 'block', marginBottom: 5 }}>Fecha desde</label>
                    <input className="input-field" type="date" value={exportDesde}
                      onChange={e => setExportDesde(e.target.value)} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: 12, color: 'var(--slate-400)', display: 'block', marginBottom: 5 }}>Fecha hasta</label>
                    <input className="input-field" type="date" value={exportHasta}
                      onChange={e => setExportHasta(e.target.value)} />
                  </div>
                </div>
                <button onClick={onExportarExcel} disabled={exportando || !exportDesde || !exportHasta}
                  style={{ width: '100%', padding: '10px', borderRadius: 8, fontSize: 13, fontWeight: 500, background: exportDesde && exportHasta ? '#16a34a' : 'var(--slate-200)', color: exportDesde && exportHasta ? 'white' : 'var(--slate-400)', border: 'none', cursor: exportDesde && exportHasta ? 'pointer' : 'default', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
                  {exportando ? 'Generando...' : 'Exportar tratamientos a CSV'}
                </button>
                {exportMsg && (
                  <div style={{ background: exportMsg.startsWith('Error') ? '#fef2f2' : 'var(--teal-50)', border: `1px solid ${exportMsg.startsWith('Error') ? '#fca5a5' : 'var(--teal-100)'}`, borderRadius: 8, padding: '10px 14px', fontSize: 13, color: exportMsg.startsWith('Error') ? '#dc2626' : 'var(--teal-700)' }}>
                    {exportMsg}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {!loading && tratamientos.length === 0 && !mostrarForm && (
          <div style={{ textAlign: 'center', padding: '32px 20px', color: 'var(--slate-400)' }}>
            <p style={{ fontSize: 15 }}>Sin tratamientos registrados</p>
            <p style={{ fontSize: 13, marginTop: 6 }}>Pulsa "+ Añadir tratamiento" para empezar</p>
          </div>
        )}
      </div>
    </div>
  );
}
