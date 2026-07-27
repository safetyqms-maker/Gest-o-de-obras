import React, { useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Plus, Save, Trash2, X } from 'lucide-react';
import { supabase } from './supabase.js';
import { C, s, STATUS_PAG, fmtBRL, fmtDate } from './theme.js';

const TIPOS = ['Montadora', 'Supervisor', 'Seguro', 'Transporte', 'Outro'];
const STATUS = ['Não iniciado', 'Pendente', 'Autorizado', 'Pago', 'Atrasado', 'Cancelado'];

const EMPTY_CONTRATO = {
  tipo: 'Montadora',
  fornecedor: '',
  pc_tibre: '',
  valor_contrato: 0,
  prazo_pagamento_dd: 15,
  email_fornecedor: '',
  email_nf_fornecedor: '',
  condicoes: '',
  observacoes: '',
};

const EMPTY_PAGAMENTO = {
  evento: '',
  competencia: '',
  valor: 0,
  data_vencimento: '',
  data_pagamento: '',
  status: 'Não iniciado',
  observacoes: '',
};

function num(value) {
  return Number(value) || 0;
}

function nullable(value) {
  return value === '' || value === undefined ? null : value;
}

export default function FornecedoresTab({ obraId, obra }) {
  const [contratos, setContratos] = useState([]);
  const [pagamentos, setPagamentos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [expanded, setExpanded] = useState({});

  const [editContratoId, setEditContratoId] = useState(null);
  const [contratoForm, setContratoForm] = useState({ ...EMPTY_CONTRATO });

  const [editPagamentoId, setEditPagamentoId] = useState(null);
  const [pagamentoContratoId, setPagamentoContratoId] = useState(null);
  const [pagamentoForm, setPagamentoForm] = useState({ ...EMPTY_PAGAMENTO });

  const [filtroMes, setFiltroMes] = useState('');

  async function load() {
    setLoading(true);

    const [contratosResponse, pagamentosResponse] = await Promise.all([
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

    const error = contratosResponse.error || pagamentosResponse.error;
    if (error) alert(`Erro ao carregar fornecedores: ${error.message}`);

    setContratos(contratosResponse.data || []);
    setPagamentos(pagamentosResponse.data || []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, [obraId]);

  function novoContrato() {
    setEditContratoId('novo');
    setContratoForm({ ...EMPTY_CONTRATO });
  }

  function editarContrato(contrato) {
    setEditContratoId(contrato.id);
    setContratoForm({ ...EMPTY_CONTRATO, ...contrato });
  }

  async function salvarContrato() {
    if (!contratoForm.fornecedor.trim()) {
      alert('Informe o nome do fornecedor.');
      return;
    }

    setSaving(true);

    const dados = {
      obra_id: obraId,
      tipo: contratoForm.tipo,
      fornecedor: contratoForm.fornecedor.trim(),
      pc_tibre: nullable(contratoForm.pc_tibre),
      valor_contrato: num(contratoForm.valor_contrato),
      prazo_pagamento_dd: num(contratoForm.prazo_pagamento_dd) || 15,
      email_fornecedor: nullable(contratoForm.email_fornecedor),
      email_nf_fornecedor: nullable(contratoForm.email_nf_fornecedor),
      condicoes: nullable(contratoForm.condicoes),
      observacoes: nullable(contratoForm.observacoes),
    };

    const response = editContratoId === 'novo'
      ? await supabase.from('contratos_fornecedor').insert([dados]).select().single()
      : await supabase.from('contratos_fornecedor').update(dados).eq('id', editContratoId).select().single();

    if (response.error) {
      alert(`Erro ao salvar fornecedor: ${response.error.message}`);
      setSaving(false);
      return;
    }

    if (editContratoId === 'novo') {
      setContratos((prev) => [...prev, response.data]);
      setExpanded((prev) => ({ ...prev, [response.data.id]: true }));
    } else {
      setContratos((prev) => prev.map((item) => item.id === editContratoId ? response.data : item));
    }

    setEditContratoId(null);
    setContratoForm({ ...EMPTY_CONTRATO });
    setSaving(false);
  }

  async function removerContrato(id) {
    if (!confirm('Remover este fornecedor e todos os pagamentos previstos?')) return;

    const { error } = await supabase.from('contratos_fornecedor').delete().eq('id', id);
    if (error) {
      alert(`Erro ao remover fornecedor: ${error.message}`);
      return;
    }

    setContratos((prev) => prev.filter((item) => item.id !== id));
    setPagamentos((prev) => prev.filter((item) => item.contrato_fornecedor_id !== id));
  }

  function novoPagamento(contratoId) {
    setPagamentoContratoId(contratoId);
    setEditPagamentoId('novo');
    setPagamentoForm({ ...EMPTY_PAGAMENTO });
    setExpanded((prev) => ({ ...prev, [contratoId]: true }));
  }

  function editarPagamento(pagamento) {
    setPagamentoContratoId(pagamento.contrato_fornecedor_id);
    setEditPagamentoId(pagamento.id);
    setPagamentoForm({
      ...EMPTY_PAGAMENTO,
      ...pagamento,
      competencia: pagamento.competencia || pagamento.data_vencimento?.slice(0, 7) || '',
      data_vencimento: pagamento.data_vencimento || '',
      data_pagamento: pagamento.data_pagamento || '',
    });
  }

  async function salvarPagamento() {
    if (!pagamentoForm.evento.trim()) {
      alert('Informe o evento ou marco de pagamento.');
      return;
    }

    setSaving(true);

    const dados = {
      obra_id: obraId,
      contrato_fornecedor_id: pagamentoContratoId,
      evento: pagamentoForm.evento.trim(),
      competencia: nullable(pagamentoForm.competencia),
      valor: num(pagamentoForm.valor),
      data_vencimento: nullable(pagamentoForm.data_vencimento),
      data_pagamento: nullable(pagamentoForm.data_pagamento),
      status: pagamentoForm.status,
      observacoes: nullable(pagamentoForm.observacoes),
    };

    const response = editPagamentoId === 'novo'
      ? await supabase.from('pagamentos_fornecedor').insert([dados]).select().single()
      : await supabase.from('pagamentos_fornecedor').update(dados).eq('id', editPagamentoId).select().single();

    if (response.error) {
      alert(`Erro ao salvar pagamento previsto: ${response.error.message}`);
      setSaving(false);
      return;
    }

    if (editPagamentoId === 'novo') {
      setPagamentos((prev) => [...prev, response.data]);
    } else {
      setPagamentos((prev) => prev.map((item) => item.id === editPagamentoId ? response.data : item));
    }

    setEditPagamentoId(null);
    setPagamentoContratoId(null);
    setPagamentoForm({ ...EMPTY_PAGAMENTO });
    setSaving(false);
  }

  async function removerPagamento(id) {
    if (!confirm('Remover este pagamento previsto?')) return;

    const { error } = await supabase.from('pagamentos_fornecedor').delete().eq('id', id);
    if (error) {
      alert(`Erro ao remover pagamento: ${error.message}`);
      return;
    }

    setPagamentos((prev) => prev.filter((item) => item.id !== id));
  }

  const pagamentosFiltrados = useMemo(() => {
    if (!filtroMes) return pagamentos;
    return pagamentos.filter((item) => {
      const competencia = item.competencia || item.data_vencimento?.slice(0, 7);
      return competencia === filtroMes;
    });
  }, [pagamentos, filtroMes]);

  const totais = useMemo(() => {
    const contratado = contratos.reduce((total, item) => total + num(item.valor_contrato), 0);
    const previsto = pagamentosFiltrados.reduce((total, item) => total + num(item.valor), 0);
    const pago = pagamentosFiltrados
      .filter((item) => item.status === 'Pago')
      .reduce((total, item) => total + num(item.valor), 0);

    return {
      contratado,
      previsto,
      pago,
      pendente: Math.max(previsto - pago, 0),
    };
  }, [contratos, pagamentosFiltrados]);

  if (loading) return <div style={{ padding: 24, color: C.gray }}>Carregando…</div>;

  return (
    <div style={{ padding: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: C.white }}>Fornecedores e pagamentos previstos</div>
          <div style={{ fontSize: 11, color: C.gray, marginTop: 3 }}>
            {obra?.cliente || 'Cliente'} · contratos e marcos previstos, sem duplicar notas fiscais
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <div>
            <label style={s.label}>Mês</label>
            <input type="month" style={s.input} value={filtroMes} onChange={(event) => setFiltroMes(event.target.value)} />
          </div>
          <button onClick={novoContrato} style={{ ...s.btnPrimary, display: 'flex', alignItems: 'center', gap: 6, alignSelf: 'flex-end' }}>
            <Plus size={14} /> Fornecedor
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10, marginBottom: 18 }}>
        {[
          ['Total contratado', totais.contratado, C.white],
          ['Previsto no período', totais.previsto, C.cyan],
          ['Pago', totais.pago, C.green],
          ['Pendente', totais.pendente, C.amber],
        ].map(([label, value, color]) => (
          <div key={label} style={s.card}>
            <div style={{ fontSize: 9, color: C.gray, fontWeight: 700, textTransform: 'uppercase', marginBottom: 6 }}>{label}</div>
            <div style={{ fontSize: 17, color, fontWeight: 700, fontFamily: 'IBM Plex Mono' }}>{fmtBRL(value)}</div>
          </div>
        ))}
      </div>

      {editContratoId && (
        <EditorContrato
          form={contratoForm}
          setForm={setContratoForm}
          saving={saving}
          onSave={salvarContrato}
          onCancel={() => setEditContratoId(null)}
        />
      )}

      {contratos.length === 0 && (
        <div style={{ ...s.card, color: C.gray, textAlign: 'center', padding: 32 }}>
          Nenhum fornecedor cadastrado.
        </div>
      )}

      {contratos.map((contrato) => {
        const itens = pagamentosFiltrados.filter((item) => item.contrato_fornecedor_id === contrato.id);
        const todosItens = pagamentos.filter((item) => item.contrato_fornecedor_id === contrato.id);
        const totalPrevisto = itens.reduce((total, item) => total + num(item.valor), 0);
        const totalPago = itens.filter((item) => item.status === 'Pago').reduce((total, item) => total + num(item.valor), 0);
        const isExpanded = expanded[contrato.id];

        return (
          <div key={contrato.id} style={{ ...s.panel, marginBottom: 12, overflow: 'hidden' }}>
            <div style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <button
                onClick={() => setExpanded((prev) => ({ ...prev, [contrato.id]: !prev[contrato.id] }))}
                style={iconButton()}
              >
                {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
              </button>

              <div style={{ flex: 1, minWidth: 220 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span style={s.badge(C.cyanBg, C.cyan)}>{contrato.tipo}</span>
                  <span style={{ color: C.white, fontWeight: 700 }}>{contrato.fornecedor}</span>
                  {contrato.pc_tibre && <span style={{ color: C.gray, fontSize: 11 }}>PC {contrato.pc_tibre}</span>}
                </div>
                <div style={{ color: C.gray, fontSize: 11, marginTop: 4 }}>
                  Contrato {fmtBRL(contrato.valor_contrato)} · {todosItens.length} marco(s) · previsto {fmtBRL(totalPrevisto)} · pago {fmtBRL(totalPago)}
                </div>
              </div>

              <button onClick={() => editarContrato(contrato)} style={s.btn}>Editar</button>
              <button onClick={() => removerContrato(contrato.id)} style={s.btnRed}>Remover</button>
            </div>

            {isExpanded && (
              <div style={{ padding: 14, background: C.card2, borderTop: `1px solid ${C.border}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center', marginBottom: 10 }}>
                  <div style={{ color: C.gray, fontSize: 11, fontWeight: 700 }}>PAGAMENTOS PREVISTOS</div>
                  <button onClick={() => novoPagamento(contrato.id)} style={{ ...s.btn, display: 'flex', alignItems: 'center', gap: 5 }}>
                    <Plus size={12} /> Adicionar
                  </button>
                </div>

                {editPagamentoId && pagamentoContratoId === contrato.id && (
                  <EditorPagamento
                    form={pagamentoForm}
                    setForm={setPagamentoForm}
                    saving={saving}
                    onSave={salvarPagamento}
                    onCancel={() => {
                      setEditPagamentoId(null);
                      setPagamentoContratoId(null);
                    }}
                  />
                )}

                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 760 }}>
                    <thead>
                      <tr>
                        {['Evento / Marco', 'Competência', 'Vencimento', 'Valor previsto', 'Pagamento', 'Status', ''].map((label) => (
                          <th key={label} style={s.th}>{label}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {itens.map((pagamento, index) => {
                        const status = STATUS_PAG[pagamento.status] || { bg: C.card, fg: C.gray };
                        return (
                          <tr key={pagamento.id} style={{ background: index % 2 === 0 ? C.bg : C.panel, cursor: 'pointer' }} onClick={() => editarPagamento(pagamento)}>
                            <td style={{ ...s.td, fontWeight: 600 }}>{pagamento.evento}</td>
                            <td style={s.td}>{pagamento.competencia || pagamento.data_vencimento?.slice(0, 7) || '—'}</td>
                            <td style={s.td}>{fmtDate(pagamento.data_vencimento)}</td>
                            <td style={moneyCell(C.amber)}>{fmtBRL(pagamento.valor)}</td>
                            <td style={{ ...s.td, color: C.green }}>{fmtDate(pagamento.data_pagamento)}</td>
                            <td style={s.td}><span style={s.badge(status.bg, status.fg)}>{pagamento.status}</span></td>
                            <td style={s.td}>
                              <button
                                onClick={(event) => {
                                  event.stopPropagation();
                                  removerPagamento(pagamento.id);
                                }}
                                style={iconButton()}
                              >
                                <Trash2 size={13} />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                      {itens.length === 0 && (
                        <tr>
                          <td colSpan={7} style={{ ...s.td, textAlign: 'center', color: C.gray, padding: 24 }}>
                            Nenhum pagamento previsto {filtroMes ? 'neste mês' : 'cadastrado'}.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function EditorContrato({ form, setForm, saving, onSave, onCancel }) {
  return (
    <div style={{ ...s.panel, padding: 14, marginBottom: 14, background: C.card2 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
        <div style={{ color: C.white, fontSize: 12, fontWeight: 700 }}>DADOS DO FORNECEDOR</div>
        <button onClick={onCancel} style={iconButton()}><X size={15} /></button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10 }}>
        <Field label="Tipo">
          <select style={s.input} value={form.tipo} onChange={(e) => setForm((p) => ({ ...p, tipo: e.target.value }))}>
            {TIPOS.map((item) => <option key={item}>{item}</option>)}
          </select>
        </Field>
        {[
          ['fornecedor', 'Fornecedor', 'text'],
          ['pc_tibre', 'PC Tibre', 'text'],
          ['valor_contrato', 'Valor contrato', 'number'],
          ['prazo_pagamento_dd', 'Prazo (dias)', 'number'],
          ['email_fornecedor', 'E-mail fornecedor', 'email'],
          ['email_nf_fornecedor', 'E-mail NF', 'email'],
          ['condicoes', 'Condições', 'text'],
          ['observacoes', 'Observações', 'text'],
        ].map(([key, label, type]) => (
          <Field key={key} label={label}>
            <input type={type} style={s.input} value={form[key] || ''} onChange={(e) => setForm((p) => ({ ...p, [key]: type === 'number' ? Number(e.target.value) : e.target.value }))} />
          </Field>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        <button onClick={onSave} disabled={saving} style={{ ...s.btnPrimary, display: 'flex', alignItems: 'center', gap: 6 }}><Save size={13} /> {saving ? 'Salvando…' : 'Salvar'}</button>
        <button onClick={onCancel} style={s.btn}>Cancelar</button>
      </div>
    </div>
  );
}

function EditorPagamento({ form, setForm, saving, onSave, onCancel }) {
  return (
    <div style={{ ...s.panel, padding: 12, marginBottom: 12 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(145px, 1fr))', gap: 9 }}>
        {[
          ['evento', 'Evento / Marco', 'text'],
          ['competencia', 'Competência', 'month'],
          ['valor', 'Valor previsto', 'number'],
          ['data_vencimento', 'Vencimento', 'date'],
          ['data_pagamento', 'Pagamento', 'date'],
          ['observacoes', 'Observações', 'text'],
        ].map(([key, label, type]) => (
          <Field key={key} label={label}>
            <input type={type} style={s.input} value={form[key] || ''} onChange={(e) => setForm((p) => ({ ...p, [key]: type === 'number' ? Number(e.target.value) : e.target.value }))} />
          </Field>
        ))}
        <Field label="Status">
          <select style={s.input} value={form.status} onChange={(e) => setForm((p) => ({ ...p, status: e.target.value }))}>
            {STATUS.map((item) => <option key={item}>{item}</option>)}
          </select>
        </Field>
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
        <button onClick={onSave} disabled={saving} style={{ ...s.btnPrimary, display: 'flex', alignItems: 'center', gap: 6 }}><Save size={13} /> {saving ? 'Salvando…' : 'Salvar'}</button>
        <button onClick={onCancel} style={s.btn}>Cancelar</button>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return <div><label style={s.label}>{label}</label>{children}</div>;
}

function moneyCell(color) {
  return { ...s.td, textAlign: 'right', fontFamily: 'IBM Plex Mono', fontSize: 12, color, fontWeight: 700 };
}

function iconButton() {
  return { background: 'none', border: 'none', color: C.gray, cursor: 'pointer', padding: 4 };
}
