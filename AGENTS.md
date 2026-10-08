# AGENTS.md — Padrão de trabalho para agentes de IA (qualquer modelo)

Este arquivo é normativo. Qualquer agente de IA que trabalhe neste repositório
(Solar IA — Sistema de Gerenciamento de Mandato) DEVE seguir estas regras.

## 1. Zonas protegidas (NÃO ALTERAR)

As áreas abaixo estão em produção, funcionando e autorizadas. Não refatore,
não "melhore", não renomeie e não mova nada nelas sem pedido explícito do dono:

- **Autenticação e sessão**: `src/hooks/useAuth.tsx`, `src/pages/Auth.tsx`,
  `src/pages/ResetPassword.tsx`, `src/pages/AguardandoAprovacao.tsx`,
  `src/hooks/useSessionTimeout.ts`, `src/integrations/supabase/client.ts`,
  políticas de RLS e roles (`user_roles`, `has_role`).
- **Integração n8n / criação automática de ofícios**:
  `supabase/functions/criar-oficio-whatsapp/`,
  `supabase/functions/auto-generate-oficio-whatsapp/`,
  o trigger Postgres que dispara a geração automática,
  os secrets `INTERNAL_WEBHOOK_SECRET*` e o contrato do header `x-internal-secret`.

Se uma tarefa exigir tocar nessas zonas, **pare e peça autorização** antes.

## 2. Toda tarefa vira uma Issue

Nenhum trabalho começa sem Issue. Tipos válidos:

| Tipo | Label | Prefixo de branch |
| --- | --- | --- |
| Correção de bug | `fix` | `fix/` |
| Melhoria de algo existente | `enhancement` | `feat/` |
| Nova função | `feature` | `feat/` |
| Infra, deps, config, docs | `chore` | `chore/` |

A Issue deve conter: contexto, comportamento atual, comportamento esperado,
critério de aceite e (se UI) print do estado atual.

Nome de branch: `<tipo>/<numero-da-issue>-<slug-curto>`
Exemplos: `fix/12-preview-corta-texto`, `feat/34-filtro-respostas`, `chore/40-biome`.

## 3. Todo deploy passa por Pull Request

- Uma PR por Issue. Nada de push direto na branch principal.
- A descrição da PR **deve** referenciar a Issue: `Closes #12`.
- A PR segue o template em `.github/pull_request_template.md` e precisa conter:
  1. **O que foi alterado**
  2. **Como foi testado**
  3. **Screenshot antes/depois** sempre que houver mudança de UI
- PR só é mergeada com build e testes verdes.
- Merge por squash; a mensagem final segue Conventional Commits.

## 4. Commits

Conventional Commits: `fix: ...`, `feat: ...`, `chore: ...`, `docs: ...`,
`refactor: ...`, `test: ...`. Escopo opcional: `feat(oficios): ...`.

## 5. Padrões técnicos do projeto

- File uploads use scoped `data-file-upload` containers and the shared transfer hook, routing paste/drop through existing input handlers to avoid duplicate uploads and preserve validation.

- Stack: React 18 + Vite + TypeScript + Tailwind + shadcn/ui. Backend: Lovable Cloud (Supabase).
- **Nunca** use cores hardcoded (`text-white`, `bg-[#fff]`). Use os tokens semânticos do design system (`src/index.css`, `tailwind.config.ts`).
- Identidade visual: Solar, primário verde `160 45% 28%`, Merriweather (títulos) / Source Sans 3 (corpo).
- Ofícios: Arial 10pt, espaçamento 1.5, **paridade absoluta entre preview e exportação**.
- Toda tabela nova em `public` exige `GRANT` + RLS + policies na mesma migration.
- Segredos nunca vão para o código nem para o chat.

## 6. Motion e acessibilidade

Toda UI nova ou alterada deve respeitar:

- Skeleton loading em carregamentos de dados (nada de tela em branco).
- Lazy loading de rotas pesadas e imagens.
- Animações de entrada/saída suaves (150–300ms, easing padrão do projeto).
- Indicador de progresso em qualquer ação assíncrona (upload, IA, exportação).
- Respeito a `prefers-reduced-motion`: animações reduzidas ou desligadas.

## 7. Qualidade

- Testes unitários/integração: Vitest. E2E: Playwright.
- Não abra PR com `console.log` de depuração, código morto ou dependência não usada.
- Erros de runtime devem ser reportados à camada de observabilidade, não silenciados.

## 8. Checklist antes de abrir a PR

- [ ] Existe Issue e a PR referencia `Closes #N`
- [ ] Branch com prefixo correto (`fix/`, `feat/`, `chore/`)
- [ ] Nenhuma zona protegida (seção 1) foi tocada
- [ ] Build e testes passando
- [ ] Screenshot antes/depois anexado (se UI)
- [ ] `prefers-reduced-motion` respeitado (se animação)