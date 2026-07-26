import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { TrendingUp, Clock, AlertTriangle, CheckCircle, DollarSign, ArrowRight, ArrowUp, ArrowDown } from 'lucide-react';
import { supabase } from './supabase.js';
import { C, STATUS_OBRA, s, fmtBRL, fmtDate } from './theme.js';

function KPI({ label, value, color, bg, sub, icon: Icon }) {
  return (
    <div style={{ ...s.card, flex: '1 1 130px', minWidth: 130 }}>
      <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:6 }}>
        {Icon && <div style={{ background: bg||C.card2, borderRadius:6, padding:6 }}><Icon size={13} color={color||C.cyan}/></div>}
        <span style={{ fontSize:10, color:C.gray, fontWeight:600, textTransform:'uppercase', letterSpacing:'.05em' }}>{label}</span>
      </div>
      <div style={{ fontSize:17, fontWeight:700, color:color||C.white, fontFamily:'IBM Plex Mono' }}>{value}</div>
      {sub && <div style={{ fontSize:10, color:C.gray, marginTop:3 }}>{sub}</div>}
    </div>
  );
}

function MesCard({ label, value, color, bg, icon: Icon, delta }) {
  return (
    <div style={{ flex:'1 1 150px', minWidth:150, background: bg||C.card, border:`1px solid ${C.border}`,
                  borderRadius:8, padding:'12px 14px' }}>
      <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:6 }}>
        {Icon && <Icon size={13} color={color}/>}
        <span style={{ fontSize:10, color:C.gray, fontWeight:600, textTransform:'uppercase', letterSpacing:'.05em' }}>{label}</span>
      </div>
      <div style={{ fontSize:18, fontWeight:700, color, fontFamily:'IBM Plex Mono' }}>{value}</div>
      {delta !== undefined && (
        <div style={{ fontSize:10, color: delta >= 0 ? C.green : C.red, marginTop:3, display:'flex', alignItems:'center', gap:3 }}>
          {delta >= 0 ? <ArrowUp size={10}/> : <ArrowDown size={10}/>}
          {fmtBRL(Math.abs(delta))} vs mês anterior
        </div>
      )}
    </div>
  );
}

