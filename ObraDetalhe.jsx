import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, BarChart2, FileText, DollarSign, Truck } from 'lucide-react';
import { supabase } from './supabase.js';
import { C, s } from './theme.js';
import GanttTab from './GanttTab.jsx';
import ContratoTab from './ContratoTab.jsx';
import FaturamentoTab from './FaturamentoTab.jsx';
import FornecedoresTab from './FornecedoresTab.jsx';

const TABS = [
  { id:'gantt',        label:'Cronograma',   icon: BarChart2  },
  { id:'contrato',     label:'Contrato',     icon: FileText   },
  { id:'faturamento',  label:'Faturamento',  icon: DollarSign },
  { id:'fornecedores', label:'Fornecedores', icon: Truck      },
];

const STATUS_COLORS = {
  'No prazo':'#10B981','Atrasada':'#EF4444',
  'Não iniciada':'#8B95A8','Concluída':'#38BDF8','Em andamento':'#F59E0B',
};

export default function ObraDetalhe() {
  const { id } = useParams();
  const [obra, setObra] = useState(null);
  const [tab, setTab] = useState('gantt');
  const [loading, setLoading] = useState(true);

  async function loadObra() {
    const { data } = await supabase.from('obras').select('*').eq('id', id).single();
    setObra(data); setLoading(false);
  }
  useEffect(() => { loadObra(); }, [id]);

  if (loading) return <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'50vh', color: C.gray }}>Carregando…</div>;
  if (!obra) return <div style={{ padding:24, color:C.red }}>Obra não encontrada.</div>;

  const stColor = STATUS_COLORS[obra.status] || C.gray;

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%' }}>
      {/* Header */}
      <div style={{ background:C.panel, borderBottom:`1px solid ${C.border}`, padding:'16px 20px' }}>
        <Link to="/obras" style={{ display:'inline-flex', alignItems:'center', gap:6,
                                    fontSize:12, color:C.gray, textDecoration:'none', marginBottom:10 }}>
          <ArrowLeft size={13} /> Obras
        </Link>
        <div style={{ display:'flex', alignItems:'center', gap:12, flexWrap:'wrap' }}>
          <h1 style={{ fontSize:18, fontWeight:700, color:C.white, margin:0 }}>{obra.nome}</h1>
          <span style={{ fontSize:11, fontWeight:700, color:stColor,
            background: stColor + '22', padding:'3px 9px', borderRadius:4 }}>{obra.status}</span>
          {obra.tag && <span style={{ fontSize:12, color:C.gray, fontFamily:'IBM Plex Mono' }}>PV {obra.tag}</span>}
        </div>
        <p style={{ fontSize:12, color:C.gray, marginTop:4 }}>
          {[obra.cliente, obra.cidade, obra.tipo_obra].filter(Boolean).join(' · ')}
        </p>

        {/* Tabs */}
        <div style={{ display:'flex', gap:4, marginTop:16, borderBottom:`1px solid ${C.card}`, paddingBottom:0 }}>
          {TABS.map(({ id:tid, label, icon:Icon }) => {
            const active = tab === tid;
            return (
              <button key={tid} onClick={() => setTab(tid)}
                style={{ display:'flex', alignItems:'center', gap:6,
                         padding:'8px 14px', background:'none', border:'none', cursor:'pointer',
                         fontSize:13, fontWeight: active ? 700 : 500,
                         color: active ? C.cyan : C.gray,
                         borderBottom: active ? `2px solid ${C.cyan}` : '2px solid transparent',
                         marginBottom:-1, transition:'all 0.15s' }}>
                <Icon size={14} /> {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab content */}
      <div style={{ flex:1, overflow:'auto' }}>
        {tab === 'gantt'        && <GanttTab       obraId={id} obra={obra} onObraChange={loadObra} />}
        {tab === 'contrato'     && <ContratoTab     obraId={id} obra={obra} />}
        {tab === 'faturamento'  && <FaturamentoTab  obraId={id} obra={obra} />}
        {tab === 'fornecedores' && <FornecedoresTab obraId={id} obra={obra} />}
      </div>
    </div>
  );
}
