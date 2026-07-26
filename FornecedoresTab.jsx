import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Save, ChevronDown, ChevronRight } from 'lucide-react';
import { supabase } from './supabase.js';
import { C, s, STATUS_PAG, fmtBRL, fmtDate } from './theme.js';

const TIPOS = ['Montadora','Supervisor','Seguro','Outro'];

export default function FornecedoresTab({ obraId }) {
  const [contratos, setContratos] = useState([]);
  const [pagamentos, setPagamentos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState({});
  const [editCtId, setEditCtId] = useState(null);
  const [editCtData, setEditCtData] = useState({});
  const [addPag, setAddPag] = useState(null);
  const [newPag, setNewPag] = useState({ evento:'', valor:0, data_vencimento:'', status:'Pendente' });

  async function load() {
    const [{ data: ct }, { data: pg }] = await Promise.all([
      supabase.from('contratos_fornecedor').select('*').eq('obra_id', obraId).order('created_at'),
      supabase.from('pagamentos_fornecedor').select('*').eq('obra_id', obraId).order('data_vencimento'),
    ]);
    setContratos(ct||[]); setPagamentos(pg||[]); setLoading(false);
  }
  useEffect(() => { load(); }, [obraId]);

  async function addContrato() {
    const { data } = await supabase.from('contratos_fornecedor').insert([{
      obra_id: obraId, tipo:'Montadora', fornecedor:'', pc_tibre:'', valor_contrato:0, prazo_pagamento_dd:15,
    }]).select().single();
    if (data) { setContratos(p=>[...p,data]); setEditCtId(data.id); setEditCtData(data); }
  }

  async function saveContrato() {
    const {id,...rest}=editCtData;
    await supabase.from('contratos_fornecedor').update(rest).eq('id',id);
    setContratos(p=>p.map(c=>c.id===id?editCtData:c));
    setEditCtId(null);
  }

  async function deleteContrato(id) {
    if (!confirm('Remover este fornecedor e seus pagamentos?')) return;
    await supabase.from('contratos_fornecedor').delete().eq('id',id);
    setContratos(p=>p.filter(c=>c.id!==id));
    setPagamentos(p=>p.filter(pg=>pg.contrato_fornecedor_id!==id));
  }

  async function addPagamento(contratoId) {
    const { data } = await supabase.from('pagamentos_fornecedor').insert([{
      obra_id: obraId, contrato_fornecedor_id: contratoId,
      evento: newPag.evento, valor: Number(newPag.valor)||0,
      data_vencimento: newPag.data_vencimento||null, status: newPag.status,
    }]).select().single();
    if (data) { setPagamentos(p=>[...p,data]); setAddPag(null); setNewPag({evento:'',valor:0,data_vencimento:'',status:'Pendente'}); }
  }

  async function toggleStatus(pg) {
    const next = pg.status==='Pendente'?'Pago':pg.status==='Pago'?'Atrasado':'Pendente';
    await supabase.from('pagamentos_fornecedor').update({ status:next, data_pagamento:next==='Pago'?new Date().toISOString().slice(0,10):null }).eq('id',pg.id);
    setPagamentos(p=>p.map(x=>x.id===pg.id?{...x,status:next,data_pagamento:next==='Pago'?new Date().toISOString().slice(0,10):null}:x));
  }

  const totalContratos = contratos.reduce((s,c)=>s+(c.valor_contrato||0),0);
  const totalPago      = pagamentos.filter(p=>p.status==='Pago').reduce((s,p)=>s+(p.valor||0),0);
  const totalPendente  = pagamentos.filter(p=>p.status!=='Pago').reduce((s,p)=>s+(p.valor||0),0);

  if (loading) return <div style={{padding:24,color:C.gray}}>Carregando…</div>;

  return (
    <div style={{ padding:'20px' }}>
      {/* KPIs */}
      <div style={{ display:'flex',flexWrap:'wrap',gap:12,marginBottom:20 }}>
        {[
          ['Total Contratado',fmtBRL(totalContratos),C.white],
          ['Pago Fornecedores',fmtBRL(totalPago),C.green],
          ['Pendente',fmtBRL(totalPendente),C.amber],
        ].map(([lbl,val,clr])=>(
          <div key={lbl} style={{ ...s.card,flex:'1 1 140px',minWidth:140 }}>
            <div style={{ fontSize:10,color:C.gray,fontWeight:600,textTransform:'uppercase',marginBottom:6 }}>{lbl}</div>
            <div style={{ fontSize:18,fontWeight:700,color:clr,fontFamily:'IBM Plex Mono' }}>{val}</div>
          </div>
        ))}
      </div>

      <button onClick={addContrato}
        style={{ ...s.btnPrimary,display:'flex',alignItems:'center',gap:6,marginBottom:16 }}>
        <Plus size={14}/> Adicionar Fornecedor
      </button>

      {contratos.length===0&&(
        <div style={{ ...s.card,textAlign:'center',color:C.gray,padding:32 }}>
          Nenhum fornecedor cadastrado. Adicione montadora, supervisor e seguro.
        </div>
      )}

      {contratos.map(ct=>{
        const pags = pagamentos.filter(p=>p.contrato_fornecedor_id===ct.id);
        const isExp = expanded[ct.id];
        const isEdit = editCtId===ct.id;
        const totalCtPago = pags.filter(p=>p.status==='Pago').reduce((s,p)=>s+(p.valor||0),0);

        return (
          <div key={ct.id} style={{ ...s.panel,marginBottom:12,overflow:'hidden' }}>
            {/* Header fornecedor */}
            <div style={{ padding:'12px 16px',borderBottom:isExp?`1px solid ${C.card}`:'none',
                           display:'flex',alignItems:'center',gap:12,flexWrap:'wrap' }}>
              <button onClick={()=>setExpanded(p=>({...p,[ct.id]:!p[ct.id]}))}
                style={{ background:'none',border:'none',cursor:'pointer',color:C.gray,padding:2 }}>
                {isExp?<ChevronDown size={16}/>:<ChevronRight size={16}/>}
              </button>
              <div style={{ flex:1,minWidth:0 }}>
                <div style={{ display:'flex',alignItems:'center',gap:8,flexWrap:'wrap' }}>
                  <span style={{ fontSize:11,fontWeight:700,color:C.cyan,
                    background:C.cyanBg,padding:'2px 8px',borderRadius:4 }}>{ct.tipo}</span>
                  <span style={{ fontSize:14,fontWeight:700,color:C.white }}>{ct.fornecedor||'—'}</span>
                  {ct.pc_tibre&&<span style={{ fontSize:11,color:C.gray,fontFamily:'IBM Plex Mono' }}>PC {ct.pc_tibre}</span>}
                </div>
                <div style={{ fontSize:12,color:C.gray,marginTop:2 }}>
                  Contrato: {fmtBRL(ct.valor_contrato)} · Pagto: {ct.prazo_pagamento_dd}d · Pago: {fmtBRL(totalCtPago)}
                </div>
              </div>
              <div style={{ display:'flex',gap:6 }}>
                <button onClick={()=>{setEditCtId(ct.id);setEditCtData(ct);}}
                  style={s.btn}>Editar</button>
                <button onClick={()=>deleteContrato(ct.id)}
                  style={s.btnRed}>Remover</button>
              </div>
            </div>

            {/* Form edição contrato */}
            {isEdit&&(
              <div style={{ padding:16,borderBottom:`1px solid ${C.card}`,background:C.card2 }}>
                <div style={{ display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(160px,1fr))',gap:10 }}>
                  {[
                    ['tipo','Tipo','select'],['fornecedor','Fornecedor','text'],
                    ['pc_tibre','PC Tibre','text'],['valor_contrato','Valor Contrato','number'],
                    ['prazo_pagamento_dd','Prazo Pagto (dias)','number'],['email_nf','E-mail NF','text'],
                  ].map(([field,lbl,type])=>(
                    <div key={field}>
                      <label style={s.label}>{lbl}</label>
                      {type==='select'?(
                        <select style={s.input} value={editCtData[field]||''} onChange={e=>setEditCtData(p=>({...p,[field]:e.target.value}))}>
                          {TIPOS.map(t=><option key={t}>{t}</option>)}
                        </select>
                      ):(
                        <input type={type==='number'?'number':'text'} style={s.input}
                          value={editCtData[field]||''}
                          onChange={e=>setEditCtData(p=>({...p,[field]:type==='number'?Number(e.target.value):e.target.value}))} />
                      )}
                    </div>
                  ))}
                </div>
                <div style={{ display:'flex',gap:8,marginTop:10 }}>
                  <button onClick={saveContrato} style={{ ...s.btnPrimary,display:'flex',alignItems:'center',gap:6 }}>
                    <Save size={13}/> Salvar
                  </button>
                  <button onClick={()=>setEditCtId(null)} style={s.btn}>Cancelar</button>
                </div>
              </div>
            )}

            {/* Pagamentos */}
            {isExp&&(
              <div style={{ padding:16 }}>
                <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:10 }}>
                  <span style={{ fontSize:12,fontWeight:700,color:C.gray }}>PAGAMENTOS</span>
                  <button onClick={()=>setAddPag(ct.id)}
                    style={{ ...s.btn,display:'flex',alignItems:'center',gap:4,fontSize:12,padding:'4px 10px' }}>
                    <Plus size={12}/> Adicionar
                  </button>
                </div>

                {addPag===ct.id&&(
                  <div style={{ background:C.card2,borderRadius:8,padding:12,marginBottom:12 }}>
                    <div style={{ display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(140px,1fr))',gap:8,marginBottom:10 }}>
                      {[
                        ['evento','Evento','text'],['valor','Valor','number'],
                        ['data_vencimento','Vencimento','date'],['status','Status','select'],
                      ].map(([field,lbl,type])=>(
                        <div key={field}>
                          <label style={s.label}>{lbl}</label>
                          {type==='select'?(
                            <select style={s.input} value={newPag[field]||''} onChange={e=>setNewPag(p=>({...p,[field]:e.target.value}))}>
                              {Object.keys(STATUS_PAG).map(k=><option key={k}>{k}</option>)}
                            </select>
                          ):(
                            <input type={type} style={s.input} value={newPag[field]||''}
                              onChange={e=>setNewPag(p=>({...p,[field]:type==='number'?Number(e.target.value):e.target.value}))} />
                          )}
                        </div>
                      ))}
                    </div>
                    <div style={{ display:'flex',gap:6 }}>
                      <button onClick={()=>addPagamento(ct.id)} style={s.btnPrimary}>Salvar</button>
                      <button onClick={()=>setAddPag(null)} style={s.btn}>Cancelar</button>
                    </div>
                  </div>
                )}

                {pags.length===0&&!addPag&&(
                  <p style={{ fontSize:12,color:C.gray }}>Nenhum pagamento registrado.</p>
                )}
                <div style={{ display:'flex',flexDirection:'column',gap:6 }}>
                  {pags.map(pg=>{
                    const st=STATUS_PAG[pg.status]||{bg:C.card2,fg:C.gray};
                    const vencido=pg.data_vencimento&&pg.status!=='Pago'&&pg.data_vencimento<new Date().toISOString().slice(0,10);
                    return (
                      <div key={pg.id} style={{ display:'flex',alignItems:'center',gap:12,
                                                  padding:'8px 10px',background:C.bg,borderRadius:6,flexWrap:'wrap' }}>
                        <div style={{ flex:1,minWidth:0 }}>
                          <div style={{ fontSize:13,fontWeight:600,color:C.white }}>{pg.evento||'—'}</div>
                          <div style={{ fontSize:11,color:C.gray }}>
                            Venc: <span style={{ color:vencido?C.red:C.light }}>{fmtDate(pg.data_vencimento)}</span>
                            {pg.data_pagamento&&<span style={{ color:C.green }}> · Pago: {fmtDate(pg.data_pagamento)}</span>}
                          </div>
                        </div>
                        <div style={{ fontFamily:'IBM Plex Mono',fontSize:13,fontWeight:700,
                          color:pg.status==='Pago'?C.green:C.amber }}>{fmtBRL(pg.valor)}</div>
                        <button onClick={()=>toggleStatus(pg)} style={{ ...s.badge(st.bg,st.fg),cursor:'pointer',border:'none' }}>
                          {pg.status}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
