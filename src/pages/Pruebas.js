import React, { useState, useEffect, useRef } from 'react';
import { collection, addDoc, query, where, orderBy, getDocs, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../hooks/useAuth';
import { savePDF, getPDF, deletePDF, openPDFInBrowser } from '../services/storage';
import { isDriveConnected, uploadPDFToDrive, openDriveFile, deleteDriveFile } from '../services/googleDrive';
import { HospitalSelector } from '../components/HospitalSelector';
import { format } from 'date-fns';

const TIPOS_PRUEBA = ['Analítica de sangre', 'Analítica de orina', 'Radiografía', 'Ecografía', 'TAC', 'RMN', 'Espirometría', 'Ecocardiograma', 'Capilaroscopia', 'Electromiografía', 'Biopsia', 'Prueba de esfuerzo', 'Otra'];
const FORM_VACIO = { tipo: '', fecha: '', lugar: '', doctor_solicitante: '', resultado: '', notas: '' };

export default function Pruebas() {
  const { user } = useAuth();
  const [pruebas, setPruebas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [adjuntos, setAdjuntos] = useState([]);  // array of files
  const [abriendo, setAbriendo] = useState(null);
  const [driveConectado] = useState(() => isDriveConnected());
  const fileRef = useRef();
  const [form, setForm] = useState(FORM_VACIO);

  async function cargar() {
    try {
      const q = query(collection(db, 'pruebas'), where('uid', '==', user.uid), orderBy('fecha', 'desc'));
      const snap = await getDocs(q);
      setPruebas(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (e) {}
    setLoading(false);
  }

  useEffect(() => { cargar(); }, []);

  function onFileChange(e) {
    const file = e.target.files[0];
    if (!file) return;
    if (file.type !== 'application/pdf') { alert('Solo se admiten ficheros PDF'); return; }
    if (file.size > 20 * 1024 * 1024) { alert('El fichero no puede superar 20 MB'); return; }
    // Build filename: fecha + tipo
    const fecha = form.fecha ? form.fecha.replace(/-/g, '') : new Date().toISOString().slice(0,10).replace(/-/g,'');
    const tipo = form.tipo ? form.tipo.replace(/[^\w\s]/g, '').trim().replace(/\s+/g, '_') : 'prueba';
    const num = adjuntos.length + 1;
    const nombre = num > 1 ? `${fecha}_${tipo}_${num}.pdf` : `${fecha}_${tipo}.pdf`;
    const namedFile = new File([file], nombre, { type: 'application/pdf' });
    setAdjuntos(prev => [...prev, namedFile]);
    if (fileRef.current) fileRef.current.value = '';
  }

  async function guardar(e) {
    e.preventDefault();
    setGuardando(true);
    try {
      const fecha = form.fecha ? form.fecha.replace(/-/g, '') : new Date().toISOString().slice(0,10).replace(/-/g,'');
      const tipo = form.tipo || 'Prueba';
      const subCarpeta = `${fecha}_${tipo}`;
      const adjuntosData = [];
      for (const file of adjuntos) {
        const buffer = await file.arrayBuffer();
        if (driveConectado) {
          const driveFile = await uploadPDFToDrive(file.name, buffer, subCarpeta);
          adjuntosData.push({ pdf_drive_id: driveFile.id, pdf_nombre: driveFile.name, pdf_origen: 'drive', pdf_tipo: file.type });
        } else {
          const pdfId = `prueba_${user.uid}_${Date.now()}_${adjuntosData.length}`;
          await savePDF(pdfId, file.name, buffer);
          adjuntosData.push({ pdf_id: pdfId, pdf_nombre: file.name, pdf_origen: 'local', pdf_tipo: file.type });
        }
      }
      await addDoc(collection(db, 'pruebas'), {
        uid: user.uid, ...form, adjuntos: adjuntosData,
        ...(adjuntosData.length > 0 ? { pdf_drive_id: adjuntosData[0].pdf_drive_id, pdf_id: adjuntosData[0].pdf_id, pdf_nombre: adjuntosData[0].pdf_nombre, pdf_origen: adjuntosData[0].pdf_origen, pdf_tipo: adjuntosData[0].pdf_tipo } : {}),
        timestamp: serverTimestamp()
      });
      setForm(FORM_VACIO);
      setAdjuntos([]);
      if (fileRef.current) fileRef.current.value = '';
      setMostrarForm(false);
      cargar();
    } catch (err) { alert('Error al guardar: ' + err.message); }
    setGuardando(false);
  }

  async function eliminar(prueba) {
    if (!window.confirm('¿Eliminar esta prueba?')) return;
    if (prueba.pdf_origen === 'local' && prueba.pdf_id) await deletePDF(prueba.pdf_id);
    if (prueba.pdf_origen === 'drive' && prueba.pdf_drive_id) await deleteDriveFile(prueba.pdf_drive_id);
    await deleteDoc(doc(db, 'pruebas', prueba.id));
    cargar();
  }

  async function abrirPDF(prueba) {
    setAbriendo(prueba.id);
    try {
      if (prueba.pdf_origen === 'drive') {
        openDriveFile(prueba.pdf_drive_id);
      } else {
        const stored = await getPDF(prueba.pdf_id);
        if (!stored) { alert('PDF no encontrado en este dispositivo.'); return; }
        openPDFInBrowser(stored.data, prueba.pdf_nombre);
      }
    } catch (err) { alert('Error al abrir el PDF'); }
    setAbriendo(null);
  }

  async function abrirAdjunto(adj) {
    try {
      if (adj.pdf_origen === 'drive') {
        openDriveFile(adj.pdf_drive_id);
      } else {
        const stored = await getPDF(adj.pdf_id);
        if (!stored) { alert('Archivo no encontrado en este dispositivo.'); return; }
        const tipo = adj.pdf_tipo || 'application/pdf';
        const blob = new Blob([stored.data], { type: tipo });
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank');
        setTimeout(() => URL.revokeObjectURL(url), 10000);
      }
    } catch (err) { alert('Error al abrir el archivo'); }
  }

  return (
    <div style={{ paddingBottom: 100 }}>
      <div style={{ background: 'var(--teal-500)', padding: '48px 20px 24px' }}>
        <h1 style={{ color: 'white', fontSize: 22, fontWeight: 600 }}>Pruebas médicas</h1>
        <p style={{ color: 'rgba(255,255,255,0.75)', fontSize: 14, marginTop: 4 }}>{pruebas.length} registradas</p>
      </div>

      <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: driveConectado ? 'var(--teal-50)' : 'var(--slate-50)', border: `1px solid ${driveConectado ? 'var(--teal-100)' : 'var(--slate-200)'}`, borderRadius: 10 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: driveConectado ? 'var(--teal-500)' : 'var(--slate-300)', flexShrink: 0 }} />
          <p style={{ fontSize: 12, color: driveConectado ? 'var(--teal-700)' : 'var(--slate-500)', flex: 1 }}>
            {driveConectado ? 'PDFs se guardan en Google Drive' : 'PDFs se guardan en este dispositivo'}
          </p>
          {!driveConectado && <span style={{ fontSize: 11, color: 'var(--slate-400)' }}>Conecta en Configuración</span>}
        </div>

        <button className="btn-primary" onClick={() => setMostrarForm(!mostrarForm)}>
          {mostrarForm ? 'Cancelar' : '+ Registrar prueba'}
        </button>

        {mostrarForm && (
          <form onSubmit={guardar} className="card" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <p className="section-header">Nueva prueba</p>
            <div>
              <label style={{ fontSize: 12, color: 'var(--slate-400)', display: 'block', marginBottom: 5 }}>Tipo de prueba</label>
              <select className="input-field" value={form.tipo}
                onChange={e => setForm(f => ({ ...f, tipo: e.target.value }))}
                required style={{ appearance: 'none' }}>
                <option value="">Seleccionar...</option>
                {TIPOS_PRUEBA.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 12, color: 'var(--slate-400)', display: 'block', marginBottom: 5 }}>Fecha</label>
              <input className="input-field" type="date" value={form.fecha}
                onChange={e => setForm(f => ({ ...f, fecha: e.target.value }))} required />
            </div>
            <div>
              <label style={{ fontSize: 12, color: 'var(--slate-400)', display: 'block', marginBottom: 5 }}>Centro / Hospital</label>
              <HospitalSelector value={form.lugar} onChange={v => setForm(f => ({ ...f, lugar: v }))} />
            </div>
            <div>
              <label style={{ fontSize: 12, color: 'var(--slate-400)', display: 'block', marginBottom: 5 }}>Doctor solicitante</label>
              <input className="input-field" value={form.doctor_solicitante}
                onChange={e => setForm(f => ({ ...f, doctor_solicitante: e.target.value }))}
                placeholder="Dra. Martínez" />
            </div>
            <div>
              <label style={{ fontSize: 12, color: 'var(--slate-400)', display: 'block', marginBottom: 5 }}>Resultado / Valores</label>
              <textarea className="input-field" value={form.resultado}
                onChange={e => setForm(f => ({ ...f, resultado: e.target.value }))}
                placeholder="Resultados principales..." rows={3} style={{ resize: 'none' }} />
            </div>
            <div>
              <label style={{ fontSize: 12, color: 'var(--slate-400)', display: 'block', marginBottom: 5 }}>Notas adicionales</label>
              <textarea className="input-field" value={form.notas}
                onChange={e => setForm(f => ({ ...f, notas: e.target.value }))}
                placeholder="Observaciones..." rows={2} style={{ resize: 'none' }} />
            </div>
            <div style={{ background: 'var(--teal-50)', border: '1.5px dashed var(--teal-300)', borderRadius: 10, padding: 14 }}>
              <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--teal-700)', marginBottom: 4 }}>Adjuntar PDF (opcional)</p>
              <p style={{ fontSize: 11, color: 'var(--teal-500)', marginBottom: 10 }}>
                {driveConectado ? 'Se guardará en tu Google Drive · carpeta ScleroApp' : 'Se guardará solo en este dispositivo'}
              </p>
              <input ref={fileRef} type="file" accept="application/pdf" onChange={onFileChange}
                style={{ fontSize: 13, color: 'var(--slate-600)', width: '100%' }} />

            </div>
            <button className="btn-primary" type="submit" disabled={guardando}>
              {guardando ? (driveConectado ? `Subiendo ${adjuntos.length} archivo(s)...` : 'Guardando...') : 'Guardar prueba'}
            </button>
          </form>
        )}

        {loading && <p style={{ color: 'var(--slate-400)', textAlign: 'center', padding: 20 }}>Cargando...</p>}
        {!loading && pruebas.length === 0 && !mostrarForm && (
          <div style={{ textAlign: 'center', padding: '32px 20px', color: 'var(--slate-400)' }}>
            <p style={{ fontSize: 15 }}>Sin pruebas registradas</p>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {pruebas.map(p => (
            <div key={p.id} className="card" style={{ padding: '14px 16px', borderLeft: '3px solid var(--teal-500)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--slate-800)' }}>{p.tipo}</p>
                  <p style={{ fontSize: 12, color: 'var(--slate-400)', marginTop: 3 }}>
                    {p.fecha}{p.lugar ? ` · ${p.lugar}` : ''}{p.doctor_solicitante ? ` · ${p.doctor_solicitante}` : ''}
                  </p>
                  {p.resultado && <p style={{ fontSize: 13, color: 'var(--slate-600)', marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--slate-100)' }}>{p.resultado}</p>}
                  {p.notas && <p style={{ fontSize: 12, color: 'var(--slate-500)', marginTop: 4, fontStyle: 'italic' }}>{p.notas}</p>}
                  {(p.pdf_id || p.pdf_drive_id) && (
                    <button onClick={() => abrirPDF(p)} disabled={abriendo === p.id}
                      style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 6, background: 'var(--teal-50)', border: '1px solid var(--teal-100)', borderRadius: 8, padding: '7px 12px', cursor: 'pointer', color: 'var(--teal-700)', fontSize: 12, fontWeight: 500 }}>
                      {abriendo === p.id ? 'Abriendo...' : p.pdf_nombre || 'Ver PDF'}
                      {p.pdf_origen === 'drive' && <span style={{ fontSize: 10, color: 'var(--teal-500)' }}>· Drive</span>}
                    </button>
                  )}
                </div>
                <button onClick={() => eliminar(p)} style={{ background: 'none', border: 'none', color: 'var(--slate-300)', cursor: 'pointer', paddingLeft: 12, flexShrink: 0 }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/></svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
