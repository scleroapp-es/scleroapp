import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, query, where, orderBy, limit, getDocs, getDoc, doc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../hooks/useAuth';
import { usePerfil } from '../hooks/usePerfil';
import { format, differenceInDays, parseISO, addDays } from 'date-fns';
import { es } from 'date-fns/locale';

function QuickBtn({ icon, label, to }) {
  const navigate = useNavigate();
  return (
    <button onClick={() => navigate(to)}
      style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, padding: '10px 2px 10px', background: 'transparent', border: 'none', borderRadius: 10, cursor: 'pointer', transition: 'transform 0.1s' }}
      onTouchStart={e => e.currentTarget.style.transform = 'scale(0.95)'}
      onTouchEnd={e => e.currentTarget.style.transform = 'scale(1)'}>
      <div style={{ width: 40, height: 40, borderRadius: 12, background: 'var(--teal-50)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {icon}
      </div>
      <span style={{ fontSize: 10, fontWeight: 500, color: 'var(--teal-700)', textAlign: 'center', lineHeight: 1.2 }}>{label}</span>
    </button>
  );
}

function SectionCard({ title, icon, children, to }) {
  const navigate = useNavigate();
  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid var(--teal-50)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {icon}
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--teal-700)' }}>{title}</span>
        </div>
        {to && <button onClick={() => navigate(to)} style={{ fontSize: 11, color: 'var(--teal-500)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 500 }}>Ver todo →</button>}
      </div>
      <div style={{ padding: '10px 16px 14px' }}>{children}</div>
    </div>
  );
}

export default function Home() {
  const { user, logout } = useAuth();
  const { nombre } = usePerfil();
  const navigate = useNavigate();
  const [cuestionarioHoy, setCuestionarioHoy] = useState({ manana: false, noche: false });
  const [proximasCitas, setProximasCitas] = useState([]);
  const [proximasPruebas, setProximasPruebas] = useState([]);
  const [diasCiclo, setDiasCiclo] = useState(null);
  const [enPeriodo, setEnPeriodo] = useState(false);
  const [proximaFechaCiclo, setProximaFechaCiclo] = useState(null);
  const fechaHoy = format(new Date(), 'yyyy-MM-dd');
  const hoy = format(new Date(), "EEEE, d 'de' MMMM", { locale: es });
  const hour = new Date().getHours();
  const saludo = hour < 12 ? 'Buenos días' : hour < 20 ? 'Buenas tardes' : 'Buenas noches';
  const greeting = nombre ? `${saludo}, ${nombre}` : saludo;

  useEffect(() => {
    if (!user) return;
    async function cargar() {
      try {
        const qM = query(collection(db, 'cuestionarios'), where('uid', '==', user.uid), where('fecha', '==', fechaHoy), where('tipo', '==', 'manana'));
        const qN = query(collection(db, 'cuestionarios'), where('uid', '==', user.uid), where('fecha', '==', fechaHoy), where('tipo', '==', 'noche'));
        const [snapM, snapN] = await Promise.all([getDocs(qM), getDocs(qN)]);
        setCuestionarioHoy({ manana: !snapM.empty, noche: !snapN.empty });

        const qCitas = query(collection(db, 'citas'), where('uid', '==', user.uid), where('fecha', '>=', fechaHoy), orderBy('fecha', 'asc'), limit(2));
        const snapCitas = await getDocs(qCitas);
        setProximasCitas(snapCitas.docs.map(d => ({ id: d.id, ...d.data() })));

        // Pruebas: traer todas las del usuario ordenadas por fecha desc, filtrar en cliente
        const qPruebas = query(collection(db, 'pruebas'), where('uid', '==', user.uid), orderBy('fecha', 'desc'), limit(10));
        const snapPruebas = await getDocs(qPruebas);
        const todasPruebas = snapPruebas.docs.map(d => ({ id: d.id, ...d.data() }));
        // Priorizar futuras, luego más recientes
        const futuras = todasPruebas.filter(p => p.fecha >= fechaHoy).sort((a, b) => a.fecha.localeCompare(b.fecha));
        const pasadas = todasPruebas.filter(p => p.fecha < fechaHoy);
        const listaPruebas = [...futuras, ...pasadas].slice(0, 2);
        setProximasPruebas(listaPruebas);
        // Ciclo menstrual
        try {
          const qMens = query(collection(db, 'menstruacion'), where('uid', '==', user.uid), orderBy('fecha_inicio', 'desc'), limit(1));
          const snapMens = await getDocs(qMens);
          if (!snapMens.empty) {
            const ultima = snapMens.docs[0].data();
            const snapConf = await getDoc(doc(db, 'configuracion', user.uid));
            const cicloDias = snapConf.exists() && snapConf.data().cicloDias ? snapConf.data().cicloDias : 28;
            const duracion = snapConf.exists() && snapConf.data().duracionDias ? snapConf.data().duracionDias : 5;
            const ultimaFecha = parseISO(ultima.fecha_inicio);
            const proxima = addDays(ultimaFecha, cicloDias);
            const diff = differenceInDays(proxima, new Date());
            setDiasCiclo(diff);
            setProximaFechaCiclo(proxima);
            const finPeriodo = addDays(ultimaFecha, ultima.duracion_real || duracion);
            setEnPeriodo(differenceInDays(new Date(), ultimaFecha) >= 0 && differenceInDays(finPeriodo, new Date()) > 0);
          }
        } catch (e) {}
      } catch (e) {}
    }
    cargar();
  }, [user, fechaHoy]);

  function diasRestantes(fecha) {
    const diff = differenceInDays(parseISO(fecha), new Date());
    if (diff === 0) return 'Hoy';
    if (diff === 1) return 'Mañana';
    return `En ${diff} días`;
  }

  const i16 = { width: 16, height: 16, viewBox: "0 0 24 24", fill: "none", stroke: "var(--teal-500)", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" };
  const i20 = { width: 20, height: 20, viewBox: "0 0 24 24", fill: "none", stroke: "var(--teal-500)", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" };

  return (
    <div style={{ paddingBottom: 100 }}>
      <div style={{ background: 'var(--teal-500)', padding: '48px 20px 28px', position: 'relative' }}>
        <button onClick={logout} style={{ position: 'absolute', top: 16, right: 16, background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: 8, padding: '6px 12px', color: 'white', fontSize: 12, cursor: 'pointer' }}>Salir</button>
        <p style={{ color: 'rgba(255,255,255,0.75)', fontSize: 13, marginBottom: 4, textTransform: 'capitalize' }}>{hoy}</p>
        <h1 style={{ color: 'white', fontSize: 24, fontWeight: 600 }}>{greeting}</h1>
      </div>

      {/* Accesos rápidos - parte superior */}
      <div style={{ padding: '12px 16px 0', background: 'white', borderBottom: '1px solid var(--teal-50)' }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <QuickBtn to="/tension" label="Tensión" icon={<svg {...i20}><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>} />
          <QuickBtn to="/cuestionarios" label="Diario" icon={<svg {...i20}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>} />
          <QuickBtn to="/citas" label="Citas" icon={<svg {...i20}><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>} />
          <QuickBtn to="/pruebas" label="Pruebas" icon={<svg {...i20}><path d="M9 3H5a2 2 0 0 0-2 2v4m6-6h10a2 2 0 0 1 2 2v4M9 3v11m0 0a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2m-6 0V9m6 5V9"/></svg>} />
          <QuickBtn to="/medicacion" label="Medicación" icon={<svg {...i20}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>} />
          <QuickBtn to="/menstruacion" label="Ciclo" icon={<svg {...i20}><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg>} />
        </div>
      </div>

      <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: 12 }}>

        {/* 0. Ciclo menstrual - PRIMERO */}
        {diasCiclo !== null && (
          <button onClick={() => navigate('/menstruacion')}
            style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', background: enPeriodo ? 'var(--teal-50)' : 'white', border: `1px solid ${enPeriodo ? 'var(--teal-300)' : 'var(--teal-100)'}`, borderRadius: 14, cursor: 'pointer', width: '100%', textAlign: 'left' }}>
            <div style={{ width: 42, height: 42, borderRadius: 12, background: 'var(--teal-500)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <span style={{ fontSize: 16, fontWeight: 700, color: 'white', lineHeight: 1 }}>{enPeriodo ? '●' : Math.max(0, diasCiclo)}</span>
              <span style={{ fontSize: 8, color: 'rgba(255,255,255,0.8)', marginTop: 1 }}>{enPeriodo ? 'HOY' : 'DÍAS'}</span>
            </div>
            <div>
              <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--teal-700)' }}>{enPeriodo ? 'Período en curso' : 'Próxima menstruación'}</p>
              <p style={{ fontSize: 11, color: 'var(--teal-500)', marginTop: 2 }}>
                {enPeriodo ? 'Pulsa para registrar síntomas' :
                  proximaFechaCiclo ? format(proximaFechaCiclo, 'dd-MM-yy') + (diasCiclo === 0 ? ' · Hoy' : diasCiclo === 1 ? ' · Mañana' : ` · En ${diasCiclo} días`) : ''}
              </p>
            </div>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--teal-300)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: 'auto', flexShrink: 0 }}><polyline points="9 18 15 12 9 6"/></svg>
          </button>
        )}

        {/* 1. Citas médicas próximas */}
        {proximasCitas.filter(c => c.tipo_cita !== 'prueba').length > 0 && (
          <SectionCard title="Citas médicas" to="/citas"
            icon={<svg {...i16}><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>}>
            {proximasCitas.filter(c => c.tipo_cita !== 'prueba').slice(0,2).map((c, i, arr) => (
              <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: i < arr.length - 1 ? '1px solid var(--teal-50)' : 'none' }}>
                <div style={{ width: 38, height: 38, borderRadius: 10, background: 'var(--teal-50)', border: '1px solid var(--teal-100)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--teal-700)', lineHeight: 1 }}>{c.fecha?.slice(8)}</span>
                  <span style={{ fontSize: 9, color: 'var(--teal-500)', textTransform: 'uppercase' }}>{c.fecha ? format(parseISO(c.fecha), 'MMM', { locale: es }) : ''}</span>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--teal-800)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.doctor}</p>
                  <p style={{ fontSize: 11, color: 'var(--teal-600)', marginTop: 1 }}>{c.especialidad}</p>
                  {(c.lugar || c.hora) && <p style={{ fontSize: 11, color: 'var(--slate-400)', marginTop: 1 }}>{[c.lugar, c.hora].filter(Boolean).join(' · ')}</p>}
                </div>
                <span style={{ fontSize: 10, fontWeight: 500, padding: '3px 8px', borderRadius: 10, background: 'var(--teal-50)', color: 'var(--teal-700)', border: '1px solid var(--teal-100)', flexShrink: 0 }}>{diasRestantes(c.fecha)}</span>
              </div>
            ))}
          </SectionCard>
        )}

        {/* 1b. Citas para prueba próximas */}
        {proximasCitas.filter(c => c.tipo_cita === 'prueba').length > 0 && (
          <SectionCard title="Pruebas médicas programadas" to="/citas"
            icon={<svg {...i16}><path d="M9 3H5a2 2 0 0 0-2 2v4m6-6h10a2 2 0 0 1 2 2v4M9 3v11m0 0a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2m-6 0V9m6 5V9"/></svg>}>
            {proximasCitas.filter(c => c.tipo_cita === 'prueba').slice(0,2).map((c, i, arr) => (
              <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: i < arr.length - 1 ? '1px solid var(--teal-50)' : 'none' }}>
                <div style={{ width: 38, height: 38, borderRadius: 10, background: '#faeeda', border: '1px solid #BA7517', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: '#854F0B', lineHeight: 1 }}>{c.fecha?.slice(8)}</span>
                  <span style={{ fontSize: 9, color: '#BA7517', textTransform: 'uppercase' }}>{c.fecha ? format(parseISO(c.fecha), 'MMM', { locale: es }) : ''}</span>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--teal-800)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.nombre_prueba || c.doctor}</p>
                  {c.doctor && c.nombre_prueba && <p style={{ fontSize: 11, color: '#BA7517', marginTop: 1 }}>Dr/a: {c.doctor}</p>}
                  {(c.lugar || c.hora) && <p style={{ fontSize: 11, color: 'var(--slate-400)', marginTop: 1 }}>{[c.lugar, c.hora].filter(Boolean).join(' · ')}</p>}
                </div>
                <span style={{ fontSize: 10, fontWeight: 500, padding: '3px 8px', borderRadius: 10, background: '#faeeda', color: '#854F0B', border: '1px solid #BA7517', flexShrink: 0 }}>{diasRestantes(c.fecha)}</span>
              </div>
            ))}
          </SectionCard>
        )}

        {proximasCitas.length === 0 && (
          <SectionCard title="Próximas citas" to="/citas"
            icon={<svg {...i16}><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>}>
            <p style={{ fontSize: 13, color: 'var(--slate-400)', textAlign: 'center', padding: '8px 0' }}>Sin citas próximas</p>
          </SectionCard>
        )}

        {/* 2. Pruebas médicas */}
        <SectionCard title="Pruebas médicas" to="/pruebas"
          icon={<svg {...i16}><path d="M9 3H5a2 2 0 0 0-2 2v4m6-6h10a2 2 0 0 1 2 2v4M9 3v11m0 0a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2m-6 0V9m6 5V9"/></svg>}>
          {proximasPruebas.length === 0 ? (
            <p style={{ fontSize: 13, color: 'var(--slate-400)', textAlign: 'center', padding: '8px 0' }}>Sin pruebas registradas</p>
          ) : proximasPruebas.map((p, i) => (
            <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: i < proximasPruebas.length - 1 ? '1px solid var(--teal-50)' : 'none' }}>
              <div style={{ width: 38, height: 38, borderRadius: 10, background: 'var(--teal-50)', border: '1px solid var(--teal-100)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--teal-700)', lineHeight: 1 }}>{p.fecha?.slice(8)}</span>
                <span style={{ fontSize: 9, color: 'var(--teal-500)', textTransform: 'uppercase' }}>{p.fecha ? format(parseISO(p.fecha), 'MMM', { locale: es }) : ''}</span>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--teal-800)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.tipo}</p>
                {(p.lugar || p.doctor_solicitante) && <p style={{ fontSize: 11, color: 'var(--slate-400)', marginTop: 1 }}>{[p.lugar, p.doctor_solicitante].filter(Boolean).join(' · ')}</p>}
              </div>
              <span style={{ fontSize: 10, fontWeight: 500, padding: '3px 8px', borderRadius: 10, background: 'var(--teal-50)', color: 'var(--teal-700)', border: '1px solid var(--teal-100)', flexShrink: 0 }}>{diasRestantes(p.fecha)}</span>
            </div>
          ))}
        </SectionCard>

        {/* 3. Cuestionarios del día */}
        <SectionCard title="Cuestionarios de hoy" to="/cuestionarios"
          icon={<svg {...i16}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>}>
          <div style={{ display: 'flex', gap: 10 }}>
            {[{ key: 'manana', label: 'Mañana' }, { key: 'noche', label: 'Noche' }].map(({ key, label }) => (
              <button key={key} onClick={() => navigate('/cuestionarios')}
                style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', borderRadius: 10, background: cuestionarioHoy[key] ? 'var(--teal-50)' : 'var(--slate-50)', border: `1px solid ${cuestionarioHoy[key] ? 'var(--teal-300)' : 'var(--slate-200)'}`, cursor: 'pointer' }}>
                <div style={{ width: 20, height: 20, borderRadius: '50%', background: cuestionarioHoy[key] ? 'var(--teal-500)' : 'var(--slate-200)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  {cuestionarioHoy[key] && <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>}
                </div>
                <div style={{ textAlign: 'left' }}>
                  <p style={{ fontSize: 12, fontWeight: 600, color: cuestionarioHoy[key] ? 'var(--teal-700)' : 'var(--slate-600)' }}>{label}</p>
                  <p style={{ fontSize: 10, color: cuestionarioHoy[key] ? 'var(--teal-500)' : 'var(--slate-400)' }}>{cuestionarioHoy[key] ? 'Completado' : 'Pendiente'}</p>
                </div>
              </button>
            ))}
          </div>
        </SectionCard>


      </div>
    </div>
  );
}
