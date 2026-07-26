import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Search, ChevronRight, Trash2 } from 'lucide-react';
import { supabase } from './supabase.js';
import { C, s, STATUS_OBRA, fmtBRL, fmtDate } from './theme.js';

const PHASES = ['Recebimento do Contrato','Projeto do Cliente','Engenharia','Fabricação','Expedição','Montagem em Obra'];

function uid() { return 'o_' + Date.now().toString(36) + Math.random().toString(36).slice(2,8); }

export default function Obras() {
  const [obras, setObras] = useState([]);
  const [contratos, setContratos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ nome:'', cliente:'', tag:'', cidade:'', tipo_obra:'', dona_obra:'' });
  const [saving, setSaving] = useState(false);

  async function load() {
    const [{ data: ob }, { data: ct }] = await Promise.all([
      supabase.from('obras').select('*').order('created_at', { ascending: false }),
      supabase.from('contratos_cliente').select('obra_id,valor_total'),
    ]);
    setObras(ob || []); setContratos(ct || []); setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function handleCreate() {
    if (!form.nome.trim()) return;
    setSaving(true);
    const { data: obra, error } = await supabase.from('obras').insert([{
      nome: form.nome, cliente: form.cliente, tag: form.tag,
      cidade: form.cidade, tipo_obra: form.tipo_obra, dona_obra: form.dona_obra,
      status: 'Não iniciada',
    }]).select().single();
    if (!error && obra) {
      // Criar fases padrão
      const fases = PHASES.map((nome, i) => ({
        obra_id: obra.id, nome, ordem: i,
        data_inicio: null, data_fim_prevista: null, data_fim_real: null,
        data_inicio_real: null, perc_concluido: 0, responsavel: '',
        predecessor_id: null, justificativa_atraso: '', plano_recuperacao: '',
        baseline_inicio: null, baseline_fim_prevista: null,
      }));
      await supabase.from('fases').insert(fases);
      setShowAdd(false);
      setForm({ nome:'', cliente:'', tag:'', cidade:'', tipo_obra:'', dona_obra:'' });
      load();
    }
    setSaving(false);
  }

  async function handleDelete(id, e) {
    e.preventDefault(); e.stopPropagation();
    if (!confirm('Deletar esta obra e todas as suas fases?')) return;
    await supabase.from('obras').delete().eq('id', id);
    load();
  }

  const filtered = obras.filter(o =>
    [o.nome, o.cliente, o.tag, o.cidade].some(v => v?.toLowerCase().includes(search.toLowerCase()))
  );

  const STATUS_COLORS = {
    'No prazo':     '#10B981', 'Atrasada': '#EF4444',
    'Não iniciada': '#8B95A8', 'Concluída': '#38BDF8', 'Em andamento': '#F59E0B',
  };

  if (loading) return <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'50vh', color: C.gray }}>Carregando…</div>;

  return (
    <div style={{ padding:'24px 20px', maxWidth:1100, margin:'0 auto' }}>
      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:12, marginBottom:24 }}>
        <div>
          <h1 style={{ fontSize:20, fontWeight:700, color:C.white }}>Obras</h1>
          <p style={{ fontSize:13, color:C.gray, marginTop:4 }}>{obras.length} obras cadastradas</p>
        </div>
        <button onClick={() => setShowAdd(true)} style={{ ...s.btnPrimary, display:'flex', alignItems:'center', gap:6 }}>
          <Plus size={15} /> Nova Obra
        </button>
      </div>

      {/* Search */}
      <div style={{ position:'relative', marginBottom:20 }}>
        <Search size={14} style={{ position:'absolute', left:12, top:'50%', transform:'translateY(-50%)', color:C.gray }} />
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Buscar por nome, cliente, TAG…"
          style={{ ...s.input, paddingLeft:36 }} />
      </div>

      {/* Modal nova obra */}
      {showAdd && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.7)', zIndex:100, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}>
          <div style={{ background:C.panel, border:`1px solid ${C.card}`, borderRadius:12, padding:24, width:'100%', maxWidth:520 }}>
            <h2 style={{ fontSize:16, fontWeight:700, color:C.white, marginBottom:20 }}>Nova Obra</h2>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
              {[
                ['nome','Nome da Obra *','text','Adecoagro — Pipe Rack'],
                ['cliente','Cliente *','text','Adecoagro Vale do Ivinhema'],
                ['tag','TAG / PV Tibre','text','24103'],
                ['cidade','Cidade','text','Ivinhema - MS'],
                ['tipo_obra','Tipo de Obra','text','Pipe Rack'],
                ['dona_obra','Dona da Obra','text','Adecoagro S.A.'],
              ].map(([field, label, type, ph]) => (
                <div key={field} style={{ gridColumn: field==='nome' ? 'span 2' : undefined }}>
                  <label style={s.label}>{label}</label>
                  <input type={type} placeholder={ph} value={form[field]}
                    onChange={e => setForm(p => ({...p, [field]: e.target.value}))}
                    style={s.input} />
                </div>
              ))}
            </div>
            <p style={{ fontSize:11, color:C.gray, marginTop:12 }}>
              As 6 fases padrão (Recebimento → Montagem) serão criadas automaticamente.
            </p>
            <div style={{ display:'flex', gap:10, marginTop:20, justifyContent:'flex-end' }}>
              <button onClick={() => setShowAdd(false)} style={s.btn}>Cancelar</button>
              <button onClick={handleCreate} disabled={saving || !form.nome.trim()} style={s.btnPrimary}>
                {saving ? 'Criando…' : 'Criar Obra'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Lista */}
      <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
        {filtered.length === 0 && (
          <div style={{ ...s.card, textAlign:'center', padding:40, color:C.gray }}>
            {search ? 'Nenhuma obra encontrada.' : 'Nenhuma obra cadastrada. Clique em "Nova Obra" para começar.'}
          </div>
        )}
        {filtered.map(o => {
          const ct = contratos.find(c => c.obra_id === o.id);
          const stColor = STATUS_COLORS[o.status] || C.gray;
          return (
            <Link key={o.id} to={`/obras/${o.id}`}
              style={{ ...s.panel, display:'flex', alignItems:'center', gap:16, padding:'14px 16px',
                       textDecoration:'none', transition:'border-color 0.15s',
                       ':hover': { borderColor: C.cyan } }}>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ display:'flex', alignItems:'center', gap:10, flexWrap:'wrap' }}>
                  <span style={{ fontSize:14, fontWeight:700, color:C.white }}>{o.nome}</span>
                  <span style={{ fontSize:11, fontWeight:700, color:stColor,
                    background: stColor + '22', padding:'2px 8px', borderRadius:4 }}>{o.status}</span>
                  {o.tag && <span style={{ fontSize:11, color:C.gray, fontFamily:'IBM Plex Mono' }}>PV {o.tag}</span>}
                </div>
                <div style={{ fontSize:12, color:C.gray, marginTop:3 }}>
                  {[o.cliente, o.cidade, o.tipo_obra].filter(Boolean).join(' · ')}
                </div>
              </div>
              {ct && (
                <div style={{ textAlign:'right', flexShrink:0 }}>
                  <div style={{ fontSize:13, fontWeight:700, color:C.white, fontFamily:'IBM Plex Mono' }}>
                    {fmtBRL(ct.valor_total)}
                  </div>
                  <div style={{ fontSize:11, color:C.gray }}>contrato</div>
                </div>
              )}
              <button onClick={e => handleDelete(o.id, e)}
                style={{ background:'none', border:'none', color:C.gray, cursor:'pointer', padding:6, flexShrink:0 }}
                title="Deletar obra">
                <Trash2 size={14} />
              </button>
              <ChevronRight size={16} color={C.gray} style={{ flexShrink:0 }} />
            </Link>
          );
        })}
      </div>
    </div>
  );
}
