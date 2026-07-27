-- ============================================================
-- TIBRE GESTÃO DE OBRAS · Schema Supabase v2
-- Cole no SQL Editor do Supabase → Run
-- ============================================================

-- 1. OBRAS
create table if not exists obras (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  cliente text,
  tag text,
  cidade text,
  tipo_obra text,
  peso_kg numeric,
  dona_obra text,
  status text default 'Não iniciada',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 2. FASES DO GANTT
create table if not exists fases (
  id uuid primary key default gen_random_uuid(),
  obra_id uuid references obras(id) on delete cascade,
  nome text not null,
  ordem integer default 0,
  data_inicio date,
  data_inicio_real date,
  data_fim_prevista date,
  data_fim_real date,
  perc_concluido integer default 0,
  responsavel text,
  predecessor_id uuid references fases(id),
  justificativa_atraso text,
  plano_recuperacao text,
  baseline_inicio date,
  baseline_fim_prevista date,
  created_at timestamptz default now()
);

-- 3. CONTRATO DO CLIENTE (dados fixos)
create table if not exists contratos_cliente (
  id uuid primary key default gen_random_uuid(),
  obra_id uuid references obras(id) on delete cascade unique,
  pv_tibre text,
  oc_cliente text,
  valor_total numeric default 0,
  adiantamento_pct numeric default 0.20,
  valor_adiantamento numeric default 0,
  prazo_pagamento_dd integer default 30,
  -- Emails e portais do cliente
  email_nf_cliente text,           -- nfe_ang@adecoagro.com
  email_financeiro_cliente text,   -- financeiro@cliente.com
  email_engenharia_cliente text,   -- engenharia@cliente.com
  portal_nf_cliente text,          -- fornecedor.adecoagro.com
  -- Emails internos Tibre
  email_nf_tibre text default 'nfe@tibre.com.br;compras@tibre.com.br;financeiro@tibre.com.br;fiscal@tibre.com.br',
  email_gestor text,               -- igor@tibre.com.br
  -- Divisão de faturamento
  divisao_estrutura_pct numeric default 0.75,
  divisao_montagem_pct numeric default 0.15,
  divisao_locacao_pct numeric default 0.10,
  -- Condições e retenção
  condicoes_pagamento text,
  retencao_pct numeric default 0,
  cnpj_cliente text,
  ie_cliente text,
  observacoes text,
  created_at timestamptz default now()
);

-- 4. EVENTOS DE FATURAMENTO (fluxo de 5 etapas)
-- Etapas: A emitir → NF emitida → Recebido → Fornecedor autorizado → Fornecedor pago
create table if not exists eventos_faturamento (
  id uuid primary key default gen_random_uuid(),
  obra_id uuid references obras(id) on delete cascade,
  ordem integer default 0,
  evento text not null,
  -- Tipo e divisão de NF
  tipo_nf text,                    -- 'Estrutura' | 'Serviço de Montagem' | 'Locação' | 'Misto'
  pct_evento numeric default 0,    -- % do contrato que este evento representa
  valor_bruto numeric default 0,
  desconto_adiantamento numeric default 0,
  valor_liquido numeric default 0,
  -- NF Tibre → Cliente
  nf_numero text,                  -- número da NF emitida
  nf_serie text,
  data_emissao date,
  data_envio_portal date,
  data_envio_email date,
  data_vencimento date,
  data_recebimento date,
  valor_recebido numeric,
  -- Fluxo de 5 etapas
  status text default 'A emitir',
  -- 'A emitir' | 'NF emitida' | 'Recebido' | 'Fornecedor autorizado' | 'Fornecedor pago'
  data_autorizacao_fornecedor date,-- quando Igor autorizou o fornecedor a faturar
  observacoes text,
  created_at timestamptz default now()
);

-- 5. CONTRATOS FORNECEDORES
create table if not exists contratos_fornecedor (
  id uuid primary key default gen_random_uuid(),
  obra_id uuid references obras(id) on delete cascade,
  tipo text not null,              -- 'Montadora' | 'Supervisor' | 'Seguro' | 'Outro'
  fornecedor text not null,
  pc_tibre text,                   -- número do PC da Tibre
  valor_contrato numeric default 0,
  prazo_pagamento_dd integer default 15,
  -- Emails
  email_fornecedor text,           -- para onde enviar a autorização de faturamento
  email_nf_fornecedor text,        -- para onde o fornecedor envia a NF dele
  -- Condições
  condicoes text,
  observacoes text,
  created_at timestamptz default now()
);

-- 6. PAGAMENTOS AOS FORNECEDORES
create table if not exists pagamentos_fornecedor (
  id uuid primary key default gen_random_uuid(),
  obra_id uuid references obras(id),
  contrato_fornecedor_id uuid references contratos_fornecedor(id) on delete cascade,
  evento_faturamento_id uuid references eventos_faturamento(id), -- vinculado ao BM correspondente
  evento text,
  -- NF do fornecedor contra Tibre
  nf_numero_fornecedor text,
  nf_serie_fornecedor text,
  data_nf_fornecedor date,
  data_recebimento_nf date,        -- quando Tibre recebeu a NF do fornecedor
  valor numeric default 0,
  -- Pagamento
  data_vencimento date,
  data_pagamento date,
  status text default 'Aguardando autorização',
  -- 'Aguardando autorização' | 'Autorizado' | 'NF recebida' | 'Pago'
  observacoes text,
  created_at timestamptz default now()
);

-- 7. PEDIDOS DE COMPRA
create table if not exists pedidos (
  id uuid primary key default gen_random_uuid(),
  obra_id uuid references obras(id),
  solicitacao text,
  fornecedor text,
  data_abertura date,
  data_aprovacao date,
  status text default 'Aberta',
  pc_numero text,
  nf_numero text,
  valor numeric,
  verba numeric,
  conta_contabil text,
  ccusto text,
  narrativa text,
  data_pagamento date,
  created_at timestamptz default now()
);

-- 8. ALERTAS (histórico de alertas disparados)
create table if not exists alertas (
  id uuid primary key default gen_random_uuid(),
  obra_id uuid references obras(id) on delete cascade,
  tipo text not null,
  -- 'bm_vencido' | 'recebido_autorizar' | 'fornecedor_nao_faturou' | 'pagamento_vencendo' | 'fase_atrasada'
  mensagem text,
  email_destino text,
  enviado boolean default false,
  data_envio timestamptz,
  lido boolean default false,
  created_at timestamptz default now()
);

-- 9. CONFIGURAÇÃO DE ALERTAS (global)
create table if not exists config_alertas (
  id uuid primary key default gen_random_uuid(),
  -- Emails que recebem alertas
  email_gestor text default 'igor@tibre.com.br',
  email_financeiro text default 'financeiro@tibre.com.br',
  -- Dias para cada alerta
  dias_alerta_bm_vencido integer default 3,         -- alertar X dias após vencimento sem recebimento
  dias_alerta_pagamento_vencendo integer default 3,  -- alertar X dias antes do vencimento do fornecedor
  dias_alerta_fornecedor_sem_nf integer default 5,  -- alertar X dias após autorização sem NF do fornecedor
  created_at timestamptz default now()
);

-- Inserir configuração padrão
insert into config_alertas (email_gestor, email_financeiro)
values ('igor@tibre.com.br', 'financeiro@tibre.com.br')
on conflict do nothing;

-- ── POLÍTICAS DE ACESSO PÚBLICO ────────────────────────────────────────────
alter table obras enable row level security;
alter table fases enable row level security;
alter table contratos_cliente enable row level security;
alter table eventos_faturamento enable row level security;
alter table contratos_fornecedor enable row level security;
alter table pagamentos_fornecedor enable row level security;
alter table pedidos enable row level security;
alter table alertas enable row level security;
alter table config_alertas enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename='obras' and policyname='acesso publico obras') then
    create policy "acesso publico obras" on obras for all using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where tablename='fases' and policyname='acesso publico fases') then
    create policy "acesso publico fases" on fases for all using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where tablename='contratos_cliente' and policyname='acesso publico contratos_cliente') then
    create policy "acesso publico contratos_cliente" on contratos_cliente for all using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where tablename='eventos_faturamento' and policyname='acesso publico eventos_faturamento') then
    create policy "acesso publico eventos_faturamento" on eventos_faturamento for all using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where tablename='contratos_fornecedor' and policyname='acesso publico contratos_fornecedor') then
    create policy "acesso publico contratos_fornecedor" on contratos_fornecedor for all using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where tablename='pagamentos_fornecedor' and policyname='acesso publico pagamentos_fornecedor') then
    create policy "acesso publico pagamentos_fornecedor" on pagamentos_fornecedor for all using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where tablename='pedidos' and policyname='acesso publico pedidos') then
    create policy "acesso publico pedidos" on pedidos for all using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where tablename='alertas' and policyname='acesso publico alertas') then
    create policy "acesso publico alertas" on alertas for all using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where tablename='config_alertas' and policyname='acesso publico config_alertas') then
    create policy "acesso publico config_alertas" on config_alertas for all using (true) with check (true);
  end if;
