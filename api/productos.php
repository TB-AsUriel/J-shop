<?php
declare(strict_types=1);

require_once __DIR__ . '/_helpers.php';

const SQL_PRODUCTO = 'SELECT p.id, p.nombre, p.categoria_id AS categoria, p.precio, p.stock, p.imagen,
                            c.nombre AS categoria_nombre, c.icono AS categoria_icono
                     FROM productos p
                     JOIN categorias c ON c.id = p.categoria_id';

function normalizar_producto(array $fila): array
{
    return [
        'id' => (int) $fila['id'],
        'nombre' => $fila['nombre'],
        'categoria' => $fila['categoria'],
        'categoria_nombre' => $fila['categoria_nombre'],
        'categoria_icono' => $fila['categoria_icono'],
        'precio' => (float) $fila['precio'],
        'stock' => (int) $fila['stock'],
        'imagen' => $fila['imagen'],
    ];
}

function obtener_producto(PDO $db, int $id): array
{
    $stmt = $db->prepare(SQL_PRODUCTO . ' WHERE p.id = ? AND p.activo = 1');
    $stmt->execute([$id]);
    $fila = $stmt->fetch();

    if (!$fila) {
        fail('El producto no existe o fue eliminado', 404);
    }

    $producto = normalizar_producto($fila);
    $variantes = cargar_variantes($db, [$id]);
    $producto['variantes'] = $variantes[$id] ?? [];

    return $producto;
}

function cargar_variantes(PDO $db, array $ids): array
{
    if (!$ids) {
        return [];
    }

    $marcas = implode(',', array_fill(0, count($ids), '?'));
    $stmt = $db->prepare(
        "SELECT producto_id, modelo, precio
         FROM producto_variantes
         WHERE producto_id IN ($marcas)
         ORDER BY id"
    );
    $stmt->execute(array_values($ids));

    $porProducto = [];
    foreach ($stmt->fetchAll() as $fila) {
        $porProducto[(int) $fila['producto_id']][] = [
            'modelo' => $fila['modelo'],
            'precio' => (float) $fila['precio'],
        ];
    }

    return $porProducto;
}

function validar_categoria(PDO $db, string $categoria): void
{
    $stmt = $db->prepare('SELECT COUNT(*) FROM categorias WHERE id = ?');
    $stmt->execute([$categoria]);

    if ((int) $stmt->fetchColumn() === 0) {
        fail('La categoría no existe');
    }
}

$db = db();
$metodo = method();

switch ($metodo) {
    case 'GET':
        $filas = $db
            ->query(SQL_PRODUCTO . ' WHERE p.activo = 1 ORDER BY p.id DESC')
            ->fetchAll();

        $productos = array_map('normalizar_producto', $filas);
        $variantes = cargar_variantes($db, array_column($productos, 'id'));

        foreach ($productos as &$producto) {
            $producto['variantes'] = $variantes[$producto['id']] ?? [];
        }
        unset($producto);

        ok($productos);
        break;

    case 'POST':
        $data = body();
        require_fields($data, ['nombre', 'categoria', 'precio', 'stock']);

        $nombre = trim((string) $data['nombre']);
        $categoria = (string) $data['categoria'];
        $precio = is_numeric($data['precio']) ? (float) $data['precio'] : -1;
        $stock = is_numeric($data['stock']) ? (int) $data['stock'] : -1;
        $imagen = isset($data['imagen']) && is_string($data['imagen']) ? $data['imagen'] : null;

        if ($nombre === '') {
            fail('El nombre del producto es obligatorio');
        }
        if ($precio < 0) {
            fail('El precio no puede ser negativo');
        }
        if ($stock < 0) {
            fail('El stock no puede ser negativo');
        }

        validar_categoria($db, $categoria);

        $db->beginTransaction();

        try {
            $stmt = $db->prepare(
                'INSERT INTO productos (nombre, categoria_id, precio, stock, imagen) VALUES (?, ?, ?, ?, ?)'
            );
            $stmt->execute([$nombre, $categoria, $precio, $stock, $imagen]);
            $id = (int) $db->lastInsertId();

            if ($stock > 0) {
                $mov = $db->prepare(
                    'INSERT INTO movimientos_inventario
                        (producto_id, tipo, cantidad, stock_anterior, stock_nuevo, motivo)
                     VALUES (?, ?, ?, ?, ?, ?)'
                );
                $mov->execute([$id, 'entrada', $stock, 0, $stock, 'Alta de producto']);
            }

            $db->commit();
        } catch (Throwable $e) {
            $db->rollBack();
            fail('No se pudo crear el producto: ' . $e->getMessage(), 500);
        }

        ok(obtener_producto($db, $id));
        break;

    case 'PUT':
        $id = (int) (param('id') ?? 0);
        if ($id <= 0) {
            fail('Falta el id del producto');
        }

        $stmt = $db->prepare('SELECT * FROM productos WHERE id = ? AND activo = 1');
        $stmt->execute([$id]);
        $actual = $stmt->fetch();

        if (!$actual) {
            fail('El producto no existe o fue eliminado', 404);
        }

        $data = body();

        $nombre = isset($data['nombre']) ? trim((string) $data['nombre']) : $actual['nombre'];
        $categoria = isset($data['categoria']) ? (string) $data['categoria'] : $actual['categoria_id'];
        $precio = isset($data['precio']) ? (float) $data['precio'] : (float) $actual['precio'];
        $stock = isset($data['stock']) ? (int) $data['stock'] : (int) $actual['stock'];
        $imagen = array_key_exists('imagen', $data) ? $data['imagen'] : $actual['imagen'];

        if ($nombre === '') {
            fail('El nombre del producto es obligatorio');
        }
        if ($precio < 0) {
            fail('El precio no puede ser negativo');
        }
        if ($stock < 0) {
            fail('El stock no puede ser negativo');
        }

        validar_categoria($db, $categoria);

        $db->beginTransaction();

        try {
            $stmt = $db->prepare(
                'UPDATE productos SET nombre = ?, categoria_id = ?, precio = ?, stock = ?, imagen = ? WHERE id = ?'
            );
            $stmt->execute([$nombre, $categoria, $precio, $stock, $imagen, $id]);

            if ($stock !== (int) $actual['stock']) {
                $mov = $db->prepare(
                    'INSERT INTO movimientos_inventario
                        (producto_id, tipo, cantidad, stock_anterior, stock_nuevo, motivo)
                     VALUES (?, ?, ?, ?, ?, ?)'
                );
                $mov->execute([
                    $id,
                    'ajuste',
                    abs($stock - (int) $actual['stock']),
                    (int) $actual['stock'],
                    $stock,
                    'Ajuste manual desde el panel',
                ]);
            }

            $db->commit();
        } catch (Throwable $e) {
            $db->rollBack();
            fail('No se pudo actualizar el producto: ' . $e->getMessage(), 500);
        }

        ok(obtener_producto($db, $id));
        break;

    case 'DELETE':
        $id = (int) (param('id') ?? 0);
        if ($id <= 0) {
            fail('Falta el id del producto');
        }

        $stmt = $db->prepare('UPDATE productos SET activo = 0 WHERE id = ? AND activo = 1');
        $stmt->execute([$id]);

        if ($stmt->rowCount() === 0) {
            fail('El producto no existe o ya fue eliminado', 404);
        }

        ok(['id' => $id, 'eliminado' => true]);
        break;

    default:
        fail('Método no permitido', 405);
}
