-- ============================================================
-- Migración J-Shop: nuevas imágenes y precios
-- Ejecutar una sola vez sobre la base jshop_db ya existente.
--   mysql -u root jshop_db < database/migracion_imagenes_precios.sql
-- ============================================================

USE jshop_db;

-- Actualizar precios e imágenes de los productos existentes
UPDATE productos SET precio = 70.00,  imagen = 'img/audifonos-cable.jpg'        WHERE id = 1;
UPDATE productos SET precio = 250.00, imagen = 'img/audifonos-inalambricos.jpeg' WHERE id = 2;
UPDATE productos SET precio = 50.00,  imagen = 'img/cable-tipo-c.jpeg'           WHERE id = 3;
UPDATE productos SET precio = 70.00,  imagen = 'img/cargador-lightning.jpeg'     WHERE id = 4;
UPDATE productos SET nombre = 'Funda transparente con MagSafe',
                     precio = 50.00,
                     imagen = 'img/fundas-transparentes.jpeg'                    WHERE id = 5;
UPDATE productos SET precio = 450.00, imagen = 'img/reloj.jpeg'                  WHERE id = 6;

-- Nuevas presentaciones de fundas de color
INSERT INTO productos (nombre, categoria_id, precio, stock, imagen)
SELECT 'Funda de color iPhone 11-15', 'fundas', 100.00, 10, 'img/funda.jpg' FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM productos WHERE nombre = 'Funda de color iPhone 11-15');

INSERT INTO productos (nombre, categoria_id, precio, stock, imagen)
SELECT 'Funda de color iPhone 16-17', 'fundas', 150.00, 10, 'img/funda.jpg' FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM productos WHERE nombre = 'Funda de color iPhone 16-17');

-- Movimiento de entrada por el stock inicial de las nuevas fundas
INSERT INTO movimientos_inventario (producto_id, tipo, cantidad, stock_anterior, stock_nuevo, motivo)
SELECT p.id, 'entrada', p.stock, 0, p.stock, 'Carga inicial de inventario'
FROM productos p
WHERE p.nombre IN ('Funda de color iPhone 11-15', 'Funda de color iPhone 16-17')
  AND NOT EXISTS (
    SELECT 1 FROM movimientos_inventario m
    WHERE m.producto_id = p.id AND m.motivo = 'Carga inicial de inventario'
  );
