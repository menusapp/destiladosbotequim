-- Align movement_type values with the app: allow 'income'/'expense' and keep compatibility
ALTER TABLE cash_movements DROP CONSTRAINT IF EXISTS cash_movements_movement_type_check;
ALTER TABLE cash_movements
  ADD CONSTRAINT cash_movements_movement_type_check
  CHECK (movement_type IN ('income','expense','entrada','saida','in','out'));
