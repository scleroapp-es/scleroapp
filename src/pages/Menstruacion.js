import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, addDoc, query, where, orderBy, getDocs, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../hooks/useAuth';
import { format, addDays, differenceInDays, parseISO, isAfter, isBefore } from 'date-fns';
import { es } from 'date-fns/locale';

const SINTOMAS = ['Cólicos', 'Dolor lumbar', 'Cefalea', 'Náuseas', 'Fatiga intensa', 'Hinchazón abdominal', 'Cambios de humor', 'Sensibilidad en mamas', 'Diarrea', 'Mareos', 'Insomnio', 'Ansiedad', 'Irritabilidad', 'Acné', 'Retención de líquidos'];
const INTENSIDADES = ['Muy leve', 'Leve', 'Moderada', 'Intensa', 'Muy intensa'];
const COLORES_FLUJO = ['Rosa claro', 'Rojo brillante', 'Rojo oscuro', 'Marrón', 'Negro'];

function diasRestantesTexto(dias) {
  if (dias < 0) return 'En curso';
  if (dias === 0) return 'Hoy';
  if (dias === 1) return 'Mañana';
  return `En ${dias} días`;
}

export default function Menstruacion() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [registros, setRegistros] = useState([]);
  const [loading, setLoading] = useState(true);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [cicloDias, setCicloDias] = useState(28);
  const [duracionDias, setDuracionDias] = useState(5);
  const [proximaFecha, setProximaFecha] = useState(null);
  const [diasRestantes, setDiasRestantes] = useState(null);
  const [enPeriodo, setEnPeriodo] = useState(false);
  const [form, setForm] = useState({
    fecha_inicio: format(new Date(), 'yyyy-MM-dd'),
    fecha_fin: '',
    duracion_real: '',
    intensidad_general: '',
    color_flujo: '',
    sintomas: [],
    dolor_escala: '',
    humor_escala: '',
    temperatura_basal: '',
    notas: '',
  });

  async function cargar() {
    try {
      const q = query(collection(db, 'menstruacion'), where('uid', '==', user.uid), orderBy('fecha_inicio', 'desc'));
      const snap = await getDocs(q);
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setRegistros(data);

      // Cargar configuración del ciclo
      const qConf = query(collection(db, 'configuracion'), where('__name__', '==', user.uid));
      const snapConf = await getDocs(qConf);
      if (!snapConf.empty) {
        const conf = snapConf.docs[0].data();
        if (conf.cicloDias) setCicloDias(conf.cicloDias);
        if (conf.duracionDias) setDuracionDias(conf.duracionDias);
      }

      // Calcular próxima menstruación
      if (data.length > 0) {
        const ultima = data[0];
        const ultimaFecha = parseISO(ultima.fecha_inicio);
        const proxima = addDays(ultimaFecha, cicloDias);
        setProximaFecha(proxima);
        const hoy = new Date();
        const diff = differenceInDays(proxima, hoy);
        setDiasRestantes(diff);
        // Comprobar si está en periodo
        const finPeriodo = addDays(ultimaFecha, ultima.duracion_real || duracionDias);
        setEnPeriodo(isAfter(hoy, ultimaFecha) && isBefore(hoy, finPeriodo));
      }
    } catch (e) {}
    setLoading(false);
  }

  useEffect(() => { cargar(); }, [cicloDias, duracionDias]);

  async function guardar(e) {
    e.preventDefault();
    setGuardando(true);
    try {
      await addDoc(collection(db, 'menstruacion'), {
        uid: user.uid,
        ...form,
        dolor_escala: form.dolor_escala ? parseInt(form.dolor_escala) : null,
        humor_escala: form.humor_escala ? parseInt(form.humor_escala) : null,
        duracion_real: form.duracion_real ? parseInt(form.duracion_real) : null,
        timestamp: serverTimestamp(),
      });
      setForm({ fecha_inicio: format(new Date(), 'yyyy-MM-dd'), fecha_fin: '', duracion_real: '', intensidad_general: '', color_flujo: '', sintomas: [], dolor_escala: '', humor_escala: '', temperatura_basal: '', notas: '' });
      setMostrarForm(false);
      cargar();
    } catch (err) { alert('Error: ' + err.message); }
    setGuardando(false);
  }

  async function eliminar(id) {
    if (!window.confirm('¿Eliminar este registro?')) return;
    await deleteDoc(doc(db, 'menstruacion', id));
    cargar();
  }

  function toggleSintoma(s) {
    setForm(prev => ({
      ...prev,
      sintomas: prev.sintomas.includes(s) ? prev.sintomas.filter(x => x !== s) : [...prev.sintomas, s]
    }));
  }

  // Generar calendario de próximos ciclos (6 meses)
  function generarCalendario() {
    if (registros.length === 0) return [];
    const ultima = parseISO(registros[0].fecha_inicio);
    const ciclos = [];
    for (let i = 1; i <= 6; i++) {
      const inicio = addDays(ultima, cicloDias * i);
      const fin = addDays(inicio, duracionDias - 1);
      ciclos.push({ inicio, fin, mes: format(inicio, 'MMMM yyyy', { locale: es }) });
    }
    return ciclos;
  }

  const calendario = generarCalendario();

  return (
    <div style={{ paddingBottom: 100 }}>
      <div style={{ background: 'var(--teal-500)', padding: '48px 20px 24px', position: 'relative' }}>
        <button onClick={() => navigate('/')} style={{ position: 'absolute', top: 16, right: 16, background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: 8, padding: '6px 12px', color: 'white', fontSize: 12, cursor: 'pointer', fontWeight: 500 }}>← Inicio</button>
        <h1 style={{ color: 'white', fontSize: 22, fontWeight: 600 }}>Ciclo menstrual</h1>
        <p style={{ color: 'rgba(255,255,255,0.75)', fontSize: 14, marginTop: 4 }}>{registros.length} ciclos registrados</p>
      </div>

      <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: 12 }}>

        {/* Estado actual */}
        {registros.length > 0 && (
          <div style={{ background: enPeriodo ? 'var(--teal-50)' : 'white', border: `1.5px solid ${enPeriodo ? 'var(--teal-300)' : 'var(--teal-100)'}`, borderRadius: 14, padding: '16px' }}>
            <div style={{ display: 'flex', justify: 'space-between', alignItems: 'center', gap: 12 }}>
              <div style={{ flex: 1 }}>
                {enPeriodo ? (
                  <>
                    <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--teal-700)' }}>Período en curso</p>
                    <p style={{ fontSize: 12, color: 'var(--teal-500)', marginTop: 3 }}>Inicio: {registros[0]?.fecha_inicio}</p>
                  </>
                ) : (
                  <>
                    <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--teal-700)' }}>Próxima menstruación</p>
                    <p style={{ fontSize: 12, color: 'var(--teal-500)', marginTop: 3 }}>{proximaFecha ? format(proximaFecha, "d 'de' MMMM yyyy", { locale: es }) : '—'}</p>
                  </>
                )}
              </div>
              {!enPeriodo && diasRestantes !== null && (
                <div style={{ textAlign: 'center', background: 'var(--teal-500)', borderRadius: 12, padding: '10px 16px', minWidth: 70 }}>
                  <p style={{ fontSize: 22, fontWeight: 700, color: 'white', lineHeight: 1 }}>{Math.max(0, diasRestantes)}</p>
                  <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.8)', marginTop: 2 }}>días</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Próximos ciclos */}
        {calendario.length > 0 && (
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--teal-50)' }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--teal-700)' }}>Próximos ciclos previstos</span>
            </div>
            <div style={{ padding: '8px 16px 12px' }}>
              {calendario.map((c, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 0', borderBottom: i < calendario.length - 1 ? '1px solid var(--teal-50)' : 'none' }}>
                  <div style={{ width: 38, height: 38, borderRadius: 10, background: 'var(--teal-50)', border: '1px solid var(--teal-100)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--teal-700)', lineHeight: 1 }}>{format(c.inicio, 'd')}</span>
                    <span style={{ fontSize: 9, color: 'var(--teal-500)', textTransform: 'uppercase' }}>{format(c.inicio, 'MMM', { locale: es })}</span>
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--teal-800)', textTransform: 'capitalize' }}>{c.mes}</p>
                    <p style={{ fontSize: 11, color: 'var(--slate-400)' }}>Del {format(c.inicio, 'd')} al {format(c.fin, 'd')} · {duracionDias} días estimados</p>
                  </div>
                  <span style={{ fontSize: 10, fontWeight: 500, padding: '3px 8px', borderRadius: 10, background: 'var(--teal-50)', color: 'var(--teal-700)', border: '1px solid var(--teal-100)', flexShrink: 0 }}>
                    {diasRestantesTexto(differenceInDays(c.inicio, new Date()))}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        <button className="btn-primary" onClick={() => setMostrarForm(!mostrarForm)}>
          {mostrarForm ? 'Cancelar' : '+ Registrar menstruación'}
        </button>

        {mostrarForm && (
          <form onSubmit={guardar} className="card" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <p className="section-header">Nuevo registro</p>

            <div style={{ display: 'flex', gap: 10 }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 12, color: 'var(--slate-400)', display: 'block', marginBottom: 5 }}>Fecha inicio</label>
                <input className="input-field" type="date" value={form.fecha_inicio} onChange={e => setForm({ ...form, fecha_inicio: e.target.value })} required />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 12, color: 'var(--slate-400)', display: 'block', marginBottom: 5 }}>Fecha fin</label>
                <input className="input-field" type="date" value={form.fecha_fin} onChange={e => setForm({ ...form, fecha_fin: e.target.value })} />
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 12, color: 'var(--slate-400)', display: 'block', marginBottom: 5 }}>Duración real (días)</label>
                <input className="input-field" type="number" value={form.duracion_real} onChange={e => setForm({ ...form, duracion_real: e.target.value })} placeholder="5" min="1" max="15" />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 12, color: 'var(--slate-400)', display: 'block', marginBottom: 5 }}>Temperatura basal (°C)</label>
                <input className="input-field" type="number" value={form.temperatura_basal} onChange={e => setForm({ ...form, temperatura_basal: e.target.value })} placeholder="36.5" step="0.1" min="35" max="39" />
              </div>
            </div>

            <div>
              <label style={{ fontSize: 12, color: 'var(--slate-400)', display: 'block', marginBottom: 8 }}>Intensidad general del flujo</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {INTENSIDADES.map(i => (
                  <button type="button" key={i} onClick={() => setForm({ ...form, intensidad_general: i })}
                    style={{ padding: '7px 12px', borderRadius: 20, fontSize: 12, fontWeight: 500, cursor: 'pointer', border: `1.5px solid ${form.intensidad_general === i ? 'var(--teal-500)' : 'var(--slate-200)'}`, background: form.intensidad_general === i ? 'var(--teal-500)' : 'white', color: form.intensidad_general === i ? 'white' : 'var(--slate-600)', transition: 'all 0.12s' }}>
                    {i}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label style={{ fontSize: 12, color: 'var(--slate-400)', display: 'block', marginBottom: 8 }}>Color del flujo</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {COLORES_FLUJO.map(c => (
                  <button type="button" key={c} onClick={() => setForm({ ...form, color_flujo: c })}
                    style={{ padding: '7px 12px', borderRadius: 20, fontSize: 12, fontWeight: 500, cursor: 'pointer', border: `1.5px solid ${form.color_flujo === c ? 'var(--teal-500)' : 'var(--slate-200)'}`, background: form.color_flujo === c ? 'var(--teal-500)' : 'white', color: form.color_flujo === c ? 'white' : 'var(--slate-600)', transition: 'all 0.12s' }}>
                    {c}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label style={{ fontSize: 12, color: 'var(--slate-400)', display: 'block', marginBottom: 6 }}>Dolor (1-10)</label>
              <div style={{ display: 'flex', gap: 4 }}>
                {[1,2,3,4,5,6,7,8,9,10].map(n => (
                  <button type="button" key={n} onClick={() => setForm({ ...form, dolor_escala: n })}
                    className={`scale-btn${form.dolor_escala === n ? ` selected${n > 6 ? ' high' : n > 3 ? ' medium' : ''}` : ''}`}>{n}</button>
                ))}
              </div>
            </div>

            <div>
              <label style={{ fontSize: 12, color: 'var(--slate-400)', display: 'block', marginBottom: 6 }}>Estado de ánimo (1=muy bajo, 10=muy bueno)</label>
              <div style={{ display: 'flex', gap: 4 }}>
                {[1,2,3,4,5,6,7,8,9,10].map(n => (
                  <button type="button" key={n} onClick={() => setForm({ ...form, humor_escala: n })}
                    className={`scale-btn${form.humor_escala === n ? ' selected' : ''}`}>{n}</button>
                ))}
              </div>
            </div>

            <div>
              <label style={{ fontSize: 12, color: 'var(--slate-400)', display: 'block', marginBottom: 8 }}>Síntomas</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {SINTOMAS.map(s => (
                  <button type="button" key={s} onClick={() => toggleSintoma(s)}
                    style={{ padding: '6px 11px', borderRadius: 20, fontSize: 12, fontWeight: 500, cursor: 'pointer', border: `1.5px solid ${form.sintomas.includes(s) ? 'var(--teal-500)' : 'var(--slate-200)'}`, background: form.sintomas.includes(s) ? 'var(--teal-500)' : 'white', color: form.sintomas.includes(s) ? 'white' : 'var(--slate-600)', transition: 'all 0.12s' }}>
                    {s}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label style={{ fontSize: 12, color: 'var(--slate-400)', display: 'block', marginBottom: 5 }}>Notas adicionales</label>
              <textarea className="input-field" value={form.notas} onChange={e => setForm({ ...form, notas: e.target.value })} placeholder="Observaciones, medicación tomada, cambios..." rows={2} style={{ resize: 'none' }} />
            </div>

            <button className="btn-primary" type="submit" disabled={guardando}>{guardando ? 'Guardando...' : 'Guardar registro'}</button>
          </form>
        )}

        <p className="section-header">Historial</p>
        {loading && <p style={{ color: 'var(--slate-400)', textAlign: 'center', padding: 20 }}>Cargando...</p>}
        {!loading && registros.length === 0 && (
          <div style={{ textAlign: 'center', padding: '32px 20px', color: 'var(--slate-400)' }}>
            <p style={{ fontSize: 15 }}>Sin registros todavía</p>
            <p style={{ fontSize: 13, marginTop: 6 }}>Añade tu primer ciclo arriba</p>
          </div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {registros.map(r => (
            <div key={r.id} className="card" style={{ padding: '14px 16px', borderLeft: '3px solid var(--teal-500)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--teal-800)' }}>
                    {r.fecha_inicio}{r.fecha_fin ? ` → ${r.fecha_fin}` : ''}
                    {r.duracion_real ? <span style={{ fontSize: 12, color: 'var(--teal-500)', marginLeft: 8 }}>{r.duracion_real} días</span> : null}
                  </p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
                    {r.intensidad_general && <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, background: 'var(--teal-50)', color: 'var(--teal-700)', border: '1px solid var(--teal-100)' }}>{r.intensidad_general}</span>}
                    {r.color_flujo && <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, background: 'var(--teal-50)', color: 'var(--teal-700)', border: '1px solid var(--teal-100)' }}>{r.color_flujo}</span>}
                    {r.dolor_escala && <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, background: 'var(--teal-50)', color: 'var(--teal-700)', border: '1px solid var(--teal-100)' }}>Dolor: {r.dolor_escala}/10</span>}
                  </div>
                  {r.sintomas?.length > 0 && <p style={{ fontSize: 11, color: 'var(--slate-400)', marginTop: 6 }}>{r.sintomas.join(' · ')}</p>}
                  {r.notas && <p style={{ fontSize: 12, color: 'var(--slate-500)', marginTop: 4, fontStyle: 'italic' }}>{r.notas}</p>}
                </div>
                <button onClick={() => eliminar(r.id)} style={{ background: 'none', border: 'none', color: 'var(--slate-300)', cursor: 'pointer', paddingLeft: 12 }}>
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
