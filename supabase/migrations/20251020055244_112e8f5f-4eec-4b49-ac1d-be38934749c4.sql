-- Ensure DELETE/UPDATE realtime payloads include full row for bills
ALTER TABLE public.bills REPLICA IDENTITY FULL;