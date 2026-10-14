# Roadmap

- [x] Permitir que operadores visualizem ofícios próprios e dos colegas sem baixar PDF, mantendo edição restrita ao autor/admin — exceção de Issue/PR autorizada.

- [x] Corrigir seleção múltipla e colagem contínua de prints na página Respostas — 8 testes passaram; prévia validada com dois prints selecionados e um terceiro colado.
- [x] Permitir colar e arrastar arquivos em todas as áreas de envio, sem alterar permissões — exceção de Issue/PR autorizada.

- [x] Redefinição de senha corrigida com updateUserById, 2 testes passaram e função publicada — exceção de Issue/PR autorizada nesta tarefa.

- [x] SOS Uberlândia: importação agendada corrigida (token de cron seguro + mescla manual) — matérias atualizadas até 02/09/2026
- [x] Scripts "Mais procurados": Escola/Educação, Saúde e Casas Populares fixadas no topo
- [ ] Validar correção completa do editor: não fechar durante edição, exibir/exportar numeração e impedir fotos duplicadas

- [x] Corrigir erros de verificação das funções (buffers binários e erros desconhecidos): verificação automática OK, 10 testes passaram e prévia abre sem erros.
- [ ] Abrir Issue/PR desta correção — bloqueado por ausência de acesso ao GitHub.
- [x] Sincronizar com a main do GitHub (commit 43b33f2) e publicar a função oficio-pdf-bot — código local já idêntico ao commit; função publicada e respondendo (401 sem o segredo do bot).
