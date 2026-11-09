-- 05/11/2026 Cérebro Fase 2: ofício por cidade. Só acrescenta (3 colunas, 1 cidade, órgãos e roteamento de Uberlândia).
-- Nada existente muda: nas outras 9 cidades só preenche as colunas NOVAS (que estão vazias).
-- Pode rodar duas vezes. Rodar no editor SQL do Lovable Cloud.
-- Desfazer: delete from public.cidades where nome = 'Uberlândia' (apaga os órgãos e o roteamento dela junto);
--           alter table public.orgaos_publicos drop column destinatario, drop column vocativo, drop column tratamento_situacao;

-- ===== Parte 1: colunas novas =====
alter table public.orgaos_publicos add column if not exists destinatario text;
alter table public.orgaos_publicos add column if not exists vocativo text;
-- situação SÓ do tratamento (destinatário/vocativo); a coluna situacao (e-mail/contato) continua como está
alter table public.orgaos_publicos add column if not exists tratamento_situacao text not null default 'conferir';
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'orgaos_tratamento_situacao_chk') then
    alter table public.orgaos_publicos add constraint orgaos_tratamento_situacao_chk check (tratamento_situacao in ('ok', 'conferir'));
  end if;
end $$;

-- ===== Parte 2: Uberlândia (textos IGUAIS ao src/lib/oficioUtils.ts, que é o que gera o ofício hoje) =====
insert into public.cidades (nome, porta_entrada, observacao)
values ('Uberlândia', 'Prefeitura Municipal (Gabinete do Prefeito)', 'Órgãos copiados de src/lib/oficioUtils.ts (SECRETARIAS_CONFIG) em 05/11/2026. E-mails ainda não cadastrados.')
on conflict (nome) do nothing;

