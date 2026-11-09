# Preparação Google Pay / Woovi / Neon

O botão está integrado ao modal de proposta protocolada de anuncie.html e publicidade.html.
Por padrão permanece oculto. O endpoint GET /api/payments/google-pay/config retorna enabled:false.
Para demonstrar em ambiente local: definir GOOGLE_PAY_TEST_ENABLED=true e executar node server.cjs.
NODE_ENV=production bloqueia a demonstração mesmo com a flag ligada. O servidor não lê .env automaticamente:
usar variáveis do processo ou node --env-file=.env server.cjs.

O SDK oficial usa createButton, isReadyToPay e loadPaymentData exclusivamente em TEST, com o gateway
example fornecido pelo Google. Não representa uma conexão à Woovi. A resposta de teste é descartada:
não gravamos token, cartão, CPF, dados pessoais nem marcamos proposta como paga.
O navegador carrega o SDK somente após autorização da configuração de teste. Falhas mantêm o espaço oculto.

## Armazenamento

GitHub: código, testes e migrações. Neon: futuros eventos de pagamento no schema orlinx_payments.
Uso do Neon para esta integração foi solicitado expressamente pelo responsável nesta tarefa.
Os dados e a autenticação existentes permanecem intactos. Não importar recursos de outros projetos ORLINX.
Projeto Neon indicado pelo responsável: solitary-scene-22116050 (orlinx-marketplace-hub-sa).
Migração aplicada e repetida com sucesso na branch dev-test (br-falling-heart-b6tx4els), banco neondb.
A criação de uma branch schema-only foi recusada devido à role legada anonymous; utilizou-se a branch
de testes existente, sem consultar dados de outros schemas. A branch production não foi alterada.
Um evento sintético TEST de R$ 1,00 foi persistido para validar o armazenamento; não representa cobrança.
Foram validados repetição idempotente, conflito de conteúdo e bloqueio de UPDATE, DELETE e TRUNCATE.
PAYMENTS_DATABASE_URL deve ficar somente no servidor. Usar conexão pooled para aplicação e direta para migração.

001_payment_events.sql prepara eventos append-only, sem dados bancários ou tokens. Validar primeiro em uma
branch Neon isolada do projeto escolhido. Criar role de runtime com somente USAGE no schema e SELECT/INSERT
na tabela, sem propriedade, DDL, UPDATE, DELETE ou TRUNCATE. O proprietário ainda pode alterar os gatilhos;
isto não constitui armazenamento WORM nem proteção contra o administrador do banco.
createPaymentStore recebe um cliente Postgres com query(text, values), com SQL parametrizado e idempotência
por event_id. Ainda não está ligado às rotas públicas: somente um backend com confirmação autenticada do
processador poderá produzir eventos de pagamento. Não usar a resposta do navegador como prova de quitação.

## Pendências para produção

- Homologar cadastro e conta de liquidação (banco indicado: 301 / Dock; sem agência/conta homologadas).
- Confirmar com Woovi o suporte técnico ao token Google Pay, gateway e gatewayMerchantId, ou optar por seu checkout hospedado.
- Obter merchantId e aprovação do domínio no Google Pay. Não inferir merchantId a partir da URL do console.
- Implementar processamento servidor a servidor com pedido/preço validados no servidor, autorização de acesso,
  idempotência, webhook autenticado, conciliação e tratamento de falhas antes de liberar PRODUCTION.
- Criar uma credencial de runtime com privilégios mínimos e conectar o processamento confirmado ao Neon.
  A persistência foi testada diretamente; o botão de demonstração não grava dados nem realiza pagamentos.
- Revisar transparência e retenção dos dados do novo fluxo antes de coletar dados reais.
- Publicação em produção depende de aprovação expressa conforme AGENTS.md.

Referências:
- https://developers.google.com/pay/api/web/guides/tutorial
- https://developers.google.com/pay/api/web/guides/brand-guidelines
- https://developers.woovi.com/docs/card/card-first-steps
- https://developers.woovi.com/docs/card/card-how-to-create-charge-using-api

Validação local: node --test tests/google_pay_test.cjs
Validação Neon: scripts/validate_neon_payments.cjs, com conexão direta em PAYMENTS_DATABASE_URL e
PAYMENTS_MIGRATION_BRANCH=br-falling-heart-b6tx4els; PAYMENTS_MIGRATION_HOST deve ser o host verificado
da conexão retornada pela CLI para essa branch. Credenciais não são versionadas.
Testes de navegador com carteira real e homologação Google/Woovi ainda não foram realizados.
Não chamar suites legadas que enviam e-mails, uploads ou alteram serviços externos para validar esta preparação.
