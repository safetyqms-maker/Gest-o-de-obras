import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, ArrowRight, CalendarDays, WalletCards } from 'lucide-react';
import { supabase } from './supabase.js';
import { C, s, fmtBRL, fmtDate } from './theme.js';

const n = (v) => Number(v) || 0;
const monthOf = (v) => (v ? String(v).slice(0, 7) : '');

function Card({ label, value, color, detail }) {
  return (
    <div style={{ ...s.card, background: C.card2, minWidth: 150 }}>
      <div style={{ fontSize: 9, color: C.gray, textTransform: 'uppercase', fontWeight: 700 }}>{label}</div>
      <div style={{ marginTop: 7, fontSize: 17, fontFamily: 'IBM Plex Mono', fontWeight: 700, color }}>{value}</div>
      <div style={{ marginTop: 5, fontSize: 10, color: C.gray }}>{detail}</div>
    </div>
  );
}

export default function Financeiro() {
  const [obras, setObras] = useState([]);
  const [contratos, setContratos] = useState([]);
  const [faturamentos, setFaturamentos] = useState([]);
  const [pagamentos, setPagamentos] = useState([]);
  const [fornecedores, setFornecedores] = useState([]);
  const [obraFiltro, setObraFiltro] = useState('todas');
  const [mesFiltro, setMesFiltro] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [ob, ct, ft, pg, fr] = await Promise.all([
        supabase.from('obras').select('*').order('created_at', { ascending: false }),
        supabase.from('contratos_cliente').select('*'),
        supabase.from('faturamentos').select('*').order('data_vencimento'),
        supabase.from('pagamentos_fornecedor').select('*').order('data_vencimento'),
        supabase.from('contratos_fornecedor').select('*'),
      ]);
      const error = ob.error || ct.error || ft.error || pg.error || fr.error;
      if (error) alert(`Erro ao carregar financeiro: ${error.message}`);
      setObras(ob.data || []);
      setContratos(ct.data || []);
      setFaturamentos(ft.data || []);
      setPagamentos(pg.data || []);
      setFornecedores(fr.data || []);
      setLoading(false);
    }
    load();
  }, []);

  const dados = useMemo(() => {
    const obrasIds = obraFiltro === 'todas' ? new Set(obras.map((o) => o.id)) : new Set([obraFiltro]);
    const mesOk = (item) => !mesFiltro || item.competencia === mesFiltro || monthOf(item.data_vencimento) === mesFiltro || monthOf(item.data_emissao) === mesFiltro;
    const contratosF = contratos.filter((x) => obrasIds.has(x.obra_id));
    const ft = faturamentos.filter((x) => obrasIds.has(x.obra_id) && mesOk(x));
    const pg = pagamentos.filter((x) => obrasIds.has(x.obra_id) && (!mesFiltro || x.competencia === mesFiltro || monthOf(x.data_vencimento) === mesFiltro));
    const entradas = ft.filter((x) => x.tipo_movimento === 'entrada');
    const saidas = ft.filter((x) => x.tipo_movimento === 'saida');
    const contrato = contratosF.reduce((a, x) => a + n(x.valor_total), 0);
    const faturado = entradas.reduce((a, x) => a + n(x.valor_liquido), 0);
    const recebido = entradas.reduce((a, x) => a + n(x.valor_baixado), 0);
    const nfFornec = saidas.reduce((a, x) => a + n(x.valor_liquido), 0);
    const pago = pg.filter((x) => x.status === 'Pago').reduce((a, x) => a + n(x.valor), 0);
    const previsto = pg.reduce((a, x) => a + n(x.valor), 0);
    return {
      contratosF, ft, pg, entradas, saidas, contrato, faturado, recebido, nfFornec, pago, previsto,
      aReceber: Math.max(faturado - recebido, 0),
      aPagar: Math.max(previsto - pago, 0),
      saldo: recebido - pago,
    };
  }, [obras, contratos, faturamentos, pagamentos, obraFiltro, mesFiltro]);

  const hoje = new Date().toISOString().slice(0, 10);
  const alertas = [
    {
      label: 'Notas a emitir para clientes',
      items: dados.entradas.filter((x) => ['Previsto', 'A emitir'].includes(x.status)),
      color: C.cyan,
    },
    {
      label: 'Fornecedor a liberar',
      items: dados.saidas.filter((x) => ['Previsto', 'NF pendente', 'Em aprovação'].includes(x.status)),
      color: C.amber,
    },
    {
      label: 'Pagamentos vencidos',
      items: dados.pg.filter((x) => x.status !== 'Pago' && x.data_vencimento && x.data_vencimento < hoje),
      color: C.red,
    },
  ];

  if (loading) return <div style={{ height: '50vh', display: 'grid', placeItems: 'center', color: C.gray }}>Carregando…</div>;

  return (
    <div style={{ padding: 20, maxWidth: 1400, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 20, color: C.white }}>Financeiro Consolidado</h1>
          <p style={{ margin: '4px 0 0', fontSize: 11, color: C.gray }}>Somente consulta: entradas, saídas, prazos e fluxo de caixa.</p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '220px 160px', gap: 8 }}>
          <select style={s.input} value={obraFiltro} onChange={(e) => setObraFiltro(e.target.value)}>
            <option value="todas">Todas as obras</option>
            {obras.map((o) => <option key={o.id} value={o.id}>{o.nome}</option>)}
          </select>
          <input type="month" style={s.input} value={mesFiltro} onChange={(e) => setMesFiltro(e.target.value)} />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,minmax(150px,1fr))', gap: 9, marginBottom: 12 }}>
        <Card label="Contrato Total" value={fmtBRL(dados.contrato)} color={C.white} detail="Valor contratado" />
        <Card label="Faturado Cliente" value={fmtBRL(dados.faturado)} color={C.cyan} detail="Notas emitidas / previstas" />
        <Card label="Recebido Cliente" value={fmtBRL(dados.recebido)} color={C.green} detail="Entradas realizadas" />
        <Card label="A Receber" value={fmtBRL(dados.aReceber)} color={C.amber} detail="Entradas em aberto" />
        <Card label="NF Fornecedores" value={fmtBRL(dados.nfFornec)} color={C.pink} detail="Notas recebidas" />
        <Card label="A Pagar Previsto" value={fmtBRL(dados.aPagar)} color={C.red} detail="Cronograma financeiro" />
        <Card label="Saldo de Caixa" value={fmtBRL(dados.saldo)} color={dados.saldo >= 0 ? C.green : C.red} detail="Recebido menos pago" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))', gap: 10, marginBottom: 10 }}>
        {alertas.map((a) => (
          <div key={a.label} style={{ ...s.panel, padding: 13 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, color: a.color, fontSize: 12, fontWeight: 700 }}>
              <AlertTriangle size={14} /> {a.label}
            </div>
            <div style={{ marginTop: 8, fontSize: 24, fontFamily: 'IBM Plex Mono', fontWeight: 700, color: C.white }}>{a.items.length}</div>
            <div style={{ fontSize: 10, color: C.gray }}>Total: {fmtBRL(a.items.reduce((sum, x) => sum + n(x.valor_liquido || x.valor), 0))}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <div style={{ ...s.panel, overflow: 'hidden' }}>
          <div style={{ padding: 12, borderBottom: `1px solid ${C.border}`, fontWeight: 700, color: C.white }}>Entradas — Cliente</div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 720 }}>
              <thead><tr>{['Obra','Evento','NF','Vencimento','Valor','Recebido','Status'].map((h) => <th key={h} style={s.th}>{h}</th>)}</tr></thead>
              <tbody>
                {dados.entradas.slice(0, 12).map((x, i) => {
                  const obra = obras.find((o) => o.id === x.obra_id);
                  return <tr key={x.id} style={{ background: i % 2 ? C.card2 : C.bg }}>
                    <td style={s.td}>{obra?.nome || '—'}</td><td style={s.td}>{x.evento}</td><td style={s.td}>{x.nf_numero || '—'}</td><td style={s.td}>{fmtDate(x.data_vencimento)}</td>
                    <td style={{ ...s.td, textAlign: 'right', color: C.cyan }}>{fmtBRL(x.valor_liquido)}</td><td style={{ ...s.td, textAlign: 'right', color: C.green }}>{fmtBRL(x.valor_baixado)}</td><td style={s.td}>{x.status}</td>
                  </tr>;
                })}
                {!dados.entradas.length && <tr><td colSpan={7} style={{ ...s.td, padding: 28, textAlign: 'center', color: C.gray }}>Nenhuma entrada encontrada.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>

        <div style={{ ...s.panel, overflow: 'hidden' }}>
          <div style={{ padding: 12, borderBottom: `1px solid ${C.border}`, fontWeight: 700, color: C.white }}>Saídas — Fornecedores</div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 720 }}>
              <thead><tr>{['Fornecedor','Evento','NF','Vencimento','Valor','Pago','Status'].map((h) => <th key={h} style={s.th}>{h}</th>)}</tr></thead>
              <tbody>
                {dados.saidas.slice(0, 12).map((x, i) => <tr key={x.id} style={{ background: i % 2 ? C.card2 : C.bg }}>
                  <td style={s.td}>{x.cliente_fornecedor || '—'}</td><td style={s.td}>{x.evento}</td><td style={s.td}>{x.nf_numero || '—'}</td><td style={s.td}>{fmtDate(x.data_vencimento)}</td>
                  <td style={{ ...s.td, textAlign: 'right', color: C.pink }}>{fmtBRL(x.valor_liquido)}</td><td style={{ ...s.td, textAlign: 'right', color: C.green }}>{fmtBRL(x.valor_baixado)}</td><td style={s.td}>{x.status}</td>
                </tr>)}
                {!dados.saidas.length && <tr><td colSpan={7} style={{ ...s.td, padding: 28, textAlign: 'center', color: C.gray }}>Nenhuma saída encontrada.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
