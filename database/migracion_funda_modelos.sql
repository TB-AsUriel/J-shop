-- ============================================================
-- Migración J-Shop: funda de color con variantes por modelo
-- Ejecutar una sola vez sobre la base jshop_db existente.
--   mysql -u root jshop_db < database/migracion_funda_modelos.sql
-- ============================================================

USE jshop_db;

-- Guardar el modelo elegido en cada línea del pedido
ALTER TABLE pedido_detalle
  ADD COLUMN modelo VARCHAR(60) NULL AFTER nombre_producto;

-- Catálogo de variantes por producto
CREATE TABLE IF NOT EXISTS producto_variantes (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  producto_id INT UNSIGNED NOT NULL,
  modelo VARCHAR(60) NOT NULL,
  precio DECIMAL(10,2) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_variante (producto_id, modelo),
  KEY idx_variante_producto (producto_id),
  CONSTRAINT fk_variante_producto FOREIGN KEY (producto_id)
    REFERENCES productos (id) ON DELETE CASCADE,
  CONSTRAINT chk_variante_precio CHECK (precio >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Consolidar las dos presentaciones en un solo producto
UPDATE productos
SET nombre = 'Funda de color', precio = 100.00, stock = 20, imagen = 'img/funda.jpg'
WHERE id = 7;

-- Desactivar la presentación duplicada (se conserva el historial)
UPDATE productos SET activo = 0 WHERE id = 8;

-- Variantes de la funda de color
INSERT INTO producto_variantes (producto_id, modelo, precio) VALUES
  (7, 'iPhone 11-15', 100.00),
  (7, 'iPhone 16-17', 150.00)
ON DUPLICATE KEY UPDATE precio = VALUES(precio);
