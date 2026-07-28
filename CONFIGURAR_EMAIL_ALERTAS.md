# Configuração opcional de e-mail automático

A central de notificações dentro da plataforma funciona após executar `ATUALIZAR_SUPABASE_ALERTAS.sql`.

Para enviar e-mails automaticamente:

1. Crie uma conta no Resend e valide um domínio/remetente.
2. Instale o Supabase CLI no computador.
3. Dentro da pasta do projeto, conecte ao projeto Supabase:

```bash
supabase login
supabase link --project-ref SEU_PROJECT_REF
```

4. Cadastre os segredos:

```bash
supabase secrets set RESEND_API_KEY="SUA_CHAVE_RESEND"
supabase secrets set ALERT_FROM_EMAIL="Gestão de Obras <alertas@seudominio.com>"
supabase secrets set APP_URL="https://gest-o-de-obras-alpha.vercel.app"
```

5. Publique a função:

```bash
supabase functions deploy enviar-alertas-email --no-verify-jwt
```

6. No painel Supabase, abra **Integrations > Cron** e crie um agendamento para executar a função `enviar-alertas-email` a cada hora.

Sugestão de cron:

```text
5 * * * *
```

A função processa os prazos, envia somente alertas ainda não enviados e limita cada erro a três tentativas.