end $$;


-- 10. FATURAMENTOS UNIFICADOS (ENTRADAS E SAÍDAS)
-- ============================================================
-- ATUALIZAÇÃO FINANCEIRO / FATURAMENTO / FORNECEDORES
-- Execute uma única vez no Supabase > SQL Editor > New query
-- Este script pode ser executado novamente com segurança.
-- ============================================================

-- 1. Competência dos pagamentos previstos dos fornecedores
alter table if exists pagamentos_fornecedor
  add column if not exists competencia text;

-- 2. Tabela exclusiva para notas fiscais e faturamentos reais
create table if not exists faturamentos (
  id uuid primary key default gen_random_uuid(),
  obra_id uuid not null references obras(id) on delete cascade,
  tipo_movimento text not null default 'entrada',
  contrato_fornecedor_id uuid references contratos_fornecedor(id) on delete set null,
  pagamento_fornecedor_id uuid references pagamentos_fornecedor(id) on delete set null,
  origem_evento_id uuid references eventos_faturamento(id) on delete set null,
  cliente_fornecedor text,
  evento text not null default 'Novo faturamento',
  competencia text,
  tipo_nf text,
  nf_numero text,
  data_emissao date,
  data_vencimento date,
  data_baixa date,
  valor_bruto numeric not null default 0,
  descontos numeric not null default 0,
  valor_liquido numeric not null default 0,
  valor_baixado numeric not null default 0,
  status text not null default 'Previsto',
  observacoes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Garante as colunas mesmo se a tabela já foi criada anteriormente
alter table faturamentos add column if not exists tipo_movimento text default 'entrada';
alter table faturamentos add column if not exists contrato_fornecedor_id uuid references contratos_fornecedor(id) on delete set null;
alter table faturamentos add column if not exists pagamento_fornecedor_id uuid references pagamentos_fornecedor(id) on delete set null;
alter table faturamentos add column if not exists origem_evento_id uuid references eventos_faturamento(id) on delete set null;
alter table faturamentos add column if not exists cliente_fornecedor text;
alter table faturamentos add column if not exists evento text default 'Novo faturamento';
alter table faturamentos add column if not exists competencia text;
alter table faturamentos add column if not exists tipo_nf text;
alter table faturamentos add column if not exists nf_numero text;
alter table faturamentos add column if not exists data_emissao date;
alter table faturamentos add column if not exists data_vencimento date;
alter table faturamentos add column if not exists data_baixa date;
alter table faturamentos add column if not exists valor_bruto numeric default 0;
alter table faturamentos add column if not exists descontos numeric default 0;
alter table faturamentos add column if not exists valor_liquido numeric default 0;
alter table faturamentos add column if not exists valor_baixado numeric default 0;
alter table faturamentos add column if not exists status text default 'Previsto';
alter table faturamentos add column if not exists observacoes text;
alter table faturamentos add column if not exists created_at timestamptz default now();
alter table faturamentos add column if not exists updated_at timestamptz default now();

-- Validação do tipo de movimento
alter table faturamentos drop constraint if exists faturamentos_tipo_movimento_check;
alter table faturamentos
  add constraint faturamentos_tipo_movimento_check
  check (tipo_movimento in ('entrada', 'saida'));

-- Índices
create index if not exists idx_faturamentos_obra on faturamentos(obra_id);
create index if not exists idx_faturamentos_tipo on faturamentos(tipo_movimento);
create index if not exists idx_faturamentos_competencia on faturamentos(competencia);
create index if not exists idx_faturamentos_fornecedor on faturamentos(contrato_fornecedor_id);
create index if not exists idx_faturamentos_pagamento on faturamentos(pagamento_fornecedor_id);
create unique index if not exists idx_faturamentos_origem_evento
  on faturamentos(origem_evento_id)
  where origem_evento_id is not null;

-- Atualização automática de updated_at
create or replace function set_faturamentos_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_faturamentos_updated_at on faturamentos;
create trigger trg_faturamentos_updated_at
before update on faturamentos
for each row execute function set_faturamentos_updated_at();

-- 3. Migra os faturamentos antigos do cliente, sem duplicar registros
insert into faturamentos (
  obra_id,
  tipo_movimento,
  origem_evento_id,
  cliente_fornecedor,
  evento,
  competencia,
  tipo_nf,
  nf_numero,
  data_emissao,
  data_vencimento,
  data_baixa,
  valor_bruto,
  descontos,
  valor_liquido,
  valor_baixado,
  status,
  observacoes,
  created_at
)
select
  e.obra_id,
  'entrada',
  e.id,
  coalesce(o.cliente, o.dona_obra, 'Cliente'),
  e.evento,
  coalesce(to_char(e.data_vencimento, 'YYYY-MM'), to_char(e.data_emissao, 'YYYY-MM')),
  e.tipo_nf,
  e.nf_numero,
  e.data_emissao,
  e.data_vencimento,
  e.data_recebimento,
  coalesce(e.valor_bruto, 0),
  coalesce(e.desconto_adiantamento, 0),
  coalesce(e.valor_liquido, e.valor_bruto, 0),
  coalesce(e.valor_recebido, 0),
  case
    when e.status = 'Recebido' then 'Recebido'
    when e.status in ('Emitido', 'NF emitida') then 'Emitido'
    when e.status = 'Vencido' then 'Vencido'
    when e.status = 'Cancelado' then 'Cancelado'
    else 'A emitir'
  end,
  e.observacoes,
  coalesce(e.created_at, now())
from eventos_faturamento e
join obras o on o.id = e.obra_id
where not exists (
  select 1 from faturamentos f where f.origem_evento_id = e.id
);

-- 4. Segurança de acesso no mesmo padrão atual do projeto
alter table faturamentos enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'faturamentos'
      and policyname = 'acesso publico faturamentos'
  ) then
    create policy "acesso publico faturamentos"
      on faturamentos for all
      using (true)
      with check (true);
  end if;
end $$;
