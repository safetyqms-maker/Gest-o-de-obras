import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { TrendingUp, Clock, AlertTriangle, CheckCircle, DollarSign, ArrowRight } from 'lucide-react';
import { supabase } from './supabase.js';
import { C, fmtBRL, fmtDate, STATUS_OBRA, s } from './theme.js';

function KPICard({ icon: Icon, label, value, sub, color, bg }) {
  return (
    <div style={{ ...s.card, display: 'flex', flexDirection: 'column', gap: 8, flex: '1 1 160px', minWidth: 160 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ background: bg || C.card2, borderRadius: 8, padding: 8 }}>
          <Icon size={16} color={color || C.cyan} />
        </div>
        <span style={{ fontSize: 11, color: C.gray, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</span>
      </div>
      <div style={{ fontSize: 22, fontWeight: 700, color: color || C.white }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: C.gray }}>{sub}</div>}
    </div>
  );
}

export default function Dashboard() {
  const [obras, setObras] = useState([]);
  const [contratos, setContratos] = useState([]);
  const [eventos, setEventos] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [{ data: ob }, { data: ct }, { data: ev }] = await Promise.all([
        supabase.from('obras').select('*').order('created_at', { ascending: false }),
        supabase.from('contratos_cliente').select('*'),
        supabase.from('eventos_faturamento').select('*'),
      ]);
      setObras(ob || []);
      setContratos(ct || []);
      setEventos(ev || []);
      setLoading(false);
    }
    load();
  }, []);

  const totalContrato  = contratos.reduce((s, c) => s + (c.valor_total || 0), 0);
  const totalAdiant    = contratos.reduce((s, c) => s + (c.valor_adiantamento || 0), 0);
  const totalFaturado  = eventos.reduce((s, e) => s + (e.valor_bruto || 0), 0);
  const totalRecebido  = eventos.reduce((s, e) => s + (e.valor_recebido || 0), 0);
  const emAndamento    = obras.filter(o => ['Em andamento','No prazo','Atrasada'].includes(o.status)).length;
  const atrasadas      = obras.filter(o => o.status === 'Atrasada').length;

  const alertas = eventos.filter(e => {
    if (e.status === 'Recebido') return false;
    if (!e.data_vencimento) return false;
    return new Date(e.data_vencimento) < new Date();
  });

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '50vh', color: C.gray }}>
      Carregando…
    </div>
  );

  return (
    <div style={{ padding: '24px 20px', maxWidth: 1100, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: C.white }}>Painel Executivo</h1>
        <p style={{ fontSize: 13, color: C.gray, marginTop: 4 }}>
          Tibre Engenharia · {obras.length} obras · Atualizado agora
        </p>
      </div>

      {/* KPIs */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 28 }}>
        <KPICard icon={DollarSign}     label="Contrato Total"  value={fmtBRL(totalContrato)} color={C.white} />
        <KPICard icon={TrendingUp}     label="Adiant. Recebido" value={fmtBRL(totalAdiant)}  color={C.green} bg={C.greenBg} />
        <KPICard icon={DollarSign}     label="Faturado Tibre"  value={fmtBRL(totalFaturado)} color={C.cyan}  bg={C.cyanBg} />
        <KPICard icon={CheckCircle}    label="Recebido"        value={fmtBRL(totalRecebido)} color={C.green} bg={C.greenBg} />
        <KPICard icon={Clock}          label="Em Andamento"    value={emAndamento}           color={C.amber} bg={C.amberBg} sub={`${atrasadas} atrasada(s)`} />
        <KPICard icon={AlertTriangle}  label="BMs Vencidos"    value={alertas.length}        color={alertas.length > 0 ? C.red : C.green} bg={alertas.length > 0 ? C.redBg : C.greenBg} />
      </div>

      {/* Alertas */}
      {alertas.length > 0 && (
        <div style={{ background: C.redBg, border: `1px solid ${C.red}`, borderRadius: 8,
                      padding: '12px 16px', marginBottom: 24 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: C.red, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
            <AlertTriangle size={14} /> {alertas.length} EVENTO(S) VENCIDO(S) SEM RECEBIMENTO
          </div>
          {alertas.slice(0, 3).map(e => (
            <div key={e.id} style={{ fontSize: 12, color: C.light, marginBottom: 4 }}>
              ▸ {e.evento} · Vencimento: {fmtDate(e.data_vencimento)} · {fmtBRL(e.valor_liquido)}
            </div>
          ))}
        </div>
      )}

      {/* Lista de obras */}
      <div style={{ ...s.panel, overflow: 'hidden' }}>
        <div style={{ padding: '14px 16px', borderBottom: `1px solid ${C.border}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: C.white }}>Obras</span>
          <Link to="/obras" style={{ fontSize: 12, color: C.cyan, textDecoration: 'none',
                                     display: 'flex', alignItems: 'center', gap: 4 }}>
            Ver todas <ArrowRight size={12} />
          </Link>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['Obra','Cliente','Status','Contrato','Recebido','Próx. Evento'].map(h => (
                  <th key={h} style={s.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {obras.slice(0, 8).map((o, i) => {
                const ct = contratos.find(c => c.obra_id === o.id);
                const ev = eventos.filter(e => e.obra_id === o.id && e.status === 'A emitir')[0];
                const st = STATUS_OBRA[o.status] || { bg: C.card2, fg: C.gray };
                return (
                  <tr key={o.id} style={{ background: i % 2 === 0 ? C.bg : C.card2 }}>
                    <td style={s.td}>
                      <Link to={`/obras/${o.id}`} style={{ color: C.cyan, textDecoration: 'none', fontWeight: 600 }}>
                        {o.nome}
                      </Link>
                    </td>
                    <td style={{ ...s.td, color: C.gray, fontSize: 12 }}>{o.cliente || '—'}</td>
                    <td style={s.td}>
                      <span style={s.badge(st.bg, st.fg)}>{o.status}</span>
                    </td>
                    <td style={{ ...s.td, textAlign: 'right', fontFamily: 'IBM Plex Mono', fontSize: 12 }}>
                      {ct ? fmtBRL(ct.valor_total) : '—'}
                    </td>
                    <td style={{ ...s.td, textAlign: 'right', fontFamily: 'IBM Plex Mono', fontSize: 12, color: C.green }}>
                      {fmtBRL(eventos.filter(e => e.obra_id === o.id).reduce((s, e) => s + (e.valor_recebido || 0), 0))}
                    </td>
                    <td style={{ ...s.td, fontSize: 12, color: C.amber }}>
                      {ev ? ev.evento : '—'}
                    </td>
                  </tr>
                );
              })}
              {obras.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ ...s.td, textAlign: 'center', color: C.gray, padding: 32 }}>
                    Nenhuma obra cadastrada. <Link to="/obras" style={{ color: C.cyan }}>Cadastrar primeira obra →</Link>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
