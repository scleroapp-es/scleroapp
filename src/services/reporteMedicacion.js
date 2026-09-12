import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../firebase/config';

const DIAS_NOMBRES = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

function getDiaIndex(date) {
  const d = date.getDay();
  return d === 0 ? 6 : d - 1;
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

export async function exportarExcelTomas(uid, nombrePaciente, fechaDesde, fechaHasta) {
  const q = query(collection(db, 'tratamientos'), where('uid', '==', uid));
  const snap = await getDocs(q);
  const tratamientos = snap.docs.map(d => d.data()).filter(t => t.activo !== false);

  if (tratamientos.length === 0) throw new Error('No hay tratamientos activos definidos.');

  const fechas = dateRange(fechaDesde, fechaHasta);
  const filas = [];

  for (const fecha of fechas) {
    const diaIdx = getDiaIndex(fecha);
    const fechaStr = fecha.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const diaNombre = DIAS_NOMBRES[diaIdx];

    for (const t of tratamientos) {
      if (!t.dias?.includes(diaIdx)) continue;
      for (const momento of (t.momentos || [])) {
        filas.push([fechaStr, diaNombre, t.farmaco, t.dosis || '', momento, t.notas || '']);
      }
    }
  }

  if (filas.length === 0) throw new Error('No hay tomas previstas en ese rango de fechas.');

  const headers = ['Fecha', 'Día', 'Medicamento', 'Dosis', 'Momento', 'Notas'];
  const csvRows = [headers.join(';'), ...filas.map(f => f.join(';'))];
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