insert into public.orgaos_publicos (cidade_id, esfera, nome, sigla, assuntos, destinatario, vocativo, tratamento_situacao, fonte, conferido_em, situacao)
select c.id, v.esfera, v.nome, v.sigla, v.assuntos, v.destinatario, v.vocativo, 'ok', 'src/lib/oficioUtils.ts (SECRETARIAS_CONFIG)', date '2026-11-05', 'sem_email'
from public.cidades c
cross join (values
  ('municipal', 'Administração', null, array[]::text[], 'Ilmo(a). Sr(a). Secretário(a) Municipal de Administração', 'Excelentíssimo(a) Senhor(a) Secretário(a),'),
  ('municipal', 'Agronegócio', null, array['rural'], 'Ilmo(a). Sr(a). Secretário(a) Municipal de Agronegócio', 'Excelentíssimo(a) Senhor(a) Secretário(a),'),
  ('municipal', 'Comunicação', null, array['comunicacao'], 'Ilmo(a). Sr(a). Secretário(a) Municipal de Comunicação', 'Excelentíssimo(a) Senhor(a) Secretário(a),'),
  ('municipal', 'Controladoria-Geral do Município', null, array['ouvidoria'], 'Ilmo(a). Sr(a). Secretário(a) Municipal de Controladoria-Geral do Município', 'Excelentíssimo(a) Senhor(a) Secretário(a),'),
  ('municipal', 'Cultura e Turismo', null, array['esporte_cultura'], 'Ilmo(a). Sr(a). Secretário(a) Municipal de Cultura e Turismo', 'Excelentíssimo(a) Senhor(a) Secretário(a),'),
  ('municipal', 'Desenvolvimento Econômico e Inovação', null, array['emprego'], 'Ilmo(a). Sr(a). Secretário(a) Municipal de Desenvolvimento Econômico e Inovação', 'Excelentíssimo(a) Senhor(a) Secretário(a),'),
  ('municipal', 'Desenvolvimento Social', null, array['assistencia_social'], 'Ilmo(a). Sr(a). Secretário(a) Municipal de Desenvolvimento Social', 'Excelentíssimo(a) Senhor(a) Secretário(a),'),
  ('municipal', 'Educação', null, array['educacao'], 'Ilmo(a). Sr(a). Secretário(a) Municipal de Educação', 'Excelentíssimo(a) Senhor(a) Secretário(a),'),
  ('municipal', 'Finanças', null, array['tributos'], 'Ilmo(a). Sr(a). Secretário(a) Municipal de Finanças', 'Excelentíssimo(a) Senhor(a) Secretário(a),'),
  ('municipal', 'Gestão Ambiental e Sustentabilidade', null, array['meio_ambiente'], 'Ilmo(a). Sr(a). Secretário(a) Municipal de Gestão Ambiental e Sustentabilidade', 'Excelentíssimo(a) Senhor(a) Secretário(a),'),
  ('municipal', 'Gestão Estratégica', null, array[]::text[], 'Ilmo(a). Sr(a). Secretário(a) Municipal de Gestão Estratégica', 'Excelentíssimo(a) Senhor(a) Secretário(a),'),
  ('municipal', 'Governo', null, array[]::text[], 'Ilmo(a). Sr(a). Secretário(a) Municipal de Governo', 'Excelentíssimo(a) Senhor(a) Secretário(a),'),
  ('municipal', 'Habitação', null, array['moradia'], 'Ilmo(a). Sr(a). Secretário(a) Municipal de Habitação', 'Excelentíssimo(a) Senhor(a) Secretário(a),'),
  ('municipal', 'Infraestrutura', null, array['infraestrutura'], 'Ilmo(a). Sr(a). Secretário(a) Municipal de Infraestrutura', 'Excelentíssimo(a) Senhor(a) Secretário(a),'),
  ('municipal', 'Juventude', null, array[]::text[], 'Ilmo(a). Sr(a). Secretário(a) Municipal de Juventude', 'Excelentíssimo(a) Senhor(a) Secretário(a),'),
  ('municipal', 'Planejamento Urbano', null, array['planejamento'], 'Ilmo(a). Sr(a). Secretário(a) Municipal de Planejamento Urbano', 'Excelentíssimo(a) Senhor(a) Secretário(a),'),
  ('municipal', 'Procuradoria-Geral do Município', null, array['juridico'], 'Ilmo(a). Sr(a). Secretário(a) Municipal de Procuradoria-Geral do Município', 'Excelentíssimo(a) Senhor(a) Secretário(a),'),
  ('municipal', 'Saúde', null, array['saude'], 'Ilmo(a). Sr(a). Secretário(a) Municipal de Saúde', 'Excelentíssimo(a) Senhor(a) Secretário(a),'),
  ('municipal', 'Segurança Integrada', null, array['seguranca'], 'Ilmo(a). Sr(a). Secretário(a) Municipal de Segurança Integrada', 'Excelentíssimo(a) Senhor(a) Secretário(a),'),
  ('municipal', 'Serviços Urbanos', null, array['infraestrutura'], 'Ilmo(a). Sr(a). Secretário(a) Municipal de Serviços Urbanos', 'Excelentíssimo(a) Senhor(a) Secretário(a),'),
  ('municipal', 'Trânsito e Transportes (SETTRAN)', 'SETTRAN', array['transito'], 'Ilmo(a). Sr(a). Secretário(a) Municipal de Trânsito e Transportes', 'Excelentíssimo(a) Senhor(a) Secretário(a),'),
  ('municipal', 'ARESAN', 'ARESAN', array[]::text[], 'Sr(a). Diretor(a) Presidente da Agência de Regulação dos Serviços de Saneamento Básico de Uberlândia (ARESAN)', 'Excelentíssimo(a) Senhor(a) Diretor(a) Presidente,'),
  ('municipal', 'DMAE', 'DMAE', array['agua_esgoto'], 'Sr(a). Diretor(a) Geral do Departamento Municipal de Água e Esgoto (DMAE)', 'Excelentíssimo(a) Senhor(a) Diretor(a) Geral,'),
  ('municipal', 'FUTEL', 'FUTEL', array['esporte_cultura'], 'Sr(a). Diretor(a) Geral da Fundação Uberlandense do Turismo (FUTEL)', 'Excelentíssimo(a) Senhor(a) Diretor(a) Geral,'),
  ('municipal', 'IPREMU', 'IPREMU', array[]::text[], 'Sr(a). Diretor(a) Geral do Instituto de Previdência dos Servidores Públicos do Município de Uberlândia (IPREMU)', 'Excelentíssimo(a) Senhor(a) Diretor(a) Geral,'),
  ('municipal', 'EMAM', 'EMAM', array[]::text[], 'Sr(a). Diretor(a) Geral da Empresa Municipal de Apoio e Manutenção (EMAM)', 'Excelentíssimo(a) Senhor(a) Diretor(a) Geral,'),
  ('municipal', 'FERUB', 'FERUB', array['rural'], 'Sr(a). Diretor(a) da Fundação de Excelência Rural de Uberlândia (FERUB)', 'Excelentíssimo(a) Senhor(a) Diretor(a),'),
  ('municipal', 'PRODAUB', 'PRODAUB', array[]::text[], 'Sr(a). Diretor(a) da PRODAUB', 'Excelentíssimo(a) Senhor(a) Diretor(a),'),
  ('municipal', 'PROCON', 'PROCON', array[]::text[], 'Sr(a). Superintendente do PROCON', 'Excelentíssimo(a) Senhor(a) Superintendente,'),
  ('municipal', 'Prefeitura Municipal (Gabinete do Prefeito)', null, array['geral'], 'Excelentíssimo Senhor Prefeito Municipal', 'Excelentíssimo Senhor Prefeito,'),
  ('municipal', 'Câmara Municipal de Uberlândia', null, array['parlamentar'], 'Excelentíssimo(a) Senhor(a) Presidente da Câmara Municipal', 'Excelentíssimo(a) Senhor(a) Vereador(a),'),
  ('estadual', 'DETRAN-MG', 'DETRAN-MG', array[]::text[], 'Sr(a). Diretor(a) do Departamento Estadual de Trânsito de Minas Gerais (DETRAN-MG)', 'Excelentíssimo(a) Senhor(a) Diretor(a),'),
  ('estadual', 'HC/UFU', 'HC/UFU', array[]::text[], 'Diretor(a) e Superintendente do Hospital de Clínicas da Universidade Federal de Uberlândia (HC/UFU)', 'Prezados(as) Senhores(as),'),
  ('estadual', 'DER-MG', 'DER-MG', array[]::text[], 'Sr(a). Coordenador(a) do Departamento de Estradas de Rodagem de Minas Gerais (DER-MG) – 11ª Unidade Regional – Uberlândia', 'Prezados(a) Senhores(a) Coordenador(a),'),
  ('estadual', 'DNIT', 'DNIT', array[]::text[], 'Sr(a). Chefe de Serviço do Departamento Nacional de Infraestrutura de Transportes (DNIT) – Unidade Local de Uberlândia', 'Prezado(a) Senhor(a),'),
  ('estadual', 'Conservatório Estadual de Música Cora Pavan Capparelli', null, array[]::text[], 'Sr(a). Diretor(a) do Conservatório Estadual de Música Cora Pavan Capparelli', 'Excelentíssimo(a) Senhor(a) Diretor(a),'),
  ('estadual', 'Polícia Militar (PMMG)', 'PMMG', array[]::text[], 'Senhor(a) Comandante do Batalhão da Polícia Militar de Minas Gerais (PMMG)', 'Senhor(a) Comandante,'),
  ('estadual', 'Superintendência Regional de Saúde', null, array[]::text[], 'Responsável legal da Superintendência Regional de Saúde', 'Prezado(a) Senhor(a),'),
  ('estadual', 'CEMIG', 'CEMIG', array[]::text[], 'Responsável legal da CEMIG em Uberlândia', 'Prezado(a) Senhor(a),'),
  ('estadual', 'Superintendência Regional de Ensino', null, array[]::text[], 'Senhor(a) Diretor(a) da Superintendência Regional de Ensino', 'Senhor(a) Diretor(a),'),
  ('estadual', 'Ministério Público de Minas Gerais', 'MPMG', array[]::text[], 'Exmo(a) Sr(a) Promotor(a) de Justiça do Ministério Público de Minas Gerais', 'Excelentíssimo(a) Senhor(a) Promotor(a) de Justiça,')
) as v(esfera, nome, sigla, assuntos, destinatario, vocativo)
where c.nome = 'Uberlândia'
  and not exists (select 1 from public.orgaos_publicos o where o.cidade_id = c.id and o.nome = v.nome);

