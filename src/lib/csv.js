// Download a table as a CSV that Excel opens well in Spanish (semicolons, UTF-8 with BOM).
export function downloadCsv(filename, rows) {
  const cell = (v) => {
    const s = v == null ? '' : String(v);
    return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const text = rows.map((r) => r.map(cell).join(';')).join('\r\n');
  const blob = new Blob(['﻿', text], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

const slug = (s) => String(s || 'negocio').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-');

// Every booking/order, one per line.
export function exportBookings(business, orders) {
  const rows = [['Fecha', 'Hora', 'Cliente', 'Correo', 'Teléfono', 'Personas', 'Detalle', 'Estado', 'Origen', 'Nota', 'Valoración', 'Creada']];
  [...orders].sort((a, b) => `${b.date} ${b.time}`.localeCompare(`${a.date} ${a.time}`)).forEach((o) => rows.push([
    o.date, String(o.time || '').slice(0, 13), o.customer, o.customer_email, o.phone, o.guests ?? '', String(o.items || '').split(' · Nota:')[0],
    o.status, o.source === 'app' || !o.source ? (o.channel || 'NetWish') : o.source, o.note, o.rating ?? '',
    o.created_at ? new Date(o.created_at).toLocaleString('es-ES') : '',
  ]));
  downloadCsv(`reservas-${slug(business.name)}.csv`, rows);
}

// One line per customer: visits, last visit and contact.
export function exportCustomers(business, orders, profiles) {
  const map = new Map();
  for (const o of orders) {
    const key = o.customer_email ? `mail:${o.customer_email.toLowerCase()}` : o.phone ? `tel:${String(o.phone).replace(/\D/g, '')}` : null;
    if (!key) continue;
    const c = map.get(key) || { name: o.customer, email: o.customer_email || '', phone: o.phone || '', visits: 0, noshow: 0, last: '', key };
    if (['Completado', 'Sentado', 'Recogido'].includes(o.status)) c.visits += 1;
    if (o.status === 'No vino') c.noshow += 1;
    if ((o.date || '') > c.last) c.last = o.date;
    if (!c.phone && o.phone) c.phone = o.phone;
    map.set(key, c);
  }
  const notes = profiles instanceof Map ? profiles : new Map(Object.entries(profiles || {}));
  const rows = [['Nombre', 'Correo', 'Teléfono', 'Visitas', 'No vino', 'Última vez', 'Etiquetas', 'Nota', 'Cumpleaños']];
  [...map.values()].sort((a, b) => b.visits - a.visits).forEach((c) => {
    const p = notes.get(c.key) || {};
    rows.push([c.name, c.email, c.phone, c.visits, c.noshow, c.last, (p.tags || []).join(', '), p.note || '', p.birthday || '']);
  });
  downloadCsv(`clientes-${slug(business.name)}.csv`, rows);
}
