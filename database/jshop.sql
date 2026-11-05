-- ============================================================
-- Base de datos J-Shop
-- Importar desde phpMyAdmin (XAMPP) o ejecutar:
--   mysql -u root < database/jshop.sql
-- ============================================================

CREATE DATABASE IF NOT EXISTS jshop_db
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE jshop_db;

SET FOREIGN_KEY_CHECKS = 0;
DROP VIEW IF EXISTS vw_inventario_bajo;
DROP VIEW IF EXISTS vw_ventas;
DROP TABLE IF EXISTS movimientos_inventario;
DROP TABLE IF EXISTS ventas;
DROP TABLE IF EXISTS pedido_detalle;
DROP TABLE IF EXISTS pedidos;
DROP TABLE IF EXISTS productos;
DROP TABLE IF EXISTS categorias;
SET FOREIGN_KEY_CHECKS = 1;

-- ------------------------------------------------------------
-- Categorías
-- ------------------------------------------------------------
CREATE TABLE categorias (
  id VARCHAR(40) NOT NULL,
  nombre VARCHAR(80) NOT NULL,
  icono VARCHAR(16) NOT NULL DEFAULT '',
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- Productos / inventario
-- ------------------------------------------------------------
CREATE TABLE productos (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  nombre VARCHAR(150) NOT NULL,
  categoria_id VARCHAR(40) NOT NULL,
  precio DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  stock INT NOT NULL DEFAULT 0,
  imagen MEDIUMTEXT NULL,
  activo TINYINT(1) NOT NULL DEFAULT 1,
  creado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  actualizado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_productos_categoria (categoria_id),
  KEY idx_productos_activo (activo),
  CONSTRAINT fk_productos_categoria FOREIGN KEY (categoria_id) REFERENCES categorias (id) ON UPDATE CASCADE,
  CONSTRAINT chk_productos_precio CHECK (precio >= 0),
  CONSTRAINT chk_productos_stock CHECK (stock >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- Pedidos
-- ------------------------------------------------------------
CREATE TABLE pedidos (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  folio VARCHAR(30) NOT NULL,
  cliente VARCHAR(150) NOT NULL,
  fecha DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  estado ENUM('pendiente','completado','cancelado') NOT NULL DEFAULT 'pendiente',
  total DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  fecha_venta DATETIME NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_pedidos_folio (folio),
  KEY idx_pedidos_estado (estado),
  KEY idx_pedidos_fecha (fecha),
  KEY idx_pedidos_fecha_venta (fecha_venta)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- Detalle de pedidos (snapshot de nombre y precio)
-- ------------------------------------------------------------
CREATE TABLE pedido_detalle (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  pedido_id INT UNSIGNED NOT NULL,
  producto_id INT UNSIGNED NULL,
  nombre_producto VARCHAR(150) NOT NULL,
  precio_unitario DECIMAL(10,2) NOT NULL,
  cantidad INT NOT NULL,
  subtotal DECIMAL(10,2) NOT NULL,
  PRIMARY KEY (id),
  KEY idx_detalle_pedido (pedido_id),
  KEY idx_detalle_producto (producto_id),
  CONSTRAINT fk_detalle_pedido FOREIGN KEY (pedido_id) REFERENCES pedidos (id) ON DELETE CASCADE,
  CONSTRAINT fk_detalle_producto FOREIGN KEY (producto_id) REFERENCES productos (id) ON DELETE SET NULL,
  CONSTRAINT chk_detalle_cantidad CHECK (cantidad > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- Ventas (registro de pedidos completados)
-- ------------------------------------------------------------
CREATE TABLE ventas (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  pedido_id INT UNSIGNED NOT NULL,
  fecha_venta DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  total DECIMAL(10,2) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_ventas_pedido (pedido_id),
  KEY idx_ventas_fecha (fecha_venta),
  CONSTRAINT fk_ventas_pedido FOREIGN KEY (pedido_id) REFERENCES pedidos (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- Movimientos de inventario
-- ------------------------------------------------------------
CREATE TABLE movimientos_inventario (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  producto_id INT UNSIGNED NOT NULL,
  tipo ENUM('entrada','salida','ajuste') NOT NULL,
  cantidad INT NOT NULL,
  stock_anterior INT NOT NULL,
  stock_nuevo INT NOT NULL,
  motivo VARCHAR(150) NULL,
  pedido_id INT UNSIGNED NULL,
  fecha DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_mov_producto (producto_id),
  KEY idx_mov_fecha (fecha),
  KEY idx_mov_pedido (pedido_id),
  CONSTRAINT fk_mov_producto FOREIGN KEY (producto_id) REFERENCES productos (id) ON DELETE CASCADE,
  CONSTRAINT fk_mov_pedido FOREIGN KEY (pedido_id) REFERENCES pedidos (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- Vistas para reportes
-- ------------------------------------------------------------
CREATE OR REPLACE VIEW vw_ventas AS
SELECT v.id AS venta_id,
       p.id AS pedido_id,
       p.folio,
       p.cliente,
       v.fecha_venta,
       v.total
FROM ventas v
JOIN pedidos p ON p.id = v.pedido_id;

CREATE OR REPLACE VIEW vw_inventario_bajo AS
SELECT id, nombre, stock, precio
FROM productos
WHERE activo = 1 AND stock <= 5
ORDER BY stock ASC;

-- ------------------------------------------------------------
-- Datos iniciales: categorías
-- ------------------------------------------------------------
INSERT INTO categorias (id, nombre, icono) VALUES
('audifonos-cable', 'Audífonos con cable', '🎧'),
('audifonos-inalambricos', 'Audífonos inalámbricos', '🎵'),
('cables', 'Cables', '🔌'),
('cargadores', 'Cargadores', '⚡'),
('fundas', 'Fundas', '📱'),
('relojes', 'Relojes', '⌚'),
('otros', 'Otros', '🧩');

-- ------------------------------------------------------------
-- Datos iniciales: productos
-- ------------------------------------------------------------
INSERT INTO productos (id, nombre, categoria_id, precio, stock, imagen) VALUES
(1, 'EarPods con conector Lightning', 'audifonos-cable', 450.00, 12, 'img/earpods.jpg'),
(2, 'Audífonos Bluetooth con estuche de carga', 'audifonos-inalambricos', 899.00, 8, 'img/audifonos-bt.jpg'),
(3, 'Cable USB-C a Lightning 1 m', 'cables', 249.00, 25, 'img/cable.jpg'),
(4, 'Cargador de pared 20 W USB-C', 'cargadores', 329.00, 15, 'img/cargador.jpg'),
(5, 'Funda de silicón transparente', 'fundas', 199.00, 3, 'img/funda.jpg'),
(6, 'Reloj inteligente con llamadas', 'relojes', 1290.00, 5, 'img/reloj.jpg');

-- Movimientos iniciales de entrada por la carga de inventario
INSERT INTO movimientos_inventario (producto_id, tipo, cantidad, stock_anterior, stock_nuevo, motivo)
SELECT id, 'entrada', stock, 0, stock, 'Carga inicial de inventario'
FROM productos
WHERE stock > 0;
