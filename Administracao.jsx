import React, { useEffect, useState } from 'react';
import {
  BellRing,
  Building2,
  Mail,
  RefreshCw,
  Save,
  Settings,
} from 'lucide-react';
import { supabase } from './supabase.js';
import { C, s } from './theme.js';

const DEFAULT_CONFIG = {
  email_gestor: '',
  email_financeiro: '',
  alertas_ativos: true,
  notificar_sistema: true,
  notificar_email: false,
  dias_nota_emitir: 5,
  dias_verificar_pagamento_cliente: 3,
  dias_fornecedor_sem_liberacao: 2,
  dias_fornecedor_sem_nf: 3,
  dias_pagamento_fornecedor: 5,
  repetir_vencidos_diariamente: true,
};

export default function Administracao() {
  const [config, setConfig] = useState(DEFAULT_CONFIG);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from('config_alertas')
      .select('*')
      .order('created_at')
      .limit(1)
      .maybeSingle();

    if (error) {
      setMessage(`Erro ao carregar: ${error.message}`);
    } else if (data) {
      setConfig({ ...DEFAULT_CONFIG, ...data });
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  function update(field, value) {
    setConfig((prev) => ({ ...prev, [field]: value }));
  }

  async function save() {
    setSaving(true);
    setMessage('');

    const payload = {
      email_gestor: config.email_gestor || null,
      email_financeiro: config.email_financeiro || null,
      alertas_ativos: Boolean(config.alertas_ativos),
      notificar_sistema: Boolean(config.notificar_sistema),
      notificar_email: Boolean(config.notificar_email),
      dias_nota_emitir: Number(config.dias_nota_emitir) || 0,
      dias_verificar_pagamento_cliente:
        Number(config.dias_verificar_pagamento_cliente) || 0,
      dias_fornecedor_sem_liberacao:
        Number(config.dias_fornecedor_sem_liberacao) || 0,
      dias_fornecedor_sem_nf: Number(config.dias_fornecedor_sem_nf) || 0,
      dias_pagamento_fornecedor:
        Number(config.dias_pagamento_fornecedor) || 0,
      repetir_vencidos_diariamente: Boolean(
        config.repetir_vencidos_diariamente,
      ),
    };

    let response;

    if (config.id) {
      response = await supabase
        .from('config_alertas')
        .update(payload)
        .eq('id', config.id)
        .select()
        .single();
    } else {
      response = await supabase
        .from('config_alertas')
        .insert([payload])
        .select()
        .single();
    }

    if (response.error) {
      setMessage(`Erro ao salvar: ${response.error.message}`);
    } else {
      setConfig({ ...DEFAULT_CONFIG, ...response.data });
      setMessage('Configuração salva com sucesso.');
    }

    setSaving(false);
  }

  async function processNow() {
    setMessage('Processando alertas…');
    const { error } = await supabase.rpc('processar_alertas');

    setMessage(
      error
        ? `Erro ao processar: ${error.message}`
        : 'Alertas verificados e atualizados.',
    );
  }

  if (loading) {
    return <div style={{ padding: 24, color: C.gray }}>Carregando…</div>;
  }

  return (
    <div style={{ padding: 20, maxWidth: 1100, margin: '0 auto' }}>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ color: C.white, fontSize: 20, margin: 0 }}>
          Administração
        </h1>
        <p style={{ color: C.gray, fontSize: 12, marginTop: 4 }}>
          Configurações de notificações e avisos automáticos
        </p>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 12,
          marginBottom: 18,
        }}
      >
        <SummaryCard
          Icon={BellRing}
          title="Alertas"
          value={config.alertas_ativos ? 'Ativos' : 'Desativados'}
          color={config.alertas_ativos ? C.green : C.gray}
        />
        <SummaryCard
          Icon={Settings}
          title="Notificação no sistema"
          value={config.notificar_sistema ? 'Ativa' : 'Desativada'}
          color={config.notificar_sistema ? C.cyan : C.gray}
        />
        <SummaryCard
          Icon={Mail}
          title="Envio por e-mail"
          value={config.notificar_email ? 'Ativo' : 'Desativado'}
          color={config.notificar_email ? C.amber : C.gray}
        />
        <SummaryCard
          Icon={Building2}
          title="Rotina automática"
          value="A cada hora"
          color={C.pink}
        />
      </div>

      <section style={{ ...s.panel, padding: 16, marginBottom: 14 }}>
        <SectionTitle>Ativação</SectionTitle>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: 12,
          }}
        >
          <Toggle
            label="Ativar central de alertas"
            checked={config.alertas_ativos}
            onChange={(value) => update('alertas_ativos', value)}
          />
          <Toggle
            label="Mostrar no sino da plataforma"
            checked={config.notificar_sistema}
            onChange={(value) => update('notificar_sistema', value)}
          />
          <Toggle
            label="Enviar e-mails"
            checked={config.notificar_email}
            onChange={(value) => update('notificar_email', value)}
          />
          <Toggle
            label="Repetir vencidos diariamente"
            checked={config.repetir_vencidos_diariamente}
            onChange={(value) =>
              update('repetir_vencidos_diariamente', value)
            }
          />
        </div>
      </section>

      <section style={{ ...s.panel, padding: 16, marginBottom: 14 }}>
        <SectionTitle>Antecedência dos avisos</SectionTitle>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
            gap: 12,
          }}
        >
          <NumberField
            label="Nota do cliente próxima da emissão"
            value={config.dias_nota_emitir}
            onChange={(value) => update('dias_nota_emitir', value)}
          />
          <NumberField
            label="Verificar pagamento do cliente"
            value={config.dias_verificar_pagamento_cliente}
            onChange={(value) =>
              update('dias_verificar_pagamento_cliente', value)
            }
          />
          <NumberField
            label="Fornecedor aguardando liberação"
            value={config.dias_fornecedor_sem_liberacao}
            onChange={(value) =>
              update('dias_fornecedor_sem_liberacao', value)
            }
          />
          <NumberField
            label="Fornecedor liberado sem enviar NF"
            value={config.dias_fornecedor_sem_nf}
            onChange={(value) => update('dias_fornecedor_sem_nf', value)}
          />
          <NumberField
            label="Pagamento do fornecedor vencendo"
            value={config.dias_pagamento_fornecedor}
            onChange={(value) =>
              update('dias_pagamento_fornecedor', value)
            }
          />
        </div>
      </section>

      <section style={{ ...s.panel, padding: 16, marginBottom: 14 }}>
        <SectionTitle>Destinatários de e-mail</SectionTitle>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
            gap: 12,
          }}
        >
          <div>
            <label style={s.label}>E-mail do gestor</label>
            <input
              type="email"
              style={s.input}
              value={config.email_gestor || ''}
              onChange={(event) => update('email_gestor', event.target.value)}
              placeholder="gestor@empresa.com.br"
            />
          </div>
          <div>
            <label style={s.label}>E-mail do financeiro</label>
            <input
              type="email"
              style={s.input}
              value={config.email_financeiro || ''}
              onChange={(event) =>
                update('email_financeiro', event.target.value)
              }
              placeholder="financeiro@empresa.com.br"
            />
          </div>
        </div>

        <div style={{ color: C.gray, fontSize: 10, marginTop: 10 }}>
          O envio automático de e-mails exige publicar a função Supabase
          incluída no pacote e configurar a chave do serviço de e-mail.
        </div>
      </section>

      {message && (
        <div
          style={{
            padding: '10px 12px',
            borderRadius: 7,
            background: C.card2,
            color: message.startsWith('Erro') ? C.red : C.green,
            fontSize: 11,
            marginBottom: 12,
          }}
        >
          {message}
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={save}
          disabled={saving}
          style={{ ...s.btnPrimary, display: 'flex', gap: 6, alignItems: 'center' }}
        >
          <Save size={14} /> {saving ? 'Salvando…' : 'Salvar configurações'}
        </button>

        <button
          type="button"
          onClick={processNow}
          style={{ ...s.btn, display: 'flex', gap: 6, alignItems: 'center' }}
        >
          <RefreshCw size={14} /> Verificar alertas agora
        </button>
      </div>
    </div>
  );
}

