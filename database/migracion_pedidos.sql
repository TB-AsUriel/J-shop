-- ============================================================
-- Migración J-Shop: fecha de entrega y lugar en pedidos
-- Ejecutar una sola vez si la base jshop_db ya estaba importada.
--   mysql -u root jshop_db < database/migracion_pedidos.sql
-- ============================================================

USE jshop_db;

ALTER TABLE pedidos
  ADD COLUMN fecha_entrega DATE NULL AFTER fecha_venta;

ALTER TABLE pedidos
  ADD COLUMN lugar VARCHAR(80) NULL AFTER fecha_entrega;
