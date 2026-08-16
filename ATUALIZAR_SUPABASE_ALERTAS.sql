-- ============================================================
-- CENTRAL DE ALERTAS E NOTIFICAÇÕES
-- Execute no Supabase > SQL Editor > New query > Run
-- O script preserva os dados existentes.
-- ============================================================

create extension if not exists pg_cron with schema extensions;

-- 1. Datas e vínculos necessários para os fluxos
alter table if exists faturamentos
  add column if not exists data_prevista_emissao date;

alter table if exists pagamentos_fornecedor
  add column if not exists data_autorizacao date;

-- 2. Configurações dos avisos
alter table if exists config_alertas
  add column if not exists alertas_ativos boolean default true,
  add column if not exists notificar_sistema boolean default true,
  add column if not exists notificar_email boolean default false,
  add column if not exists dias_nota_emitir integer default 5,
  add column if not exists dias_verificar_pagamento_cliente integer default 3,
  add column if not exists dias_fornecedor_sem_liberacao integer default 2,
  add column if not exists dias_fornecedor_sem_nf integer default 3,
  add column if not exists dias_pagamento_fornecedor integer default 5,
  add column if not exists repetir_vencidos_diariamente boolean default true;

insert into config_alertas (
  email_gestor,
  email_financeiro,
  alertas_ativos,
  notificar_sistema,
  notificar_email
)
select
  'igor@tibre.com.br',
  'financeiro@tibre.com.br',
  true,
  true,
  false
where not exists (select 1 from config_alertas);

-- 3. Ampliação da tabela de alertas
alter table if exists alertas
  add column if not exists chave_unica text,
  add column if not exists titulo text,
  add column if not exists nivel text default 'info',
  add column if not exists link text,
  add column if not exists data_referencia date,
  add column if not exists resolvido boolean default false,
  add column if not exists email_enviado boolean default false,
  add column if not exists email_erro text,
  add column if not exists email_tentativas integer default 0;

create unique index if not exists idx_alertas_chave_unica
  on alertas(chave_unica)
  where chave_unica is not null;

create index if not exists idx_alertas_pendentes
  on alertas(lido, resolvido, created_at desc);

-- 4. Registra a data de autorização do fornecedor
create or replace function registrar_data_autorizacao_fornecedor()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'Autorizado'
     and coalesce(old.status, '') <> 'Autorizado'
     and new.data_autorizacao is null then
    new.data_autorizacao = current_date;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_pagamento_fornecedor_autorizacao
  on pagamentos_fornecedor;

create trigger trg_pagamento_fornecedor_autorizacao
before update on pagamentos_fornecedor
for each row
execute function registrar_data_autorizacao_fornecedor();

-- 5. Rotina que verifica prazos e gera notificações
create or replace function processar_alertas()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  cfg config_alertas%rowtype;
  quantidade integer := 0;
