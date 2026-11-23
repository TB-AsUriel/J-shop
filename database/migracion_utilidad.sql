-- ============================================================
-- Migración J-Shop: costos de productos, gastos y utilidad
-- Ejecutar una sola vez sobre la base jshop_db ya existente.
--   mysql -u root jshop_db < database/migracion_utilidad.sql
-- ============================================================

USE jshop_db;

-- Costo del producto (lo que cobra el proveedor)
ALTER TABLE productos
  ADD COLUMN costo DECIMAL(10,2) NOT NULL DEFAULT 0.00 AFTER precio;

ALTER TABLE productos
  ADD CONSTRAINT chk_productos_costo CHECK (costo >= 0);

-- Costos iniciales del proveedor (por id)
UPDATE productos SET costo = 25.00 WHERE id = 1;
UPDATE productos SET costo = 113.00 WHERE id = 2;
UPDATE productos SET costo = 10.00 WHERE id = 3;
UPDATE productos SET costo = 25.00 WHERE id = 4;
UPDATE productos SET costo = 13.50 WHERE id = 5;
UPDATE productos SET costo = 220.00 WHERE id = 6;
UPDATE productos SET costo = 35.00 WHERE id = 7;

-- Respaldo por nombre por si los ids cambiaron
UPDATE productos SET costo = 25.00
  WHERE nombre = 'EarPods con conector Lightning' AND costo = 0;
UPDATE productos SET costo = 113.00
  WHERE (nombre = 'Audífonos Bluetooth con estuche de carga' OR nombre LIKE '%AirPods%') AND costo = 0;
UPDATE productos SET costo = 10.00
  WHERE nombre = 'Cable USB-C a Lightning 1 m' AND costo = 0;
UPDATE productos SET costo = 25.00
  WHERE nombre = 'Cargador de pared 20 W USB-C' AND costo = 0;
UPDATE productos SET costo = 13.50
  WHERE nombre = 'Funda transparente con MagSafe' AND costo = 0;
UPDATE productos SET costo = 220.00
  WHERE nombre = 'Reloj inteligente con llamadas' AND costo = 0;
UPDATE productos SET costo = 35.00
  WHERE nombre LIKE 'Funda de color%' AND costo = 0;

-- Gastos del negocio para calcular la utilidad neta
CREATE TABLE IF NOT EXISTS gastos (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  concepto VARCHAR(150) NOT NULL,
  monto DECIMAL(10,2) NOT NULL,
  fecha DATE NOT NULL,
  creado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_gastos_fecha (fecha),
  CONSTRAINT chk_gastos_monto CHECK (monto >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
