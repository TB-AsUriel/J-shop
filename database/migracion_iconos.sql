-- ============================================================
-- Migración J-Shop: iconos SVG de categorías
-- Ejecutar una sola vez sobre la base jshop_db ya existente.
--   mysql -u root jshop_db < database/migracion_iconos.sql
-- ============================================================

USE jshop_db;

UPDATE categorias SET icono = 'headphones' WHERE id = 'audifonos-cable';
UPDATE categorias SET icono = 'music' WHERE id = 'audifonos-inalambricos';
UPDATE categorias SET icono = 'plug' WHERE id = 'cables';
UPDATE categorias SET icono = 'zap' WHERE id = 'cargadores';
UPDATE categorias SET icono = 'smartphone' WHERE id = 'fundas';
UPDATE categorias SET icono = 'watch' WHERE id = 'relojes';
UPDATE categorias SET icono = 'shapes' WHERE id = 'otros';
