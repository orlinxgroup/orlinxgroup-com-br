# DIRETRIZES DE GOVERNANÇA E POLÍTICA DE ISOLAMENTO — ORLINX ADS

Este repositório (`https://github.com/orlinxgroup/orlinxgroup-com-br`) é o ambiente oficial e exclusivo do portal institucional **ORLINX GROUP** e da plataforma publicitária **ORLINX ADS**.

---

## 1. Escopo Exclusivo de Infraestrutura e Banco de Dados

- **Projeto Supabase Autorizado:** `ulajrvkaqqedwuaiaksp`
- **URL Base:** `https://ulajrvkaqqedwuaiaksp.supabase.co`
- **Repositório GitHub Autorizado:** `https://github.com/orlinxgroup/orlinxgroup-com-br`
- **Branch Ativa de Desenvolvimento:** `develop`

### ⚠️ POLÍTICA DE ISOLAMENTO ESTRITO (PROIBIÇÃO DE REÚSO)
1. **Isolamento de Outros Projetos:** É terminantemente proibido acessar, consultar, referenciar, migrar ou reutilizar qualquer recurso, banco de dados, arquivo `.env`, credenciais, schemas ou chaves originárias de outros repositórios ou projetos (incluindo qualquer versão do ORLINX 2.0).
2. **Independência Operacional:** Toda tabela, política de segurança (RLS), usuário administrativo e telemetria deve ser configurada única e exclusivamente dentro do projeto `ulajrvkaqqedwuaiaksp`.

---

## 2. Princípios de Segurança e Governança de Acesso

1. **Gestão de Segredos:**
   - Nunca expor chaves privilegiadas (`service_role` ou senhas de banco) no código frontend, terminal, logs, histórico do chat ou commits no Git.
   - O frontend utiliza exclusivamente a chave pública anônima (`SUPABASE_ANON_KEY` / publishable key) protegida por **Row Level Security (RLS)**.
   - Variáveis sensíveis do servidor residem exclusivamente no arquivo `.env` local, protegido pelo `.gitignore`.
2. **Políticas de RLS Rigorosas (Sem Concessões Genéricas):**
   - É proibido conceder privilégios administrativos usando `auth.role() = 'authenticated'` de forma ampla. Usuários autenticados comuns NÃO possuem acesso aos dados de outros clientes nem controle administrativo de campanhas.
   - O acesso administrativo exige validação explícita de perfil/função administrativa (`role = 'admin'` verificado na tabela `orx_admins` ou verificação estrita de identidade institucional autorizada).
3. **Cobranças e Pagamentos:**
   - O checkout público automatizado permanece suspenso até que os dados bancários e cadastrais oficiais sejam homologados pela diretoria.
   - Nenhuma chave Pix provisória ou canal de atendimento não validado pode ser apresentado como definitivo.
4. **Proteção da Produção:**
   - Nenhuma alteração pode ser enviada para a branch `main`, DNS ou servidor de produção sem aprovação humana expressa do responsável técnico.
