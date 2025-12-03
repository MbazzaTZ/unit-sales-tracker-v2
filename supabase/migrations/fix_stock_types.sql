-- Fix existing stock records to use short codes instead of full text
UPDATE stock
SET type = 'FS'
WHERE type LIKE '%Full Set%' OR type = 'FS';

UPDATE stock
SET type = 'DO'
WHERE type LIKE '%Decoder Only%' OR type = 'DO';

UPDATE stock
SET type = 'DVS'
WHERE type LIKE '%Digital Virtual Stock%' OR type = 'DVS';
