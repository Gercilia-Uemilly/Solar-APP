-- Remove duplicates from SOS Uberlândia keeping the oldest entry per link
DELETE FROM base_conhecimento a
USING base_conhecimento b
WHERE a.fonte = 'SOS Uberlândia'
  AND b.fonte = 'SOS Uberlândia'
  AND a.link = b.link
  AND a.link IS NOT NULL
  AND a.id > b.id;

-- Add a partial unique index to prevent future duplicates from SOS Uberlândia
CREATE UNIQUE INDEX IF NOT EXISTS base_conhecimento_sos_link_unique
ON base_conhecimento (link)
WHERE fonte = 'SOS Uberlândia' AND link IS NOT NULL;