-- roteamento de Uberlândia: assunto -> órgão (Uberlândia ainda não tem e-mails, então não dá pra usar a regra "primeiro com e-mail")
insert into public.roteamento (cidade_id, categoria, orgao_destino_id)
select c.id, r.categoria, (select o.id from public.orgaos_publicos o where o.cidade_id = c.id and o.nome = r.orgao)
from public.cidades c
cross join (values
  ('infraestrutura', 'Serviços Urbanos'), ('transito', 'Trânsito e Transportes (SETTRAN)'), ('agua_esgoto', 'DMAE'),
  ('saude', 'Saúde'), ('educacao', 'Educação'), ('assistencia_social', 'Desenvolvimento Social'),
  ('meio_ambiente', 'Gestão Ambiental e Sustentabilidade'), ('moradia', 'Habitação'), ('seguranca', 'Segurança Integrada'),
  ('planejamento', 'Planejamento Urbano'), ('tributos', 'Finanças'), ('rural', 'Agronegócio'), ('emprego', 'Desenvolvimento Econômico e Inovação'),
  ('esporte_cultura', 'Cultura e Turismo'), ('juridico', 'Procuradoria-Geral do Município'), ('comunicacao', 'Comunicação'),
  ('ouvidoria', 'Controladoria-Geral do Município'), ('parlamentar', 'Câmara Municipal de Uberlândia')
) as r(categoria, orgao)
where c.nome = 'Uberlândia'
on conflict (cidade_id, categoria) do nothing;

