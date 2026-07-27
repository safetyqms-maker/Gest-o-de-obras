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
  TrendingUp,
  WalletCards,
} from 'lucide-react';
import { supabase } from './supabase.js';
import { C, STATUS_OBRA, s, fmtBRL, fmtDate } from './theme.js';

function num(value) {
  return Number(value) || 0;
}

function MetricCard({ label, value, color, icon: Icon, detail, progress }) {
  const safeProgress = Math.max(0, Math.min(Number(progress) || 0, 100));

  return (
    <div
      style={{
        ...s.card,
        background: C.card2,
        minWidth: 0,
        padding: 14,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          marginBottom: 9,
        }}
      >
        <div
          style={{
            width: 28,
            height: 28,
            borderRadius: 7,
            background: C.panel,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
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
          }}
        >
          {label}
        </div>
      </div>

      <div
        style={{
          fontFamily: 'IBM Plex Mono',
          fontWeight: 700,
          fontSize: 17,
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
          marginTop: 7,
          fontSize: 10,
          color: C.gray,
          minHeight: 13,
        }}
      >
        {detail || ' '}
      </div>

      {progress !== undefined && (
        <div
          style={{
            height: 5,
            marginTop: 8,
            background: C.bg,
            borderRadius: 999,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              width: `${safeProgress}%`,
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

function MiniLineChart({ series }) {
  const width = 720;
  const height = 190;
  const padding = 24;

  const values = series.flatMap((item) => item.values);
  const maxValue = Math.max(...values, 1);

  function points(values) {
    return values
      .map((value, index) => {
        const x =
          padding +
          (index * (width - padding * 2)) /
            Math.max(values.length - 1, 1);
        const y =
          height -
          padding -
          (value / maxValue) * (height - padding * 2);

        return `${x},${y}`;
      })
      .join(' ');
  }

  return (
    <div style={{ width: '100%', overflow: 'hidden' }}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        style={{ width: '100%', height: 'auto', display: 'block' }}
        role="img"
        aria-label="Fluxo financeiro mensal"
      >
        {[0.25, 0.5, 0.75, 1].map((factor) => {
          const y = height - padding - factor * (height - padding * 2);

          return (
            <line
              key={factor}
              x1={padding}
              x2={width - padding}
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
            points={points(item.values)}
            fill="none"
            stroke={item.color}
            strokeWidth="3"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        ))}

        {series.map((item) =>
          item.values.map((value, index) => {
            const x =
              padding +
              (index * (width - padding * 2)) /
                Math.max(item.values.length - 1, 1);
            const y =
              height -
              padding -
              (value / maxValue) * (height - padding * 2);

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
    </div>
  );
}

function StatusBars({ eventos }) {
  const steps = [
    'A emitir',
    'NF emitida',
    'Recebido',
    'Fornecedor autorizado',
    'Fornecedor pago',
  ];

  const colors = [C.cyan, C.pink, C.green, C.amber, C.gray];

  const counts = steps.map((step) =>
    eventos.filter((item) => item.status === step).length,
  );

  const total = counts.reduce((sum, item) => sum + item, 0) || 1;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
      {steps.map((step, index) => {
        const count = counts[index];
        const pct = (count / total) * 100;

        return (
          <div key={step}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                gap: 12,
                marginBottom: 5,
                fontSize: 11,
              }}
            >
              <span style={{ color: C.light }}>{step}</span>
              <span style={{ color: C.gray }}>
                {count} ({pct.toFixed(0)}%)
              </span>
            </div>

            <div
              style={{
                height: 6,
                background: C.bg,
                borderRadius: 999,
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  height: '100%',
                  width: `${pct}%`,
                  background: colors[index],
                  borderRadius: 999,
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function Dashboard() {
  const [obras, setObras] = useState([]);
  const [contratos, setContratos] = useState([]);
  const [eventos, setEventos] = useState([]);
  const [pagamentos, setPagamentos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [obraFiltro, setObraFiltro] = useState('todas');

  useEffect(() => {
    async function load() {
      const [
        { data: obrasData, error: obrasError },
        { data: contratosData, error: contratosError },
        { data: eventosData, error: eventosError },
        { data: pagamentosData, error: pagamentosError },
      ] = await Promise.all([
        supabase
          .from('obras')
          .select('*')
          .order('created_at', { ascending: false }),
        supabase.from('contratos_cliente').select('*'),
        supabase.from('eventos_faturamento').select('*'),
        supabase.from('pagamentos_fornecedor').select('*'),
      ]);

      const error =
        obrasError || contratosError || eventosError || pagamentosError;

      if (error) {
        alert(`Erro ao carregar painel: ${error.message}`);
      }

      setObras(obrasData || []);
      setContratos(contratosData || []);
      setEventos(eventosData || []);
      setPagamentos(pagamentosData || []);
      setLoading(false);
    }

    load();
  }, []);

  const dados = useMemo(() => {
    const obraIds =
      obraFiltro === 'todas' ? null : new Set([obraFiltro]);

    const obrasFiltradas = obraIds
      ? obras.filter((item) => obraIds.has(item.id))
      : obras;

    const contratosFiltrados = obraIds
      ? contratos.filter((item) => obraIds.has(item.obra_id))
      : contratos;

    const eventosFiltrados = obraIds
      ? eventos.filter((item) => obraIds.has(item.obra_id))
      : eventos;

    const pagamentosFiltrados = obraIds
      ? pagamentos.filter((item) => obraIds.has(item.obra_id))
      : pagamentos;

    const totalContrato = contratosFiltrados.reduce(
      (total, item) => total + num(item.valor_total),
      0,
    );

    const totalFaturado = eventosFiltrados.reduce(
      (total, item) => total + num(item.valor_bruto),
      0,
    );

    const totalRecebido = eventosFiltrados.reduce(
      (total, item) => total + num(item.valor_recebido),
      0,
    );

    const totalPago = pagamentosFiltrados
      .filter((item) => item.status === 'Pago')
      .reduce((total, item) => total + num(item.valor), 0);

    const totalAPagar = pagamentosFiltrados
      .filter((item) => item.status !== 'Pago')
      .reduce((total, item) => total + num(item.valor), 0);

    const aReceber = Math.max(totalFaturado - totalRecebido, 0);
    const saldoCaixa = totalRecebido - totalPago;

    return {
      obrasFiltradas,
      contratosFiltrados,
      eventosFiltrados,
      pagamentosFiltrados,
      totalContrato,
      totalFaturado,
      totalRecebido,
      totalPago,
      totalAPagar,
      aReceber,
      saldoCaixa,
    };
  }, [obraFiltro, obras, contratos, eventos, pagamentos]);

  const hoje = new Date().toISOString().slice(0, 10);

  const pagamentosProximos = useMemo(
    () =>
      dados.pagamentosFiltrados
        .filter(
          (item) =>
            item.status !== 'Pago' &&
            item.data_vencimento,
        )
        .sort((a, b) =>
          String(a.data_vencimento).localeCompare(
            String(b.data_vencimento),
          ),
        )
        .slice(0, 5),
    [dados.pagamentosFiltrados],
  );

  const eventosPendentes = useMemo(
    () =>
      dados.eventosFiltrados
        .filter((item) => item.status !== 'Recebido')
        .sort((a, b) =>
          String(a.data_vencimento || '').localeCompare(
            String(b.data_vencimento || ''),
          ),
        )
        .slice(0, 5),
    [dados.eventosFiltrados],
  );

  const alertas = useMemo(() => {
    const pagamentosVencidos = dados.pagamentosFiltrados.filter(
      (item) =>
        item.status !== 'Pago' &&
        item.data_vencimento &&
        item.data_vencimento < hoje,
    );

    const faturamentosVencidos = dados.eventosFiltrados.filter(
      (item) =>
        item.status !== 'Recebido' &&
        item.data_vencimento &&
        item.data_vencimento < hoje,
    );

    const obrasAtrasadas = dados.obrasFiltradas.filter(
      (item) => item.status === 'Atrasada',
    );

    return [
      {
        label: `${pagamentosVencidos.length} pagamento(s) vencido(s)`,
        color: C.red,
      },
      {
        label: `${faturamentosVencidos.length} faturamento(s) vencido(s)`,
        color: C.amber,
      },
      {
        label: `${obrasAtrasadas.length} obra(s) atrasada(s)`,
        color: C.cyan,
      },
    ];
  }, [dados, hoje]);

  const fluxo = useMemo(() => {
    const months = [];

    for (let offset = 5; offset >= 0; offset -= 1) {
      const date = new Date();
      date.setMonth(date.getMonth() - offset);

      months.push({
        key: `${date.getFullYear()}-${String(
          date.getMonth() + 1,
        ).padStart(2, '0')}`,
        label: date.toLocaleDateString('pt-BR', {
          month: 'short',
        }),
      });
    }

    const recebido = months.map(({ key }) =>
      dados.eventosFiltrados
        .filter((item) =>
          item.data_recebimento?.startsWith(key),
        )
        .reduce((sum, item) => sum + num(item.valor_recebido), 0),
    );

    const pago = months.map(({ key }) =>
      dados.pagamentosFiltrados
        .filter(
          (item) =>
            item.status === 'Pago' &&
            item.data_pagamento?.startsWith(key),
        )
        .reduce((sum, item) => sum + num(item.valor), 0),
    );

    return {
      labels: months.map((item) => item.label),
      series: [
        {
          label: 'Recebido do cliente',
          values: recebido,
          color: C.green,
        },
        {
          label: 'Pago aos fornecedores',
          values: pago,
          color: C.pink,
        },
      ],
    };
  }, [dados.eventosFiltrados, dados.pagamentosFiltrados]);

  if (loading) {
    return (
      <div
        style={{
          height: '60vh',
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

  const pctFaturado =
    dados.totalContrato > 0
      ? (dados.totalFaturado / dados.totalContrato) * 100
      : 0;

  const pctRecebido =
    dados.totalFaturado > 0
      ? (dados.totalRecebido / dados.totalFaturado) * 100
      : 0;

  const pctPago =
    dados.totalPago + dados.totalAPagar > 0
      ? (dados.totalPago /
          (dados.totalPago + dados.totalAPagar)) *
        100
      : 0;

  return (
    <div
      style={{
        padding: 20,
        maxWidth: 1380,
        margin: '0 auto',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: 16,
          flexWrap: 'wrap',
          marginBottom: 18,
        }}
      >
        <div>
          <h1
            style={{
              fontSize: 21,
              fontWeight: 700,
              color: C.white,
              margin: 0,
            }}
          >
            Dashboard Executivo
          </h1>
          <p
            style={{
              fontSize: 12,
              color: C.gray,
              marginTop: 4,
            }}
          >
            Visão geral de contratos, faturamento e fluxo financeiro
          </p>
        </div>

        <div style={{ minWidth: 240 }}>
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
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns:
            'repeat(auto-fit, minmax(165px, 1fr))',
          gap: 10,
          marginBottom: 14,
        }}
      >
        <MetricCard
          label="Contrato Total"
          value={fmtBRL(dados.totalContrato)}
          color={C.white}
          icon={Building2}
          detail="Valor contratado"
          progress={100}
        />

        <MetricCard
          label="Faturado"
          value={fmtBRL(dados.totalFaturado)}
          color={C.cyan}
          icon={FileText}
          detail={`${pctFaturado.toFixed(1)}% do contrato`}
          progress={pctFaturado}
        />

        <MetricCard
          label="Recebido"
          value={fmtBRL(dados.totalRecebido)}
          color={C.green}
          icon={CheckCircle2}
          detail={`${pctRecebido.toFixed(1)}% do faturado`}
          progress={pctRecebido}
        />

        <MetricCard
          label="A Receber"
          value={fmtBRL(dados.aReceber)}
          color={C.amber}
          icon={Clock3}
          detail="Faturamento em aberto"
        />

        <MetricCard
          label="Pago a Fornecedores"
          value={fmtBRL(dados.totalPago)}
          color={C.pink}
          icon={WalletCards}
          detail={`${pctPago.toFixed(1)}% do previsto`}
          progress={pctPago}
        />

        <MetricCard
          label="A Pagar"
          value={fmtBRL(dados.totalAPagar)}
          color={C.red}
          icon={CalendarDays}
          detail={`${pagamentosProximos.length} pagamento(s) próximo(s)`}
        />

        <MetricCard
          label="Saldo de Caixa"
          value={fmtBRL(dados.saldoCaixa)}
          color={dados.saldoCaixa >= 0 ? C.green : C.red}
          icon={TrendingUp}
          detail="Recebido menos pago"
        />
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1.6fr) minmax(280px, .9fr)',
          gap: 12,
          marginBottom: 12,
        }}
      >
        <div style={{ ...s.panel, padding: 14 }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              gap: 12,
              flexWrap: 'wrap',
              marginBottom: 8,
            }}
          >
            <div>
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  color: C.white,
                }}
              >
                Fluxo Financeiro
              </div>
              <div
                style={{
                  fontSize: 10,
                  color: C.gray,
                  marginTop: 2,
                }}
              >
                Últimos 6 meses
              </div>
            </div>

            <div
              style={{
                display: 'flex',
                gap: 12,
                fontSize: 10,
                color: C.gray,
              }}
            >
              {fluxo.series.map((item) => (
                <span
                  key={item.label}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 5,
                  }}
                >
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: 2,
                      background: item.color,
                    }}
                  />
                  {item.label}
                </span>
              ))}
            </div>
          </div>

          <MiniLineChart series={fluxo.series} />

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: `repeat(${fluxo.labels.length}, 1fr)`,
              gap: 4,
              color: C.gray,
              fontSize: 9,
              textAlign: 'center',
            }}
          >
            {fluxo.labels.map((label) => (
              <span key={label}>{label}</span>
            ))}
          </div>
        </div>

        <div style={{ ...s.panel, padding: 14 }}>
          <div
            style={{
              fontSize: 13,
              fontWeight: 700,
              color: C.white,
              marginBottom: 14,
            }}
          >
            Etapas do Faturamento
          </div>

          <StatusBars eventos={dados.eventosFiltrados} />
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns:
            'repeat(auto-fit, minmax(290px, 1fr))',
          gap: 12,
          marginBottom: 12,
        }}
      >
        <div style={{ ...s.panel, overflow: 'hidden' }}>
          <PanelHeader
            title="Próximos pagamentos"
            link="/financeiro"
          />

          <SimpleTable
            headers={['Fornecedor', 'Evento', 'Vencimento', 'Valor']}
            empty="Nenhum pagamento previsto."
            rows={pagamentosProximos.map((item) => {
              const obra = obras.find(
                (obraItem) => obraItem.id === item.obra_id,
              );

              return [
                obra?.nome || '—',
                item.evento || '—',
                fmtDate(item.data_vencimento),
                fmtBRL(item.valor),
              ];
            })}
          />
        </div>

        <div style={{ ...s.panel, overflow: 'hidden' }}>
          <PanelHeader
            title="Faturamentos pendentes"
            link="/financeiro"
          />

          <SimpleTable
            headers={['Obra', 'Evento', 'Vencimento', 'Valor']}
            empty="Nenhum faturamento pendente."
            rows={eventosPendentes.map((item) => {
              const obra = obras.find(
                (obraItem) => obraItem.id === item.obra_id,
              );

              return [
                obra?.nome || '—',
                item.evento || '—',
                fmtDate(item.data_vencimento),
                fmtBRL(item.valor_liquido),
              ];
            })}
          />
        </div>

        <div style={{ ...s.panel, padding: 14 }}>
          <div
            style={{
              fontSize: 13,
              fontWeight: 700,
              color: C.white,
              marginBottom: 12,
            }}
          >
            Alertas e Pendências
          </div>

          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 9,
            }}
          >
            {alertas.map((item) => (
              <div
                key={item.label}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 9,
                  padding: '9px 10px',
                  background: C.card2,
                  borderRadius: 7,
                }}
              >
                <AlertTriangle size={14} color={item.color} />
                <span
                  style={{
                    color: C.light,
                    fontSize: 11,
                  }}
                >
                  {item.label}
                </span>
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
              minWidth: 920,
            }}
          >
            <thead>
              <tr>
                {[
                  'Obra',
                  'Contrato',
                  'Faturado',
                  'Recebido',
                  'Pago Fornec.',
                  'A Pagar',
                  'Saldo Caixa',
                  'Status',
                ].map((item) => (
                  <th key={item} style={s.th}>
                    {item}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {dados.obrasFiltradas.map((obra, index) => {
                const contrato = contratos.find(
                  (item) => item.obra_id === obra.id,
                );

                const eventosObra = eventos.filter(
                  (item) => item.obra_id === obra.id,
                );

                const pagamentosObra = pagamentos.filter(
                  (item) => item.obra_id === obra.id,
                );

                const faturado = eventosObra.reduce(
                  (total, item) => total + num(item.valor_bruto),
                  0,
                );

                const recebido = eventosObra.reduce(
                  (total, item) =>
                    total + num(item.valor_recebido),
                  0,
                );

                const pago = pagamentosObra
                  .filter((item) => item.status === 'Pago')
                  .reduce(
                    (total, item) => total + num(item.valor),
                    0,
                  );

                const aPagar = pagamentosObra
                  .filter((item) => item.status !== 'Pago')
                  .reduce(
                    (total, item) => total + num(item.valor),
                    0,
                  );

                const saldo = recebido - pago;
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

                    <td style={moneyCell()}>
                      {fmtBRL(contrato?.valor_total)}
                    </td>

                    <td style={moneyCell(C.cyan)}>
                      {fmtBRL(faturado)}
                    </td>

                    <td style={moneyCell(C.green)}>
                      {fmtBRL(recebido)}
                    </td>

                    <td style={moneyCell(C.pink)}>
                      {fmtBRL(pago)}
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
                      padding: 32,
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

function PanelHeader({ title, link }) {
  return (
    <div
      style={{
        padding: '12px 14px',
        borderBottom: `1px solid ${C.border}`,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 12,
      }}
    >
      <span
        style={{
          fontSize: 13,
          fontWeight: 700,
          color: C.white,
        }}
      >
        {title}
      </span>

      <Link
        to={link}
        style={{
          color: C.cyan,
          textDecoration: 'none',
          fontSize: 10,
          display: 'flex',
          alignItems: 'center',
          gap: 4,
        }}
      >
        Ver todos <ArrowRight size={11} />
      </Link>
    </div>
  );
}

function SimpleTable({ headers, rows, empty }) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table
        style={{
          width: '100%',
          borderCollapse: 'collapse',
          minWidth: 420,
        }}
      >
        <thead>
          <tr>
            {headers.map((item) => (
              <th key={item} style={s.th}>
                {item}
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
                    fontFamily:
                      cellIndex === row.length - 1
                        ? 'IBM Plex Mono'
                        : 'IBM Plex Sans',
                    textAlign:
                      cellIndex === row.length - 1
                        ? 'right'
                        : 'left',
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
      </table>
    </div>
  );
}

function moneyCell(color = C.light) {
  return {
    ...s.td,
    textAlign: 'right',
    fontFamily: 'IBM Plex Mono',
    fontSize: 11,
    color,
  };
}
