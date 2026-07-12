-- Define o valor padrão da coluna para false
ALTER TABLE public.orders ALTER COLUMN is_hidden SET DEFAULT false;

-- Corrige todos os pedidos existentes que ficaram com o valor 'NULL' em vez de 'false'
UPDATE public.orders SET is_hidden = false WHERE is_hidden IS NULL;
