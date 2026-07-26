import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Plus, Pencil, Trash2, Check, AlertTriangle, ArrowUp, ArrowDown, ZoomIn, ZoomOut, X } from 'lucide-react';
import { supabase } from './supabase.js';

// ── CONSTANTES ────────────────────────────────────────────────────────────────
const COLORS = {
  bg:'#EEF2F4', panel:'#FFFFFF', navy:'#1B4965', navyDark:'#10293A',
  steel:'#5B6B79', amber:'#D98E04', amberLight:'#FCE8C7',
  red:'#C0463E', redLight:'#F6D9D6', green:'#3F8C6E', greenLight:'#D9EDE4',
  blue:'#3E7CA6', blueLight:'#DCEAF3', gray:'#9AA7B0', grayLight:'#E7EAEC', ink:'#1F2A33',
};
const STATUS_META = {
  'nao-iniciado': { label:'Não iniciado', bg:COLORS.grayLight,  fg:COLORS.steel, bar:COLORS.gray  },
  'em-andamento': { label:'Em andamento', bg:COLORS.blueLight,  fg:COLORS.navy,  bar:COLORS.blue  },
  'concluido':    { label:'Concluído',    bg:COLORS.greenLight, fg:COLORS.green, bar:COLORS.green },
  'atrasado':     { label:'Atrasado',     bg:COLORS.redLight,   fg:COLORS.red,   bar:COLORS.red   },
};
const ZOOM_LEVELS = [2, 4, 7, 12, 20, 32, 50];
const LABEL_WIDTH = 168;
const ROW_HEIGHT   = 36;

// ── HELPERS ───────────────────────────────────────────────────────────────────
const uid = () => 'f_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const todayISO = () => new Date().toISOString().slice(0, 10);
const fmtDate  = (iso) => { if (!iso) return ''; const [y,m,d]=iso.split('-'); return `${d}/${m}/${y}`; };

