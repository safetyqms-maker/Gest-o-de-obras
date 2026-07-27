import React, { useEffect, useMemo, useState } from 'react';
import { Plus, Save, Trash2 } from 'lucide-react';
import { supabase } from './supabase.js';
import {
  C,
  s,
  STATUS_FAT,
  STATUS_PAG,
  fmtBRL,
  fmtDate,
} from './theme.js';

const TIPOS_NF_CLIENTE = [
  'Estrutura Metálica',
  'Serviço de Montagem',
  'Locação de Equipamentos',
  'Misto',
];

const TIPOS_NF_FORNECEDOR = [
  'Serviço',
  'Locação',
  'Material',
  'Seguro',
  'Outro',
];

const EVENTOS_PADRAO = [
  { evento: 'Adiantamento (20%)', tipo_nf: 'Misto', ordem: 0 },
  { evento: 'Estrutura (embarque)', tipo_nf: 'Estrutura Metálica', ordem: 1 },
  { evento: 'Serviço - Integração', tipo_nf: 'Serviço de Montagem', ordem: 2 },
  { evento: 'Locação - BM Mensal 1', tipo_nf: 'Locação de Equipamentos', ordem: 3 },
  { evento: 'Locação - BM Mensal 2', tipo_nf: 'Locação de Equipamentos', ordem: 4 },
  { evento: 'Serviço - Conclusão', tipo_nf: 'Serviço de Montagem', ordem: 5 },
];

const EMPTY_FORNECEDOR = {
  contrato_fornecedor_id: '',
  evento: '',
  tipo_nf: 'Serviço',
  nf_numero: '',
  data_emissao: '',
  data_vencimento: '',
  data_pagamento: '',
  valor_bruto: 0,
  descontos: 0,
  valor_liquido: 0,
  valor_pago: 0,
  status: 'Pendente',
  observacoes: '',
};

function numberValue(value) {
  return Number(value) || 0;
}

