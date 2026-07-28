import React, { useEffect, useMemo, useState } from 'react';
import { Plus, Save, Trash2, X } from 'lucide-react';
import { supabase } from './supabase.js';
import { C, s, fmtBRL, fmtDate } from './theme.js';

const EMPTY_FORM = {
  tipo_movimento: 'entrada',
  contrato_fornecedor_id: '',
  pagamento_fornecedor_id: '',
  cliente_fornecedor: '',
  evento: '',
  competencia: '',
  tipo_nf: 'Serviço',
  nf_numero: '',
  data_emissao: '',
  data_vencimento: '',
  data_baixa: '',
  valor_bruto: 0,
  descontos: 0,
  valor_liquido: 0,
  valor_baixado: 0,
  status: 'Previsto',
  observacoes: '',
};

const STATUS_ENTRADA = [
  'Previsto',
  'A emitir',
  'Emitido',
  'Enviado ao cliente',
  'A receber',
  'Recebido',
  'Vencido',
  'Cancelado',
];

const STATUS_SAIDA = [
  'Previsto',
  'NF pendente',
  'NF recebida',
  'Em aprovação',
  'A pagar',
  'Pago',
  'Vencido',
  'Cancelado',
];

const TIPOS_NF = [
  'Serviço',
  'Material',
  'Locação',
  'Seguro',
  'Misto',
  'Outro',
];

function num(value) {
  return Number(value) || 0;
}

function nullable(value) {
  return value === '' || value === undefined ? null : value;
}

