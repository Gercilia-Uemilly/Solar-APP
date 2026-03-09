-- Clean up existing numero prefixes (remove alpha prefixes)
UPDATE oficios 
SET numero = REGEXP_REPLACE(numero, '^[A-Za-zÀ-ú\.\-\/]+-?\s*', '')
WHERE numero ~ '^[A-Za-zÀ-ú]';