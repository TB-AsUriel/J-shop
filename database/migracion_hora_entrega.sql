-- ============================================================
-- Migración J-Shop: hora de entrega del pedido
-- Ejecutar una sola vez:
--   mysql -u root jshop_db < database/migracion_hora_entrega.sql
-- ============================================================

USE jshop_db;

ALTER TABLE pedidos
  ADD COLUMN hora_entrega TIME NULL AFTER fecha_entrega;