function SummaryCard({ Icon, title, value, color }) {
  return (
    <div style={{ ...s.card, background: C.card2 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Icon size={16} color={color} />
        <span style={{ color: C.gray, fontSize: 10, fontWeight: 700 }}>
          {title.toUpperCase()}
        </span>
      </div>
      <div style={{ color, fontSize: 17, fontWeight: 700, marginTop: 10 }}>
        {value}
      </div>
    </div>
  );
}

function SectionTitle({ children }) {
  return (
    <div
      style={{
        color: C.white,
        fontSize: 12,
        fontWeight: 700,
        marginBottom: 12,
      }}
    >
      {children}
    </div>
  );
}

function Toggle({ label, checked, onChange }) {
  return (
    <label
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        background: C.card2,
        border: `1px solid ${C.border}`,
        borderRadius: 7,
        padding: '10px 12px',
        color: C.light,
        fontSize: 11,
        cursor: 'pointer',
      }}
    >
      <span>{label}</span>
      <input
        type="checkbox"
        checked={Boolean(checked)}
        onChange={(event) => onChange(event.target.checked)}
      />
    </label>
  );
}

function NumberField({ label, value, onChange }) {
  return (
    <div>
      <label style={s.label}>{label}</label>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
        <input
          type="number"
          min="0"
          max="30"
          style={s.input}
          value={value ?? 0}
          onChange={(event) => onChange(Number(event.target.value))}
        />
        <span style={{ color: C.gray, fontSize: 10 }}>dias</span>
      </div>
    </div>
  );
}
