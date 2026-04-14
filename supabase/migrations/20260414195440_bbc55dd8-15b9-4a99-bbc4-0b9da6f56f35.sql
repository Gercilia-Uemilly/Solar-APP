-- Fix ofício 673: "Secretaria de Trânsito e Transportes (SETTRAN)" → correct
UPDATE oficios SET conteudo = REPLACE(conteudo, 'apreciação da Secretaria de Trânsito e Transportes (SETTRAN)', 'apreciação da Secretaria Municipal de Trânsito e Transportes') WHERE id = '8e05e63b-d6a3-4c5f-a464-f279f2e830f7';

-- Fix ofício 689: "Secretaria Trânsito e Transportes (SETTRAN)" → correct
UPDATE oficios SET conteudo = REPLACE(conteudo, 'apreciação da Secretaria Trânsito e Transportes (SETTRAN)', 'apreciação da Secretaria Municipal de Trânsito e Transportes') WHERE id = 'ac895796-db11-423c-9647-7f1e4cee6462';

-- Fix ofício 819: remove "(SETTRAN)" from closing
UPDATE oficios SET conteudo = REPLACE(conteudo, 'apreciação da Secretaria Municipal de Trânsito e Transportes (SETTRAN)', 'apreciação da Secretaria Municipal de Trânsito e Transportes') WHERE id = 'a3c253d2-8d53-47e1-b3fb-eb1364a7bf1c';

-- Fix ofício 672: "HC/UFU" → full name
UPDATE oficios SET conteudo = REPLACE(conteudo, 'apreciação do HC/UFU', 'apreciação do Hospital de Clínicas da Universidade Federal de Uberlândia') WHERE id = 'a92015cb-332c-4aef-996a-b30d8bfbd154';

-- Fix ofício 682: "HC/UFU" → full name
UPDATE oficios SET conteudo = REPLACE(conteudo, 'apreciação do HC/UFU', 'apreciação do Hospital de Clínicas da Universidade Federal de Uberlândia') WHERE id = '9c0bf36c-a936-4307-bb2b-b4234639d8c9';