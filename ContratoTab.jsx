import React, { useState, useEffect } from 'react';
import { Save } from 'lucide-react';
import { supabase } from './supabase.js';
import { C, s, fmtBRL } from './theme.js';

export default function ContratoTab({ obraId }) {
  const [form, setForm]     = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [saved, setSaved]     = useState(false);

  useEffect(() => {
    supabase.from('contratos_cliente').select('*').eq('obra_id', obraId).single()
      .then(({ data }) => {
        setForm(data || {
          obra_id: obraId, pv_tibre:'', oc_cliente:'', valor_total:0,
          adiantamento_pct:0.20, valor_adiantamento:0,
          prazo_pagamento_dd:30, email_nf:'', portal_nf:'',
          cnpj_cliente:'', condicoes_pagamento:'30 dias',
          divisao_estrutura_pct:0.75, divisao_montagem_pct:0.15, divisao_locacao_pct:0.10,
          observacoes:'',
        });
        setLoading(false);
      });
  }, [obraId]);

  function upd(field, value) {
    setForm(p => {
      const next = {...p, [field]:value};
      if (['valor_total','adiantamento_pct'].includes(field)) {
        next.valor_adiantamento = Math.round((Number(next.valor_total)||0)*(Number(next.adiantamento_pct)||0));
      }
      return next;
    });
  }

  async function handleSave() {
    setSaving(true);
    const { id, ...rest } = form;
    if (id) { await supabase.from('contratos_cliente').update(rest).eq('id', id); }
    else     { await supabase.from('contratos_cliente').insert([{...rest,obra_id:obraId}]); }
    setSaving(false); setSaved(true); setTimeout(()=>setSaved(false),2000);
  }

  if (loading||!form) return <div style={{padding:24,color:C.gray}}>Carregando…</div>;

  const fields = [
    { group:'PEDIDO DE VENDA', items:[
      ['pv_tibre','PV Tibre','text','24103'],
      ['oc_cliente','OC do Cliente','text','514062'],
      ['cnpj_cliente','CNPJ Cliente','text','07.903.169/0001-68'],
    ]},
    { group:'VALORES', items:[
      ['valor_total','Valor Total do Contrato','number','1190000'],
      ['adiantamento_pct','Adiantamento %','percent','0.20'],
      ['valor_adiantamento','Valor Adiantamento (auto)','readonly',''],
      ['prazo_pagamento_dd','Prazo de Pagamento (dias)','number','30'],
    ]},
    { group:'DIVISÃO DE FATURAMENTO', items:[
      ['divisao_estrutura_pct','Estrutura Metálica %','percent','0.75'],
      ['divisao_montagem_pct','Serviço de Montagem %','percent','0.15'],
      ['divisao_locacao_pct','Locação de Equipamentos %','percent','0.10'],
    ]},
    { group:'CONTATOS E PORTAIS', items:[
      ['email_nf','E-mail para envio de NF','text','nfe_ang@adecoagro.com'],
      ['portal_nf','Portal do Cliente','text','fornecedor.adecoagro.com'],
    ]},
    { group:'CONDIÇÕES', items:[
      ['condicoes_pagamento','Condições de Pagamento','text','20% adiantamento, 80% 30 dias após embarque'],
      ['observacoes','Observações','textarea',''],
    ]},
  ];

  return (
    <div style={{ padding:'20px', maxWidth:760 }}>
      <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:20 }}>
        <div>
          <h2 style={{ fontSize:16,fontWeight:700,color:C.white }}>Dados do Contrato</h2>
          <p style={{ fontSize:12,color:C.gray,marginTop:3 }}>Preenchidos uma vez — base imutável para todos os cálculos.</p>
        </div>
        <button onClick={handleSave} disabled={saving}
          style={{ ...s.btnPrimary,display:'flex',alignItems:'center',gap:6 }}>
          <Save size={14}/> {saving?'Salvando…':saved?'Salvo ✓':'Salvar'}
        </button>
      </div>

      {/* Resumo financeiro */}
      {form.valor_total>0&&(
        <div style={{ display:'flex',flexWrap:'wrap',gap:12,marginBottom:24 }}>
          {[
            ['Estrutura',fmtBRL((form.valor_total||0)*(form.divisao_estrutura_pct||0.75)),C.cyan],
            ['Montagem', fmtBRL((form.valor_total||0)*(form.divisao_montagem_pct||0.15)),C.green],
            ['Locação',  fmtBRL((form.valor_total||0)*(form.divisao_locacao_pct||0.10)),C.amber],
            ['Adiantamento',fmtBRL(form.valor_adiantamento||0),C.pink],
          ].map(([lbl,val,clr])=>(
            <div key={lbl} style={{ ...s.card,flex:'1 1 120px',minWidth:120 }}>
              <div style={{ fontSize:10,color:C.gray,fontWeight:600,textTransform:'uppercase',marginBottom:4 }}>{lbl}</div>
              <div style={{ fontSize:15,fontWeight:700,color:clr,fontFamily:'IBM Plex Mono' }}>{val}</div>
            </div>
          ))}
        </div>
      )}

      {fields.map(({ group, items }) => (
        <div key={group} style={{ marginBottom:24 }}>
          <div style={{ fontSize:11,fontWeight:700,color:C.cyan,textTransform:'uppercase',
                         letterSpacing:'0.08em',marginBottom:12,paddingBottom:6,
                         borderBottom:`1px solid ${C.card}` }}>
            {group}
          </div>
          <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:12 }}>
            {items.map(([field,label,type,ph])=>(
              <div key={field} style={{ gridColumn:type==='textarea'?'span 2':undefined }}>
                <label style={s.label}>{label}</label>
                {type==='textarea'?(
                  <textarea style={{ ...s.input,minHeight:64,resize:'vertical' }}
                    value={form[field]||''} placeholder={ph}
                    onChange={e=>upd(field,e.target.value)} />
                ):type==='readonly'?(
                  <div style={{ ...s.input,opacity:0.6,fontFamily:'IBM Plex Mono',fontWeight:700,color:C.green }}>
                    {fmtBRL(form[field])}
                  </div>
                ):(
                  <input type={type==='percent'?'number':'text'}
                    step={type==='percent'?'0.01':undefined}
                    min={type==='percent'?0:undefined} max={type==='percent'?1:undefined}
                    style={s.input} value={form[field]||''} placeholder={ph}
                    onChange={e=>upd(field,type==='number'||type==='percent'?Number(e.target.value):e.target.value)} />
                )}
                {type==='percent'&&<span style={{ fontSize:10,color:C.gray,marginTop:2,display:'block' }}>
                  = {fmtBRL((form.valor_total||0)*(form[field]||0))}
                </span>}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
