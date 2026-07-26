export const C = {
  bg:      '#0D1B2A',
  panel:   '#1C3D5A',
  card:    '#264E70',
  card2:   '#162B3E',
  border:  '#0A1A2A',
  white:   '#FFFFFF',
  light:   '#E5E7EB',
  gray:    '#8B95A8',
  green:   '#10B981',
  red:     '#EF4444',
  amber:   '#F59E0B',
  cyan:    '#38BDF8',
  pink:    '#F472B6',
  greenBg: '#064E3B',
  redBg:   '#7F1D1D',
  amberBg: '#2D1B00',
  cyanBg:  '#0C2D4A',
};

export const STATUS_OBRA = {
  'No prazo':     { bg: C.greenBg, fg: C.green },
  'Atrasada':     { bg: C.redBg,   fg: C.red   },
  'Não iniciada': { bg: C.card2,   fg: C.gray  },
  'Concluída':    { bg: C.cyanBg,  fg: C.cyan  },
};

export const STATUS_FAT = {
  'Recebido':   { bg: C.greenBg, fg: C.green },
  'Emitido':    { bg: C.amberBg, fg: C.amber },
  'A emitir':   { bg: C.card2,   fg: C.gray  },
  'Vencido':    { bg: C.redBg,   fg: C.red   },
  'Cancelado':  { bg: C.redBg,   fg: C.red   },
};

export const STATUS_PAG = {
  'Pago':       { bg: C.greenBg, fg: C.green },
  'Pendente':   { bg: C.amberBg, fg: C.amber },
  'Não iniciado':{ bg: C.card2,  fg: C.gray  },
  'Atrasado':   { bg: C.redBg,   fg: C.red   },
};

export function fmtBRL(v) {
  if (v == null || v === '') return '—';
  return Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function fmtDate(v) {
  if (!v) return '—';
  const d = typeof v === 'string' ? new Date(v + 'T12:00:00') : new Date(v);
  return d.toLocaleDateString('pt-BR');
}

export function fmtPct(v) {
  if (v == null) return '—';
  return `${(Number(v) * 100).toFixed(1)}%`;
}

export function diffDays(a, b) {
  if (!a || !b) return 0;
  return Math.round((new Date(b) - new Date(a)) / 86400000);
}

export function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export const s = {
  card:   { background: C.card,  border: `1px solid ${C.border}`, borderRadius: 8, padding: '12px 16px' },
  panel:  { background: C.panel, border: `1px solid ${C.border}`, borderRadius: 8 },
  input:  { background: C.card2, border: `1px solid ${C.card}`, borderRadius: 6, padding: '6px 10px',
            color: C.light, fontSize: 13, fontFamily: 'IBM Plex Sans', width: '100%', outline: 'none' },
  label:  { fontSize: 11, color: C.gray, fontWeight: 600, marginBottom: 4, display: 'block', textTransform: 'uppercase', letterSpacing: '0.05em' },
  btn:    { background: C.card, border: `1px solid ${C.card}`, borderRadius: 6, padding: '7px 14px',
            color: C.white, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'IBM Plex Sans' },
  btnPrimary: { background: C.amber, border: 'none', borderRadius: 6, padding: '8px 18px',
                color: '#0D1B2A', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'IBM Plex Sans' },
  btnGreen:   { background: C.greenBg, border: `1px solid ${C.green}`, borderRadius: 6, padding: '7px 14px',
                color: C.green, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'IBM Plex Sans' },
  btnRed:     { background: C.redBg, border: `1px solid ${C.red}`, borderRadius: 6, padding: '7px 14px',
                color: C.red, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'IBM Plex Sans' },
  badge: (bg, fg) => ({ background: bg, color: fg, fontSize: 11, fontWeight: 700,
                         padding: '3px 8px', borderRadius: 4, whiteSpace: 'nowrap' }),
  th:    { background: C.card, color: C.gray, fontSize: 10, fontWeight: 700,
           padding: '8px 10px', textAlign: 'left', textTransform: 'uppercase',
           letterSpacing: '0.05em', borderBottom: `1px solid ${C.border}`, whiteSpace: 'nowrap' },
  td:    { padding: '9px 10px', fontSize: 13, borderBottom: `1px solid ${C.border}`, color: C.light },
};
