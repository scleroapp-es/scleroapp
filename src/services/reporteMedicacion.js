import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../firebase/config';

const DIAS_NOMBRES = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

function getDiaIndex(date) {
  const d = date.getDay(); // 0=Sun
  return d === 0 ? 6 : d - 1; // Mon=0 ... Sun=6
}

function dateRange(desde, hasta) {
  const dates = [];
  const current = new Date(desde);
  const end = new Date(hasta);
  while (current <= end) {
    dates.push(new Date(current));
    current.setDate(current.getDate() + 1);
  }
  return dates;
}

function formatDate(date) {
  return date.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export async function generarHistoricoTomas(uid, nombrePaciente, fechaDesde, fechaHasta) {
  // Load treatments
  const q = query(collection(db, 'tratamientos'), where('uid', '==', uid));
  const snap = await getDocs(q);
  const tratamientos = snap.docs.map(d => d.data());

  if (tratamientos.length === 0) throw new Error('No hay tratamientos definidos.');

  // Generate all expected doses in range
  const fechas = dateRange(fechaDesde, fechaHasta);
  const filas = [];

  for (const fecha of fechas) {
    const diaIdx = getDiaIndex(fecha);
    const diaNombre = DIAS_NOMBRES[diaIdx];
    const fechaStr = formatDate(fecha);

    for (const t of tratamientos) {
      if (!t.dias?.includes(diaIdx)) continue;
      if (t.activo === false) continue; // skip inactive

      for (const momento of (t.momentos || [])) {
        filas.push({
          fecha: fechaStr,
          dia: diaNombre,
          medicamento: t.farmaco,
          dosis: t.dosis || '—',
          momento,
          notas: t.notas || '',
        });
      }
    }
  }

  if (filas.length === 0) throw new Error('No hay tomas previstas en ese rango de fechas con los tratamientos activos.');

  return { filas, total: filas.length };
}

export async function exportarExcelTomas(uid, nombrePaciente, fechaDesde, fechaHasta) {
  const { filas } = await generarHistoricoTomas(uid, nombrePaciente, fechaDesde, fechaHasta);

  const headers = ['Fecha', 'Día', 'Medicamento', 'Dosis', 'Momento', 'Notas'];
  const csvRows = [
    headers.join(';'),
    ...filas.map(f => [f.fecha, f.dia, f.medicamento, f.dosis, f.momento, f.notas].join(';'))
  ];

  const csvContent = '\uFEFF' + csvRows.join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const desde = fechaDesde.toLocaleDateString('es-ES').replace(/\//g, '-');
  const hasta = fechaHasta.toLocaleDateString('es-ES').replace(/\//g, '-');
  a.download = `ScleroApp_Medicacion_${desde}_${hasta}.csv`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  return filas.length;
}

export async function exportarPDFTomas(uid, nombrePaciente, fechaDesde, fechaHasta) {
  const { filas } = await generarHistoricoTomas(uid, nombrePaciente, fechaDesde, fechaHasta);

  const desde = fechaDesde.toLocaleDateString('es-ES');
  const hasta = fechaHasta.toLocaleDateString('es-ES');
  const hoy = new Date().toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' });

  // Group by date for cleaner display
  const porFecha = {};
  for (const f of filas) {
    if (!porFecha[f.fecha]) porFecha[f.fecha] = { dia: f.dia, tomas: [] };
    porFecha[f.fecha].tomas.push(f);
  }

  const rowsHTML = Object.entries(porFecha).map(([fecha, { dia, tomas }]) => {
    return tomas.map((t, i) => `
      <tr>
        ${i === 0 ? `<td rowspan="${tomas.length}" style="background:#f0fdf4;font-weight:600;vertical-align:middle">${fecha}<br><span style="font-size:11px;color:#059669;font-weight:400">${dia}</span></td>` : ''}
        <td style="font-weight:500">${t.medicamento}</td>
        <td>${t.dosis}</td>
        <td><span style="background:#e6f4f1;color:#0f766e;padding:2px 8px;border-radius:10px;font-size:11px">${t.momento}</span></td>
        <td style="font-size:11px;color:#666;font-style:italic">${t.notas}</td>
      </tr>
    `).join('');
  }).join('');

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8"/>
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    body { font-family:'Segoe UI',Arial,sans-serif; color:#1e2e2c; background:white; padding:36px; font-size:13px; }
    .header { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:28px; padding-bottom:18px; border-bottom:2px solid #0f766e; }
    .logo { display:flex; align-items:center; gap:12px; }
    .logo-icon { width:44px; height:44px; background:#0f766e; border-radius:12px; display:flex; align-items:center; justify-content:center; }
    .app-name { font-size:22px; font-weight:700; color:#0f766e; }
    .app-sub { font-size:11px; color:#8fa39f; margin-top:2px; }
    .report-meta { text-align:right; }
    .report-title { font-size:16px; font-weight:600; color:#1e2e2c; }
    .report-date { font-size:11px; color:#8fa39f; margin-top:4px; }
    .patient-box { background:#e6f4f1; border-radius:10px; padding:12px 18px; margin-bottom:24px; display:flex; justify-content:space-between; align-items:center; }
    .patient-label { font-size:11px; color:#095e57; text-transform:uppercase; letter-spacing:0.06em; margin-bottom:3px; }
    .patient-value { font-size:15px; font-weight:600; color:#0f766e; }
    .stats { display:flex; gap:16px; margin-bottom:24px; }
    .stat { background:#f8faf9; border:1px solid #b3ddd6; border-radius:10px; padding:10px 16px; text-align:center; flex:1; }
    .stat-val { font-size:20px; font-weight:700; color:#0f766e; }
    .stat-label { font-size:10px; color:#8fa39f; margin-top:2px; text-transform:uppercase; }
    table { width:100%; border-collapse:collapse; margin-bottom:24px; }
    th { background:#0f766e; color:white; padding:9px 10px; font-size:11px; font-weight:600; text-align:left; }
    th:first-child { border-radius:8px 0 0 0; }
    th:last-child { border-radius:0 8px 0 0; }
    td { padding:8px 10px; border-bottom:1px solid #f0f0f0; vertical-align:middle; font-size:12px; }
    tr:nth-child(even) td:not(:first-child) { background:#fafafa; }
    .footer { margin-top:24px; padding-top:14px; border-top:1px solid #e6f4f1; display:flex; justify-content:space-between; font-size:10px; color:#8fa39f; }
    @media print { body { padding:20px; } }
  </style>
</head>
<body>
  <div class="header">
    <div class="logo">
      <div class="logo-icon">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
        </svg>
      </div>
      <div>
        <div class="app-name">ScleroApp</div>
        <div class="app-sub">Sistema de Control y Seguimiento para pacientes ES</div>
      </div>
    </div>
    <div class="report-meta">
      <div class="report-title">Informe de Medicación</div>
      <div class="report-date">Generado el ${hoy}</div>
      <div class="report-date">Período: ${desde} — ${hasta}</div>
    </div>
  </div>

  <div class="patient-box">
    <div>
      <div class="patient-label">Paciente</div>
      <div class="patient-value">${nombrePaciente || 'Paciente'}</div>
    </div>
    <div style="text-align:right">
      <div class="patient-label">Total de tomas previstas</div>
      <div class="patient-value">${filas.length}</div>
    </div>
  </div>

  <div class="stats">
    <div class="stat">
      <div class="stat-val">${Object.keys(porFecha).length}</div>
      <div class="stat-label">Días con medicación</div>
    </div>
    <div class="stat">
      <div class="stat-val">${[...new Set(filas.map(f => f.medicamento))].length}</div>
      <div class="stat-label">Medicamentos distintos</div>
    </div>
    <div class="stat">
      <div class="stat-val">${Math.round(filas.length / Math.max(Object.keys(porFecha).length, 1) * 10) / 10}</div>
      <div class="stat-label">Tomas por día</div>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th>Fecha</th>
        <th>Medicamento</th>
        <th>Dosis</th>
        <th>Momento</th>
        <th>Notas</th>
      </tr>
    </thead>
    <tbody>${rowsHTML}</tbody>
  </table>

  <div class="footer">
    <span>ScleroApp · Informe generado automáticamente · ${hoy}</span>
    <span>Documento de uso médico personal. Consulte siempre con su médico.</span>
  </div>
</body>
</html>`;

  const win = window.open('', '_blank');
  win.document.write(html);
  win.document.close();
  setTimeout(() => win.print(), 800);
  return filas.length;
}
