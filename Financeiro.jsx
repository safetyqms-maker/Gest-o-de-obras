import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { supabase } from './supabase.js';
import { C, s, fmtBRL, fmtDate } from './theme.js';

function num(value) {
  return Number(value) || 0;
}

export default function Financeiro() {
  const [obras, setObras] = useState([]);
  const [contratosCliente, setContratosCliente] = useState([]);
  const [contratosFornecedor, setContratosFornecedor] = useState([]);
  const [pagamentosPrevistos, setPagamentosPrevistos] = useState([]);
  const [faturamentos, setFaturamentos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtroMes, setFiltroMes] = useState('');

  useEffect(() => {
    async function load() {
      const [obrasRes, clienteRes, fornecedorRes, pagamentosRes, faturamentosRes] = await Promise.all([
        supabase.from('obras').select('*').order('created_at', { ascending: false }),
        supabase.from('contratos_cliente').select('*'),
        supabase.from('contratos_fornecedor').select('*'),
        supabase.from('pagamentos_fornecedor').select('*').order('data_vencimento'),
        supabase.from('faturamentos').select('*').order('data_vencimento'),
      ]);

      const error = obrasRes.error || clienteRes.error || fornecedorRes.error || pagamentosRes.error || faturamentosRes.error;
      if (error) alert(`Erro ao carregar financeiro: ${error.message}`);

      setObras(obrasRes.data || []);
      setContratosCliente(clienteRes.data || []);
      setContratosFornecedor(fornecedorRes.data || []);
      setPagamentosPrevistos(pagamentosRes.data || []);
      setFaturamentos(faturamentosRes.data || []);
      setLoading(false);
    }

    load();
  }, []);

  const faturamentosFiltrados = useMemo(() => {
    if (!filtroMes) return faturamentos;
    return faturamentos.filter((item) => {
      const competencia = item.competencia || item.data_vencimento?.slice(0, 7);
      return competencia === filtroMes;
    });
  }, [faturamentos, filtroMes]);

  const pagamentosFiltrados = useMemo(() => {
    if (!filtroMes) return pagamentosPrevistos;
    return pagamentosPrevistos.filter((item) => {
      const competencia = item.competencia || item.data_vencimento?.slice(0, 7);
      return competencia === filtroMes;
    });
  }, [pagamentosPrevistos, filtroMes]);

  const totais = useMemo(() => {
    const entradas = faturamentosFiltrados.filter((item) => item.tipo_movimento === 'entrada');
    const saidas = faturamentosFiltrados.filter((item) => item.tipo_movimento === 'saida');

    const contratoCliente = contratosCliente.reduce((total, item) => total + num(item.valor_total), 0);
    const contratadoFornecedor = contratosFornecedor.reduce((total, item) => total + num(item.valor_contrato), 0);
    const faturadoCliente = entradas.reduce((total, item) => total + num(item.valor_liquido), 0);
    const recebidoCliente = entradas.reduce((total, item) => total + num(item.valor_baixado), 0);
    const nfFornecedor = saidas.reduce((total, item) => total + num(item.valor_liquido), 0);
    const pagoFornecedor = saidas.reduce((total, item) => total + num(item.valor_baixado), 0);
    const previstoFornecedor = pagamentosFiltrados.reduce((total, item) => total + num(item.valor), 0);

    return {
      contratoCliente,
      contratadoFornecedor,
      faturadoCliente,
      recebidoCliente,
      aReceber: Math.max(faturadoCliente - recebidoCliente, 0),
      nfFornecedor,
      pagoFornecedor,
      aPagar: Math.max(nfFornecedor - pagoFornecedor, 0),
      previstoFornecedor,
      semNota: Math.max(previstoFornecedor - nfFornecedor, 0),
      saldoCaixa: recebidoCliente - pagoFornecedor,
    };
  }, [contratosCliente, contratosFornecedor, faturamentosFiltrados, pagamentosFiltrados]);

  const vencidos = useMemo(() => {
    const hoje = new Date().toISOString().slice(0, 10);
    return faturamentos.filter((item) => {
      if (!item.data_vencimento || item.data_vencimento >= hoje) return false;
      if (item.tipo_movimento === 'entrada') return item.status !== 'Recebido';
      return item.status !== 'Pago';
    });
  }, [faturamentos]);

  if (loading) {
    return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '50vh', color: C.gray }}>Carregando…</div>;
  }

  return (
    <div style={{ padding: '24px 20px', maxWidth: 1320, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: C.white, margin: 0 }}>Financeiro consolidado</h1>
          <p style={{ fontSize: 12, color: C.gray, marginTop: 4 }}>Entradas, saídas, previsão e saldo de todas as obras</p>
        </div>
        <div>
          <label style={s.label}>Mês de referência</label>
          <input type="month" style={{ ...s.input, minWidth: 180 }} value={filtroMes} onChange={(event) => setFiltroMes(event.target.value)} />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(165px, 1fr))', gap: 10, marginBottom: 20 }}>
        {[
          ['Contrato clientes', totais.contratoCliente, C.white],
          ['Faturado clientes', totais.faturadoCliente, C.cyan],
          ['Recebido clientes', totais.recebidoCliente, C.green],
          ['A receber', totais.aReceber, C.amber],
          ['NF fornecedores', totais.nfFornecedor, C.pink],
          ['Pago fornecedores', totais.pagoFornecedor, C.green],
          ['A pagar', totais.aPagar, C.amber],
          ['Saldo de caixa', totais.saldoCaixa, totais.saldoCaixa >= 0 ? C.green : C.red],
        ].map(([label, value, color]) => (
          <div key={label} style={s.card}>
            <div style={{ fontSize: 9, color: C.gray, fontWeight: 700, textTransform: 'uppercase', marginBottom: 6 }}>{label}</div>
            <div style={{ fontSize: 17, fontWeight: 700, color, fontFamily: 'IBM Plex Mono' }}>{fmtBRL(value)}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10, marginBottom: 20 }}>
        <div style={{ ...s.panel, padding: 14 }}>
          <div style={{ color: C.cyan, fontSize: 10, fontWeight: 700, marginBottom: 8 }}>ENTRADAS</div>
          <ResumoLinha label="Faturado" value={totais.faturadoCliente} color={C.cyan} />
          <ResumoLinha label="Recebido" value={totais.recebidoCliente} color={C.green} />
          <ResumoLinha label="A receber" value={totais.aReceber} color={C.amber} />
        </div>
        <div style={{ ...s.panel, padding: 14 }}>
          <div style={{ color: C.pink, fontSize: 10, fontWeight: 700, marginBottom: 8 }}>SAÍDAS</div>
          <ResumoLinha label="Previsto" value={totais.previstoFornecedor} color={C.white} />
          <ResumoLinha label="NF recebidas" value={totais.nfFornecedor} color={C.pink} />
          <ResumoLinha label="Pago" value={totais.pagoFornecedor} color={C.green} />
          <ResumoLinha label="Sem NF" value={totais.semNota} color={C.red} />
        </div>
        <div style={{ ...s.panel, padding: 14 }}>
          <div style={{ color: totais.saldoCaixa >= 0 ? C.green : C.red, fontSize: 10, fontWeight: 700, marginBottom: 8 }}>RESULTADO</div>
          <div style={{ fontSize: 24, fontWeight: 700, fontFamily: 'IBM Plex Mono', color: totais.saldoCaixa >= 0 ? C.green : C.red }}>{fmtBRL(totais.saldoCaixa)}</div>
          <div style={{ color: C.gray, fontSize: 11, marginTop: 5 }}>Recebido de clientes menos pago a fornecedores</div>
        </div>
      </div>

      {vencidos.length > 0 && (
        <div style={{ background: C.redBg, border: `1px solid ${C.red}`, borderRadius: 8, padding: '12px 14px', marginBottom: 20 }}>
          <div style={{ color: C.red, fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
            <AlertTriangle size={14} /> {vencidos.length} FATURAMENTO(S) VENCIDO(S)
          </div>
          {vencidos.slice(0, 5).map((item) => {
            const obra = obras.find((o) => o.id === item.obra_id);
            return (
              <div key={item.id} style={{ display: 'flex', gap: 8, flexWrap: 'wrap', color: C.light, fontSize: 11, marginTop: 5 }}>
                <span style={{ color: item.tipo_movimento === 'entrada' ? C.cyan : C.pink, fontWeight: 700 }}>{obra?.nome || 'Obra'}</span>
                <span>·</span>
                <span>{item.evento}</span>
                <span>·</span>
                <span style={{ color: C.red }}>{fmtDate(item.data_vencimento)}</span>
                <span>·</span>
                <span style={{ color: C.amber, fontFamily: 'IBM Plex Mono' }}>{fmtBRL(item.valor_liquido)}</span>
              </div>
            );
          })}
        </div>
      )}

      <div style={{ ...s.panel, overflow: 'hidden' }}>
        <div style={{ padding: '12px 14px', borderBottom: `1px solid ${C.border}`, color: C.white, fontSize: 13, fontWeight: 700 }}>
          Situação financeira por obra
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 1100 }}>
            <thead>
              <tr>
                {['Obra', 'PV', 'Contrato cliente', 'Faturado', 'Recebido', 'NF fornecedor', 'Pago fornecedor', 'Previsto fornecedor', 'Saldo', ''].map((label) => (
                  <th key={label} style={s.th}>{label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {obras.map((obra, index) => {
                const contrato = contratosCliente.find((item) => item.obra_id === obra.id);
                const fatObra = faturamentosFiltrados.filter((item) => item.obra_id === obra.id);
                const pagamentosObra = pagamentosFiltrados.filter((item) => item.obra_id === obra.id);
                const entradas = fatObra.filter((item) => item.tipo_movimento === 'entrada');
                const saidas = fatObra.filter((item) => item.tipo_movimento === 'saida');

                const faturado = entradas.reduce((total, item) => total + num(item.valor_liquido), 0);
                const recebido = entradas.reduce((total, item) => total + num(item.valor_baixado), 0);
                const nfFornecedor = saidas.reduce((total, item) => total + num(item.valor_liquido), 0);
                const pagoFornecedor = saidas.reduce((total, item) => total + num(item.valor_baixado), 0);
                const previsto = pagamentosObra.reduce((total, item) => total + num(item.valor), 0);
                const saldo = recebido - pagoFornecedor;

                return (
                  <tr key={obra.id} style={{ background: index % 2 === 0 ? C.bg : C.card2 }}>
                    <td style={{ ...s.td, fontWeight: 700 }}><Link to={`/obras/${obra.id}`} style={{ color: C.cyan, textDecoration: 'none' }}>{obra.nome}</Link></td>
                    <td style={{ ...s.td, color: C.gray }}>{obra.tag || '—'}</td>
                    <td style={moneyCell(C.white)}>{fmtBRL(contrato?.valor_total)}</td>
                    <td style={moneyCell(C.cyan)}>{fmtBRL(faturado)}</td>
                    <td style={moneyCell(C.green)}>{fmtBRL(recebido)}</td>
                    <td style={moneyCell(C.pink)}>{fmtBRL(nfFornecedor)}</td>
                    <td style={moneyCell(C.green)}>{fmtBRL(pagoFornecedor)}</td>
                    <td style={moneyCell(C.amber)}>{fmtBRL(previsto)}</td>
                    <td style={moneyCell(saldo >= 0 ? C.green : C.red)}>{fmtBRL(saldo)}</td>
                    <td style={s.td}><Link to={`/obras/${obra.id}`} style={{ color: C.gray, display: 'flex' }}><ArrowRight size={13} /></Link></td>
                  </tr>
                );
              })}
              {obras.length === 0 && (
                <tr><td colSpan={10} style={{ ...s.td, textAlign: 'center', color: C.gray, padding: 32 }}>Nenhuma obra cadastrada.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function ResumoLinha({ label, value, color }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginTop: 7 }}>
      <span style={{ color: C.gray, fontSize: 11 }}>{label}</span>
      <span style={{ color, fontFamily: 'IBM Plex Mono', fontWeight: 700, fontSize: 12 }}>{fmtBRL(value)}</span>
    </div>
  );
}

function moneyCell(color) {
  return { ...s.td, textAlign: 'right', fontFamily: 'IBM Plex Mono', fontSize: 12, color, fontWeight: 700 };
}
