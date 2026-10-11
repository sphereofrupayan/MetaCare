(() => {
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/* ---------- theme, active link, confirm, flash ---------- */
$('#theme').onclick = () => {
  const t = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  document.documentElement.dataset.theme = t; localStorage.setItem('theme', t);
};
$$('nav a').forEach(a => { if (a.pathname === location.pathname) a.classList.add('active'); });
$$('form[data-confirm]').forEach(f => f.addEventListener('submit', e => { if (!confirm(f.dataset.confirm)) e.preventDefault(); }));
$$('.flash').forEach(el => setTimeout(() => el.remove(), 5000));
const paint = s => { s.dataset.s = s.value; };
$$('select[name=status]').forEach(s => { paint(s); s.addEventListener('change', () => paint(s)); });

let tt; const toast = m => { const t = $('#toast'); t.textContent = m; t.classList.add('show'); clearTimeout(tt); tt = setTimeout(() => t.classList.remove('show'), 2200); };

/* ---------- appointment receipt ---------- */
const receipt = $('#appointment-receipt');
if (receipt) {
  $('#print-receipt').addEventListener('click', () => window.print());
  $('#download-receipt').addEventListener('click', () => {
    if (!window.jspdf) return toast('PDF library not loaded - check your internet connection');

    const value = name => receipt.querySelector(`[data-field="${name}"]`)?.textContent.trim() || '';
    const doc = new window.jspdf.jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 18;
    const id = value('id').replace(/^#/, '');

    doc.setFillColor(15, 118, 110);
    doc.rect(0, 0, pageWidth, 48, 'F');
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(margin, 13, 12, 12, 2, 2, 'F');
    doc.setDrawColor(15, 118, 110);
    doc.setLineWidth(1.2);
    doc.line(margin + 6, 15.5, margin + 6, 22.5);
    doc.line(margin + 2.5, 19, margin + 9.5, 19);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(17);
    doc.setTextColor(255, 255, 255);
    doc.text('MetaCare', margin + 17, 19);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(220, 242, 239);
    doc.text('Hospital Management System', margin + 17, 26);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text('APPOINTMENT RECEIPT', pageWidth - margin, 17, { align: 'right' });
    doc.setFontSize(12);
    doc.text('#' + id, pageWidth - margin, 25, { align: 'right' });

    doc.setTextColor(15, 118, 110);
    doc.setFontSize(9);
    doc.text('APPOINTMENT CONFIRMATION', margin, 63);
    doc.setTextColor(23, 33, 43);
    doc.setFontSize(21);
    doc.text('Appointment receipt', margin, 74);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139);
    doc.text('Keep this receipt for your records and bring it to your visit.', margin, 81);

    const status = value('status');
    const statusColors = {
      Scheduled: [37, 99, 235],
      Completed: [21, 128, 61],
      Cancelled: [220, 38, 38],
    };
    const color = statusColors[status] || [71, 85, 105];
    doc.setTextColor(...color);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text(status.toUpperCase(), pageWidth - margin, 68, { align: 'right' });

    const columnGap = 12;
    const columnWidth = (pageWidth - margin * 2 - columnGap) / 2;
    const rightX = margin + columnWidth + columnGap;
    const partyY = 94;
    const partyHeight = 43;
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.35);
    doc.roundedRect(margin, partyY, columnWidth, partyHeight, 2, 2);
    doc.roundedRect(rightX, partyY, columnWidth, partyHeight, 2, 2);

    const addParty = (x, label, name, details) => {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(15, 118, 110);
      doc.text(label, x + 6, partyY + 8);
      doc.setFontSize(12);
      doc.setTextColor(23, 33, 43);
      doc.text(doc.splitTextToSize(name, columnWidth - 12)[0], x + 6, partyY + 17);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(100, 116, 139);
      details.filter(Boolean).slice(0, 2).forEach((line, index) => {
        doc.text(doc.splitTextToSize(line, columnWidth - 12)[0], x + 6, partyY + 25 + index * 6);
      });
    };
    addParty(margin, 'PATIENT', value('patient'), [value('phone'), value('email')]);
    addParty(rightX, 'CARE PROVIDER', value('doctor'), [value('specialization')]);

    const visitY = 150;
    doc.setFillColor(244, 248, 248);
    doc.setDrawColor(228, 238, 238);
    doc.roundedRect(margin, visitY, pageWidth - margin * 2, 39, 2, 2, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(15, 118, 110);
    doc.text('VISIT DETAILS', margin + 6, visitY + 9);
    const visitFields = [
      ['DATE', value('date')],
      ['TIME', value('time')],
      ['APPOINTMENT ID', '#' + id],
    ];
    const visitColumn = (pageWidth - margin * 2 - 12) / 3;
    visitFields.forEach(([label, text], index) => {
      const x = margin + 6 + index * visitColumn;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      doc.text(label, x, visitY + 19);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(23, 33, 43);
      doc.text(text, x, visitY + 27);
    });

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(15, 118, 110);
    doc.text('REASON FOR VISIT', margin, 203);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(51, 65, 85);
    doc.text(doc.splitTextToSize(value('reason'), pageWidth - margin * 2), margin, 211);

    doc.setDrawColor(226, 232, 240);
    doc.line(margin, 266, pageWidth - margin, 266);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(23, 33, 43);
    doc.text('Thank you for choosing MetaCare.', margin, 274);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text('Please arrive 10 minutes before your scheduled appointment.', margin, 280);
    doc.save(`appointment-receipt-${id}.pdf`);
    toast('Receipt PDF downloaded');
  });
}

/* ---------- table helpers (filter + CSV + PDF) ---------- */
const cellText = td => {
  const sel = $('select', td);
  return (sel ? (sel.selectedOptions[0] || sel.options[0]).textContent : td.textContent).replace(/\s+/g, ' ').trim();
};
function tableData(t) {
  const rows = $$('tr', t), head = $$('th', rows[0]);
  const keep = head.map((h, i) => (h.textContent.trim() ? i : -1)).filter(i => i >= 0); // skips the empty "actions" column
  const body = rows.slice(1).filter(r => r.style.display !== 'none').map(r => { const c = $$('td', r); return keep.map(i => cellText(c[i])); });
  return { head: keep.map(i => head[i].textContent.trim()), body };
}
const title = () => ($('h1')?.textContent || 'export').trim();
const fname = () => title().toLowerCase().replace(/\s+/g, '-') + '-' + new Date().toISOString().slice(0, 10);
function save(name, blob) { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000); }
function exportCSV(t) {
  const { head, body } = tableData(t), q = v => '"' + v.replace(/"/g, '""') + '"';
  const csv = [head, ...body].map(r => r.map(q).join(',')).join('\r\n');
  save(fname() + '.csv', new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' }));
  toast('CSV downloaded');
}
function exportPDF(t) {
  if (!window.jspdf) return toast('PDF library not loaded - check your internet connection');
  const doc = new window.jspdf.jsPDF({ orientation: 'landscape' }), { head, body } = tableData(t);
  doc.setFontSize(17); doc.setTextColor(15, 118, 110); doc.text('MetaCare - ' + title(), 14, 16);
  doc.setFontSize(9); doc.setTextColor(110); doc.text('Generated ' + new Date().toLocaleString(), 14, 22);
  doc.autoTable({ head: [head], body, startY: 27, styles: { fontSize: 9 }, headStyles: { fillColor: [15, 118, 110] }, alternateRowStyles: { fillColor: [244, 247, 250] } });
  doc.save(fname() + '.pdf'); toast('PDF downloaded');
}
$$('.card').forEach(card => {
  const t = $('table', card); if (!t) return;
  const bar = document.createElement('div'); bar.className = 'tools';
  bar.innerHTML = '<input class="filter" placeholder="Filter rows…"><button data-a="csv">Export CSV</button><button data-a="pdf">Export PDF</button>';
  card.prepend(bar);
  $('.filter', bar).addEventListener('input', e => {
    const v = e.target.value.toLowerCase();
    $$('tr', t).slice(1).forEach(r => { r.style.display = r.textContent.toLowerCase().includes(v) ? '' : 'none'; });
  });
  bar.addEventListener('click', e => { const a = e.target.dataset.a; if (a === 'csv') exportCSV(t); if (a === 'pdf') exportPDF(t); });
});

/* ---------- AI assistant (runs in the browser, reads your pages - no backend changes) ---------- */
const orb = $('#orb'), panel = $('#panel'), msgs = $('#msgs');
const pages = { patients: '/patients', doctors: '/doctors', appointments: '/appointments', records: '/records' };
let cache = null, cacheAt = 0;

async function loadData() {
  if (cache && Date.now() - cacheAt < 30000) return cache;
  const out = {};
  await Promise.all(Object.entries(pages).map(async ([k, u]) => {
    out[k] = [];
    try {
      const doc = new DOMParser().parseFromString(await (await fetch(u)).text(), 'text/html');
      const t = $('table', doc); if (!t) return;
      const rows = $$('tr', t), head = $$('th', rows[0]).map(h => h.textContent.trim().toLowerCase());
      out[k] = rows.slice(1).map(r => { const o = {}, c = $$('td', r); head.forEach((h, i) => { if (h) o[h] = cellText(c[i]); }); return o; });
    } catch (e) { /* page unavailable */ }
  }));
  cache = out; cacheAt = Date.now(); return out;
}

const say = (html, me) => { const d = document.createElement('div'); d.className = 'm ' + (me ? 'me' : 'bot'); d.innerHTML = html; msgs.append(d); msgs.scrollTop = msgs.scrollHeight; };
const ul = (rows, fn, max = 8) => rows.length ? '<ul>' + rows.slice(0, max).map(r => '<li>' + fn(r) + '</li>').join('') + '</ul>' + (rows.length > max ? `<small>…and ${rows.length - max} more</small>` : '') : '';
const apptLine = a => `<b>${esc(a.date)}</b> ${esc(a.time)} · ${esc(a.patient)} → ${esc(a.doctor)} <small>(${esc(a.status)})</small>`;
const STOP = new Set('the a an of for to is are me my show list find tell about with and any all who what which when where how many do does there have has can you please give get'.split(' '));

async function answer(q) {
  const { patients: P, doctors: D, appointments: A, records: R } = await loadData();
  const s = q.toLowerCase(), today = new Date().toLocaleDateString('en-CA');
  const byTime = (a, b) => (a.date + a.time).localeCompare(b.date + b.time);

  if (/^(hi|hello|hey)\b|^help|what can you/.test(s))
    return 'Hi! I can summarise the system, list today\'s or upcoming appointments, find a patient or doctor, filter by status or specialization, and explain how to book or export. Try a chip below.';
  if (/\bbook|new appointment|schedule an/.test(s))
    return 'To book: open <a href="/appointments">Appointments</a>, pick a patient and doctor, choose a date and time, then press <b>Book</b>. The system blocks double-booking for the same doctor and time.';
  if (/export|csv|pdf|download/.test(s))
    return 'Every table has <b>Export CSV</b> and <b>Export PDF</b> buttons above it. Use the filter box first and only the visible rows are exported.';
  if (/summary|overview|stats|how many|count|total/.test(s)) {
    const sch = A.filter(a => a.status === 'Scheduled').length;
    const all = `<ul><li><b>${P.length}</b> patients</li><li><b>${D.length}</b> doctors</li><li><b>${A.length}</b> appointments (${sch} scheduled)</li><li><b>${R.length}</b> medical records</li></ul>`;
    if (/patient/.test(s)) return `There are <b>${P.length}</b> patients.`;
    if (/doctor/.test(s)) return `There are <b>${D.length}</b> doctors.`;
    if (/record/.test(s)) return `There are <b>${R.length}</b> medical records.`;
    if (/appointment/.test(s)) return `There are <b>${A.length}</b> appointments, <b>${sch}</b> scheduled.`;
    return 'Here is the overview:' + all;
  }
  if (/today/.test(s)) {
    const r = A.filter(a => a.date === today).sort(byTime);
    return r.length ? `<b>${r.length}</b> appointment(s) today:` + ul(r, apptLine) : 'No appointments scheduled for today.';
  }
  const st = (s.match(/scheduled|completed|cancel/) || [])[0];
  if (st && /appointment|status|show|list/.test(s)) {
    const key = st.startsWith('cancel') ? 'Cancelled' : st[0].toUpperCase() + st.slice(1);
    const r = A.filter(a => a.status === key).sort(byTime);
    return r.length ? `<b>${r.length}</b> ${key.toLowerCase()} appointment(s):` + ul(r, apptLine) : `No ${key.toLowerCase()} appointments.`;
  }
  if (/upcoming|next|soon/.test(s)) {
    const r = A.filter(a => a.status === 'Scheduled' && a.date >= today).sort(byTime);
    return r.length ? 'Upcoming appointments:' + ul(r, apptLine) : 'No upcoming appointments.';
  }
  const words = s.replace(/[^a-z0-9. @]/g, ' ').split(/\s+/).filter(w => w.length > 2 && !STOP.has(w));
  if (/doctor|specialist|specialization/.test(s)) {
    const w = words.filter(x => !/^(doctor|doctors|specialist|specialization)$/.test(x));
    const r = w.length ? D.filter(d => w.some(x => (d.name + ' ' + d.specialization).toLowerCase().includes(x))) : D;
    return r.length ? 'Doctors:' + ul(r, d => `<b>${esc(d.name)}</b> · ${esc(d.specialization)} <small>${esc(d.phone)}</small>`) : 'No matching doctors found.';
  }
  const all = [['Patients', P, p => `<b>${esc(p.name)}</b>, ${esc(p.age)} ${esc(p.gender)} <small>${esc(p.phone)}</small>`],
    ['Doctors', D, d => `<b>${esc(d.name)}</b> · ${esc(d.specialization)}`],
    ['Appointments', A, apptLine],
    ['Records', R, r => `${esc(r['record date'] || r.date)} · <b>${esc(r.patient)}</b>: ${esc(r.diagnosis)} <small>${esc(r.prescription)}</small>`]];
  const hits = words.length ? all.map(([n, rows, f]) => [n, rows.filter(r => words.every(w => Object.values(r).join(' ').toLowerCase().includes(w))), f]).filter(h => h[1].length) : [];
  if (!hits.length) return 'I couldn\'t find anything for that. Try a patient or doctor name, "today\'s appointments", "cardiology doctors" or "summary".';
  return hits.map(([n, rows, f]) => `<b>${n}</b>` + ul(rows, f, 5)).join('');
}

async function ask(q) {
  q = q.trim(); if (!q) return;
  say(esc(q), true); orb.classList.add('thinking');
  try { say(await answer(q)); } catch (e) { say('Sorry, something went wrong reading the data.'); }
  orb.classList.remove('thinking');
}
const chips = ['Summary', "Today's appointments", 'Upcoming appointments', 'Doctors', 'How to book'];
$('#chips').innerHTML = chips.map(c => `<button type="button">${c}</button>`).join('');
$('#chips').onclick = e => { if (e.target.tagName === 'BUTTON') ask(e.target.textContent); };
$('#ask').onsubmit = e => { e.preventDefault(); const i = $('#q'); ask(i.value); i.value = ''; };
const toggle = f => { panel.classList.toggle('open', f); if (panel.classList.contains('open')) $('#q').focus(); };
orb.onclick = () => toggle(); $('#close').onclick = () => toggle(false);
say('Hello! I\'m your MetaCare assistant. Ask me about patients, doctors or appointments.');

/* ---------- dashboard extras (only on the dashboard page) ---------- */
if ($('#dash')) (async () => {
  const hr = new Date().getHours();
  $('#greet').textContent = (hr < 12 ? 'Good morning' : hr < 18 ? 'Good afternoon' : 'Good evening') + ', Doctor';
  const tick = () => {
    const n = new Date();
    $('#clock').textContent = n.toLocaleTimeString('en-GB');
    $('#dateline').textContent = n.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  };
  tick(); setInterval(tick, 1000);

  $$('.stat b').forEach(b => {
    const end = parseInt(b.textContent, 10) || 0; let i = 0; const step = Math.max(1, Math.ceil(end / 30));
    if (!end) return;
    const t = setInterval(() => { i = Math.min(end, i + step); b.textContent = i; if (i >= end) clearInterval(t); }, 30);
  });

  const { patients: P, doctors: D, appointments: A } = await loadData();
  const today = new Date().toLocaleDateString('en-CA');

  // donut by status
  const cols = { Scheduled: '#3b82f6', Completed: '#16a34a', Cancelled: '#dc2626' };
  const counts = Object.fromEntries(Object.keys(cols).map(k => [k, A.filter(a => a.status === k).length]));
  const total = A.length; let acc = 0;
  const stops = total ? Object.keys(cols).map(k => { const from = acc / total * 100; acc += counts[k]; return `${cols[k]} ${from}% ${acc / total * 100}%`; }).join(',') : 'var(--line) 0 100%';
  $('#donut').style.background = `conic-gradient(${stops})`;
  $('#donutN').textContent = total;
  $('#legend').innerHTML = Object.keys(cols).map(k => `<li><i style="background:${cols[k]}"></i>${k}: ${counts[k]}</li>`).join('');

  const bars = (el, entries) => {
    if (!entries.length) { el.innerHTML = '<p class="hint">Nothing to show yet.</p>'; return; }
    const max = Math.max(...entries.map(e => e[1]));
    el.innerHTML = entries.map(([n, v]) => `<div class="bar-row"><span class="lb" title="${esc(n)}">${esc(n)}</span><div class="tr"><div class="fl" data-w="${v / max * 100}"></div></div><span class="v">${v}</span></div>`).join('');
    requestAnimationFrame(() => setTimeout(() => $$('.fl', el).forEach(f => f.style.width = f.dataset.w + '%'), 60));
  };
  const tally = (rows, key) => { const m = {}; rows.forEach(r => { const k = r[key] || 'Other'; m[k] = (m[k] || 0) + 1; }); return Object.entries(m).sort((a, b) => b[1] - a[1]); };

  bars($('#specbars'), tally(D, 'specialization').slice(0, 6));
  bars($('#genderbars'), tally(P, 'gender'));
  const ages = P.map(p => parseInt(p.age, 10)).filter(n => n > 0);
  $('#avgage').textContent = ages.length ? `Average patient age: ${Math.round(ages.reduce((a, b) => a + b, 0) / ages.length)} years` : '';

  // busiest doctors (scheduled appointments)
  const sched = A.filter(a => a.status === 'Scheduled');
  const load = D.map(d => [d.name, sched.filter(a => a.doctor.startsWith(d.name)).length]).filter(x => x[1] > 0).sort((a, b) => b[1] - a[1]).slice(0, 5);
  bars($('#busy'), load);

  // today's timeline
  const td = A.filter(a => a.date === today).sort((a, b) => a.time.localeCompare(b.time));
  $('#timeline').innerHTML = td.length
    ? td.map(a => `<div class="tl"><b>${esc(a.time)}</b><span>${esc(a.patient)}<small>with ${esc(a.doctor)}, ${esc(a.status)}</small></span></div>`).join('')
    : '<p class="hint">No appointments today.</p>';
})();
})();