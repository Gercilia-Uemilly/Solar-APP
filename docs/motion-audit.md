# Auditoria de Motion — Solar IA

Skill aplicada: `design-motion-principles` (modo **audit**).

## Reconhecimento

- **Tipo de projeto**: ferramenta de produtividade / SaaS dashboard institucional (gestão de ofícios).
- **Stack de motion**: Tailwind + `tailwindcss-animate` + `framer-motion` (sidebar, overlays).
- **Ponderação das lentes**:
  - **Primária — Emil Kowalski** (restrição e velocidade): o operador repete as mesmas ações dezenas de vezes por dia.
  - **Secundária — Jakub Krehel** (polimento de produção): é um sistema em uso real, precisa parecer acabado.
  - **Seletiva — Jhey Tompkins**: só em estados vazios e onboarding (tour guiado).

## Achados e o que foi feito

### Crítico

| # | Achado | Status |
| --- | --- | --- |
| 1 | Nenhum respeito a `prefers-reduced-motion` em todo o sistema — spinners, pulsos e transições rodavam mesmo para quem tem sensibilidade vestibular. | **Corrigido** — bloco global em `src/index.css` zera durações, desliga `animate-spin/pulse/bounce` e força `scroll-behavior: auto`. |
| 2 | Fallback de rota era um spinner centralizado em tela cheia (percepção de travamento a cada navegação). | **Corrigido** — `PageSkeleton` no `Suspense` do `App.tsx`, com a silhueta real da página. |

### Importante

| # | Achado | Status |
| --- | --- | --- |
| 3 | Listas grandes (Banco de Informações, Áudios, Histórico de Respostas) mostravam spinner + "Carregando...", sem indicar a forma do conteúdo. | **Corrigido** — `CardGridSkeleton` / `ListSkeleton`. |
| 4 | Não havia tokens de duração/easing; cada componente escolhia o seu valor. | **Corrigido** — `--motion-fast/base/slow` e `--motion-ease` em `index.css` como fonte única. |
| 5 | Skeletons sem semântica de acessibilidade. | **Corrigido** — `role="status"` + texto em `sr-only` em todos os skeletons. |

### Observações (sem alteração)

- **Indicadores de progresso assíncronos já estão bem cobertos**: exportação, upload ao Drive, geração por IA, transcrição e revisão já trocam o ícone por `Loader2` e desabilitam o botão. Sob `prefers-reduced-motion` o ícone agora fica estático (ainda visível como estado).
- **Lazy loading de rotas já existia** — todas as páginas usam `React.lazy`. Mantido.
- **Anti-slop**: não foram encontrados os padrões típicos de motion gerado por IA (hover-scale em tudo, stagger-spam, springs elásticos em ações utilitárias, blur de entrada). O `hover-scale` do design system é usado com parcimônia — mantido.
- **Duração**: as animações do sistema ficam em 150–300ms, coerente com a lente primária (Emil). Não há animação acima de 300ms em interação frequente.

## Regras para daqui pra frente

1. Carregamento de dados → **skeleton**, nunca spinner de tela cheia.
2. Ação assíncrona → botão desabilitado + indicador de progresso.
3. Animação nova → usar `var(--motion-base)` e `var(--motion-ease)`.
4. Toda animação precisa passar por `prefers-reduced-motion` (já coberto globalmente; não sobrescreva com `!important`).
5. Interação de alta frequência (salvar, filtrar, digitar) → sem animação.