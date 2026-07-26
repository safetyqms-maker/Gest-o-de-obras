import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Save } from 'lucide-react';
import { supabase } from './supabase.js';
import { C, s, STATUS_FAT, fmtBRL, fmtDate } from './theme.js';

const TIPOS_NF = ['Estrutura Metálica','Serviço de Montagem','Locação de Equipamentos','Misto'];
const EVENTOS_PADRAO = [
  { evento:'Adiantamento (20%)',    tipo_nf:'Misto', ordem:0 },
  { evento:'Estrutura (embarque)',  tipo_nf:'Estrutura Metálica', ordem:1 },
  { evento:'Serviço - Integração',  tipo_nf:'Serviço de Montagem', ordem:2 },
  { evento:'Locação - BM Mensal 1', tipo_nf:'Locação de Equipamentos', ordem:3 },
  { evento:'Locação - BM Mensal 2', tipo_nf:'Locação de Equipamentos', ordem:4 },
  { evento:'Serviço - Conclusão',   tipo_nf:'Serviço de Montagem', ordem:5 },
];

export default function FaturamentoTab({ obraId }) {
  const [eventos, setEventos] = useState([]);
  const [contrato, setContrato] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editId, setEditId] = useState(null);
  const [editData, setEditData] = useState({});

  async function load() {
    const [{ data: ev }, { data: ct }] = await Promise.all([
      supabase.from('eventos_faturamento').select('*').eq('obra_id', obraId).order('ordem'),
      supabase.from('contratos_cliente').select('*').eq('obra_id', obraId).single(),
    ]);
    setEventos(ev || []); setContrato(ct); setLoading(false);
  }
  useEffect(() => { load(); }, [obraId]);

  async function addEvento() {
    const ordem = eventos.length;
    const { data } = await supabase.from('eventos_faturamento').insert([{
      obra_id: obraId, evento: `Evento ${ordem+1}`, tipo_nf: 'Estrutura Metálica',
      ordem, valor_bruto: 0, status: 'A emitir',
    }]).select().single();
    if (data) { setEventos(p=>[...p,data]); setEditId(data.id); setEditData(data); }
  }

  async function gerarEventosPadrao() {
    if (!contrato) return;
    const ct = contrato;
    const adiant = (ct.valor_total||0) * (ct.adiantamento_pct||0.20);
    const struct = (ct.valor_total||0) * (ct.divisao_estrutura_pct||0.75);
    const mont   = (ct.valor_total||0) * (ct.divisao_montagem_pct||0.15);
    const loc    = (ct.valor_total||0) * (ct.divisao_locacao_pct||0.10);
    const rows = EVENTOS_PADRAO.map((e,i)=>{
      const bruto = i===0?adiant : i===1?struct : i===5?mont*(1/3) : loc*(1/3);
      const desc  = bruto*(ct.adiantamento_pct||0.20);
      return { obra_id:obraId, evento:e.evento, tipo_nf:e.tipo_nf, ordem:i,
               valor_bruto:Math.round(bruto), desconto_adiantamento:Math.round(desc),
               valor_liquido:Math.round(bruto-desc), status:'A emitir' };
    });
    await supabase.from('eventos_faturamento').delete().eq('obra_id', obraId);
    await supabase.from('eventos_faturamento').insert(rows);
    load();
  }

  function startEdit(ev) { setEditId(ev.id); setEditData({...ev}); }

  async function saveEdit() {
    setSaving(true);
    const bruto = Number(editData.valor_bruto)||0;
    const desc  = contrato ? bruto*(contrato.adiantamento_pct||0.20) : 0;
    const liq   = bruto - desc;
    const toSave = { ...editData, desconto_adiantamento:Math.round(desc), valor_liquido:Math.round(liq) };
    await supabase.from('eventos_faturamento').update(toSave).eq('id', editId);
    setEventos(p=>p.map(e=>e.id===editId?toSave:e));
    setEditId(null); setSaving(false);
  }

  async function deleteEvento(id) {
    if (!confirm('Remover este evento?')) return;
    await supabase.from('eventos_faturamento').delete().eq('id', id);
    setEventos(p=>p.filter(e=>e.id!==id));
  }

  const totalBruto    = eventos.reduce((s,e)=>s+(e.valor_bruto||0),0);
  const totalRecebido = eventos.reduce((s,e)=>s+(e.valor_recebido||0),0);
  const totalPendente = totalBruto - totalRecebido;

  if (loading) return <div style={{padding:24,color:C.gray}}>Carregando…</div>;

  return (
    <div style={{ padding:'20px' }}>
      {/* KPIs */}
      <div style={{ display:'flex',flexWrap:'wrap',gap:12,marginBottom:20 }}>
        {[
          ['Contrato Total', fmtBRL(contrato?.valor_total), C.white],
          ['Total Faturado', fmtBRL(totalBruto), C.cyan],
          ['Recebido', fmtBRL(totalRecebido), C.green],
          ['A Receber', fmtBRL(totalPendente), C.amber],
        ].map(([lbl,val,clr])=>(
          <div key={lbl} style={{ ...s.card, flex:'1 1 140px', minWidth:140 }}>
            <div style={{ fontSize:10,color:C.gray,fontWeight:600,textTransform:'uppercase',marginBottom:6 }}>{lbl}</div>
            <div style={{ fontSize:18,fontWeight:700,color:clr,fontFamily:'IBM Plex Mono' }}>{val}</div>
          </div>
        ))}
      </div>

      {/* Actions */}
      <div style={{ display:'flex',gap:8,marginBottom:16,flexWrap:'wrap' }}>
        <button onClick={addEvento}
          style={{ ...s.btnPrimary, display:'flex',alignItems:'center',gap:6 }}>
          <Plus size={14}/> Adicionar evento
        </button>
        {contrato&&eventos.length===0&&(
          <button onClick={gerarEventosPadrao} style={{ ...s.btnGreen, display:'flex',alignItems:'center',gap:6 }}>
            Gerar eventos padrão do contrato
          </button>
        )}
      </div>

      {/* Tabela */}
      <div style={{ ...s.panel, overflowX:'auto' }}>
        <table style={{ width:'100%', borderCollapse:'collapse', minWidth:800 }}>
          <thead>
            <tr>
              {['Evento','Tipo NF','Valor Bruto','Desc. Adiant.','Valor Líquido',
                'Nº NF','Emissão','Vencimento','Recebimento','Valor Recebido','Status',''].map(h=>(
                <th key={h} style={s.th}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {eventos.map((ev, i) => {
              const st = STATUS_FAT[ev.status]||{bg:C.card2,fg:C.gray};
              const isEdit = editId===ev.id;
              const bg = i%2===0?C.bg:C.card2;
              if (isEdit) return (
                <tr key={ev.id} style={{ background:C.cyanBg }}>
                  <td colSpan={12} style={{ padding:12 }}>
                    <div style={{ display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(160px,1fr))',gap:10 }}>
                      {[
                        ['evento','Evento','text'],
                        ['tipo_nf','Tipo NF','select'],
                        ['valor_bruto','Valor Bruto','number'],
                        ['nf_numero','Nº NF','text'],
                        ['data_emissao','Data Emissão','date'],
                        ['data_envio_portal','Envio Portal','date'],
                        ['data_vencimento','Vencimento','date'],
                        ['data_recebimento','Recebimento','date'],
                        ['valor_recebido','Valor Recebido','number'],
                        ['status','Status','status'],
                        ['observacoes','Obs.','text'],
                      ].map(([field,lbl,type])=>(
                        <div key={field}>
                          <label style={{ ...s.label }}>{lbl}</label>
                          {type==='select'?(
                            <select style={s.input} value={editData[field]||''} onChange={e=>setEditData(p=>({...p,[field]:e.target.value}))}>
                              {TIPOS_NF.map(t=><option key={t}>{t}</option>)}
                            </select>
                          ):type==='status'?(
                            <select style={s.input} value={editData[field]||''} onChange={e=>setEditData(p=>({...p,[field]:e.target.value}))}>
                              {Object.keys(STATUS_FAT).map(k=><option key={k}>{k}</option>)}
                            </select>
                          ):(
                            <input type={type} style={s.input} value={editData[field]||''}
                              onChange={e=>setEditData(p=>({...p,[field]:type==='number'?Number(e.target.value):e.target.value}))} />
                          )}
                        </div>
                      ))}
                    </div>
                    <div style={{ display:'flex',gap:8,marginTop:12 }}>
                      <button onClick={saveEdit} disabled={saving}
                        style={{ ...s.btnPrimary,display:'flex',alignItems:'center',gap:6 }}>
                        <Save size={13}/> {saving?'Salvando…':'Salvar'}
                      </button>
                      <button onClick={()=>setEditId(null)} style={s.btn}>Cancelar</button>
                    </div>
                  </td>
                </tr>
              );
              return (
                <tr key={ev.id} style={{ background:bg, cursor:'pointer' }} onClick={()=>startEdit(ev)}>
                  <td style={{ ...s.td,fontWeight:600,color:C.white }}>{ev.evento}</td>
                  <td style={{ ...s.td,fontSize:11,color:C.gray }}>{ev.tipo_nf||'—'}</td>
                  <td style={{ ...s.td,textAlign:'right',fontFamily:'IBM Plex Mono',fontSize:12 }}>{fmtBRL(ev.valor_bruto)}</td>
                  <td style={{ ...s.td,textAlign:'right',fontFamily:'IBM Plex Mono',fontSize:12,color:C.amber }}>{fmtBRL(ev.desconto_adiantamento)}</td>
                  <td style={{ ...s.td,textAlign:'right',fontFamily:'IBM Plex Mono',fontSize:12,color:C.green,fontWeight:700 }}>{fmtBRL(ev.valor_liquido)}</td>
                  <td style={{ ...s.td,fontSize:12,fontFamily:'IBM Plex Mono',color:C.cyan }}>{ev.nf_numero||'—'}</td>
                  <td style={{ ...s.td,fontSize:11 }}>{fmtDate(ev.data_emissao)}</td>
                  <td style={{ ...s.td,fontSize:11,color:ev.data_vencimento&&!ev.data_recebimento&&ev.data_vencimento<new Date().toISOString().slice(0,10)?C.red:C.light }}>
                    {fmtDate(ev.data_vencimento)}
                  </td>
                  <td style={{ ...s.td,fontSize:11,color:C.green }}>{fmtDate(ev.data_recebimento)}</td>
                  <td style={{ ...s.td,textAlign:'right',fontFamily:'IBM Plex Mono',fontSize:12,color:C.green }}>{fmtBRL(ev.valor_recebido)}</td>
                  <td style={s.td}><span style={s.badge(st.bg,st.fg)}>{ev.status}</span></td>
                  <td style={s.td}>
                    <button onClick={e=>{e.stopPropagation();deleteEvento(ev.id);}}
                      style={{ background:'none',border:'none',color:C.gray,cursor:'pointer',padding:4 }}>
                      <Trash2 size={13}/>
                    </button>
                  </td>
                </tr>
              );
            })}
            {eventos.length===0&&(
              <tr><td colSpan={12} style={{ ...s.td,textAlign:'center',color:C.gray,padding:32 }}>
                Nenhum evento de faturamento. Clique em "Adicionar evento" ou gere automaticamente a partir do contrato.
              </td></tr>
            )}
          </tbody>
          {eventos.length>0&&(
            <tfoot>
              <tr style={{ background:C.card }}>
                <td style={{ ...s.td,fontWeight:700,color:C.white }}>TOTAL</td>
                <td colSpan={1} />
                <td style={{ ...s.td,textAlign:'right',fontFamily:'IBM Plex Mono',fontWeight:700,color:C.white }}>{fmtBRL(totalBruto)}</td>
                <td colSpan={1} />
                <td style={{ ...s.td,textAlign:'right',fontFamily:'IBM Plex Mono',fontWeight:700,color:C.green }}>{fmtBRL(totalRecebido)}</td>
                <td colSpan={7} />
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
