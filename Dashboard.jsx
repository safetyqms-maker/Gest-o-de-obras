import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowRight,
  Building2,
  CalendarDays,
  CheckCircle2,
  Clock3,
  DollarSign,
  FileText,
  ReceiptText,
  TrendingUp,
  WalletCards,
} from 'lucide-react';
import { supabase } from './supabase.js';
import { C, STATUS_OBRA, s, fmtBRL, fmtDate } from './theme.js';

function num(value) {
  return Number(value) || 0;
}

function pct(value, total) {
  if (!total) return 0;
  return Math.max(0, Math.min((value / total) * 100, 100));
}

function monthKey(dateValue) {
  if (!dateValue) return null;
  return String(dateValue).slice(0, 7);
}

function MetricCard({
  label,
  value,
  color,
  Icon,
  detail,
  progress,
}) {
  return (
    <div
      style={{
        ...s.card,
        background: C.card2,
        padding: 13,
        minWidth: 0,
        border: `1px solid ${C.border}`,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          marginBottom: 10,
        }}
      >
        <div
          style={{
            width: 29,
            height: 29,
            borderRadius: 7,
            background: C.bg,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <Icon size={14} color={color} />
        </div>

        <div
          style={{
            fontSize: 9,
            color: C.gray,
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '.05em',
            lineHeight: 1.2,
          }}
        >
          {label}
        </div>
      </div>

      <div
        title={value}
        style={{
          fontFamily: 'IBM Plex Mono',
          fontWeight: 700,
          fontSize: 16,
          color,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {value}
      </div>

      <div
        style={{
          fontSize: 9,
          color: C.gray,
          marginTop: 7,
          minHeight: 12,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {detail}
      </div>

      {progress !== undefined && (
        <div
          style={{
            height: 5,
            background: C.bg,
            borderRadius: 999,
            overflow: 'hidden',
            marginTop: 8,
          }}
        >
          <div
            style={{
              width: `${Math.max(0, Math.min(progress, 100))}%`,
              height: '100%',
              background: color,
              borderRadius: 999,
            }}
          />
        </div>
      )}
    </div>
  );
}

function PanelHeader({ title, link }) {
  return (
    <div
      style={{
        padding: '11px 13px',
        borderBottom: `1px solid ${C.border}`,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 12,
      }}
    >
      <div
        style={{
          fontSize: 12,
          fontWeight: 700,
          color: C.white,
        }}
      >
        {title}
      </div>

      {link && (
        <Link
          to={link}
          style={{
            color: C.cyan,
            textDecoration: 'none',
            fontSize: 9,
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            whiteSpace: 'nowrap',
          }}
        >
          Ver todos <ArrowRight size={10} />
        </Link>
      )}
    </div>
  );
}

function FinanceChart({ labels, series }) {
  const width = 760;
  const height = 220;
  const padX = 40;
  const padY = 26;

  const allValues = series.flatMap((item) => item.values);
  const maxValue = Math.max(...allValues, 1);

  function path(values) {
    return values
      .map((value, index) => {
        const x =
          padX +
          (index * (width - padX * 2)) /
            Math.max(values.length - 1, 1);
        const y =
          height -
          padY -
          (value / maxValue) * (height - padY * 2);

        return `${x},${y}`;
      })
      .join(' ');
  }

  return (
    <div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        style={{
          width: '100%',
          height: 'auto',
          display: 'block',
        }}
        role="img"
        aria-label="Fluxo financeiro mensal"
      >
        {[0, 0.25, 0.5, 0.75, 1].map((factor) => {
          const y =
            height -
            padY -
            factor * (height - padY * 2);

          return (
            <line
              key={factor}
              x1={padX}
              x2={width - padX}
              y1={y}
              y2={y}
              stroke={C.border}
              strokeWidth="1"
            />
          );
        })}

        {series.map((item) => (
          <polyline
            key={item.label}
            points={path(item.values)}
            fill="none"
            stroke={item.color}
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ))}

        {series.map((item) =>
          item.values.map((value, index) => {
            const x =
              padX +
              (index * (width - padX * 2)) /
                Math.max(item.values.length - 1, 1);
            const y =
              height -
              padY -
              (value / maxValue) *
                (height - padY * 2);

            return (
              <circle
                key={`${item.label}-${index}`}
                cx={x}
                cy={y}
                r="3"
                fill={item.color}
              />
            );
          }),
        )}
      </svg>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${labels.length}, 1fr)`,
          gap: 4,
          fontSize: 9,
          color: C.gray,
          textAlign: 'center',
          marginTop: -2,
        }}
      >
        {labels.map((label) => (
          <span key={label}>{label}</span>
        ))}
      </div>
    </div>
  );
}

function Donut({ items }) {
  const total = items.reduce((sum, item) => sum + item.value, 0) || 1;

  let cursor = 0;
  const stops = items.map((item) => {
    const start = cursor;
    const end = cursor + (item.value / total) * 100;
    cursor = end;
    return `${item.color} ${start}% ${end}%`;
  });

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '170px 1fr',
        gap: 18,
        alignItems: 'center',
      }}
    >
      <div
        style={{
          width: 165,
          height: 165,
          borderRadius: '50%',
          background: `conic-gradient(${stops.join(',')})`,
          position: 'relative',
          margin: '0 auto',
        }}
      >
        <div
          style={{
            position: 'absolute',
            inset: 36,
            borderRadius: '50%',
            background: C.card2,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div
            style={{
              fontSize: 24,
              fontWeight: 700,
              color: C.white,
              fontFamily: 'IBM Plex Mono',
            }}
          >
            {items.reduce((sum, item) => sum + item.value, 0)}
          </div>
          <div style={{ fontSize: 9, color: C.gray }}>
            Eventos
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {items.map((item) => {
          const percentage = (item.value / total) * 100;

          return (
            <div
              key={item.label}
              style={{
                display: 'grid',
                gridTemplateColumns: '10px 1fr auto',
                gap: 8,
                alignItems: 'center',
                fontSize: 10,
              }}
            >
              <span
                style={{
                  width: 9,
                  height: 9,
                  borderRadius: 2,
                  background: item.color,
                }}
              />
              <span style={{ color: C.light }}>{item.label}</span>
              <span style={{ color: C.gray }}>
                {item.value} ({percentage.toFixed(0)}%)
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CompactTable({ headers, rows, empty, totalLabel, totalValue }) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table
        style={{
          width: '100%',
          borderCollapse: 'collapse',
          minWidth: 480,
        }}
      >
        <thead>
          <tr>
            {headers.map((header) => (
              <th key={header} style={s.th}>
                {header}
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {rows.map((row, rowIndex) => (
            <tr
              key={rowIndex}
              style={{
                background:
                  rowIndex % 2 === 0 ? C.bg : C.card2,
              }}
            >
              {row.map((cell, cellIndex) => (
                <td
                  key={`${rowIndex}-${cellIndex}`}
                  style={{
                    ...s.td,
                    fontSize: 10,
                    color:
                      cellIndex === row.length - 1
                        ? C.amber
                        : C.light,
                    textAlign:
                      cellIndex === row.length - 1
                        ? 'right'
                        : 'left',
                    fontFamily:
                      cellIndex === row.length - 1
                        ? 'IBM Plex Mono'
                        : 'IBM Plex Sans',
                  }}
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}

          {rows.length === 0 && (
            <tr>
              <td
                colSpan={headers.length}
                style={{
                  ...s.td,
                  color: C.gray,
                  textAlign: 'center',
                  padding: 26,
                }}
              >
                {empty}
              </td>
            </tr>
          )}
        </tbody>

        {totalLabel && (
          <tfoot>
            <tr style={{ background: C.card2 }}>
              <td
                colSpan={headers.length - 1}
                style={{
                  ...s.td,
                  fontSize: 10,
                  fontWeight: 700,
                  color: C.white,
                }}
              >
                {totalLabel}
              </td>

              <td
                style={{
                  ...s.td,
                  textAlign: 'right',
                  color: C.red,
                  fontFamily: 'IBM Plex Mono',
                  fontWeight: 700,
                }}
              >
                {totalValue}
              </td>
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}

export default function Dashboard() {
  const [obras, setObras] = useState([]);
  const [contratosCliente, setContratosCliente] = useState([]);
  const [faturamentos, setFaturamentos] = useState([]);
  const [pagamentos, setPagamentos] = useState([]);
  const [fornecedores, setFornecedores] = useState([]);
  const [loading, setLoading] = useState(true);

  const [obraFiltro, setObraFiltro] = useState('todas');
  const [mesFiltro, setMesFiltro] = useState('');

  useEffect(() => {
    async function load() {
      const [
        { data: obrasData, error: obrasError },
        { data: contratosData, error: contratosError },
        { data: faturamentosData, error: faturamentosError },
        { data: pagamentosData, error: pagamentosError },
        { data: fornecedoresData, error: fornecedoresError },
      ] = await Promise.all([
        supabase
          .from('obras')
          .select('*')
          .order('created_at', { ascending: false }),
        supabase.from('contratos_cliente').select('*'),
        supabase.from('faturamentos').select('*'),
        supabase.from('pagamentos_fornecedor').select('*'),
        supabase.from('contratos_fornecedor').select('*'),
      ]);

      const error =
        obrasError ||
        contratosError ||
        faturamentosError ||
        pagamentosError ||
        fornecedoresError;

      if (error) {
        alert(`Erro ao carregar Dashboard: ${error.message}`);
      }

      setObras(obrasData || []);
      setContratosCliente(contratosData || []);
      setFaturamentos(faturamentosData || []);
      setPagamentos(pagamentosData || []);
      setFornecedores(fornecedoresData || []);
      setLoading(false);
    }

    load();
  }, []);

  const dados = useMemo(() => {
    const obraIds =
      obraFiltro === 'todas'
        ? new Set(obras.map((item) => item.id))
        : new Set([obraFiltro]);

    const obrasFiltradas = obras.filter((item) =>
      obraIds.has(item.id),
    );

    const contratosFiltrados = contratosCliente.filter((item) =>
      obraIds.has(item.obra_id),
    );

    const faturamentosFiltrados = faturamentos.filter((item) => {
      const obraOk = obraIds.has(item.obra_id);
      const mesOk =
        !mesFiltro ||
        item.competencia === mesFiltro ||
        monthKey(item.data_vencimento) === mesFiltro ||
        monthKey(item.data_emissao) === mesFiltro;

      return obraOk && mesOk;
    });

    const pagamentosFiltrados = pagamentos.filter((item) => {
      const obraOk = obraIds.has(item.obra_id);
      const mesOk =
        !mesFiltro ||
        item.competencia === mesFiltro ||
        monthKey(item.data_vencimento) === mesFiltro;

      return obraOk && mesOk;
    });

    const totalContrato = contratosFiltrados.reduce(
      (sum, item) => sum + num(item.valor_total),
      0,
    );

    const entradas = faturamentosFiltrados.filter(
      (item) => item.tipo_movimento === 'entrada',
    );

    const saidas = faturamentosFiltrados.filter(
      (item) => item.tipo_movimento === 'saida',
    );

    const totalFaturado = entradas.reduce(
      (sum, item) => sum + num(item.valor_liquido),
      0,
    );

    const totalRecebido = entradas.reduce(
      (sum, item) => sum + num(item.valor_baixado),
      0,
    );

    const totalPagoFornecedor = pagamentosFiltrados
      .filter((item) => item.status === 'Pago')
      .reduce((sum, item) => sum + num(item.valor), 0);

    const totalPrevistoFornecedor = pagamentosFiltrados.reduce(
      (sum, item) => sum + num(item.valor),
      0,
    );

    const totalAPagar = Math.max(
      totalPrevistoFornecedor - totalPagoFornecedor,
      0,
    );

    return {
      obraIds,
      obrasFiltradas,
      contratosFiltrados,
      faturamentosFiltrados,
      pagamentosFiltrados,
      entradas,
      saidas,
      totalContrato,
      totalFaturado,
      totalRecebido,
      totalPagoFornecedor,
      totalPrevistoFornecedor,
      totalAPagar,
      totalAReceber: Math.max(totalFaturado - totalRecebido, 0),
      saldoCaixa: totalRecebido - totalPagoFornecedor,
    };
  }, [
    obraFiltro,
    mesFiltro,
    obras,
    contratosCliente,
    faturamentos,
    pagamentos,
  ]);

  const hoje = new Date().toISOString().slice(0, 10);

  const proximosPagamentos = useMemo(() => {
    return dados.pagamentosFiltrados
      .filter(
        (item) =>
          item.status !== 'Pago' &&
          item.data_vencimento &&
          num(item.valor) > 0,
      )
      .sort((a, b) =>
        String(a.data_vencimento).localeCompare(
          String(b.data_vencimento),
        ),
      )
      .slice(0, 5);
  }, [dados.pagamentosFiltrados]);

  const nfsPendentes = useMemo(() => {
    return dados.saidas
      .filter(
        (item) =>
          item.status !== 'Pago' &&
          item.status !== 'Cancelado' &&
          num(item.valor_liquido) > 0,
      )
      .sort((a, b) =>
        String(a.data_vencimento || '').localeCompare(
          String(b.data_vencimento || ''),
        ),
      )
      .slice(0, 5);
  }, [dados.saidas]);

  const etapas = useMemo(() => {
    const labels = [
      'A emitir',
      'NF emitida',
      'Recebido',
      'Fornecedor autorizado',
      'Fornecedor pago',
    ];

    const colors = [
      '#2F80ED',
      '#8B5CF6',
      '#22C55E',
      '#F59E0B',
      '#64748B',
    ];

    return labels.map((label, index) => ({
      label,
      color: colors[index],
      value: dados.faturamentosFiltrados.filter((item) => {
        if (label === 'Fornecedor pago') {
          return (
            item.tipo_movimento === 'saida' &&
            item.status === 'Pago'
          );
        }

        if (label === 'Fornecedor autorizado') {
          return (
            item.tipo_movimento === 'saida' &&
            ['Em aprovação', 'A pagar'].includes(item.status)
          );
        }

        return item.status === label;
      }).length,
    }));
  }, [dados.faturamentosFiltrados]);

  const fluxo = useMemo(() => {
    const meses = [];

    for (let offset = 5; offset >= 0; offset -= 1) {
      const date = new Date();
      date.setMonth(date.getMonth() - offset);

      meses.push({
        key: `${date.getFullYear()}-${String(
          date.getMonth() + 1,
        ).padStart(2, '0')}`,
        label: date.toLocaleDateString('pt-BR', {
          month: 'short',
        }),
      });
    }

    const faturado = meses.map(({ key }) =>
      dados.entradas
        .filter(
          (item) =>
            item.competencia === key ||
            monthKey(item.data_emissao) === key,
        )
        .reduce((sum, item) => sum + num(item.valor_liquido), 0),
    );

    const recebido = meses.map(({ key }) =>
      dados.entradas
        .filter((item) => monthKey(item.data_baixa) === key)
        .reduce((sum, item) => sum + num(item.valor_baixado), 0),
    );

    const pagoFornecedor = meses.map(({ key }) =>
      dados.pagamentosFiltrados
        .filter(
          (item) =>
            item.status === 'Pago' &&
            monthKey(item.data_pagamento) === key,
        )
        .reduce((sum, item) => sum + num(item.valor), 0),
    );

    const previstoFornecedor = meses.map(({ key }) =>
      dados.pagamentosFiltrados
        .filter(
          (item) =>
            item.competencia === key ||
            monthKey(item.data_vencimento) === key,
        )
        .reduce((sum, item) => sum + num(item.valor), 0),
    );

    return {
      labels: meses.map((item) => item.label),
      series: [
        {
          label: 'Faturado (Cliente)',
          color: '#2F80ED',
          values: faturado,
        },
        {
          label: 'Recebido (Cliente)',
          color: '#22C55E',
          values: recebido,
        },
        {
          label: 'Pago (Fornecedores)',
          color: '#8B5CF6',
          values: pagoFornecedor,
        },
        {
          label: 'A pagar (Previsto)',
          color: '#EF4444',
          values: previstoFornecedor,
        },
      ],
    };
  }, [
    dados.entradas,
    dados.saidas,
    dados.pagamentosFiltrados,
  ]);

  const alertas = useMemo(() => {
    const pagamentosVencidos = dados.pagamentosFiltrados.filter(
      (item) =>
        item.status !== 'Pago' &&
        item.data_vencimento &&
        item.data_vencimento < hoje &&
        num(item.valor) > 0,
    );

    const nfsSemBaixa = dados.faturamentosFiltrados.filter(
      (item) =>
        item.status !== 'Recebido' &&
        item.status !== 'Pago' &&
        item.data_vencimento &&
        item.data_vencimento < hoje &&
        num(item.valor_liquido) > 0,
    );

    const obrasAtrasadas = dados.obrasFiltradas.filter(
      (item) => item.status === 'Atrasada',
    );

    return [
      {
        title: `${pagamentosVencidos.length} pagamento(s) vencido(s)`,
        detail: `Total: ${fmtBRL(
          pagamentosVencidos.reduce(
            (sum, item) => sum + num(item.valor),
            0,
          ),
        )}`,
        color: C.red,
      },
      {
        title: `${nfsSemBaixa.length} faturamento(s) vencido(s)`,
        detail: `Total: ${fmtBRL(
          nfsSemBaixa.reduce(
            (sum, item) => sum + num(item.valor_liquido),
            0,
          ),
        )}`,
        color: C.amber,
      },
      {
        title: `${obrasAtrasadas.length} obra(s) atrasada(s)`,
        detail:
          obrasAtrasadas[0]?.nome || 'Nenhuma obra atrasada',
        color: C.cyan,
      },
    ];
  }, [dados, hoje]);

  if (loading) {
    return (
      <div
        style={{
          minHeight: '55vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: C.gray,
        }}
      >
        Carregando…
      </div>
    );
  }

  const pctFaturado = pct(dados.totalFaturado, dados.totalContrato);
  const pctRecebido = pct(
    dados.totalRecebido,
    dados.totalFaturado,
  );
  const pctPago = pct(
    dados.totalPagoFornecedor,
    dados.totalPrevistoFornecedor,
  );

  return (
    <div
      style={{
        padding: 18,
        maxWidth: 1450,
        margin: '0 auto',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: 14,
          flexWrap: 'wrap',
          marginBottom: 16,
        }}
      >
        <div>
          <h1
            style={{
              margin: 0,
              color: C.white,
              fontSize: 20,
              fontWeight: 700,
            }}
          >
            Dashboard Executivo
          </h1>
          <div
            style={{
              color: C.gray,
              fontSize: 11,
              marginTop: 3,
            }}
          >
            Visão geral de contratos, faturamento e fluxo financeiro
          </div>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(210px, 1fr) 160px',
            gap: 8,
            width: 'min(100%, 390px)',
          }}
        >
          <select
            style={s.input}
            value={obraFiltro}
            onChange={(event) => setObraFiltro(event.target.value)}
          >
            <option value="todas">Todas as obras</option>
            {obras.map((item) => (
              <option key={item.id} value={item.id}>
                {item.nome}
              </option>
            ))}
          </select>

          <input
            type="month"
            style={s.input}
            value={mesFiltro}
            onChange={(event) => setMesFiltro(event.target.value)}
          />
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns:
            'repeat(7, minmax(150px, 1fr))',
          gap: 9,
          marginBottom: 12,
        }}
      >
        <MetricCard
          label="Contrato Total"
          value={fmtBRL(dados.totalContrato)}
          color={C.white}
          Icon={Building2}
          detail="100% do contrato"
          progress={100}
        />

        <MetricCard
          label="Faturado Cliente"
          value={fmtBRL(dados.totalFaturado)}
          color={C.cyan}
          Icon={FileText}
          detail={`${pctFaturado.toFixed(1)}% do contrato`}
          progress={pctFaturado}
        />

        <MetricCard
          label="Recebido Cliente"
          value={fmtBRL(dados.totalRecebido)}
          color={C.green}
          Icon={CheckCircle2}
          detail={`${pctRecebido.toFixed(1)}% do faturado`}
          progress={pctRecebido}
        />

        <MetricCard
          label="A Receber"
          value={fmtBRL(dados.totalAReceber)}
          color={C.amber}
          Icon={Clock3}
          detail="NF(s) em aberto"
        />

        <MetricCard
          label="Pago a Fornecedores"
          value={fmtBRL(dados.totalPagoFornecedor)}
          color={C.pink}
          Icon={WalletCards}
          detail={`${pctPago.toFixed(1)}% dos pagamentos previstos`}
          progress={pctPago}
        />

        <MetricCard
          label="A Pagar Previsto"
          value={fmtBRL(dados.totalAPagar)}
          color={C.red}
          Icon={CalendarDays}
          detail={`${proximosPagamentos.length} pagamento(s) pendente(s)`}
        />

        <MetricCard
          label="Saldo de Caixa"
          value={fmtBRL(dados.saldoCaixa)}
          color={dados.saldoCaixa >= 0 ? C.green : C.red}
          Icon={TrendingUp}
          detail="Recebido - Pago"
        />
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1.7fr) minmax(340px, .9fr)',
          gap: 10,
          marginBottom: 10,
        }}
      >
        <div style={{ ...s.panel, padding: 13 }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              gap: 12,
              flexWrap: 'wrap',
              marginBottom: 7,
            }}
          >
            <div>
              <div
                style={{
                  color: C.white,
                  fontSize: 12,
                  fontWeight: 700,
                }}
              >
                Fluxo Financeiro (Mensal)
              </div>
              <div style={{ color: C.gray, fontSize: 9, marginTop: 2 }}>
                Últimos 6 meses
              </div>
            </div>

            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: 10,
                fontSize: 9,
                color: C.gray,
              }}
            >
              {fluxo.series.map((item) => (
                <span
                  key={item.label}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  <span
                    style={{
                      width: 7,
                      height: 7,
                      background: item.color,
                      borderRadius: 2,
                    }}
                  />
                  {item.label}
                </span>
              ))}
            </div>
          </div>

          <FinanceChart labels={fluxo.labels} series={fluxo.series} />
        </div>

        <div style={{ ...s.panel, padding: 13 }}>
          <div
            style={{
              color: C.white,
              fontSize: 12,
              fontWeight: 700,
              marginBottom: 12,
            }}
          >
            Situação das 5 Etapas de Faturamento
          </div>

          <Donut items={etapas} />
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns:
            'minmax(0, 1fr) minmax(0, 1fr) minmax(300px, .9fr)',
          gap: 10,
          marginBottom: 10,
        }}
      >
        <div style={{ ...s.panel, overflow: 'hidden' }}>
          <PanelHeader
            title="Próximos Pagamentos a Fornecedores"
            link="/financeiro"
          />

          <CompactTable
            headers={[
              'Fornecedor',
              'Evento',
              'Vencimento',
              'Valor',
            ]}
            rows={proximosPagamentos.map((item) => {
              const contrato = fornecedores.find(
                (fornecedor) =>
                  fornecedor.id === item.contrato_fornecedor_id,
              );

              return [
                contrato?.fornecedor || '—',
                item.evento || '—',
                fmtDate(item.data_vencimento),
                fmtBRL(item.valor),
              ];
            })}
            empty="Nenhum pagamento previsto."
            totalLabel="Total a pagar (previsto)"
            totalValue={fmtBRL(
              proximosPagamentos.reduce(
                (sum, item) => sum + num(item.valor),
                0,
              ),
            )}
          />
        </div>

        <div style={{ ...s.panel, overflow: 'hidden' }}>
          <PanelHeader
            title="Notas Fiscais de Fornecedores"
            link="/financeiro"
          />

          <CompactTable
            headers={[
              'Fornecedor',
              'NF',
              'Valor',
              'Vencimento',
            ]}
            rows={nfsPendentes.map((item) => [
              item.cliente_fornecedor || '—',
              item.nf_numero || '—',
              fmtBRL(item.valor_liquido),
              fmtDate(item.data_vencimento),
            ])}
            empty="Nenhuma NF pendente."
            totalLabel="Total pendente"
            totalValue={fmtBRL(
              nfsPendentes.reduce(
                (sum, item) => sum + num(item.valor_liquido),
                0,
              ),
            )}
          />
        </div>

        <div style={{ ...s.panel, padding: 13 }}>
          <div
            style={{
              color: C.white,
              fontSize: 12,
              fontWeight: 700,
              marginBottom: 10,
            }}
          >
            Alertas e Pendências
          </div>

          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
            }}
          >
            {alertas.map((item) => (
              <div
                key={item.title}
                style={{
                  display: 'flex',
                  gap: 9,
                  alignItems: 'flex-start',
                  padding: '9px 10px',
                  borderRadius: 7,
                  background: C.bg,
                }}
              >
                <AlertTriangle
                  size={14}
                  color={item.color}
                  style={{ marginTop: 1, flexShrink: 0 }}
                />

                <div>
                  <div
                    style={{
                      color: C.light,
                      fontSize: 10,
                      fontWeight: 600,
                    }}
                  >
                    {item.title}
                  </div>
                  <div
                    style={{
                      color: C.gray,
                      fontSize: 9,
                      marginTop: 2,
                    }}
                  >
                    {item.detail}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{ ...s.panel, overflow: 'hidden' }}>
        <PanelHeader title="Resumo por Obra" link="/obras" />

        <div style={{ overflowX: 'auto' }}>
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              minWidth: 950,
            }}
          >
            <thead>
              <tr>
                {[
                  'Obra',
                  'Contrato Total',
                  'Faturado',
                  'Recebido',
                  'Pago Fornec.',
                  'A Pagar',
                  'Saldo de Caixa',
                  'Status Geral',
                ].map((header) => (
                  <th key={header} style={s.th}>
                    {header}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {dados.obrasFiltradas.map((obra, index) => {
                const contrato = contratosCliente.find(
                  (item) => item.obra_id === obra.id,
                );

                const faturamentosObra = faturamentos.filter(
                  (item) => item.obra_id === obra.id,
                );

                const pagamentosObra = pagamentos.filter(
                  (item) => item.obra_id === obra.id,
                );

                const entradaObra = faturamentosObra.filter(
                  (item) => item.tipo_movimento === 'entrada',
                );

                const saidaObra = faturamentosObra.filter(
                  (item) => item.tipo_movimento === 'saida',
                );

                const faturado = entradaObra.reduce(
                  (sum, item) => sum + num(item.valor_liquido),
                  0,
                );

                const recebido = entradaObra.reduce(
                  (sum, item) => sum + num(item.valor_baixado),
                  0,
                );

                const pagoFornecedor = pagamentosObra
                  .filter((item) => item.status === 'Pago')
                  .reduce((sum, item) => sum + num(item.valor), 0);

                const previstoFornecedor = pagamentosObra.reduce(
                  (sum, item) => sum + num(item.valor),
                  0,
                );

                const aPagar = Math.max(
                  previstoFornecedor - pagoFornecedor,
                  0,
                );

                const saldo = recebido - pagoFornecedor;

                const status =
                  STATUS_OBRA[obra.status] || {
                    bg: C.card2,
                    fg: C.gray,
                  };

                return (
                  <tr
                    key={obra.id}
                    style={{
                      background:
                        index % 2 === 0 ? C.bg : C.card2,
                    }}
                  >
                    <td style={s.td}>
                      <Link
                        to={`/obras/${obra.id}`}
                        style={{
                          color: C.cyan,
                          textDecoration: 'none',
                          fontWeight: 600,
                        }}
                      >
                        {obra.nome}
                      </Link>
                    </td>

                    <td style={moneyCell(C.white)}>
                      {fmtBRL(contrato?.valor_total)}
                    </td>

                    <td style={moneyCell(C.cyan)}>
                      {fmtBRL(faturado)}
                    </td>

                    <td style={moneyCell(C.green)}>
                      {fmtBRL(recebido)}
                    </td>

                    <td style={moneyCell(C.pink)}>
                      {fmtBRL(pagoFornecedor)}
                    </td>

                    <td style={moneyCell(C.amber)}>
                      {fmtBRL(aPagar)}
                    </td>

                    <td
                      style={moneyCell(
                        saldo >= 0 ? C.green : C.red,
                      )}
                    >
                      {fmtBRL(saldo)}
                    </td>

                    <td style={s.td}>
                      <span style={s.badge(status.bg, status.fg)}>
                        {obra.status}
                      </span>
                    </td>
                  </tr>
                );
              })}

              {dados.obrasFiltradas.length === 0 && (
                <tr>
                  <td
                    colSpan={8}
                    style={{
                      ...s.td,
                      textAlign: 'center',
                      color: C.gray,
                      padding: 28,
                    }}
                  >
                    Nenhuma obra cadastrada.
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

function moneyCell(color) {
  return {
    ...s.td,
    textAlign: 'right',
    fontFamily: 'IBM Plex Mono',
    fontSize: 10,
    color,
  };
}
