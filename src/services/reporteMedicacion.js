import { collection, getDocs, query, where, orderBy } from 'firebase/firestore';
import { db } from '../firebase/config';

export async function exportarExcelTomas(uid, nombrePaciente, fechaDesde, fechaHasta) {
  const desdeStr = fechaDesde.toISOString().slice(0,10);
  const hastaStr = fechaHasta.toISOString().slice(0,10);

  const q = query(
    collection(db, 'tomas'),
    where('uid', '==', uid),
    where('fecha', '>=', desdeStr),
    where('fecha', '<=', hastaStr),
    orderBy('fecha', 'asc')
  );
  const snap = await getDocs(q);
  const tomas = snap.docs.map(d => d.data());

  if (tomas.length === 0) throw new Error('No hay tomas registradas en ese rango de fechas.');

  const headers = ['Fecha', 'Hora', 'Medicamento', 'Dosis', 'Momento'];
  const csvRows = [
    headers.join(';'),
    ...tomas.map(t => [t.fecha, t.hora || '', t.farmaco, t.dosis || '', t.momento || ''].join(';'))
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
  return tomas.length;
}

export async function exportarPDFTomas(uid, nombrePaciente, fechaDesde, fechaHasta) {
  const desdeStr = fechaDesde.toISOString().slice(0,10);
  const hastaStr = fechaHasta.toISOString().slice(0,10);

  const q = query(
    collection(db, 'tomas'),
    where('uid', '==', uid),
    where('fecha', '>=', desdeStr),
    where('fecha', '<=', hastaStr),
    orderBy('fecha', 'asc')
  );
  const snap = await getDocs(q);
  const tomas = snap.docs.map(d => d.data());

  if (tomas.length === 0) throw new Error('No hay tomas registradas en ese rango de fechas.');

  const desde = fechaDesde.toLocaleDateString('es-ES');
  const hasta = fechaHasta.toLocaleDateString('es-ES');
  const hoy = new Date().toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' });

  // Group by date
  const porFecha = {};
  for (const t of tomas) {
    if (!porFecha[t.fecha]) porFecha[t.fecha] = [];
    porFecha[t.fecha].push(t);
  }

  const rowsHTML = Object.entries(porFecha).map(([fecha, filas]) =>
    filas.map((t, i) => `
      <tr>
        ${i === 0 ? `<td rowspan="${filas.length}" style="background:#f0fdf4;font-weight:600;vertical-align:middle;white-space:nowrap">${fecha}</td>` : ''}
        <td style="white-space:nowrap">${t.hora || '—'}</td>
        <td style="font-weight:500">${t.farmaco}</td>
        <td>${t.dosis || '—'}</td>
        <td><span style="background:#e6f4f1;color:#0f766e;padding:2px 8px;border-radius:10px;font-size:11px">${t.momento || '—'}</span></td>
      </tr>
    `).join('')
  ).join('');

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8"/>
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    body { font-family:'Segoe UI',Arial,sans-serif; color:#1e2e2c; background:white; padding:36px; font-size:13px; }
    .header { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:28px; padding-bottom:18px; border-bottom:2px solid #0f766e; }
    .logo-icon { width:44px; height:44px; background:#0f766e; border-radius:12px; display:flex; align-items:center; justify-content:center; margin-right:12px; }
    .logo { display:flex; align-items:center; }
    .app-name { font-size:22px; font-weight:700; color:#0f766e; }
    .app-sub { font-size:11px; color:#8fa39f; margin-top:2px; }
    .report-title { font-size:16px; font-weight:600; color:#1e2e2c; text-align:right; }
    .report-date { font-size:11px; color:#8fa39f; margin-top:4px; text-align:right; }
    .patient-box { background:#e6f4f1; border-radius:10px; padding:12px 18px; margin-bottom:20px; display:flex; justify-content:space-between; }
    .patient-label { font-size:11px; color:#095e57; text-transform:uppercase; letter-spacing:0.06em; margin-bottom:3px; }
    .patient-value { font-size:15px; font-weight:600; color:#0f766e; }
    .stats { display:flex; gap:12px; margin-bottom:20px; }
    .stat { background:#f8faf9; border:1px solid #b3ddd6; border-radius:10px; padding:10px 16px; text-align:center; flex:1; }
    .stat-val { font-size:20px; font-weight:700; color:#0f766e; }
    .stat-label { font-size:10px; color:#8fa39f; margin-top:2px; text-transform:uppercase; }
    table { width:100%; border-collapse:collapse; margin-bottom:24px; }
    th { background:#0f766e; color:white; padding:9px 10px; font-size:11px; font-weight:600; text-align:left; }
    th:first-child { border-radius:8px 0 0 0; } th:last-child { border-radius:0 8px 0 0; }
    td { padding:8px 10px; border-bottom:1px solid #f0f0f0; vertical-align:middle; font-size:12px; }
    .footer { padding-top:14px; border-top:1px solid #e6f4f1; display:flex; justify-content:space-between; font-size:10px; color:#8fa39f; }
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
    <div>
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
    <div>
      <div class="patient-label">Total de tomas registradas</div>
      <div class="patient-value">${tomas.length}</div>
    </div>
  </div>

  <div class="stats">
    <div class="stat">
      <div class="stat-val">${Object.keys(porFecha).length}</div>
      <div class="stat-label">Días registrados</div>
    </div>
    <div class="stat">
      <div class="stat-val">${[...new Set(tomas.map(t => t.farmaco))].length}</div>
      <div class="stat-label">Medicamentos</div>
    </div>
    <div class="stat">
      <div class="stat-val">${Math.round(tomas.length / Math.max(Object.keys(porFecha).length,1) * 10) / 10}</div>
      <div class="stat-label">Tomas por día</div>
    </div>
  </div>

  <table>
    <thead>
      <tr><th>Fecha</th><th>Hora</th><th>Medicamento</th><th>Dosis</th><th>Momento</th></tr>
    </thead>
    <tbody>${rowsHTML}</tbody>
  </table>

  <div class="footer">
    <span>ScleroApp · Informe de tomas registradas por el paciente · ${hoy}</span>
    <span>Documento de uso médico personal.</span>
  </div>
</body>
</html>`;

  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const desdeN = fechaDesde.toLocaleDateString('es-ES').replace(/\//g, '-');
  const hastaN = fechaHasta.toLocaleDateString('es-ES').replace(/\//g, '-');
  a.download = `ScleroApp_Medicacion_${desdeN}_${hastaN}.html`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  return tomas.length;
}
