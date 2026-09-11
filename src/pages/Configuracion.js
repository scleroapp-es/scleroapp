import React, { useState, useRef, useEffect } from 'react';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { usePerfil } from '../hooks/usePerfil';
import { hacerBackup, restaurarBackup, exportarExcel } from '../services/backup';
import { generarReporteTension } from '../services/reportePDF';
import { getOpcionesConfig, saveOpcionesExtra, saveOpcionesOcultas, PREGUNTAS_AMPLIABLES } from '../services/opcionesExtra';
import { isDriveConnected, connectDrive, clearDriveToken } from '../services/googleDrive';

function ActionCard({ title, description, buttonLabel, buttonColor, onClick, loading, loadingLabel, icon, warning }) {
  return (
    <div className="card" style={{ padding: '16px' }}>
      <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
        <div style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--teal-50)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          {icon}
        </div>
        <div>
          <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--slate-800)' }}>{title}</p>
          <p style={{ fontSize: 12, color: 'var(--slate-400)', marginTop: 3, lineHeight: 1.5 }}>{description}</p>
        </div>
      </div>
      {warning && <div style={{ background: 'var(--teal-50)', border: '1px solid var(--teal-100)', borderRadius: 8, padding: '8px 12px', fontSize: 12, color: 'var(--teal-700)', marginBottom: 10 }}>{warning}</div>}
      <button onClick={onClick} disabled={loading}
        style={{ width: '100%', padding: '10px', borderRadius: 8, fontSize: 13, fontWeight: 500, background: buttonColor || 'var(--teal-500)', color: 'white', border: 'none', cursor: loading ? 'default' : 'pointer', opacity: loading ? 0.7 : 1 }}>
        {loading ? loadingLabel : buttonLabel}
      </button>
    </div>
  );
}

function ResultMsg({ msg }) {
  if (!msg) return null;
  const isError = msg.startsWith('Error');
  return (
    <div style={{ background: isError ? '#fef2f2' : 'var(--teal-50)', border: `1px solid ${isError ? '#fca5a5' : 'var(--teal-100)'}`, borderRadius: 8, padding: '10px 14px', fontSize: 13, color: isError ? 'var(--red-600)' : 'var(--teal-700)' }}>
      {msg}
    </div>
  );
}

