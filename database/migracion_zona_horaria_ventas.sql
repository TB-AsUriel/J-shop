-- ============================================================
-- Migración J-Shop: corrección de zona horaria en ventas
--
-- Las ventas se guardaban con date() de PHP (Europe/Berlin),
-- 7 horas adelantadas respecto a la hora local de MySQL
-- (America/Mexico_City). Se restan 7 horas una sola vez.
-- Ejecutar una sola vez:
--   mysql -u root jshop_db < database/migracion_zona_horaria_ventas.sql
-- ============================================================

USE jshop_db;

UPDATE ventas
SET fecha_venta = DATE_SUB(fecha_venta, INTERVAL 7 HOUR);

UPDATE pedidos
SET fecha_venta = DATE_SUB(fecha_venta, INTERVAL 7 HOUR)
WHERE fecha_venta IS NOT NULL;