export default function FaturamentoTab({ obraId }) {
  const [faturamentos, setFaturamentos] = useState([]);
  const [contratoCliente, setContratoCliente] = useState(null);
  const [fornecedores, setFornecedores] = useState([]);
  const [pagamentos, setPagamentos] = useState([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [filtroTipo, setFiltroTipo] = useState('todos');
  const [filtroFornecedor, setFiltroFornecedor] = useState('todos');
  const [filtroMes, setFiltroMes] = useState('');

  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });

  async function load() {
    setLoading(true);

    const [
      { data: ft, error: ftError },
      { data: cliente, error: clienteError },
      { data: contratos, error: contratosError },
      { data: pagamentosData, error: pagamentosError },
    ] = await Promise.all([
      supabase
        .from('faturamentos')
        .select('*')
        .eq('obra_id', obraId)
        .order('data_vencimento', { ascending: true }),

      supabase
        .from('contratos_cliente')
        .select('*')
        .eq('obra_id', obraId)
        .maybeSingle(),

      supabase
        .from('contratos_fornecedor')
        .select('*')
        .eq('obra_id', obraId)
        .order('fornecedor'),

      supabase
        .from('pagamentos_fornecedor')
        .select('*')
        .eq('obra_id', obraId)
        .order('data_vencimento'),
    ]);

    const error =
      ftError || clienteError || contratosError || pagamentosError;

    if (error) {
      alert(`Erro ao carregar faturamento: ${error.message}`);
    }

    setFaturamentos(ft || []);
    setContratoCliente(cliente || null);
    setFornecedores(contratos || []);
    setPagamentos(pagamentosData || []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, [obraId]);

  function novoFaturamento() {
    setEditId('novo');
    setForm({
      ...EMPTY_FORM,
      tipo_movimento: 'entrada',
      cliente_fornecedor: contratoCliente?.cliente || 'Cliente',
    });
  }

  function editarFaturamento(item) {
    setEditId(item.id);
    setForm({
      ...EMPTY_FORM,
      ...item,
      contrato_fornecedor_id: item.contrato_fornecedor_id || '',
      pagamento_fornecedor_id: item.pagamento_fornecedor_id || '',
      data_emissao: item.data_emissao || '',
      data_vencimento: item.data_vencimento || '',
      data_baixa: item.data_baixa || '',
      competencia: item.competencia || '',
    });
  }

  function cancelarEdicao() {
    setEditId(null);
    setForm({ ...EMPTY_FORM });
  }

  function alterarCampo(field, value) {
    setForm((prev) => {
      const next = { ...prev, [field]: value };

      if (field === 'valor_bruto' || field === 'descontos') {
        const bruto =
          field === 'valor_bruto' ? num(value) : num(prev.valor_bruto);
        const descontos =
          field === 'descontos' ? num(value) : num(prev.descontos);

        next.valor_liquido = Math.max(bruto - descontos, 0);
      }

      if (field === 'tipo_movimento') {
        next.status = value === 'entrada' ? 'Previsto' : 'NF pendente';
        next.contrato_fornecedor_id = '';
        next.pagamento_fornecedor_id = '';
        next.cliente_fornecedor =
          value === 'entrada'
            ? contratoCliente?.cliente || 'Cliente'
            : '';
      }

      if (field === 'contrato_fornecedor_id') {
        const fornecedor = fornecedores.find((item) => item.id === value);
        next.cliente_fornecedor = fornecedor?.fornecedor || '';
        next.pagamento_fornecedor_id = '';
      }

      if (field === 'pagamento_fornecedor_id') {
        const pagamento = pagamentos.find((item) => item.id === value);

        if (pagamento) {
          next.evento = pagamento.evento || next.evento;
          next.valor_bruto = num(pagamento.valor);
          next.valor_liquido = num(pagamento.valor);
          next.data_vencimento =
            pagamento.data_vencimento || next.data_vencimento;
        }
      }

      return next;
    });
  }

  async function salvar() {
    if (!form.evento.trim()) {
      alert('Informe o evento ou a medição.');
      return;
    }

    if (
      form.tipo_movimento === 'saida' &&
      !form.contrato_fornecedor_id
    ) {
      alert('Selecione o fornecedor.');
      return;
    }

    setSaving(true);

    const dados = {
      obra_id: obraId,
      tipo_movimento: form.tipo_movimento,
      contrato_fornecedor_id:
        form.tipo_movimento === 'saida'
          ? nullable(form.contrato_fornecedor_id)
          : null,
      pagamento_fornecedor_id:
        form.tipo_movimento === 'saida'
          ? nullable(form.pagamento_fornecedor_id)
          : null,
      cliente_fornecedor: form.cliente_fornecedor || null,
      evento: form.evento.trim(),
      competencia: nullable(form.competencia),
      tipo_nf: nullable(form.tipo_nf),
      nf_numero: nullable(form.nf_numero),
      data_emissao: nullable(form.data_emissao),
      data_vencimento: nullable(form.data_vencimento),
      data_baixa: nullable(form.data_baixa),
      valor_bruto: num(form.valor_bruto),
      descontos: num(form.descontos),
      valor_liquido: Math.max(
        num(form.valor_bruto) - num(form.descontos),
        0,
      ),
      valor_baixado: num(form.valor_baixado),
      status: form.status,
      observacoes: nullable(form.observacoes),
    };

    let response;

    if (editId === 'novo') {
      response = await supabase
        .from('faturamentos')
        .insert([dados])
        .select()
        .single();
    } else {
      response = await supabase
        .from('faturamentos')
        .update(dados)
        .eq('id', editId)
        .select()
        .single();
    }

    if (response.error) {
      alert(`Erro ao salvar faturamento: ${response.error.message}`);
      setSaving(false);
      return;
    }

    if (editId === 'novo') {
      setFaturamentos((prev) => [...prev, response.data]);
    } else {
      setFaturamentos((prev) =>
        prev.map((item) =>
          item.id === editId ? response.data : item,
        ),
      );
    }

    cancelarEdicao();
    setSaving(false);
  }

  async function remover(id) {
    if (!confirm('Remover este faturamento?')) return;

    const { error } = await supabase
      .from('faturamentos')
      .delete()
      .eq('id', id);

    if (error) {
      alert(`Erro ao remover faturamento: ${error.message}`);
      return;
    }

    setFaturamentos((prev) =>
      prev.filter((item) => item.id !== id),
    );
  }

  const pagamentosDoFornecedor = useMemo(() => {
    if (!form.contrato_fornecedor_id) return [];

    return pagamentos.filter(
      (item) =>
        item.contrato_fornecedor_id ===
        form.contrato_fornecedor_id,
    );
  }, [pagamentos, form.contrato_fornecedor_id]);

  const filtrados = useMemo(() => {
    return faturamentos.filter((item) => {
      const tipoOk =
        filtroTipo === 'todos' ||
        item.tipo_movimento === filtroTipo;

      const fornecedorOk =
        filtroFornecedor === 'todos' ||
        item.contrato_fornecedor_id === filtroFornecedor;

      const mesOk =
        !filtroMes || item.competencia === filtroMes;

      return tipoOk && fornecedorOk && mesOk;
    });
  }, [faturamentos, filtroTipo, filtroFornecedor, filtroMes]);

  const totais = useMemo(() => {
    const entradas = faturamentos.filter(
      (item) => item.tipo_movimento === 'entrada',
    );

    const saidas = faturamentos.filter(
      (item) => item.tipo_movimento === 'saida',
    );

    const faturadoCliente = entradas.reduce(
      (total, item) => total + num(item.valor_liquido),
      0,
    );

    const recebidoCliente = entradas.reduce(
      (total, item) => total + num(item.valor_baixado),
      0,
    );

    const faturadoFornecedor = saidas.reduce(
      (total, item) => total + num(item.valor_liquido),
      0,
    );

    const pagoFornecedor = saidas.reduce(
      (total, item) => total + num(item.valor_baixado),
      0,
    );

    return {
      faturadoCliente,
      recebidoCliente,
      aReceber: Math.max(faturadoCliente - recebidoCliente, 0),
      faturadoFornecedor,
      pagoFornecedor,
      aPagar: Math.max(faturadoFornecedor - pagoFornecedor, 0),
      saldoAtual: recebidoCliente - pagoFornecedor,
    };
  }, [faturamentos]);

  const resumoMensalFornecedor = useMemo(() => {
    if (!filtroMes || filtroFornecedor === 'todos') return null;

    const contrato = fornecedores.find(
      (item) => item.id === filtroFornecedor,
    );

    const previstos = pagamentos.filter((item) => {
      if (item.contrato_fornecedor_id !== filtroFornecedor) {
        return false;
      }

      return (
        item.data_vencimento &&
        item.data_vencimento.slice(0, 7) === filtroMes
      );
    });

    const notas = faturamentos.filter(
      (item) =>
        item.tipo_movimento === 'saida' &&
        item.contrato_fornecedor_id === filtroFornecedor &&
        item.competencia === filtroMes,
    );

    const previsto = previstos.reduce(
      (total, item) => total + num(item.valor),
      0,
    );

    const faturado = notas.reduce(
      (total, item) => total + num(item.valor_liquido),
      0,
    );

    const pago = notas.reduce(
      (total, item) => total + num(item.valor_baixado),
      0,
    );

    return {
      fornecedor: contrato?.fornecedor || 'Fornecedor',
      previsto,
      faturado,
      pago,
      aPagar: Math.max(faturado - pago, 0),
      semNota: Math.max(previsto - faturado, 0),
    };
  }, [
    filtroMes,
    filtroFornecedor,
    fornecedores,
    pagamentos,
    faturamentos,
  ]);

  if (loading) {
    return <div style={{ padding: 24, color: C.gray }}>Carregando…</div>;
  }

  return (
    <div style={{ padding: 20 }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          gap: 12,
          flexWrap: 'wrap',
          marginBottom: 16,
        }}
      >
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: C.white }}>
            Faturamento
          </div>
          <div style={{ fontSize: 11, color: C.gray, marginTop: 3 }}>
            Notas de clientes e fornecedores, sem duplicar pagamentos previstos
          </div>
        </div>

        <button
          onClick={novoFaturamento}
          style={{
            ...s.btnPrimary,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <Plus size={14} />
          Novo faturamento
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
        {[
          {
            title: 'FLUXO — CLIENTE',
            color: C.cyan,
            steps: ['Evento', 'Nota a emitir', 'NF emitida', 'A receber', 'Recebido'],
          },
          {
            title: 'FLUXO — FORNECEDOR',
            color: C.amber,
            steps: ['Medição', 'A liberar', 'NF recebida', 'A pagar', 'Pago'],
          },
        ].map((flow) => (
          <div key={flow.title} style={{ ...s.panel, padding: 12 }}>
            <div style={{ color: flow.color, fontSize: 10, fontWeight: 700, marginBottom: 10 }}>{flow.title}</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 5, alignItems: 'center' }}>
              {flow.steps.map((step, index) => (
                <div key={step} style={{ display: 'flex', alignItems: 'center', minWidth: 0 }}>
                  <div style={{ flex: 1, minWidth: 0, textAlign: 'center' }}>
                    <div style={{ width: 24, height: 24, borderRadius: '50%', margin: '0 auto 5px', display: 'grid', placeItems: 'center', background: C.bg, border: `1px solid ${index === 1 ? flow.color : C.border}`, color: index === 1 ? flow.color : C.gray, fontSize: 10, fontWeight: 700 }}>{index + 1}</div>
                    <div style={{ color: index === 1 ? flow.color : C.light, fontSize: 9, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{step}</div>
                  </div>
                  {index < flow.steps.length - 1 && <div style={{ width: 14, height: 1, background: C.border, margin: '0 2px' }} />}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
          gap: 10,
          marginBottom: 16,
        }}
      >
        {[
          ['Faturado Cliente', totais.faturadoCliente, C.cyan],
          ['Recebido Cliente', totais.recebidoCliente, C.green],
          ['A Receber', totais.aReceber, C.amber],
          ['NF Fornecedores', totais.faturadoFornecedor, C.pink],
          ['Pago Fornecedores', totais.pagoFornecedor, C.green],
          ['A Pagar', totais.aPagar, C.amber],
          [
            'Saldo Atual',
            totais.saldoAtual,
            totais.saldoAtual >= 0 ? C.green : C.red,
          ],
        ].map(([label, value, color]) => (
          <div key={label} style={s.card}>
            <div
              style={{
                fontSize: 9,
                color: C.gray,
                textTransform: 'uppercase',
                fontWeight: 700,
                marginBottom: 6,
              }}
            >
              {label}
            </div>
            <div
              style={{
                fontSize: 16,
                color,
                fontWeight: 700,
                fontFamily: 'IBM Plex Mono',
              }}
            >
              {fmtBRL(value)}
            </div>
          </div>
        ))}
      </div>

      <div
        style={{
          ...s.panel,
          padding: 12,
          marginBottom: 16,
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
          gap: 10,
        }}
      >
        <div>
          <label style={s.label}>Tipo</label>
          <select
            style={s.input}
            value={filtroTipo}
            onChange={(event) => setFiltroTipo(event.target.value)}
          >
            <option value="todos">Todos</option>
            <option value="entrada">Cliente — Entradas</option>
            <option value="saida">Fornecedor — Saídas</option>
          </select>
        </div>

        <div>
          <label style={s.label}>Fornecedor</label>
          <select
            style={s.input}
            value={filtroFornecedor}
            onChange={(event) =>
              setFiltroFornecedor(event.target.value)
            }
          >
            <option value="todos">Todos os fornecedores</option>
            {fornecedores.map((item) => (
              <option key={item.id} value={item.id}>
                {item.fornecedor}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label style={s.label}>Mês de referência</label>
          <input
            type="month"
            style={s.input}
            value={filtroMes}
            onChange={(event) => setFiltroMes(event.target.value)}
          />
        </div>
      </div>

      {resumoMensalFornecedor && (
        <div
          style={{
            ...s.panel,
            padding: 12,
            marginBottom: 16,
          }}
        >
          <div
            style={{
              fontSize: 11,
              color: C.pink,
              fontWeight: 700,
              marginBottom: 10,
            }}
          >
            {resumoMensalFornecedor.fornecedor} — {filtroMes}
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns:
                'repeat(auto-fit, minmax(130px, 1fr))',
              gap: 10,
            }}
          >
            {[
              ['Previsto', resumoMensalFornecedor.previsto, C.white],
              ['NF recebidas', resumoMensalFornecedor.faturado, C.pink],
              ['Pago', resumoMensalFornecedor.pago, C.green],
              ['A pagar', resumoMensalFornecedor.aPagar, C.amber],
              ['Sem NF', resumoMensalFornecedor.semNota, C.red],
            ].map(([label, value, color]) => (
              <div key={label}>
                <div style={{ fontSize: 9, color: C.gray }}>
                  {label}
                </div>
                <div
                  style={{
                    color,
                    fontWeight: 700,
                    fontFamily: 'IBM Plex Mono',
                  }}
                >
                  {fmtBRL(value)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {editId && (
        <div
          style={{
            ...s.panel,
            padding: 14,
            marginBottom: 16,
            background: C.card2,
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 12,
            }}
          >
            <div style={{ fontSize: 12, fontWeight: 700, color: C.white }}>
              {editId === 'novo'
                ? 'NOVO FATURAMENTO'
                : 'EDITAR FATURAMENTO'}
            </div>

            <button onClick={cancelarEdicao} style={iconButton()}>
              <X size={16} />
            </button>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns:
                'repeat(auto-fit, minmax(160px, 1fr))',
              gap: 10,
            }}
          >
            <div>
              <label style={s.label}>Faturamento de</label>
              <select
                style={s.input}
                value={form.tipo_movimento}
                onChange={(event) =>
                  alterarCampo('tipo_movimento', event.target.value)
                }
              >
                <option value="entrada">Cliente — Entrada</option>
                <option value="saida">Fornecedor — Saída</option>
              </select>
            </div>

            {form.tipo_movimento === 'saida' && (
              <>
                <div>
                  <label style={s.label}>Fornecedor</label>
                  <select
                    style={s.input}
                    value={form.contrato_fornecedor_id}
                    onChange={(event) =>
                      alterarCampo(
                        'contrato_fornecedor_id',
                        event.target.value,
                      )
                    }
                  >
                    <option value="">Selecione</option>
                    {fornecedores.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.fornecedor}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={s.label}>Pagamento previsto</label>
                  <select
                    style={s.input}
                    value={form.pagamento_fornecedor_id}
                    onChange={(event) =>
                      alterarCampo(
                        'pagamento_fornecedor_id',
                        event.target.value,
                      )
                    }
                  >
                    <option value="">Sem vínculo</option>
                    {pagamentosDoFornecedor.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.evento} — {fmtBRL(item.valor)}
                      </option>
                    ))}
                  </select>
                </div>
              </>
            )}

            <div>
              <label style={s.label}>Evento / Medição</label>
              <input
                style={s.input}
                value={form.evento}
                onChange={(event) =>
                  alterarCampo('evento', event.target.value)
                }
              />
            </div>

            <div>
              <label style={s.label}>Mês de referência</label>
              <input
                type="month"
                style={s.input}
                value={form.competencia}
                onChange={(event) =>
                  alterarCampo('competencia', event.target.value)
                }
              />
            </div>

            <div>
              <label style={s.label}>Tipo NF</label>
              <select
                style={s.input}
                value={form.tipo_nf}
                onChange={(event) =>
                  alterarCampo('tipo_nf', event.target.value)
                }
              >
                {TIPOS_NF.map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
            </div>

            {[
              ['nf_numero', 'Nº NF', 'text'],
              ['data_emissao', 'Emissão', 'date'],
              ['data_vencimento', 'Vencimento', 'date'],
              ['valor_bruto', 'Valor bruto', 'number'],
              ['descontos', 'Descontos / retenções', 'number'],
              ['valor_baixado', 'Recebido / pago', 'number'],
              ['data_baixa', 'Data recebimento / pagamento', 'date'],
              ['observacoes', 'Observações', 'text'],
            ].map(([field, label, type]) => (
              <div key={field}>
                <label style={s.label}>{label}</label>
                <input
                  type={type}
                  style={s.input}
                  value={form[field] || ''}
                  onChange={(event) =>
                    alterarCampo(
                      field,
                      type === 'number'
                        ? Number(event.target.value)
                        : event.target.value,
                    )
                  }
                />
              </div>
            ))}

            <div>
              <label style={s.label}>Valor líquido</label>
              <input
                style={s.input}
                value={fmtBRL(form.valor_liquido)}
                disabled
              />
            </div>

            <div>
              <label style={s.label}>Status</label>
              <select
                style={s.input}
                value={form.status}
                onChange={(event) =>
                  alterarCampo('status', event.target.value)
                }
              >
                {(form.tipo_movimento === 'entrada'
                  ? STATUS_ENTRADA
                  : STATUS_SAIDA
                ).map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button
              onClick={salvar}
              disabled={saving}
              style={{
                ...s.btnPrimary,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <Save size={13} />
              {saving ? 'Salvando…' : 'Salvar'}
            </button>

            <button onClick={cancelarEdicao} style={s.btn}>
              Cancelar
            </button>
          </div>
        </div>
      )}

      <div style={{ ...s.panel, overflowX: 'auto' }}>
        <table
          style={{
            width: '100%',
            borderCollapse: 'collapse',
            minWidth: 1000,
          }}
        >
          <thead>
            <tr>
              {[
                'Tipo',
                'Cliente / Fornecedor',
                'Evento / Medição',
                'Mês',
                'Nº NF',
                'Valor líquido',
                'Vencimento',
                'Recebido / Pago',
                'Status',
                '',
              ].map((item) => (
                <th key={item} style={s.th}>
                  {item}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {filtrados.map((item, index) => (
              <tr
                key={item.id}
                style={{
                  background: index % 2 === 0 ? C.bg : C.card2,
                  cursor: 'pointer',
                }}
                onClick={() => editarFaturamento(item)}
              >
                <td style={s.td}>
                  <span
                    style={{
                      ...s.badge(
                        item.tipo_movimento === 'entrada'
                          ? C.cyanBg
                          : C.card2,
                        item.tipo_movimento === 'entrada'
                          ? C.cyan
                          : C.pink,
                      ),
                    }}
                  >
                    {item.tipo_movimento === 'entrada'
                      ? 'Cliente'
                      : 'Fornecedor'}
                  </span>
                </td>

                <td style={{ ...s.td, fontWeight: 600 }}>
                  {item.cliente_fornecedor || '—'}
                </td>

                <td style={s.td}>{item.evento}</td>
                <td style={s.td}>{item.competencia || '—'}</td>
                <td style={s.td}>{item.nf_numero || '—'}</td>

                <td style={moneyCell(
                  item.tipo_movimento === 'entrada' ? C.cyan : C.pink,
                )}>
                  {fmtBRL(item.valor_liquido)}
                </td>

                <td style={s.td}>{fmtDate(item.data_vencimento)}</td>

                <td style={moneyCell(C.green)}>
                  {fmtBRL(item.valor_baixado)}
                </td>

                <td style={s.td}>{item.status}</td>

                <td style={s.td}>
                  <button
                    onClick={(event) => {
                      event.stopPropagation();
                      remover(item.id);
                    }}
                    style={iconButton()}
                  >
                    <Trash2 size={13} />
                  </button>
                </td>
              </tr>
            ))}

            {filtrados.length === 0 && (
              <tr>
                <td
                  colSpan={10}
                  style={{
                    ...s.td,
                    textAlign: 'center',
                    color: C.gray,
                    padding: 32,
                  }}
                >
                  Nenhum faturamento encontrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function moneyCell(color) {
  return {
    ...s.td,
    textAlign: 'right',
    fontFamily: 'IBM Plex Mono',
    fontSize: 12,
    color,
    fontWeight: 700,
  };
}

function iconButton() {
  return {
    background: 'none',
    border: 'none',
    color: C.gray,
    cursor: 'pointer',
    padding: 4,
  };
}
