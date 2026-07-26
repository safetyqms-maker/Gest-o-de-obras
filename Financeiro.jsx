import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { C, s, STATUS_FAT, fmtBRL, fmtDate } from './theme.js';
import { supabase } from './supabase.js';
import { AlertTriangle, ArrowRight } from 'lucide-react';

export default function Financeiro() {
  const [obras, setObras]     = useState([]);
  const [contratos, setContratos] = useState([]);
  const [eventos, setEventos] = useState([]);
  const [pagamentos, setPagamentos] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [{ data: ob }, { data: ct }, { data: ev }, { data: pg }] = await Promise.all([
        supabase.from('obras').select('*').order('created_at', { ascending: false }),
        supabase.from('contratos_cliente').select('*'),
        supabase.from('eventos_faturamento').select('*').order('obra_id,ordem'),
        supabase.from('pagamentos_fornecedor').select('*'),
      ]);
      setObras(ob||[]); setContratos(ct||[]); setEventos(ev||[]); setPagamentos(pg||[]);
      setLoading(false);
    }
    load();
  }, []);

  const totalContrato  = contratos.reduce((s,c)=>s+(c.valor_total||0),0);
  const totalFaturado  = eventos.reduce((s,e)=>s+(e.valor_bruto||0),0);
  const totalRecebido  = eventos.reduce((s,e)=>s+(e.valor_recebido||0),0);
  const totalPagoForn  = pagamentos.filter(p=>p.status==='Pago').reduce((s,p)=>s+(p.valor||0),0);
  const totalPendForn  = pagamentos.filter(p=>p.status!=='Pago').reduce((s,p)=>s+(p.valor||0),0);

  const vencidos = eventos.filter(e => {
    if (e.status==='Recebido') return false;
    if (!e.data_vencimento) return false;
    return e.data_vencimento < new Date().toISOString().slice(0,10);
  });

  if (loading) return <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'50vh',color:C.gray}}>Carregando…</div>;

  return (
    <div style={{ padding:'24px 20px', maxWidth:1100, margin:'0 auto' }}>
      <div style={{ marginBottom:24 }}>
        <h1 style={{ fontSize:20,fontWeight:700,color:C.white }}>Financeiro Consolidado</h1>
        <p style={{ fontSize:13,color:C.gray,marginTop:4 }}>Visão geral de todas as obras</p>
      </div>

      {/* KPIs */}
      <div style={{ display:'flex',flexWrap:'wrap',gap:12,marginBottom:28 }}>
        {[
          ['Contratos Total',fmtBRL(totalContrato),C.white,''],
          ['Faturado Tibre',fmtBRL(totalFaturado),C.cyan,C.cyanBg],
          ['Recebido Tibre',fmtBRL(totalRecebido),C.green,C.greenBg],
          ['Pago Fornecedores',fmtBRL(totalPagoForn),C.pink,'#3D0A2A'],
          ['A Pagar Fornec.',fmtBRL(totalPendForn),C.amber,C.amberBg],
          ['Saldo Caixa',fmtBRL(totalRecebido-totalPagoForn),totalRecebido>totalPagoForn?C.green:C.red,
            totalRecebido>totalPagoForn?C.greenBg:C.redBg],
        ].map(([lbl,val,clr,bg])=>(
          <div key={lbl} style={{ ...s.card,background:bg||C.card,flex:'1 1 150px',minWidth:150 }}>
            <div style={{ fontSize:10,color:C.gray,fontWeight:600,textTransform:'uppercase',marginBottom:6,letterSpacing:'0.05em' }}>{lbl}</div>
            <div style={{ fontSize:18,fontWeight:700,color:clr,fontFamily:'IBM Plex Mono' }}>{val}</div>
          </div>
        ))}
      </div>

      {/* Alertas vencidos */}
      {vencidos.length>0&&(
        <div style={{ background:C.redBg,border:`1px solid ${C.red}`,borderRadius:8,padding:'12px 16px',marginBottom:24 }}>
          <div style={{ fontSize:12,fontWeight:700,color:C.red,marginBottom:8,display:'flex',alignItems:'center',gap:6 }}>
            <AlertTriangle size={14}/> {vencidos.length} EVENTO(S) VENCIDO(S) SEM RECEBIMENTO
          </div>
          {vencidos.map(e=>{
            const ob=obras.find(o=>o.id===e.obra_id);
            return (
              <div key={e.id} style={{ fontSize:12,color:C.light,marginBottom:4,display:'flex',gap:8,alignItems:'center',flexWrap:'wrap' }}>
                <span style={{ color:C.cyan,fontWeight:600 }}>{ob?.nome||'—'}</span>
                <span>·</span>
                <span>{e.evento}</span>
                <span>·</span>
                <span style={{ color:C.red }}>Venceu {fmtDate(e.data_vencimento)}</span>
                <span>·</span>
                <span style={{ fontFamily:'IBM Plex Mono',color:C.amber }}>{fmtBRL(e.valor_liquido)}</span>
                {ob&&<Link to={`/obras/${ob.id}`} style={{ color:C.cyan,textDecoration:'none',fontSize:11 }}>Ver obra →</Link>}
              </div>
            );
          })}
        </div>
      )}

      {/* Tabela por obra */}
      <div style={{ ...s.panel,overflow:'hidden' }}>
        <div style={{ padding:'12px 16px',borderBottom:`1px solid ${C.border}` }}>
          <span style={{ fontSize:13,fontWeight:700,color:C.white }}>Situação Financeira por Obra</span>
        </div>
        <div style={{ overflowX:'auto' }}>
          <table style={{ width:'100%',borderCollapse:'collapse',minWidth:800 }}>
            <thead>
              <tr>
                {['Obra','PV','Contrato','Faturado','Recebido','A Receber','Pago Fornec.','Saving','Próx. Evento',''].map(h=>(
                  <th key={h} style={s.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {obras.map((o,i)=>{
                const ct = contratos.find(c=>c.obra_id===o.id);
                const evObra = eventos.filter(e=>e.obra_id===o.id);
                const pgObra = pagamentos.filter(p=>p.obra_id===o.id&&p.status==='Pago');
                const faturado  = evObra.reduce((s,e)=>s+(e.valor_bruto||0),0);
                const recebido  = evObra.reduce((s,e)=>s+(e.valor_recebido||0),0);
                const pagoForn  = pgObra.reduce((s,p)=>s+(p.valor||0),0);
                const contrato  = ct?.valor_total||0;
                const saving    = contrato-pagoForn;
                const proxEv    = evObra.find(e=>e.status==='A emitir'||e.status==='Emitido');
                const bg = i%2===0?C.bg:C.card2;
                return (
                  <tr key={o.id} style={{ background:bg }}>
                    <td style={{ ...s.td,fontWeight:600 }}>
                      <Link to={`/obras/${o.id}`} style={{ color:C.cyan,textDecoration:'none' }}>{o.nome}</Link>
                    </td>
                    <td style={{ ...s.td,fontSize:11,color:C.gray,fontFamily:'IBM Plex Mono' }}>{o.tag||'—'}</td>
                    <td style={{ ...s.td,textAlign:'right',fontFamily:'IBM Plex Mono',fontSize:12 }}>{fmtBRL(contrato)}</td>
                    <td style={{ ...s.td,textAlign:'right',fontFamily:'IBM Plex Mono',fontSize:12,color:C.cyan }}>{fmtBRL(faturado)}</td>
                    <td style={{ ...s.td,textAlign:'right',fontFamily:'IBM Plex Mono',fontSize:12,color:C.green,fontWeight:700 }}>{fmtBRL(recebido)}</td>
                    <td style={{ ...s.td,textAlign:'right',fontFamily:'IBM Plex Mono',fontSize:12,color:C.amber }}>{fmtBRL(contrato-recebido)}</td>
                    <td style={{ ...s.td,textAlign:'right',fontFamily:'IBM Plex Mono',fontSize:12,color:C.pink }}>{fmtBRL(pagoForn)}</td>
                    <td style={{ ...s.td,textAlign:'right',fontFamily:'IBM Plex Mono',fontSize:12,color:saving>0?C.green:C.red,fontWeight:700 }}>
                      {fmtBRL(saving)}
                    </td>
                    <td style={{ ...s.td,fontSize:11,color:C.amber }}>{proxEv?.evento||'—'}</td>
                    <td style={s.td}>
                      <Link to={`/obras/${o.id}`} style={{ color:C.gray,display:'flex',alignItems:'center' }}>
                        <ArrowRight size={13}/>
                      </Link>
                    </td>
                  </tr>
                );
              })}
              {obras.length===0&&(
                <tr><td colSpan={10} style={{ ...s.td,textAlign:'center',color:C.gray,padding:32 }}>
                  Nenhuma obra. <Link to="/obras" style={{ color:C.cyan }}>Cadastrar →</Link>
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