export default function Dashboard() {
  const [obras, setObras]       = useState([]);
  const [contratos, setContratos] = useState([]);
  const [eventos, setEventos]   = useState([]);
  const [pagamentos, setPagamentos] = useState([]);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    async function load() {
      const [{ data: ob }, { data: ct }, { data: ev }, { data: pg }] = await Promise.all([
        supabase.from('obras').select('*').order('created_at', { ascending: false }),
        supabase.from('contratos_cliente').select('*'),
        supabase.from('eventos_faturamento').select('*'),
        supabase.from('pagamentos_fornecedor').select('*'),
      ]);
      setObras(ob||[]); setContratos(ct||[]); setEventos(ev||[]); setPagamentos(pg||[]);
      setLoading(false);
    }
    load();
  }, []);

  // KPIs gerais
  const totalContrato  = contratos.reduce((s,c)=>s+(Number(c.valor_total)||0),0);
  const totalAdiant    = contratos.reduce((s,c)=>s+(Number(c.valor_adiantamento)||0),0);
  const totalFaturado  = eventos.reduce((s,e)=>s+(Number(e.valor_bruto)||0),0);
  const totalRecebido  = eventos.reduce((s,e)=>s+(Number(e.valor_recebido)||0),0);
  const totalPagoForn  = pagamentos.filter(p=>p.status==='Pago').reduce((s,p)=>s+(Number(p.valor)||0),0);
  const emAndamento    = obras.filter(o=>['Em andamento','No prazo','Atrasada'].includes(o.status)).length;
  const atrasadas      = obras.filter(o=>o.status==='Atrasada').length;
  const saving         = totalRecebido - totalPagoForn;

  // Fluxo do mês atual
  const now      = new Date();
  const mesAtual = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
  const mesAnt   = now.getMonth()===0
    ? `${now.getFullYear()-1}-12`
    : `${now.getFullYear()}-${String(now.getMonth()).padStart(2,'0')}`;

  const entradaMes  = eventos.filter(e=>e.data_recebimento?.startsWith(mesAtual)).reduce((s,e)=>s+(Number(e.valor_recebido)||0),0);
  const saidaMes    = pagamentos.filter(p=>p.status==='Pago'&&p.data_pagamento?.startsWith(mesAtual)).reduce((s,p)=>s+(Number(p.valor)||0),0);
  const entradaAnt  = eventos.filter(e=>e.data_recebimento?.startsWith(mesAnt)).reduce((s,e)=>s+(Number(e.valor_recebido)||0),0);
  const saidaAnt    = pagamentos.filter(p=>p.status==='Pago'&&p.data_pagamento?.startsWith(mesAnt)).reduce((s,p)=>s+(Number(p.valor)||0),0);
  const saldoMes    = entradaMes - saidaMes;

  const mesNome = now.toLocaleDateString('pt-BR',{month:'long',year:'numeric'});

  // Alertas BMs vencidos
  const hoje = new Date().toISOString().slice(0,10);
  const vencidos = eventos.filter(e=>e.status!=='Recebido'&&e.data_vencimento&&e.data_vencimento<hoje);

  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'60vh', color:C.gray }}>
      Carregando…
    </div>
  );

  return (
    <div style={{ padding:'20px', maxWidth:1100, margin:'0 auto' }}>

      {/* Título */}
      <div style={{ marginBottom:20 }}>
        <h1 style={{ fontSize:18, fontWeight:700, color:C.white }}>Painel Executivo</h1>
        <p style={{ fontSize:12, color:C.gray, marginTop:3 }}>
          Tibre Engenharia · {obras.length} obra(s) · Atualizado agora
        </p>
      </div>

      {/* KPIs principais */}
      <div style={{ display:'flex', flexWrap:'wrap', gap:10, marginBottom:20 }}>
        <KPI label="Contrato Total"    value={fmtBRL(totalContrato)}  color={C.white}  icon={DollarSign} />
        <KPI label="Adiant. Recebido"  value={fmtBRL(totalAdiant)}    color={C.green}  icon={TrendingUp}  bg={C.greenBg} />
        <KPI label="Faturado Tibre"    value={fmtBRL(totalFaturado)}  color={C.cyan}   icon={DollarSign}  bg={C.cyanBg} />
        <KPI label="Recebido Total"    value={fmtBRL(totalRecebido)}  color={C.green}  icon={CheckCircle} bg={C.greenBg} />
        <KPI label="Saving Acumulado"  value={fmtBRL(saving)}         color={saving>=0?C.green:C.red} icon={TrendingUp} bg={saving>=0?C.greenBg:C.redBg} />
        <KPI label="Em Andamento"      value={emAndamento}            color={C.amber}  icon={Clock}       bg={C.amberBg}
             sub={atrasadas>0?`${atrasadas} atrasada(s)`:undefined} />
      </div>

      {/* Fluxo do mês */}
      <div style={{ ...s.panel, padding:'14px 16px', marginBottom:20 }}>
        <div style={{ fontSize:12, fontWeight:700, color:C.white, marginBottom:12 }}>
          Fluxo de Caixa — <span style={{ color:C.cyan, textTransform:'capitalize' }}>{mesNome}</span>
        </div>
        <div style={{ display:'flex', flexWrap:'wrap', gap:10 }}>
          <MesCard label="Entrou no mês"   value={fmtBRL(entradaMes)}  color={C.green} bg={C.greenBg}
                   icon={ArrowDown} delta={entradaMes-entradaAnt} />
          <MesCard label="Saiu no mês"     value={fmtBRL(saidaMes)}    color={C.red}   bg={C.redBg}
                   icon={ArrowUp}   delta={saidaMes-saidaAnt} />
          <MesCard label="Saldo do mês"    value={fmtBRL(saldoMes)}
                   color={saldoMes>=0?C.green:C.red}
                   bg={saldoMes>=0?C.greenBg:C.redBg}
                   icon={saldoMes>=0?TrendingUp:AlertTriangle} />
          <MesCard label="A receber (total)" value={fmtBRL(totalContrato-totalRecebido)} color={C.amber} bg={C.amberBg} icon={Clock} />
        </div>
      </div>

      {/* Alertas */}
      {vencidos.length>0&&(
        <div style={{ background:C.redBg, border:`1px solid ${C.red}`, borderRadius:8,
                      padding:'10px 14px', marginBottom:20 }}>
          <div style={{ fontSize:11, fontWeight:700, color:C.red, marginBottom:6,
                        display:'flex', alignItems:'center', gap:6 }}>
            <AlertTriangle size={13}/> {vencidos.length} BM(s) VENCIDO(S) SEM RECEBIMENTO
          </div>
          {vencidos.slice(0,3).map(e=>{
            const ob=obras.find(o=>o.id===e.obra_id);
            return (
              <div key={e.id} style={{ fontSize:11, color:C.light, marginBottom:3, display:'flex', gap:8, flexWrap:'wrap' }}>
                <span style={{ color:C.cyan, fontWeight:600 }}>{ob?.nome||'—'}</span>
                <span>·</span><span>{e.evento}</span>
                <span>·</span><span style={{ color:C.red }}>Venceu {fmtDate(e.data_vencimento)}</span>
                <span>·</span><span style={{ fontFamily:'IBM Plex Mono', color:C.amber }}>{fmtBRL(e.valor_liquido)}</span>
              </div>
            );
          })}
        </div>
      )}

      {/* Tabela de obras */}
      <div style={{ ...s.panel, overflow:'hidden' }}>
        <div style={{ padding:'12px 16px', borderBottom:`1px solid ${C.border}`,
                      display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <span style={{ fontSize:13, fontWeight:700, color:C.white }}>Obras</span>
          <Link to="/obras" style={{ fontSize:11, color:C.cyan, textDecoration:'none',
                                      display:'flex', alignItems:'center', gap:4 }}>
            Ver todas <ArrowRight size={12}/>
          </Link>
        </div>
        <div style={{ overflowX:'auto' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', minWidth:600 }}>
            <thead>
              <tr>
                {['Obra','Cliente','Status','Contrato','Recebido','Saving','Próx. Evento'].map(h=>(
                  <th key={h} style={s.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {obras.map((o,i)=>{
                const ct  = contratos.find(c=>c.obra_id===o.id);
                const ev  = eventos.filter(e=>e.obra_id===o.id);
                const pg  = pagamentos.filter(p=>p.obra_id===o.id&&p.status==='Pago');
                const rec = ev.reduce((s,e)=>s+(Number(e.valor_recebido)||0),0);
                const pag = pg.reduce((s,p)=>s+(Number(p.valor)||0),0);
                const sav = rec - pag;
                const prox= ev.find(e=>e.status==='A emitir'||e.status==='Emitido');
                const st  = STATUS_OBRA[o.status]||{bg:C.card2,fg:C.gray};
                const bg  = i%2===0?C.bg:C.card2;
                return (
                  <tr key={o.id} style={{ background:bg }}>
                    <td style={s.td}>
                      <Link to={`/obras/${o.id}`} style={{ color:C.cyan, textDecoration:'none', fontWeight:600 }}>
                        {o.nome}
                      </Link>
                    </td>
                    <td style={{ ...s.td, color:C.gray, fontSize:11 }}>{o.cliente||'—'}</td>
                    <td style={s.td}><span style={s.badge(st.bg,st.fg)}>{o.status}</span></td>
                    <td style={{ ...s.td, textAlign:'right', fontFamily:'IBM Plex Mono', fontSize:11 }}>{fmtBRL(ct?.valor_total)}</td>
                    <td style={{ ...s.td, textAlign:'right', fontFamily:'IBM Plex Mono', fontSize:11, color:C.green }}>{fmtBRL(rec)}</td>
                    <td style={{ ...s.td, textAlign:'right', fontFamily:'IBM Plex Mono', fontSize:11, color:sav>=0?C.green:C.red, fontWeight:700 }}>{fmtBRL(sav)}</td>
                    <td style={{ ...s.td, fontSize:11, color:C.amber }}>{prox?.evento||'—'}</td>
                  </tr>
                );
              })}
              {obras.length===0&&(
                <tr><td colSpan={7} style={{ ...s.td, textAlign:'center', color:C.gray, padding:32 }}>
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