begin
  select * into cfg
  from config_alertas
  order by created_at
  limit 1;

  if cfg.id is null or coalesce(cfg.alertas_ativos, true) = false then
    return 0;
  end if;

  -- Os alertas ativos são revalidados a cada execução.
  update alertas
     set resolvido = true
   where resolvido = false;

  -- A. Nota do cliente próxima da emissão
  insert into alertas (
    obra_id, tipo, chave_unica, titulo, nivel, mensagem,
    email_destino, link, data_referencia, resolvido, lido
  )
  select
    f.obra_id,
    'nota_cliente_emitir',
    'nota_cliente_emitir:' || f.id::text || ':' || coalesce(f.data_prevista_emissao::text, ''),
    'Nota do cliente próxima da emissão',
    case
      when f.data_prevista_emissao <= current_date then 'critico'
      when f.data_prevista_emissao <= current_date + 2 then 'atencao'
      else 'info'
    end,
    'Obra: ' || coalesce(o.nome, '—') ||
    ' · Evento: ' || coalesce(f.evento, '—') ||
    ' · Previsão: ' || to_char(f.data_prevista_emissao, 'DD/MM/YYYY'),
    nullif(cfg.email_gestor, ''),
    '/obras/' || f.obra_id::text,
    f.data_prevista_emissao,
    false,
    false
  from faturamentos f
  join obras o on o.id = f.obra_id
  where f.tipo_movimento = 'entrada'
    and f.status in ('Previsto', 'A emitir')
    and f.data_prevista_emissao is not null
    and f.data_prevista_emissao between current_date
        and current_date + greatest(coalesce(cfg.dias_nota_emitir, 5), 0)
  on conflict (chave_unica) where chave_unica is not null
  do update set
    titulo = excluded.titulo,
    nivel = excluded.nivel,
    mensagem = excluded.mensagem,
    email_destino = excluded.email_destino,
    link = excluded.link,
    data_referencia = excluded.data_referencia,
    resolvido = false;

  get diagnostics quantidade = row_count;

  -- B. Verificar pagamento do cliente: próximo do vencimento
  insert into alertas (
    obra_id, tipo, chave_unica, titulo, nivel, mensagem,
    email_destino, link, data_referencia, resolvido, lido
  )
  select
    f.obra_id,
    'verificar_pagamento_cliente',
    'verificar_pagamento_cliente:' || f.id::text || ':' || f.data_vencimento::text,
    'Verificar pagamento do cliente',
    case
      when f.data_vencimento = current_date then 'critico'
      when f.data_vencimento <= current_date + 1 then 'atencao'
      else 'info'
    end,
    'Obra: ' || coalesce(o.nome, '—') ||
    ' · Evento: ' || coalesce(f.evento, '—') ||
    ' · Vencimento: ' || to_char(f.data_vencimento, 'DD/MM/YYYY') ||
    ' · Valor: ' || to_char(coalesce(f.valor_liquido, 0), 'FM999G999G999D00'),
    coalesce(nullif(cfg.email_financeiro, ''), nullif(cfg.email_gestor, '')),
    '/obras/' || f.obra_id::text,
    f.data_vencimento,
    false,
    false
  from faturamentos f
  join obras o on o.id = f.obra_id
  where f.tipo_movimento = 'entrada'
    and f.status not in ('Recebido', 'Cancelado')
    and f.data_vencimento is not null
    and f.data_vencimento between current_date
        and current_date + greatest(coalesce(cfg.dias_verificar_pagamento_cliente, 3), 0)
  on conflict (chave_unica) where chave_unica is not null
  do update set
    nivel = excluded.nivel,
    mensagem = excluded.mensagem,
    email_destino = excluded.email_destino,
    resolvido = false;

  -- C. Pagamento do cliente vencido
  insert into alertas (
    obra_id, tipo, chave_unica, titulo, nivel, mensagem,
    email_destino, link, data_referencia, resolvido, lido
  )
  select
    f.obra_id,
    'pagamento_cliente_vencido',
    'pagamento_cliente_vencido:' || f.id::text || ':' ||
      case when coalesce(cfg.repetir_vencidos_diariamente, true)
           then current_date::text else f.data_vencimento::text end,
    'Pagamento do cliente vencido',
    'critico',
    'Obra: ' || coalesce(o.nome, '—') ||
    ' · Evento: ' || coalesce(f.evento, '—') ||
    ' · Venceu em: ' || to_char(f.data_vencimento, 'DD/MM/YYYY') ||
    ' · Valor: ' || to_char(coalesce(f.valor_liquido, 0), 'FM999G999G999D00'),
    coalesce(nullif(cfg.email_financeiro, ''), nullif(cfg.email_gestor, '')),
    '/obras/' || f.obra_id::text,
    f.data_vencimento,
    false,
    false
  from faturamentos f
  join obras o on o.id = f.obra_id
  where f.tipo_movimento = 'entrada'
    and f.status not in ('Recebido', 'Cancelado')
    and f.data_vencimento < current_date
  on conflict (chave_unica) where chave_unica is not null
  do update set mensagem = excluded.mensagem, resolvido = false;

  -- D. Fornecedor aguardando liberação para faturar
  insert into alertas (
    obra_id, tipo, chave_unica, titulo, nivel, mensagem,
    email_destino, link, data_referencia, resolvido, lido
  )
  select
    p.obra_id,
    'fornecedor_aguardando_liberacao',
    'fornecedor_aguardando_liberacao:' || p.id::text,
    'Fornecedor aguardando liberação para faturar',
    'atencao',
    'Fornecedor: ' || coalesce(c.fornecedor, '—') ||
    ' · Evento: ' || coalesce(p.evento, '—') ||
    ' · Valor: ' || to_char(coalesce(p.valor, 0), 'FM999G999G999D00'),
    nullif(cfg.email_gestor, ''),
    '/obras/' || p.obra_id::text,
    coalesce(p.data_vencimento, p.created_at::date),
    false,
    false
  from pagamentos_fornecedor p
  left join contratos_fornecedor c on c.id = p.contrato_fornecedor_id
  where p.status in ('Aguardando autorização', 'Não iniciado', 'Pendente')
    and p.created_at::date <= current_date - greatest(coalesce(cfg.dias_fornecedor_sem_liberacao, 2), 0)
  on conflict (chave_unica) where chave_unica is not null
  do update set mensagem = excluded.mensagem, resolvido = false;

  -- E. Fornecedor liberado, mas sem NF vinculada
  insert into alertas (
    obra_id, tipo, chave_unica, titulo, nivel, mensagem,
    email_destino, link, data_referencia, resolvido, lido
  )
  select
    p.obra_id,
    'fornecedor_liberado_sem_nf',
    'fornecedor_liberado_sem_nf:' || p.id::text,
    'Fornecedor liberado sem enviar NF',
    'atencao',
    'Fornecedor: ' || coalesce(c.fornecedor, '—') ||
    ' · Evento: ' || coalesce(p.evento, '—') ||
    ' · Liberado em: ' || to_char(coalesce(p.data_autorizacao, p.created_at::date), 'DD/MM/YYYY'),
    coalesce(nullif(c.email_fornecedor, ''), nullif(cfg.email_gestor, '')),
    '/obras/' || p.obra_id::text,
    coalesce(p.data_autorizacao, p.created_at::date),
    false,
    false
  from pagamentos_fornecedor p
  left join contratos_fornecedor c on c.id = p.contrato_fornecedor_id
  where p.status = 'Autorizado'
    and coalesce(p.data_autorizacao, p.created_at::date)
        <= current_date - greatest(coalesce(cfg.dias_fornecedor_sem_nf, 3), 0)
    and not exists (
      select 1
      from faturamentos f
      where f.tipo_movimento = 'saida'
        and f.pagamento_fornecedor_id = p.id
        and f.status <> 'Cancelado'
    )
  on conflict (chave_unica) where chave_unica is not null
  do update set mensagem = excluded.mensagem, resolvido = false;

  -- F. Pagamento do fornecedor próximo do vencimento
  insert into alertas (
    obra_id, tipo, chave_unica, titulo, nivel, mensagem,
    email_destino, link, data_referencia, resolvido, lido
  )
  select
    p.obra_id,
    'pagamento_fornecedor_vencendo',
    'pagamento_fornecedor_vencendo:' || p.id::text || ':' || p.data_vencimento::text,
    'Pagamento do fornecedor próximo do vencimento',
    case
      when p.data_vencimento = current_date then 'critico'
      when p.data_vencimento <= current_date + 2 then 'atencao'
      else 'info'
    end,
    'Fornecedor: ' || coalesce(c.fornecedor, '—') ||
    ' · Evento: ' || coalesce(p.evento, '—') ||
    ' · Vencimento: ' || to_char(p.data_vencimento, 'DD/MM/YYYY') ||
    ' · Valor: ' || to_char(coalesce(p.valor, 0), 'FM999G999G999D00'),
    coalesce(nullif(cfg.email_financeiro, ''), nullif(cfg.email_gestor, '')),
    '/obras/' || p.obra_id::text,
    p.data_vencimento,
    false,
    false
  from pagamentos_fornecedor p
  left join contratos_fornecedor c on c.id = p.contrato_fornecedor_id
  where p.status <> 'Pago'
    and p.data_vencimento is not null
    and p.data_vencimento between current_date
        and current_date + greatest(coalesce(cfg.dias_pagamento_fornecedor, 5), 0)
  on conflict (chave_unica) where chave_unica is not null
  do update set nivel = excluded.nivel, mensagem = excluded.mensagem, resolvido = false;

  -- G. Pagamento do fornecedor vencido
  insert into alertas (
    obra_id, tipo, chave_unica, titulo, nivel, mensagem,
    email_destino, link, data_referencia, resolvido, lido
  )
  select
    p.obra_id,
    'pagamento_fornecedor_vencido',
    'pagamento_fornecedor_vencido:' || p.id::text || ':' ||
      case when coalesce(cfg.repetir_vencidos_diariamente, true)
           then current_date::text else p.data_vencimento::text end,
    'Pagamento do fornecedor vencido',
    'critico',
    'Fornecedor: ' || coalesce(c.fornecedor, '—') ||
    ' · Evento: ' || coalesce(p.evento, '—') ||
    ' · Venceu em: ' || to_char(p.data_vencimento, 'DD/MM/YYYY') ||
    ' · Valor: ' || to_char(coalesce(p.valor, 0), 'FM999G999G999D00'),
    coalesce(nullif(cfg.email_financeiro, ''), nullif(cfg.email_gestor, '')),
    '/obras/' || p.obra_id::text,
    p.data_vencimento,
    false,
    false
  from pagamentos_fornecedor p
  left join contratos_fornecedor c on c.id = p.contrato_fornecedor_id
  where p.status <> 'Pago'
    and p.data_vencimento < current_date
  on conflict (chave_unica) where chave_unica is not null
  do update set mensagem = excluded.mensagem, resolvido = false;

  -- Alertas resolvidos deixam de aparecer como pendentes.
  update alertas
     set lido = true
   where resolvido = true
     and lido = false;

  return (
    select count(*)::integer
    from alertas
    where resolvido = false and lido = false
  );
end;
$$;

grant execute on function processar_alertas() to anon, authenticated;

-- 6. Executa a verificação a cada hora
select cron.unschedule(jobid)
from cron.job
where jobname = 'processar-alertas-gestao-obras';

select cron.schedule(
  'processar-alertas-gestao-obras',
  '0 * * * *',
  $$select public.processar_alertas();$$
);

-- 7. Política de acesso conforme o padrão atual da plataforma
alter table alertas enable row level security;
alter table config_alertas enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'alertas'
      and policyname = 'acesso publico alertas'
  ) then
    create policy "acesso publico alertas"
      on alertas for all using (true) with check (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where tablename = 'config_alertas'
      and policyname = 'acesso publico config_alertas'
  ) then
    create policy "acesso publico config_alertas"
      on config_alertas for all using (true) with check (true);
  end if;
end $$;

-- Processa uma primeira vez imediatamente.
select processar_alertas();