-- ===== Parte 3: outras 9 cidades: tratamento no mesmo padrão, situação "conferir" (só onde a coluna nova está vazia) =====
update public.orgaos_publicos o set
  destinatario = case
    when o.nome ~* '^secretaria\s'
      then 'Ilmo(a). Sr(a). Secretário(a) Municipal ' || regexp_replace(regexp_replace(o.nome, '\s*\([^)]*\)', '', 'g'), '^Secretaria\s+(Municipal\s+)?', '', 'i') || ' de ' || c.nome
    else 'Ilmo(a). Sr(a). Responsável pelo(a) ' || regexp_replace(o.nome, '\s*\([^)]*\)', '', 'g') || ' – ' || c.nome || '/MG'
  end,
  vocativo = case when o.nome ~* '^secretaria\s' then 'Excelentíssimo(a) Senhor(a) Secretário(a),' else 'Prezado(a) Senhor(a),' end,
  tratamento_situacao = 'conferir'
from public.cidades c
where c.id = o.cidade_id and c.nome <> 'Uberlândia' and o.destinatario is null;

-- AGENTS.md: tabela nova exige GRANT (fatos_fabao veio da Fase 1)
grant select on public.fatos_fabao, public.fatos_fabao_ok to authenticated;
grant insert, update, delete on public.fatos_fabao to authenticated;

-- ===== Conferência =====
select c.nome, count(*) as orgaos, count(*) filter (where o.tratamento_situacao = 'ok') as tratamento_ok, count(o.destinatario) as com_destinatario
from public.cidades c join public.orgaos_publicos o on o.cidade_id = c.id group by c.nome order by c.nome;
