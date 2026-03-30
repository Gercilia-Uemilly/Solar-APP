UPDATE oficio_numeracao
SET status = 'usado',
    origem_numero = 'planilha'
WHERE ano = 2026
  AND numero <= 586
  AND status = 'disponivel';