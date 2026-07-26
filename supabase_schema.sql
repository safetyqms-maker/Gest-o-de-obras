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