export default function FaturamentoTab({ obraId }) {
  const [eventos, setEventos] = useState([]);
  const [contrato, setContrato] = useState(null);

  const [contratosFornecedor, setContratosFornecedor] = useState([]);
  const [pagamentosFornecedor, setPagamentosFornecedor] = useState([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [editId, setEditId] = useState(null);
  const [editData, setEditData] = useState({});

  const [editFornecedorId, setEditFornecedorId] = useState(null);
  const [editFornecedorData, setEditFornecedorData] = useState({
    ...EMPTY_FORNECEDOR,
  });

  async function load() {
    setLoading(true);

    const [
      { data: ev, error: evError },
      { data: ct, error: ctError },
      { data: fornecedores, error: fornecedoresError },
      { data: pagamentos, error: pagamentosError },
    ] = await Promise.all([
      supabase
        .from('eventos_faturamento')
        .select('*')
        .eq('obra_id', obraId)
        .order('ordem'),

      supabase
        .from('contratos_cliente')
        .select('*')
        .eq('obra_id', obraId)
        .maybeSingle(),

      supabase
        .from('contratos_fornecedor')
        .select('*')
        .eq('obra_id', obraId)
        .order('created_at'),

      supabase
        .from('pagamentos_fornecedor')
        .select('*')
        .eq('obra_id', obraId)
        .order('data_vencimento'),
    ]);

    const firstError =
      evError || ctError || fornecedoresError || pagamentosError;

    if (firstError) {
      alert(`Erro ao carregar faturamento: ${firstError.message}`);
    }

    setEventos(ev || []);
    setContrato(ct || null);
    setContratosFornecedor(fornecedores || []);
    setPagamentosFornecedor(pagamentos || []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, [obraId]);

  async function addEvento() {
    const ordem = eventos.length;

    const { data, error } = await supabase
      .from('eventos_faturamento')
      .insert([
        {
          obra_id: obraId,
          evento: `Evento ${ordem + 1}`,
          tipo_nf: 'Estrutura Metálica',
          ordem,
          valor_bruto: 0,
          status: 'A emitir',
        },
      ])
      .select()
      .single();

    if (error) {
      alert(`Erro ao adicionar evento: ${error.message}`);
      return;
    }

    setEventos((prev) => [...prev, data]);
    setEditId(data.id);
    setEditData(data);
  }

  async function gerarEventosPadrao() {
    if (!contrato) return;

    const adiantamentoPct = numberValue(contrato.adiantamento_pct) || 0.2;
    const valorTotal = numberValue(contrato.valor_total);

    const adiantamento = valorTotal * adiantamentoPct;
    const estrutura =
      valorTotal * (numberValue(contrato.divisao_estrutura_pct) || 0.75);
    const montagem =
      valorTotal * (numberValue(contrato.divisao_montagem_pct) || 0.15);
    const locacao =
      valorTotal * (numberValue(contrato.divisao_locacao_pct) || 0.1);

    const rows = EVENTOS_PADRAO.map((item, index) => {
      const bruto =
        index === 0
          ? adiantamento
          : index === 1
            ? estrutura
            : index === 5
              ? montagem / 3
              : locacao / 3;

      const desconto = bruto * adiantamentoPct;

      return {
        obra_id: obraId,
        evento: item.evento,
        tipo_nf: item.tipo_nf,
        ordem: index,
        valor_bruto: Math.round(bruto),
        desconto_adiantamento: Math.round(desconto),
        valor_liquido: Math.round(bruto - desconto),
        status: 'A emitir',
      };
    });

    const { error: deleteError } = await supabase
      .from('eventos_faturamento')
      .delete()
      .eq('obra_id', obraId);

    if (deleteError) {
      alert(`Erro ao recriar eventos: ${deleteError.message}`);
      return;
    }

    const { error: insertError } = await supabase
      .from('eventos_faturamento')
      .insert(rows);

    if (insertError) {
      alert(`Erro ao gerar eventos: ${insertError.message}`);
      return;
    }

    load();
  }

  function startEdit(evento) {
    setEditId(evento.id);
    setEditData({ ...evento });
  }

  async function saveEdit() {
    setSaving(true);

    const bruto = numberValue(editData.valor_bruto);
    const adiantamentoPct =
      numberValue(contrato?.adiantamento_pct) || 0.2;
    const desconto = contrato ? bruto * adiantamentoPct : 0;
    const liquido = bruto - desconto;

    const toSave = {
      ...editData,
      desconto_adiantamento: Math.round(desconto),
      valor_liquido: Math.round(liquido),
    };

    const { error } = await supabase
      .from('eventos_faturamento')
      .update(toSave)
      .eq('id', editId);

    if (error) {
      alert(`Erro ao salvar evento: ${error.message}`);
      setSaving(false);
      return;
    }

    setEventos((prev) =>
      prev.map((item) => (item.id === editId ? toSave : item)),
    );
    setEditId(null);
    setSaving(false);
  }

  async function deleteEvento(id) {
    if (!confirm('Remover este evento?')) return;

    const { error } = await supabase
      .from('eventos_faturamento')
      .delete()
      .eq('id', id);

    if (error) {
      alert(`Erro ao remover evento: ${error.message}`);
      return;
    }

    setEventos((prev) => prev.filter((item) => item.id !== id));
  }

  function adicionarFaturamentoFornecedor() {
    const primeiroContrato = contratosFornecedor[0];

    if (!primeiroContrato) {
      alert('Cadastre primeiro um fornecedor na aba Fornecedores.');
      return;
    }

    setEditFornecedorId('novo');
    setEditFornecedorData({
      ...EMPTY_FORNECEDOR,
      contrato_fornecedor_id: primeiroContrato.id,
      evento: 'Nova NF / Despesa',
      tipo_nf: 'Serviço',
      status: 'Pendente',
    });
  }

  function iniciarEdicaoFornecedor(pagamento) {
    setEditFornecedorId(pagamento.id);
    setEditFornecedorData({
      ...EMPTY_FORNECEDOR,
      ...pagamento,
      valor_bruto:
        pagamento.valor_bruto ??
        pagamento.valor_liquido ??
        pagamento.valor ??
        0,
      valor_liquido:
        pagamento.valor_liquido ??
        pagamento.valor ??
        0,
      valor_pago:
        pagamento.valor_pago ??
        (pagamento.status === 'Pago' ? pagamento.valor || 0 : 0),
    });
  }

  async function salvarFaturamentoFornecedor() {
    setSaving(true);

    const bruto = numberValue(editFornecedorData.valor_bruto);
    const descontos = numberValue(editFornecedorData.descontos);
    const liquido = Math.max(bruto - descontos, 0);
    const pago = numberValue(editFornecedorData.valor_pago);

    const dados = {
      obra_id: obraId,
      contrato_fornecedor_id:
        editFornecedorData.contrato_fornecedor_id,
      evento: editFornecedorData.evento || 'Nova NF / Despesa',
      tipo_nf: editFornecedorData.tipo_nf || 'Serviço',
      nf_numero: editFornecedorData.nf_numero || null,
      data_emissao: editFornecedorData.data_emissao || null,
      data_recebimento_nf:
        editFornecedorData.data_recebimento_nf || null,
      data_vencimento: editFornecedorData.data_vencimento || null,
      data_pagamento: editFornecedorData.data_pagamento || null,
      valor_bruto: bruto,
      descontos,
      valor_liquido: liquido,
      valor: liquido,
      valor_pago: pago,
      status: editFornecedorData.status || 'Pendente',
      observacoes: editFornecedorData.observacoes || null,
    };

    let data;
    let error;

    if (editFornecedorId === 'novo') {
      const resposta = await supabase
        .from('pagamentos_fornecedor')
        .insert([dados])
        .select()
        .single();

      data = resposta.data;
      error = resposta.error;
    } else {
      const resposta = await supabase
        .from('pagamentos_fornecedor')
        .update(dados)
        .eq('id', editFornecedorId)
        .select()
        .single();

      data = resposta.data;
      error = resposta.error;
    }

    if (error) {
      alert(`Erro ao salvar NF do fornecedor: ${error.message}`);
      setSaving(false);
      return;
    }

    if (editFornecedorId === 'novo') {
      setPagamentosFornecedor((prev) => [...prev, data]);
    } else {
      setPagamentosFornecedor((prev) =>
        prev.map((item) =>
          item.id === editFornecedorId ? data : item,
        ),
      );
    }

    setEditFornecedorId(null);
    setEditFornecedorData({ ...EMPTY_FORNECEDOR });
    setSaving(false);
  }

  async function deleteFaturamentoFornecedor(id) {
    if (!confirm('Remover esta NF / despesa do fornecedor?')) return;

    const { error } = await supabase
      .from('pagamentos_fornecedor')
      .delete()
      .eq('id', id);

    if (error) {
      alert(`Erro ao remover NF: ${error.message}`);
      return;
    }

    setPagamentosFornecedor((prev) =>
      prev.filter((item) => item.id !== id),
    );

    if (editFornecedorId === id) {
      setEditFornecedorId(null);
      setEditFornecedorData({ ...EMPTY_FORNECEDOR });
    }
  }

  const totais = useMemo(() => {
    const totalBruto = eventos.reduce(
      (total, item) => total + numberValue(item.valor_bruto),
      0,
    );

    const totalRecebido = eventos.reduce(
      (total, item) => total + numberValue(item.valor_recebido),
      0,
    );

    const totalContratadoFornecedor = contratosFornecedor.reduce(
      (total, item) => total + numberValue(item.valor_contrato),
      0,
    );

    const totalFaturadoFornecedor = pagamentosFornecedor.reduce(
      (total, item) =>
        total +
        numberValue(
          item.valor_liquido ?? item.valor_bruto ?? item.valor,
        ),
      0,
    );

    const totalPagoFornecedor = pagamentosFornecedor.reduce(
      (total, item) =>
        total +
        numberValue(
          item.valor_pago ??
            (item.status === 'Pago' ? item.valor || 0 : 0),
        ),
      0,
    );

    return {
      totalBruto,
      totalRecebido,
      totalPendente: Math.max(totalBruto - totalRecebido, 0),
      totalContratadoFornecedor,
      totalFaturadoFornecedor,
      totalPagoFornecedor,
      totalPagarFornecedor: Math.max(
        totalFaturadoFornecedor - totalPagoFornecedor,
        0,
      ),
      resultadoAtual: totalRecebido - totalPagoFornecedor,
    };
  }, [eventos, contratosFornecedor, pagamentosFornecedor]);

  if (loading) {
    return (
      <div style={{ padding: 24, color: C.gray }}>
        Carregando…
      </div>
    );
  }

  return (
    <div style={{ padding: 20 }}>
      <ResumoFinanceiro
        titulo="ENTRADAS — CLIENTE"
        corTitulo={C.cyan}
        itens={[
          ['Contrato Total', fmtBRL(contrato?.valor_total), C.white],
          ['Faturado', fmtBRL(totais.totalBruto), C.cyan],
          ['Recebido', fmtBRL(totais.totalRecebido), C.green],
          ['A Receber', fmtBRL(totais.totalPendente), C.amber],
        ]}
      />

      <ResumoFinanceiro
        titulo="SAÍDAS — FORNECEDORES"
        corTitulo={C.pink}
        itens={[
          [
            'Total Contratado',
            fmtBRL(totais.totalContratadoFornecedor),
            C.white,
          ],
          [
            'Faturado',
            fmtBRL(totais.totalFaturadoFornecedor),
            C.pink,
          ],
          ['Pago', fmtBRL(totais.totalPagoFornecedor), C.green],
          ['A Pagar', fmtBRL(totais.totalPagarFornecedor), C.amber],
          [
            'Resultado Atual',
            fmtBRL(totais.resultadoAtual),
            totais.resultadoAtual >= 0 ? C.green : C.red,
          ],
        ]}
      />

      <section style={{ marginTop: 20 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 10,
            flexWrap: 'wrap',
            marginBottom: 12,
          }}
        >
          <div style={{ fontSize: 13, fontWeight: 700, color: C.cyan }}>
            FATURAMENTO PARA O CLIENTE
          </div>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button
              onClick={addEvento}
              style={{
                ...s.btnPrimary,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <Plus size={14} />
              Novo evento
            </button>

            {contrato && eventos.length === 0 && (
              <button onClick={gerarEventosPadrao} style={s.btnGreen}>
                Gerar eventos padrão
              </button>
            )}
          </div>
        </div>

        <div style={{ ...s.panel, overflowX: 'auto' }}>
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              minWidth: 900,
            }}
          >
            <thead>
              <tr>
                {[
                  'Evento',
                  'Tipo NF',
                  'Valor Bruto',
                  'Desc. Adiant.',
                  'Valor Líquido',
                  'Nº NF',
                  'Emissão',
                  'Vencimento',
                  'Recebimento',
                  'Valor Recebido',
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
              {eventos.map((evento, index) => {
                const status =
                  STATUS_FAT[evento.status] || {
                    bg: C.card2,
                    fg: C.gray,
                  };

                const isEdit = editId === evento.id;

                if (isEdit) {
                  return (
                    <tr key={evento.id} style={{ background: C.cyanBg }}>
                      <td colSpan={12} style={{ padding: 12 }}>
                        <div
                          style={{
                            display: 'grid',
                            gridTemplateColumns:
                              'repeat(auto-fill, minmax(160px, 1fr))',
                            gap: 10,
                          }}
                        >
                          {[
                            ['evento', 'Evento', 'text'],
                            ['tipo_nf', 'Tipo NF', 'select'],
                            ['valor_bruto', 'Valor Bruto', 'number'],
                            ['nf_numero', 'Nº NF', 'text'],
                            ['data_emissao', 'Data Emissão', 'date'],
                            ['data_envio_portal', 'Envio Portal', 'date'],
                            ['data_vencimento', 'Vencimento', 'date'],
                            ['data_recebimento', 'Recebimento', 'date'],
                            [
                              'valor_recebido',
                              'Valor Recebido',
                              'number',
                            ],
                            ['status', 'Status', 'status'],
                            ['observacoes', 'Observações', 'text'],
                          ].map(([field, label, type]) => (
                            <div key={field}>
                              <label style={s.label}>{label}</label>

                              {type === 'select' ? (
                                <select
                                  style={s.input}
                                  value={editData[field] || ''}
                                  onChange={(event) =>
                                    setEditData((prev) => ({
                                      ...prev,
                                      [field]: event.target.value,
                                    }))
                                  }
                                >
                                  {TIPOS_NF_CLIENTE.map((item) => (
                                    <option key={item}>{item}</option>
                                  ))}
                                </select>
                              ) : type === 'status' ? (
                                <select
                                  style={s.input}
                                  value={editData[field] || ''}
                                  onChange={(event) =>
                                    setEditData((prev) => ({
                                      ...prev,
                                      [field]: event.target.value,
                                    }))
                                  }
                                >
                                  {Object.keys(STATUS_FAT).map((item) => (
                                    <option key={item}>{item}</option>
                                  ))}
                                </select>
                              ) : (
                                <input
                                  type={type}
                                  style={s.input}
                                  value={editData[field] || ''}
                                  onChange={(event) =>
                                    setEditData((prev) => ({
                                      ...prev,
                                      [field]:
                                        type === 'number'
                                          ? Number(event.target.value)
                                          : event.target.value,
                                    }))
                                  }
                                />
                              )}
                            </div>
                          ))}
                        </div>

                        <div
                          style={{
                            display: 'flex',
                            gap: 8,
                            marginTop: 12,
                          }}
                        >
                          <button
                            onClick={saveEdit}
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

                          <button
                            onClick={() => setEditId(null)}
                            style={s.btn}
                          >
                            Cancelar
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                }

                return (
                  <tr
                    key={evento.id}
                    style={{
                      background: index % 2 === 0 ? C.bg : C.card2,
                      cursor: 'pointer',
                    }}
                    onClick={() => startEdit(evento)}
                  >
                    <td
                      style={{
                        ...s.td,
                        fontWeight: 600,
                        color: C.white,
                      }}
                    >
                      {evento.evento}
                    </td>
                    <td style={{ ...s.td, fontSize: 11, color: C.gray }}>
                      {evento.tipo_nf || '—'}
                    </td>
                    <td style={moneyCell()}>
                      {fmtBRL(evento.valor_bruto)}
                    </td>
                    <td style={moneyCell(C.amber)}>
                      {fmtBRL(evento.desconto_adiantamento)}
                    </td>
                    <td style={moneyCell(C.green, true)}>
                      {fmtBRL(evento.valor_liquido)}
                    </td>
                    <td
                      style={{
                        ...s.td,
                        fontFamily: 'IBM Plex Mono',
                        color: C.cyan,
                      }}
                    >
                      {evento.nf_numero || '—'}
                    </td>
                    <td style={s.td}>{fmtDate(evento.data_emissao)}</td>
                    <td style={s.td}>
                      {fmtDate(evento.data_vencimento)}
                    </td>
                    <td style={{ ...s.td, color: C.green }}>
                      {fmtDate(evento.data_recebimento)}
                    </td>
                    <td style={moneyCell(C.green)}>
                      {fmtBRL(evento.valor_recebido)}
                    </td>
                    <td style={s.td}>
                      <span style={s.badge(status.bg, status.fg)}>
                        {evento.status}
                      </span>
                    </td>
                    <td style={s.td}>
                      <button
                        onClick={(event) => {
                          event.stopPropagation();
                          deleteEvento(evento.id);
                        }}
                        style={iconButton()}
                        title="Remover evento"
                      >
                        <Trash2 size={13} />
                      </button>
                    </td>
                  </tr>
                );
              })}

              {eventos.length === 0 && (
                <tr>
                  <td
                    colSpan={12}
                    style={{
                      ...s.td,
                      textAlign: 'center',
                      color: C.gray,
                      padding: 32,
                    }}
                  >
                    Nenhum evento de faturamento cadastrado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section style={{ marginTop: 24 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 10,
            flexWrap: 'wrap',
            marginBottom: 12,
          }}
        >
          <div style={{ fontSize: 13, fontWeight: 700, color: C.pink }}>
            FATURAMENTO DOS FORNECEDORES
          </div>

          <button
            onClick={adicionarFaturamentoFornecedor}
            style={{
              ...s.btnPrimary,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <Plus size={14} />
            Nova NF / Despesa
          </button>
        </div>

        <div style={{ ...s.panel, overflowX: 'auto' }}>
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              minWidth: 900,
            }}
          >
            <thead>
              <tr>
                {[
                  'Fornecedor',
                  'Evento / Medição',
                  'Tipo NF',
                  'Nº NF',
                  'Emissão',
                  'Vencimento',
                  'Valor Líquido',
                  'Pago',
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
              {pagamentosFornecedor.map((pagamento, index) => {
                const fornecedor = contratosFornecedor.find(
                  (item) =>
                    item.id === pagamento.contrato_fornecedor_id,
                );

                const status =
                  STATUS_PAG?.[pagamento.status] || {
                    bg: C.card2,
                    fg:
                      pagamento.status === 'Pago'
                        ? C.green
                        : C.amber,
                  };

                return (
                  <tr
                    key={pagamento.id}
                    style={{
                      background: index % 2 === 0 ? C.bg : C.card2,
                      cursor: 'pointer',
                    }}
                    onClick={() =>
                      iniciarEdicaoFornecedor(pagamento)
                    }
                  >
                    <td
                      style={{
                        ...s.td,
                        fontWeight: 600,
                        color: C.white,
                      }}
                    >
                      {fornecedor?.fornecedor || '—'}
                    </td>
                    <td style={s.td}>{pagamento.evento || '—'}</td>
                    <td style={{ ...s.td, color: C.gray }}>
                      {pagamento.tipo_nf || '—'}
                    </td>
                    <td
                      style={{
                        ...s.td,
                        fontFamily: 'IBM Plex Mono',
                        color: C.cyan,
                      }}
                    >
                      {pagamento.nf_numero || '—'}
                    </td>
                    <td style={s.td}>
                      {fmtDate(pagamento.data_emissao)}
                    </td>
                    <td style={s.td}>
                      {fmtDate(pagamento.data_vencimento)}
                    </td>
                    <td style={moneyCell(C.pink)}>
                      {fmtBRL(
                        pagamento.valor_liquido ??
                          pagamento.valor ??
                          0,
                      )}
                    </td>
                    <td style={moneyCell(C.green)}>
                      {fmtBRL(
                        pagamento.valor_pago ??
                          (pagamento.status === 'Pago'
                            ? pagamento.valor || 0
                            : 0),
                      )}
                    </td>
                    <td style={s.td}>
                      <span style={s.badge(status.bg, status.fg)}>
                        {pagamento.status || 'Pendente'}
                      </span>
                    </td>
                    <td style={s.td}>
                      <button
                        onClick={(event) => {
                          event.stopPropagation();
                          deleteFaturamentoFornecedor(pagamento.id);
                        }}
                        style={iconButton()}
                        title="Remover NF / despesa"
                      >
                        <Trash2 size={13} />
                      </button>
                    </td>
                  </tr>
                );
              })}

              {pagamentosFornecedor.length === 0 && (
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
                    Nenhuma NF ou despesa de fornecedor cadastrada.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {editFornecedorId && (
          <div
            style={{
              ...s.panel,
              marginTop: 12,
              padding: 16,
              background: C.card2,
            }}
          >
            <div
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: C.pink,
                marginBottom: 12,
              }}
            >
              EDITAR NF / DESPESA DO FORNECEDOR
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns:
                  'repeat(auto-fill, minmax(160px, 1fr))',
                gap: 10,
              }}
            >
              <div>
                <label style={s.label}>Fornecedor</label>
                <select
                  style={s.input}
                  value={
                    editFornecedorData.contrato_fornecedor_id || ''
                  }
                  onChange={(event) =>
                    setEditFornecedorData((prev) => ({
                      ...prev,
                      contrato_fornecedor_id: event.target.value,
                    }))
                  }
                >
                  {contratosFornecedor.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.fornecedor}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={s.label}>Evento / Medição</label>
                <input
                  style={s.input}
                  value={editFornecedorData.evento || ''}
                  onChange={(event) =>
                    setEditFornecedorData((prev) => ({
                      ...prev,
                      evento: event.target.value,
                    }))
                  }
                />
              </div>

              <div>
                <label style={s.label}>Tipo NF</label>
                <select
                  style={s.input}
                  value={editFornecedorData.tipo_nf || 'Serviço'}
                  onChange={(event) =>
                    setEditFornecedorData((prev) => ({
                      ...prev,
                      tipo_nf: event.target.value,
                    }))
                  }
                >
                  {TIPOS_NF_FORNECEDOR.map((item) => (
                    <option key={item}>{item}</option>
                  ))}
                </select>
              </div>

              {[
                ['nf_numero', 'Nº NF', 'text'],
                ['data_emissao', 'Emissão', 'date'],
                ['data_vencimento', 'Vencimento', 'date'],
                ['valor_bruto', 'Valor Bruto', 'number'],
                ['descontos', 'Retenções / Descontos', 'number'],
                ['valor_pago', 'Valor Pago', 'number'],
                ['data_pagamento', 'Data Pagamento', 'date'],
                ['observacoes', 'Observações', 'text'],
              ].map(([field, label, type]) => (
                <div key={field}>
                  <label style={s.label}>{label}</label>
                  <input
                    type={type}
                    style={s.input}
                    value={editFornecedorData[field] || ''}
                    onChange={(event) =>
                      setEditFornecedorData((prev) => ({
                        ...prev,
                        [field]:
                          type === 'number'
                            ? Number(event.target.value)
                            : event.target.value,
                      }))
                    }
                  />
                </div>
              ))}

              <div>
                <label style={s.label}>Status</label>
                <select
                  style={s.input}
                  value={editFornecedorData.status || 'Pendente'}
                  onChange={(event) =>
                    setEditFornecedorData((prev) => ({
                      ...prev,
                      status: event.target.value,
                    }))
                  }
                >
                  {Object.keys(STATUS_PAG || {}).length > 0 ? (
                    Object.keys(STATUS_PAG).map((item) => (
                      <option key={item}>{item}</option>
                    ))
                  ) : (
                    <>
                      <option>Pendente</option>
                      <option>Pago</option>
                      <option>Atrasado</option>
                      <option>Parcial</option>
                    </>
                  )}
                </select>
              </div>
            </div>

            <div
              style={{
                display: 'flex',
                gap: 8,
                marginTop: 12,
              }}
            >
              <button
                onClick={salvarFaturamentoFornecedor}
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

              <button
                onClick={() => {
                  setEditFornecedorId(null);
                  setEditFornecedorData({ ...EMPTY_FORNECEDOR });
                }}
                style={s.btn}
              >
                Cancelar
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

function ResumoFinanceiro({ titulo, corTitulo, itens }) {
  return (
    <section style={{ marginBottom: 16 }}>
      <div
        style={{
          fontSize: 11,
          color: corTitulo,
          fontWeight: 700,
          marginBottom: 8,
        }}
      >
        {titulo}
      </div>

      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        {itens.map(([label, value, color]) => (
          <div
            key={label}
            style={{
              ...s.card,
              flex: '1 1 150px',
              minWidth: 150,
            }}
          >
            <div
              style={{
                fontSize: 10,
                color: C.gray,
                fontWeight: 600,
                textTransform: 'uppercase',
                marginBottom: 6,
              }}
            >
              {label}
            </div>

            <div
              style={{
                fontSize: 18,
                fontWeight: 700,
                color,
                fontFamily: 'IBM Plex Mono',
              }}
            >
              {value}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function moneyCell(color = C.light, bold = false) {
  return {
    ...s.td,
    textAlign: 'right',
    fontFamily: 'IBM Plex Mono',
    fontSize: 12,
    color,
    fontWeight: bold ? 700 : 400,
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