function parseMs(iso) { if (!iso) return null; const [y,m,d]=iso.split('-').map(Number); return new Date(y,m-1,d).getTime(); }
function toISO(date)  { return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`; }
function diffDays(a,b){ const x=parseMs(a),y=parseMs(b); if(!x||!y) return 0; return Math.round((y-x)/86400000); }
function shiftDate(iso,n){ if(!iso) return iso; const d=new Date(parseMs(iso)); d.setDate(d.getDate()+n); return toISO(d); }

function computeFaseStatus(f) {
  if ((f.perc_concluido||0)>=100) return 'concluido';
  if (!f.data_inicio) return 'nao-iniciado';
  const t=todayISO();
  if (f.data_fim_prevista && t>f.data_fim_prevista) return 'atrasado';
  if (t>=f.data_inicio) return 'em-andamento';
  return 'nao-iniciado';
}
function faseAtraso(f) { if(!f.data_fim_prevista||!f.data_fim_real) return 0; const d=diffDays(f.data_fim_prevista,f.data_fim_real); return d>0?d:0; }
function inicioAtraso(f){ if(!f.data_inicio||!f.data_inicio_real) return 0; const d=diffDays(f.data_inicio,f.data_inicio_real); return d>0?d:0; }

function applyPredecessorCascade(arr) {
  const r = arr.map(f=>({...f}));
  const pos = new Map(r.map((f,i)=>[f.id,i]));
  for (let i=0;i<r.length;i++){
    const f=r[i]; if(!f.predecessor_id) continue;
    const pp=pos.get(f.predecessor_id); if(pp===undefined||pp>=i) continue;
    const pred=r[pp]; const predEnd=pred.data_fim_real||pred.data_fim_prevista;
    if(!predEnd||predEnd===f.data_inicio) continue;
    const dur=f.data_inicio&&f.data_fim_prevista?diffDays(f.data_inicio,f.data_fim_prevista):0;
    r[i]={...f, data_inicio:predEnd, data_fim_prevista:dur>0?shiftDate(predEnd,dur):f.data_fim_prevista};
  }
  return r;
}

function computeTicks(timeline, pxPerDay) {
  const ticks=[];
  if (pxPerDay>=18){
    const d=new Date(timeline.start); d.setHours(0,0,0,0);
    while(d.getTime()<timeline.end){
      const px=((d.getTime()-timeline.start)/86400000)*pxPerDay;
      const isM=d.getDate()===1; const dow=d.getDay();
      ticks.push({px,label:isM?d.toLocaleDateString('pt-BR',{day:'2-digit',month:'short'}):String(d.getDate()),strong:isM,weekend:dow===0||dow===6});
      d.setDate(d.getDate()+1);
    }
  } else if (pxPerDay>=6){
    const d=new Date(timeline.start); d.setHours(0,0,0,0);
    while(d.getDay()!==1) d.setDate(d.getDate()-1);
    while(d.getTime()<timeline.end){
      const px=((d.getTime()-timeline.start)/86400000)*pxPerDay;
      ticks.push({px,label:d.toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit'}),strong:d.getDate()<=7,weekend:false});
      d.setDate(d.getDate()+7);
    }
  } else {
    const d=new Date(timeline.start); d.setDate(1);
    if(d.getTime()<timeline.start) d.setMonth(d.getMonth()+1);
    while(d.getTime()<timeline.end){
      const px=((d.getTime()-timeline.start)/86400000)*pxPerDay;
      ticks.push({px,label:d.toLocaleDateString('pt-BR',{month:'short',year:'2-digit'}),strong:true,weekend:false});
      d.setMonth(d.getMonth()+1);
    }
  }
  return ticks;
}

const inputSt = { background:COLORS.grayLight, border:`1px solid ${COLORS.gray}`, borderRadius:5,
                   padding:'5px 8px', color:COLORS.ink, fontSize:13, width:'100%', fontFamily:'inherit', outline:'none' };

// ── COMPONENTE PRINCIPAL ──────────────────────────────────────────────────────
export default function GanttTab({ obraId, obra, onObraChange }) {
  const [fases, setFases]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [editIdx, setEditIdx] = useState(null); // índice da fase em edição
  const [zoomIdx, setZoomIdx] = useState(2);
  const scrollRef = useRef(null);

  // ── Carregar fases do Supabase ────────────────────────────────────────────
  useEffect(() => {
    async function load() {
      const { data } = await supabase.from('fases')
        .select('*').eq('obra_id', obraId).order('ordem');
      setFases(data || []); setLoading(false);
    }
    load();
  }, [obraId]);

  // ── Salvar fase no Supabase ───────────────────────────────────────────────
  async function saveFase(fase) {
    const { id, ...rest } = fase;
    if (id.startsWith('f_')) {
      // Nova fase — insert
      const { data } = await supabase.from('fases').insert([{ ...rest, obra_id: obraId }]).select().single();
      return data;
    } else {
      // Existente — update
      await supabase.from('fases').update(rest).eq('id', id);
      return fase;
    }
  }

  // ── Aplicar cascata e salvar todas as fases alteradas ────────────────────
  async function commitFases(newFases) {
    const cascaded = applyPredecessorCascade(newFases);
    setSaving(true);
    await Promise.all(cascaded.map(f => saveFase(f)));
    setFases(cascaded);
    setSaving(false);
    onObraChange?.();
  }

  function updateFase(idx, field, value) {
    setFases(prev => {
      const next = prev.map((f,i) => {
        if (i!==idx) return f;
        const updated = {...f, [field]:value};
        if (field==='data_inicio'&&value&&!f.baseline_inicio) updated.baseline_inicio=value;
        if (field==='data_fim_prevista'&&value&&!f.baseline_fim_prevista) updated.baseline_fim_prevista=value;
        if (field==='data_inicio'&&f.data_fim_prevista) { /* keep duration */ }
        if (field==='duracao_dias'&&f.data_inicio) updated.data_fim_prevista=shiftDate(f.data_inicio,Number(value)||0);
        return updated;
      });
      return applyPredecessorCascade(next);
    });
  }

  async function deleteFase(idx) {
    const f = fases[idx];
    if (!f.id.startsWith('f_')) await supabase.from('fases').delete().eq('id', f.id);
    const removedId = f.id;
    const next = fases.filter((_,i)=>i!==idx).map(f2=>f2.predecessor_id===removedId?{...f2,predecessor_id:null}:f2);
    const ordered = next.map((f2,i)=>({...f2,ordem:i}));
    setFases(ordered);
    await Promise.all(ordered.map(f2=>saveFase(f2)));
  }

  async function moveFase(idx, dir) {
    const target=idx+dir; if(target<0||target>=fases.length) return;
    const next=[...fases]; [next[idx],next[target]]=[next[target],next[idx]];
    const ordered=next.map((f,i)=>({...f,ordem:i}));
    await commitFases(ordered);
  }

  async function addFase() {
    const newF = { id:uid(), obra_id:obraId, nome:'Nova fase', ordem:fases.length,
      data_inicio:null, data_inicio_real:null, data_fim_prevista:null, data_fim_real:null,
      perc_concluido:0, responsavel:'', predecessor_id:null,
      justificativa_atraso:'', plano_recuperacao:'',
      baseline_inicio:null, baseline_fim_prevista:null };
    setFases(prev=>[...prev, newF]);
    setEditIdx(fases.length);
  }

  async function handleSaveEdit() {
    await commitFases(fases);
    setEditIdx(null);
  }

  // ── Timeline ──────────────────────────────────────────────────────────────
  const timeline = useMemo(() => {
    const all=[];
    fases.forEach(f=>{
      if(f.data_inicio) all.push(parseMs(f.data_inicio));
      if(f.data_fim_prevista) all.push(parseMs(f.data_fim_prevista));
      if(f.data_fim_real) all.push(parseMs(f.data_fim_real));
    });
    let start,end;
    if(!all.length){ const t=Date.now(); start=t-30*86400000; end=t+90*86400000; }
    else { start=Math.min(...all)-10*86400000; end=Math.max(...all)+10*86400000; }
    if(end-start<30*86400000) end=start+30*86400000;
    return { start, end, totalDays:Math.ceil((end-start)/86400000) };
  }, [fases]);

  const pxPerDay     = ZOOM_LEVELS[zoomIdx];
  const totalWidthPx = Math.max(timeline.totalDays*pxPerDay, 300);
  const ticks        = useMemo(()=>computeTicks(timeline,pxPerDay),[timeline,pxPerDay]);
  const todayPx      = ((parseMs(todayISO())||0)-timeline.start)/86400000*pxPerDay;

  function posPx(iso) {
    const ms=parseMs(iso); if(ms===null) return null;
    return ((ms-timeline.start)/86400000)*pxPerDay;
  }

  // Connectors
  const connectors = useMemo(()=>{
    const list=[];
    fases.forEach((f,i)=>{
      if(!f.predecessor_id) return;
      const pi=fases.findIndex(p=>p.id===f.predecessor_id); if(pi<0||pi>=i) return;
      const pred=fases[pi];
      const x1=posPx(pred.data_fim_real||pred.data_fim_prevista);
      const x2=posPx(f.data_inicio);
      if(x1===null||x2===null) return;
      list.push({x1,y1:pi*ROW_HEIGHT+ROW_HEIGHT/2,x2,y2:i*ROW_HEIGHT+ROW_HEIGHT/2});
    });
    return list;
  },[fases,timeline,pxPerDay]);

  // Auto-scroll to today
  useEffect(()=>{
    if(!scrollRef.current||todayPx===null) return;
    const el=scrollRef.current;
    requestAnimationFrame(()=>{
      const visible=el.clientWidth-LABEL_WIDTH;
      el.scrollTo({left:Math.max(0,todayPx-visible/2),behavior:'smooth'});
    });
  },[zoomIdx]);

  if (loading) return <div style={{padding:24,color:COLORS.steel}}>Carregando cronograma…</div>;

  const rowsH = fases.length*ROW_HEIGHT;

  return (
    <div style={{ padding:'16px 20px', fontFamily:'IBM Plex Sans, sans-serif' }}>
      {/* Top bar */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16, flexWrap:'wrap', gap:8 }}>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <button onClick={addFase} style={{ display:'flex',alignItems:'center',gap:6,background:COLORS.navy,
            border:'none',borderRadius:6,padding:'7px 14px',color:'#fff',fontSize:13,fontWeight:600,cursor:'pointer' }}>
            <Plus size={14} /> Adicionar fase
          </button>
          {saving && <span style={{fontSize:12,color:COLORS.steel}}>Salvando…</span>}
        </div>
        {/* Zoom */}
        <div style={{ display:'flex',alignItems:'center',gap:6,background:COLORS.grayLight,borderRadius:7,padding:'4px 8px' }}>
          <button onClick={()=>setZoomIdx(z=>Math.max(0,z-1))} disabled={zoomIdx===0}
            style={{background:'none',border:'none',cursor:'pointer',color:COLORS.steel,padding:2,opacity:zoomIdx===0?0.3:1}}>
            <ZoomOut size={15}/>
          </button>
          <span style={{fontSize:11,fontFamily:'IBM Plex Mono',color:COLORS.steel,width:56,textAlign:'center'}}>
            {pxPerDay}px/dia
          </span>
          <button onClick={()=>setZoomIdx(z=>Math.min(ZOOM_LEVELS.length-1,z+1))} disabled={zoomIdx===ZOOM_LEVELS.length-1}
            style={{background:'none',border:'none',cursor:'pointer',color:COLORS.steel,padding:2,opacity:zoomIdx===ZOOM_LEVELS.length-1?0.3:1}}>
            <ZoomIn size={15}/>
          </button>
        </div>
      </div>

      {/* Gantt */}
      <div ref={scrollRef} style={{ overflowX:'auto', overflowY:'visible',
                                     background:COLORS.panel,borderRadius:8,border:`1px solid ${COLORS.grayLight}` }}>
        <div style={{ width:LABEL_WIDTH+totalWidthPx, minWidth:'100%' }}>
          {/* Axis */}
          <div style={{ display:'flex', height:22, position:'relative' }}>
            <div style={{ width:LABEL_WIDTH,flexShrink:0,position:'sticky',left:0,zIndex:10,background:COLORS.panel }} />
            <div style={{ position:'relative',width:totalWidthPx,flexShrink:0 }}>
              {ticks.map((t,i)=>(
                <span key={i} style={{ position:'absolute',left:t.px,fontSize:10,fontFamily:'IBM Plex Mono',
                  color:t.strong?COLORS.navy:COLORS.gray,fontWeight:t.strong?700:400,
                  transform:pxPerDay>=18?'translateX(-50%)':undefined,whiteSpace:'nowrap',top:4 }}>
                  {t.label}
                </span>
              ))}
            </div>
          </div>

          {/* Rows */}
          <div style={{ position:'relative', height:rowsH }}>
            {/* Weekend shading */}
            {pxPerDay>=18 && (
              <div style={{ position:'absolute',top:0,left:LABEL_WIDTH,width:totalWidthPx,height:rowsH,pointerEvents:'none' }}>
                {ticks.filter(t=>t.weekend).map((t,i)=>(
                  <div key={i} style={{ position:'absolute',left:t.px,width:pxPerDay,height:rowsH,background:COLORS.bg }} />
                ))}
              </div>
            )}
            {/* Grid lines */}
            <div style={{ position:'absolute',top:0,left:LABEL_WIDTH,width:totalWidthPx,height:rowsH,pointerEvents:'none' }}>
              {ticks.filter(t=>t.strong).map((t,i)=>(
                <div key={i} style={{ position:'absolute',left:t.px,width:1,height:rowsH,background:COLORS.grayLight }} />
              ))}
            </div>
            {/* Today */}
            <div style={{ position:'absolute',top:0,left:LABEL_WIDTH+todayPx,height:rowsH,pointerEvents:'none',zIndex:6 }}>
              <div style={{ position:'absolute',top:0,bottom:0,borderLeft:`2px dashed ${COLORS.amber}` }} />
              <span style={{ position:'absolute',top:0,transform:'translateX(-50%)',
                fontSize:9,fontFamily:'IBM Plex Mono',fontWeight:700,
                color:COLORS.navyDark,background:COLORS.amberLight,padding:'1px 4px',borderRadius:3,whiteSpace:'nowrap' }}>
                Hoje
              </span>
            </div>
            {/* Connectors */}
            {connectors.length>0&&(
              <div style={{ position:'absolute',top:0,left:LABEL_WIDTH,width:totalWidthPx,height:rowsH,pointerEvents:'none' }}>
                <svg width={totalWidthPx} height={rowsH}>
                  {connectors.map((c,i)=>(
                    <path key={i} d={`M${c.x1} ${c.y1} H${c.x1+8} V${c.y2} H${c.x2}`}
                      fill="none" stroke={COLORS.steel} strokeWidth="1.5" />
                  ))}
                </svg>
              </div>
            )}

            {/* Phase rows */}
            {fases.map((f,i)=>{
              const st    = computeFaseStatus(f);
              const meta  = STATUS_META[st];
              const iatr  = inicioAtraso(f);
              const eff   = iatr>0?f.data_inicio_real:f.data_inicio;
              const left  = posPx(eff);
              const right = posPx(f.data_fim_prevista);
              const pl    = posPx(f.data_inicio);
              const hasBar= left!==null&&right!==null;
              const w     = hasBar?Math.max(right-left,pxPerDay*0.3):0;
              const fill  = hasBar?(w*(Math.min(f.perc_concluido||0,100)/100)):0;
              const hasStartO = hasBar&&iatr>0&&pl!==null;
              const soW   = hasStartO?Math.max(left-pl,2):0;
              const atr   = faseAtraso(f);
              const orr   = atr>0?posPx(f.data_fim_real):null;
              const hasO  = hasBar&&orr!==null;
              const oL    = left+w;
              const oW    = hasO?Math.max(orr-oL,2):0;

              return (
                <div key={f.id} style={{ display:'flex',alignItems:'center',height:ROW_HEIGHT,
                                          borderBottom:`1px solid ${COLORS.grayLight}` }}>
                  {/* Label */}
                  <div style={{ width:LABEL_WIDTH,flexShrink:0,position:'sticky',left:0,zIndex:10,
                                 background:COLORS.panel,height:ROW_HEIGHT,display:'flex',alignItems:'center',
                                 padding:'0 8px',gap:4,borderRight:`1px solid ${COLORS.grayLight}` }}>
                    <span style={{ fontSize:12,color:COLORS.ink,flex:1,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }}>
                      {f.nome}
                    </span>
                    {atr>0&&<span style={{ fontSize:9,fontFamily:'IBM Plex Mono',fontWeight:700,
                      background:COLORS.amberLight,color:COLORS.amber,padding:'1px 4px',borderRadius:3,flexShrink:0 }}>
                      +{atr}d
                    </span>}
                    <button onClick={()=>setEditIdx(i)}
                      style={{ background:'none',border:'none',cursor:'pointer',color:COLORS.gray,padding:2,flexShrink:0 }}>
                      <Pencil size={11}/>
                    </button>
                  </div>
                  {/* Bar area */}
                  <div style={{ position:'relative',width:totalWidthPx,height:ROW_HEIGHT,flexShrink:0 }}>
                    {hasBar?(
                      <>
                        {hasStartO&&<div style={{ position:'absolute',top:'50%',transform:'translateY(-50%)',height:14,
                          left:pl,width:soW,background:COLORS.red,border:`1px solid ${COLORS.red}`,borderRadius:'3px 0 0 3px' }}
                          title={`${iatr}d atraso no início`} />}
                        <div style={{ position:'absolute',top:'50%',transform:'translateY(-50%)',height:14,
                          left,width:w,background:meta.bg,border:`1px solid ${meta.bar}`,
                          borderLeft:hasStartO?'none':undefined,borderRight:hasO?'none':undefined,
                          borderRadius:`${hasStartO?0:3}px ${hasO?0:3}px ${hasO?0:3}px ${hasStartO?0:3}px` }}>
                          <div style={{ height:'100%',width:`${w?(fill/w*100):0}%`,background:meta.bar,opacity:.85,
                            borderRadius:`${hasStartO?0:3}px ${hasO?0:3}px ${hasO?0:3}px ${hasStartO?0:3}px` }} />
                        </div>
                        {hasO&&<div style={{ position:'absolute',top:'50%',transform:'translateY(-50%)',height:14,
                          left:oL,width:oW,background:COLORS.red,border:`1px solid ${COLORS.red}`,borderRadius:'0 3px 3px 0' }}
                          title={`${atr}d atraso`} />}
                      </>
                    ):(
                      <div style={{ position:'absolute',top:'50%',transform:'translateY(-50%)',
                        fontSize:10,color:COLORS.gray,left:4 }}>datas não definidas</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Legenda */}
      <div style={{ display:'flex',gap:16,marginTop:12,flexWrap:'wrap' }}>
        {Object.entries(STATUS_META).map(([k,m])=>(
          <div key={k} style={{ display:'flex',alignItems:'center',gap:6,fontSize:11,color:COLORS.steel }}>
            <span style={{ display:'inline-block',width:12,height:12,borderRadius:2,background:m.bar }} />
            {m.label}
          </div>
        ))}
        <div style={{ display:'flex',alignItems:'center',gap:6,fontSize:11,color:COLORS.steel }}>
          <span style={{ display:'inline-block',width:12,height:2,background:COLORS.red }} />
          Dias de atraso
        </div>
        <div style={{ display:'flex',alignItems:'center',gap:6,fontSize:11,color:COLORS.steel }}>
          <span style={{ display:'inline-block',width:12,height:2,background:COLORS.steel }} />
          Vínculo entre fases
        </div>
      </div>

      {/* Modal de edição de fase */}
      {editIdx!==null&&editIdx<fases.length&&(()=>{
        const f=fases[editIdx];
        const hasValidPred = f.predecessor_id&&fases.findIndex(p=>p.id===f.predecessor_id)<editIdx;
        return (
          <div style={{ position:'fixed',inset:0,background:'rgba(0,0,0,0.6)',zIndex:200,
                         display:'flex',alignItems:'center',justifyContent:'center',padding:16 }}>
            <div style={{ background:'#fff',borderRadius:10,width:'100%',maxWidth:560,maxHeight:'90vh',
                           overflow:'auto',padding:24 }}>
              <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16 }}>
                <h3 style={{ fontSize:15,fontWeight:700,color:COLORS.navyDark }}>{f.nome}</h3>
                <button onClick={()=>setEditIdx(null)} style={{ background:'none',border:'none',cursor:'pointer' }}>
                  <X size={18}/>
                </button>
              </div>

              {/* Nome */}
              <div style={{ marginBottom:12 }}>
                <label style={{ fontSize:11,color:COLORS.steel,fontWeight:600,display:'block',marginBottom:4 }}>NOME DA FASE</label>
                <input style={inputSt} value={f.nome||''} onChange={e=>updateFase(editIdx,'nome',e.target.value)} />
              </div>

              {/* Predecessora */}
              {editIdx>0&&(
                <div style={{ marginBottom:12 }}>
                  <label style={{ fontSize:11,color:COLORS.steel,fontWeight:600,display:'block',marginBottom:4 }}>PREDECESSORA (opcional)</label>
                  <select style={inputSt} value={f.predecessor_id||''}
                    onChange={e=>updateFase(editIdx,'predecessor_id',e.target.value||null)}>
                    <option value="">Nenhuma — fase independente</option>
                    {fases.slice(0,editIdx).map((f2,i)=>(
                      <option key={f2.id} value={f2.id}>{i+1}. {f2.nome}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Grid campos */}
              <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:10 }}>
                {[
                  ['responsavel','Responsável',false,'text'],
                  ['data_inicio',hasValidPred?'Início previsto (automático)':'Início previsto',hasValidPred,'date'],
                  ['duracao_dias','Duração (dias)',false,'number'],
                  ['data_inicio_real','Início real',false,'date'],
                  ['data_fim_prevista','Fim previsto',false,'date'],
                  ['data_fim_real','Fim real',false,'date'],
                  ['perc_concluido','% Concluído',false,'number'],
                ].map(([field,label,disabled,type])=>(
                  <div key={field}>
                    <label style={{ fontSize:11,color:COLORS.steel,fontWeight:600,display:'block',marginBottom:4 }}>{label.toUpperCase()}</label>
                    <input type={type} disabled={disabled}
                      style={{ ...inputSt, opacity:disabled?0.5:1 }}
                      value={field==='duracao_dias'
                        ? (f.data_inicio&&f.data_fim_prevista?diffDays(f.data_inicio,f.data_fim_prevista):'')
                        : (f[field]||'')}
                      onChange={e=>updateFase(editIdx,field,type==='number'?Number(e.target.value):e.target.value)} />
                  </div>
                ))}
              </div>

              {/* Baseline */}
              {(f.baseline_inicio||f.baseline_fim_prevista)&&
                (f.baseline_inicio!==f.data_inicio||f.baseline_fim_prevista!==f.data_fim_prevista)&&(
                <p style={{ fontSize:11,fontFamily:'IBM Plex Mono',color:COLORS.gray,marginTop:10 }}>
                  original: {fmtDate(f.baseline_inicio)||'—'} → {fmtDate(f.baseline_fim_prevista)||'—'}
                </p>
              )}

              {/* Atraso bloco */}
              {faseAtraso(f)>0&&(
                <div style={{ marginTop:12,padding:12,borderRadius:8,background:COLORS.amberLight,border:`1px solid ${COLORS.amber}` }}>
                  <div style={{ fontSize:12,fontWeight:700,color:COLORS.navyDark,marginBottom:8,display:'flex',justifyContent:'space-between' }}>
                    <span>⚠ {faseAtraso(f)} dia(s) de atraso</span>
                    {editIdx<fases.length-1&&(
                      <button onClick={()=>{
                        const atr=faseAtraso(f);
                        setFases(prev=>applyPredecessorCascade(prev.map((f2,i)=>i<=editIdx?f2:{...f2,
                          data_inicio:shiftDate(f2.data_inicio,atr),data_fim_prevista:shiftDate(f2.data_fim_prevista,atr)})));
                      }} style={{ fontSize:11,fontWeight:700,background:COLORS.navy,color:'#fff',border:'none',borderRadius:4,padding:'3px 10px',cursor:'pointer' }}>
                        Empurrar fases (+{faseAtraso(f)}d)
                      </button>
                    )}
                  </div>
                  {[['justificativa_atraso','Justificativa'],['plano_recuperacao','Plano de recuperação']].map(([field,lbl])=>(
                    <div key={field} style={{ marginBottom:8 }}>
                      <label style={{ fontSize:10,color:COLORS.steel,fontWeight:600,display:'block',marginBottom:3 }}>{lbl.toUpperCase()}</label>
                      <textarea style={{ ...inputSt,minHeight:48,resize:'vertical' }}
                        value={f[field]||''} onChange={e=>updateFase(editIdx,field,e.target.value)}
                        placeholder={field==='justificativa_atraso'?'Ex: atraso na entrega do material':'Ex: turno extra na próxima semana'} />
                    </div>
                  ))}
                </div>
              )}

              <div style={{ display:'flex',gap:8,marginTop:16,justifyContent:'space-between' }}>
                <button onClick={()=>{ if(confirm('Remover esta fase?')) { deleteFase(editIdx); setEditIdx(null); } }}
                  style={{ background:'none',border:`1px solid ${COLORS.red}`,borderRadius:6,padding:'6px 12px',color:COLORS.red,fontSize:12,cursor:'pointer' }}>
                  Remover fase
                </button>
                <div style={{ display:'flex',gap:8 }}>
                  <button onClick={()=>setEditIdx(null)}
                    style={{ background:COLORS.grayLight,border:'none',borderRadius:6,padding:'7px 16px',color:COLORS.steel,fontSize:13,cursor:'pointer' }}>
                    Cancelar
                  </button>
                  <button onClick={handleSaveEdit}
                    style={{ background:COLORS.navy,border:'none',borderRadius:6,padding:'7px 16px',color:'#fff',fontSize:13,fontWeight:700,cursor:'pointer' }}>
                    {saving?'Salvando…':'Salvar'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