export default function Configuracion() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { nombre, guardarNombre } = usePerfil();
  const [nombreEdit, setNombreEdit] = useState('');
  const [nombreGuardado, setNombreGuardado] = useState(false);
  const [cicloDias, setCicloDias] = useState(28);
  const [duracionDias, setDuracionDias] = useState(5);
  const [cicloGuardado, setCicloGuardado] = useState(false);
  const [opcionesExtra, setOpcionesExtra] = useState({});
  const [opcionesOcultas, setOpcionesOcultas] = useState({});
  const [preguntaActiva, setPreguntaActiva] = useState(null);
  const [nuevaOpcion, setNuevaOpcion] = useState('');
  const [driveConectado, setDriveConectado] = useState(() => isDriveConnected());
  const [loadingDrive, setLoadingDrive] = useState(false);
  const [loadingBackup, setLoadingBackup] = useState(false);
  const [loadingRestore, setLoadingRestore] = useState(false);
  const [loadingExcel, setLoadingExcel] = useState(false);
  const [loadingReport, setLoadingReport] = useState(false);
  const [fechaReporte, setFechaReporte] = useState('');
  const [msg, setMsg] = useState('');
  const fileRef = useRef();

  useEffect(() => { setNombreEdit(nombre); }, [nombre]);

  useEffect(() => {
    async function load() {
      const config = await getOpcionesConfig(user.uid);
      setOpcionesExtra(config.extras);
      setOpcionesOcultas(config.ocultas);
      try {
        const snap = await getDoc(doc(db, 'configuracion', user.uid));
        if (snap.exists()) {
          if (snap.data().cicloDias) setCicloDias(snap.data().cicloDias);
          if (snap.data().duracionDias) setDuracionDias(snap.data().duracionDias);
        }
      } catch (e) {}
    }
    load();
  }, [user.uid]);

  async function onGuardarNombre(e) {
    e.preventDefault();
    if (!nombreEdit.trim()) return;
    await guardarNombre(nombreEdit.trim());
    setNombreGuardado(true);
    setTimeout(() => setNombreGuardado(false), 2000);
  }

  async function onGuardarCiclo(e) {
    e.preventDefault();
    await setDoc(doc(db, 'configuracion', user.uid), { cicloDias, duracionDias }, { merge: true });
    setCicloGuardado(true);
    setTimeout(() => setCicloGuardado(false), 2000);
  }

  function addOpcion(preguntaId) {
    if (!nuevaOpcion.trim()) return;
    const actual = opcionesExtra[preguntaId] || [];
    if (actual.includes(nuevaOpcion.trim())) return;
    const updated = { ...opcionesExtra, [preguntaId]: [...actual, nuevaOpcion.trim()] };
    setOpcionesExtra(updated);
    saveOpcionesExtra(user.uid, updated);
    setNuevaOpcion('');
  }

  function toggleOculta(preguntaId, opcion) {
    const actuales = opcionesOcultas[preguntaId] || [];
    const nuevas = actuales.includes(opcion)
      ? actuales.filter(o => o !== opcion)
      : [...actuales, opcion];
    const updated = { ...opcionesOcultas, [preguntaId]: nuevas };
    setOpcionesOcultas(updated);
    saveOpcionesOcultas(user.uid, updated);
  }

  function removeOpcion(preguntaId, opcion) {
    const updated = { ...opcionesExtra, [preguntaId]: (opcionesExtra[preguntaId] || []).filter(o => o !== opcion) };
    setOpcionesExtra(updated);
    saveOpcionesExtra(user.uid, updated);
  }

  async function onConectarDrive() {
    setLoadingDrive(true);
    setMsg('');
    try {
      await connectDrive();
      setDriveConectado(true);
      setMsg('Google Drive conectado correctamente. Los nuevos PDFs se guardarán en tu Drive.');
    } catch (err) {
      setMsg('Error al conectar Drive: ' + err.message);
    }
    setLoadingDrive(false);
  }

  function onDesconectarDrive() {
    clearDriveToken();
    setDriveConectado(false);
    setMsg('Google Drive desconectado. Los PDFs se guardarán en este dispositivo.');
  }

  async function onBackup() {
    setMsg(''); setLoadingBackup(true);
    try {
      const res = await hacerBackup(user.uid);
      setMsg(`Backup descargado. ${res.registros} registros y ${res.pdfs} PDFs exportados.`);
    } catch (err) { setMsg('Error: ' + err.message); }
    setLoadingBackup(false);
  }

  async function onRestoreFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    if (!window.confirm('¿Restaurar backup? Se añadirán los registros del fichero.')) { fileRef.current.value = ''; return; }
    setMsg(''); setLoadingRestore(true);
    try {
      const res = await restaurarBackup(user.uid, file);
      setMsg(`Restaurado. ${res.restaurados} registros y ${res.pdfs} PDFs importados.`);
    } catch (err) { setMsg('Error: ' + err.message); }
    setLoadingRestore(false);
    fileRef.current.value = '';
  }

  async function onExcel() {
    setMsg(''); setLoadingExcel(true);
    try {
      const total = await exportarExcel(user.uid);
      setMsg(`Exportación completada. ${total} registros exportados a CSV.`);
    } catch (err) { setMsg('Error: ' + err.message); }
    setLoadingExcel(false);
  }

  async function onReporteTension() {
    if (!fechaReporte) { setMsg('Error: selecciona una fecha de inicio para el reporte.'); return; }
    setMsg(''); setLoadingReport(true);
    try {
      const total = await generarReporteTension(user.uid, nombre, fechaReporte);
      setMsg(`Informe generado con ${total} registros. Usa Ctrl+P en la nueva ventana para guardarlo como PDF.`);
    } catch (err) { setMsg('Error: ' + err.message); }
    setLoadingReport(false);
  }

  return (
    <div style={{ paddingBottom: 100 }}>
      <div style={{ background: 'var(--teal-500)', padding: '48px 20px 24px', position: 'relative' }}>
        <button onClick={() => navigate('/')} style={{ position: 'absolute', top: 16, right: 16, background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: 8, padding: '6px 12px', color: 'white', fontSize: 12, cursor: 'pointer', fontWeight: 500 }}>← Inicio</button>
        <h1 style={{ color: 'white', fontSize: 22, fontWeight: 600 }}>Configuración</h1>
        <p style={{ color: 'rgba(255,255,255,0.75)', fontSize: 13, marginTop: 4 }}>Perfil, ciclo y copias de seguridad</p>
      </div>

      <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: 12 }}>

        {/* Perfil */}
        <p className="section-header">Perfil</p>
        <div className="card" style={{ padding: '16px' }}>
          <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--slate-800)', marginBottom: 4 }}>Tu nombre</p>
          <p style={{ fontSize: 12, color: 'var(--slate-400)', marginBottom: 12 }}>Aparece en el saludo de la pantalla de inicio.</p>
          <form onSubmit={onGuardarNombre} style={{ display: 'flex', gap: 8 }}>
            <input className="input-field" value={nombreEdit} onChange={e => setNombreEdit(e.target.value)} placeholder="Escribe tu nombre..." style={{ flex: 1 }} />
            <button type="submit" style={{ padding: '10px 16px', borderRadius: 8, fontSize: 13, fontWeight: 500, background: nombreGuardado ? '#22c55e' : 'var(--teal-500)', color: 'white', border: 'none', cursor: 'pointer', transition: 'background 0.3s', whiteSpace: 'nowrap' }}>
              {nombreGuardado ? '✓ Guardado' : 'Guardar'}
            </button>
          </form>
        </div>

        {/* Ciclo menstrual */}
        <p className="section-header" style={{ marginTop: 8 }}>Ciclo menstrual</p>
        <div className="card" style={{ padding: '16px' }}>
          <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--slate-800)', marginBottom: 4 }}>Configuración del ciclo</p>
          <p style={{ fontSize: 12, color: 'var(--slate-400)', marginBottom: 12 }}>Estos valores se usan para calcular las fechas previstas de tu próxima menstruación.</p>
          <form onSubmit={onGuardarCiclo} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', gap: 10 }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 12, color: 'var(--slate-500)', display: 'block', marginBottom: 5 }}>Duración del ciclo (días)</label>
                <input className="input-field" type="number" value={cicloDias} onChange={e => setCicloDias(parseInt(e.target.value))} min="21" max="45" />
                <p style={{ fontSize: 10, color: 'var(--slate-400)', marginTop: 3 }}>Desde el 1º día de la regla hasta el siguiente. Media: 28 días.</p>
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 12, color: 'var(--slate-500)', display: 'block', marginBottom: 5 }}>Duración de la regla (días)</label>
                <input className="input-field" type="number" value={duracionDias} onChange={e => setDuracionDias(parseInt(e.target.value))} min="2" max="10" />
                <p style={{ fontSize: 10, color: 'var(--slate-400)', marginTop: 3 }}>Cuántos días dura normalmente tu período.</p>
              </div>
            </div>
            <button type="submit" style={{ padding: '10px', borderRadius: 8, fontSize: 13, fontWeight: 500, background: cicloGuardado ? '#22c55e' : 'var(--teal-500)', color: 'white', border: 'none', cursor: 'pointer', transition: 'background 0.3s' }}>
              {cicloGuardado ? '✓ Guardado' : 'Guardar configuración del ciclo'}
            </button>
          </form>
        </div>

        {/* Opciones personalizadas formularios */}
        <p className="section-header" style={{ marginTop: 8 }}>Opciones personalizadas en formularios</p>
        <div className="card" style={{ padding: '16px' }}>
          <p style={{ fontSize: 12, color: 'var(--slate-400)', marginBottom: 12, lineHeight: 1.5 }}>Añade opciones extra a los formularios de mañana y noche. Aparecerán junto a las opciones predeterminadas.</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {PREGUNTAS_AMPLIABLES.map(p => (
              <div key={p.id} style={{ border: '1px solid var(--teal-100)', borderRadius: 10, overflow: 'hidden' }}>
                <button onClick={() => setPreguntaActiva(preguntaActiva === p.id ? null : p.id)}
                  style={{ width: '100%', padding: '10px 14px', background: preguntaActiva === p.id ? 'var(--teal-50)' : 'white', border: 'none', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ textAlign: 'left' }}>
                    <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--teal-700)' }}>{p.label}</p>
                    <p style={{ fontSize: 11, color: 'var(--slate-400)' }}>Formulario {p.formulario} · {(opcionesExtra[p.id] || []).length} opciones extra</p>
                  </div>
                  <span style={{ color: 'var(--teal-500)', fontSize: 16 }}>{preguntaActiva === p.id ? '▲' : '▼'}</span>
                </button>
                {preguntaActiva === p.id && (
                  <div style={{ padding: '12px 14px', borderTop: '1px solid var(--teal-50)', background: 'white' }}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
                      {/* Opciones predeterminadas con toggle ocultar */}
                      {p.opciones && <p style={{ fontSize: 10, color: 'var(--slate-400)', marginBottom: 4, width: '100%' }}>Predeterminadas (toca para ocultar/mostrar):</p>}
                      {(p.opciones || []).map(op => {
                        const oculta = (opcionesOcultas[p.id] || []).includes(op);
                        return (
                          <span key={op} onClick={() => toggleOculta(p.id, op)}
                            style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 20, background: oculta ? 'var(--slate-100)' : 'var(--teal-50)', border: `1px solid ${oculta ? 'var(--slate-200)' : 'var(--teal-100)'}`, fontSize: 12, color: oculta ? 'var(--slate-400)' : 'var(--teal-700)', cursor: 'pointer', textDecoration: oculta ? 'line-through' : 'none', opacity: oculta ? 0.6 : 1 }}>
                            {op}
                            <span style={{ fontSize: 10 }}>{oculta ? '👁' : '—'}</span>
                          </span>
                        );
                      })}
                      {(opcionesExtra[p.id] || []).length > 0 && <p style={{ fontSize: 10, color: 'var(--slate-400)', marginTop: 6, marginBottom: 4, width: '100%' }}>Añadidas por ti:</p>}
                      {(opcionesExtra[p.id] || []).map(op => (
                        <span key={op} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 20, background: 'var(--teal-50)', border: '1px solid var(--teal-100)', fontSize: 12, color: 'var(--teal-700)' }}>
                          {op}
                          <button onClick={() => removeOpcion(p.id, op)} style={{ background: 'none', border: 'none', color: 'var(--teal-500)', cursor: 'pointer', fontSize: 14, lineHeight: 1, padding: '0 0 0 2px' }}>×</button>
                        </span>
                      ))}
                      {(opcionesExtra[p.id] || []).length === 0 && !(p.opciones?.length) && <p style={{ fontSize: 12, color: 'var(--slate-400)' }}>Sin opciones extra todavía</p>}
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <input className="input-field" value={nuevaOpcion} onChange={e => setNuevaOpcion(e.target.value)}
                        placeholder="Nueva opción..." style={{ flex: 1 }}
                        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addOpcion(p.id); } }} />
                      <button onClick={() => addOpcion(p.id)}
                        style={{ padding: '10px 14px', borderRadius: 8, fontSize: 13, fontWeight: 500, background: 'var(--teal-500)', color: 'white', border: 'none', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                        + Añadir
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Informes médicos */}
        <p className="section-header" style={{ marginTop: 8 }}>Informes médicos</p>
        <div className="card" style={{ padding: '16px' }}>
          <div style={{ display: 'flex', gap: 12, marginBottom: 14 }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--teal-50)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--teal-500)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
            </div>
            <div>
              <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--slate-800)' }}>Informe de tensión arterial</p>
              <p style={{ fontSize: 12, color: 'var(--slate-400)', marginTop: 3, lineHeight: 1.5 }}>Genera un informe PDF profesional para compartir con tu médico.</p>
            </div>
          </div>
          <div style={{ marginBottom: 10 }}>
            <label style={{ fontSize: 12, color: 'var(--slate-500)', display: 'block', marginBottom: 6 }}>Incluir registros desde:</label>
            <input type="date" className="input-field" value={fechaReporte} onChange={e => setFechaReporte(e.target.value)} style={{ maxWidth: 200 }} />
          </div>
          <button onClick={onReporteTension} disabled={loadingReport || !fechaReporte}
            style={{ width: '100%', padding: '10px', borderRadius: 8, fontSize: 13, fontWeight: 500, background: fechaReporte ? 'var(--teal-500)' : 'var(--slate-200)', color: fechaReporte ? 'white' : 'var(--slate-400)', border: 'none', cursor: fechaReporte ? 'pointer' : 'default', opacity: loadingReport ? 0.7 : 1 }}>
            {loadingReport ? 'Generando informe...' : 'Generar informe PDF'}
          </button>
        </div>

        {/* Fármacos */}
        <p className="section-header">Fármacos y medicamentos</p>
        <div className="card" style={{ padding: '16px' }}>
          <p style={{ fontSize: 12, color: 'var(--slate-400)', marginBottom: 12, lineHeight: 1.5 }}>
            Gestiona la lista de fármacos que aparece en la sección Medicación. Toca uno para ocultarlo o añade nuevos.
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
            {['Omeprazol','Acxxel','Inmunosupresor','Symbicort','Antihistamínico','Paracetamol','Aciclovir','Curcumina','Metotrexato','Micofenolato','Prednisona','Hidroxicloroquina','Bosentan','Sildenafilo','Nifedipino'].map(f => {
              const oculto = (opcionesOcultas['farmacos'] || []).includes(f);
              return (
                <span key={f} onClick={() => toggleOculta('farmacos', f)}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 20, background: oculto ? 'var(--slate-100)' : 'var(--teal-50)', border: `1px solid ${oculto ? 'var(--slate-200)' : 'var(--teal-100)'}`, fontSize: 12, color: oculto ? 'var(--slate-400)' : 'var(--teal-700)', cursor: 'pointer', textDecoration: oculto ? 'line-through' : 'none', opacity: oculto ? 0.6 : 1 }}>
                  {f}
                </span>
              );
            })}
            {(opcionesExtra['farmacos'] || []).map(f => (
              <span key={f} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 20, background: 'var(--teal-50)', border: '1px solid var(--teal-100)', fontSize: 12, color: 'var(--teal-700)' }}>
                {f}
                <button onClick={() => removeOpcion('farmacos', f)} style={{ background: 'none', border: 'none', color: 'var(--teal-500)', cursor: 'pointer', fontSize: 14, lineHeight: 1, padding: '0 0 0 2px' }}>×</button>
              </span>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input className="input-field" value={nuevaOpcion} onChange={e => setNuevaOpcion(e.target.value)}
              placeholder="Añadir nuevo fármaco..." style={{ flex: 1 }}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addOpcion('farmacos'); } }} />
            <button onClick={() => addOpcion('farmacos')}
              style={{ padding: '10px 14px', borderRadius: 8, fontSize: 13, fontWeight: 500, background: 'var(--teal-500)', color: 'white', border: 'none', cursor: 'pointer', whiteSpace: 'nowrap' }}>
              + Añadir
            </button>
          </div>
        </div>

        {/* Google Drive */}
        <p className="section-header" style={{ marginTop: 8 }}>Google Drive</p>
        <div className="card" style={{ padding: '16px' }}>
          <div style={{ display: 'flex', gap: 12, marginBottom: 14 }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--teal-50)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <svg width="22" height="22" viewBox="0 0 87.3 78" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M6.6 66.85l3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3L26.95 56H0c0 1.55.4 3.1 1.2 4.5l5.4 6.35z" fill="#0F9D58"/>
                <path d="M43.65 24.15L30.45 0c-1.35.8-2.5 1.9-3.3 3.3L1.2 51.5C.4 52.9 0 54.45 0 56h26.95l16.7-31.85z" fill="#00832D"/>
                <path d="M73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25c.8-1.4 1.2-2.95 1.2-4.5H60.35l5.9 11.5 7.3 12.3z" fill="#EA4335"/>
                <path d="M43.65 24.15L56.85 0H30.45l-13.2 24.15L43.65 24.15z" fill="#00AC47"/>
                <path d="M60.35 56H26.95L13.75 79.8h46.6l13.2-23.8H60.35z" fill="#00832D" opacity=".3"/>
                <path d="M60.35 56l16.7-31.85c-1.35-.8-2.9-1.2-4.5-1.2H29.5c-1.6 0-3.15.4-4.5 1.2L43.65 56H60.35z" fill="#FFBA00"/>
              </svg>
            </div>
            <div>
              <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--slate-800)' }}>Google Drive</p>
              <p style={{ fontSize: 12, color: 'var(--slate-400)', marginTop: 3, lineHeight: 1.5 }}>
                {driveConectado ? 'Conectado · Los PDFs de pruebas se guardan en tu Drive' : 'Conecta tu cuenta para guardar los PDFs en Google Drive'}
              </p>
            </div>
          </div>
          {driveConectado ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: 'var(--teal-50)', borderRadius: 8, border: '1px solid var(--teal-100)' }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--teal-500)' }} />
                <span style={{ fontSize: 12, color: 'var(--teal-700)', flex: 1 }}>Carpeta: ScleroApp - Pruebas Médicas</span>
              </div>
              <button onClick={onDesconectarDrive}
                style={{ width: '100%', padding: '10px', borderRadius: 8, fontSize: 13, fontWeight: 500, background: 'var(--red-50)', color: 'var(--red-600)', border: '1px solid #fca5a5', cursor: 'pointer' }}>
                Desconectar Drive
              </button>
            </div>
          ) : (
            <button onClick={onConectarDrive} disabled={loadingDrive}
              style={{ width: '100%', padding: '10px', borderRadius: 8, fontSize: 13, fontWeight: 500, background: 'var(--teal-500)', color: 'white', border: 'none', cursor: 'pointer', opacity: loadingDrive ? 0.7 : 1 }}>
              {loadingDrive ? 'Conectando...' : 'Conectar con Google Drive'}
            </button>
          )}
        </div>

        {/* Backup */}
        <p className="section-header" style={{ marginTop: 8 }}>Copia de seguridad</p>
        <ActionCard title="Hacer backup" description="Descarga un fichero con todos tus datos y PDFs guardados en este dispositivo." buttonLabel="Descargar backup" onClick={onBackup} loading={loadingBackup} loadingLabel="Generando backup..."
          icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--teal-500)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>} />

        <ActionCard title="Restaurar backup" description="Importa un fichero de backup generado anteriormente." buttonLabel="Seleccionar fichero de backup" buttonColor="#7c3aed" onClick={() => fileRef.current.click()} loading={loadingRestore} loadingLabel="Restaurando..." warning="Los registros existentes no se borran. Se añaden los del backup."
          icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>} />
        <input ref={fileRef} type="file" accept=".json" onChange={onRestoreFile} style={{ display: 'none' }} />

        <p className="section-header" style={{ marginTop: 8 }}>Exportación</p>
        <ActionCard title="Exportar a CSV" description="Descarga todos tus datos en formato CSV, compatible con Excel y Google Sheets." buttonLabel="Exportar CSV" buttonColor="#d97706" onClick={onExcel} loading={loadingExcel} loadingLabel="Exportando..."
          icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>} />

        <ResultMsg msg={msg} />

        <p style={{ fontSize: 12, color: 'var(--slate-400)', textAlign: 'center', marginTop: 8 }}>Scleroapp · v1.6 · Datos en Firebase · PDFs locales</p>
      </div>
    </div>
  );
}
