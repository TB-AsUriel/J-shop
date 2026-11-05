<?php
declare(strict_types=1);

require_once __DIR__ . '/_helpers.php';

function normalizar_pedido(array $pedido, array $items): array
{
    return [
        'id' => (int) $pedido['id'],
        'folio' => $pedido['folio'],
        'cliente' => $pedido['cliente'],
        'fecha' => $pedido['fecha'],
        'estado' => $pedido['estado'],
        'total' => (float) $pedido['total'],
        'fechaVenta' => $pedido['fecha_venta'],
        'items' => $items,
    ];
}

function cargar_items(PDO $db, array $idsPedidos): array
{
    if (!$idsPedidos) {
        return [];
    }

    $marcas = implode(',', array_fill(0, count($idsPedidos), '?'));
    $stmt = $db->prepare(
        "SELECT pedido_id, producto_id, nombre_producto, precio_unitario, cantidad
         FROM pedido_detalle
         WHERE pedido_id IN ($marcas)
         ORDER BY id"
    );
    $stmt->execute(array_values($idsPedidos));

    $items = [];
    foreach ($stmt->fetchAll() as $fila) {
        $items[(int) $fila['pedido_id']][] = [
            'id' => $fila['producto_id'] !== null ? (int) $fila['producto_id'] : null,
            'nombre' => $fila['nombre_producto'],
            'precio' => (float) $fila['precio_unitario'],
            'cantidad' => (int) $fila['cantidad'],
        ];
    }

    return $items;
}

$db = db();
$metodo = method();

switch ($metodo) {
    case 'GET':
        $estado = param('estado');
        $permitidos = ['pendiente', 'completado', 'cancelado'];

        if ($estado !== null && !in_array($estado, $permitidos, true)) {
            fail('Estado no válido');
        }

        $sql = 'SELECT id, folio, cliente, fecha, estado, total, fecha_venta FROM pedidos';
        $params = [];

        if ($estado !== null) {
            $sql .= ' WHERE estado = ?';
            $params[] = $estado;
        }

        $sql .= ' ORDER BY fecha DESC, id DESC';

        $stmt = $db->prepare($sql);
        $stmt->execute($params);
        $pedidos = $stmt->fetchAll();
        $porPedido = cargar_items($db, array_column($pedidos, 'id'));

        $salida = array_map(
            static fn(array $p): array => normalizar_pedido($p, $porPedido[(int) $p['id']] ?? []),
            $pedidos
        );

        ok($salida);
        break;

    case 'POST':
        $data = body();
        require_fields($data, ['cliente', 'items']);

        $cliente = trim((string) $data['cliente']);
        $items = $data['items'];

        if ($cliente === '') {
            fail('Escribe el nombre del cliente');
        }
        if (!is_array($items) || count($items) === 0) {
            fail('El pedido no tiene productos');
        }

        $db->beginTransaction();

        try {
            $lineas = [];
            $total = 0.0;
            $stmtProducto = $db->prepare(
                'SELECT id, nombre, precio, stock, activo FROM productos WHERE id = ? FOR UPDATE'
            );

            foreach ($items as $item) {
                $productoId = (int) ($item['id'] ?? 0);
                $cantidad = (int) ($item['cantidad'] ?? 0);

                if ($productoId <= 0 || $cantidad <= 0) {
                    throw new RuntimeException('Producto o cantidad inválida');
                }

                $stmtProducto->execute([$productoId]);
                $producto = $stmtProducto->fetch();

                if (!$producto || (int) $producto['activo'] !== 1) {
                    throw new RuntimeException('Un producto del pedido ya no está disponible');
                }
                if ($cantidad > (int) $producto['stock']) {
                    throw new RuntimeException('Stock insuficiente de: ' . $producto['nombre']);
                }

                $precio = (float) $producto['precio'];
                $subtotal = round($precio * $cantidad, 2);
                $total += $subtotal;

                $lineas[] = [
                    'id' => $productoId,
                    'nombre' => $producto['nombre'],
                    'precio' => $precio,
                    'cantidad' => $cantidad,
                    'subtotal' => $subtotal,
                ];
            }

            $folio = 'P' . date('YmdHis') . strtoupper(substr(bin2hex(random_bytes(2)), 0, 3));

            $stmtPedido = $db->prepare(
                'INSERT INTO pedidos (folio, cliente, estado, total) VALUES (?, ?, ?, ?)'
            );
            $stmtPedido->execute([$folio, $cliente, 'pendiente', round($total, 2)]);
            $pedidoId = (int) $db->lastInsertId();

            $stmtDetalle = $db->prepare(
                'INSERT INTO pedido_detalle
                    (pedido_id, producto_id, nombre_producto, precio_unitario, cantidad, subtotal)
                 VALUES (?, ?, ?, ?, ?, ?)'
            );

            foreach ($lineas as $linea) {
                $stmtDetalle->execute([
                    $pedidoId,
                    $linea['id'],
                    $linea['nombre'],
                    $linea['precio'],
                    $linea['cantidad'],
                    $linea['subtotal'],
                ]);
            }

            $db->commit();
        } catch (RuntimeException $e) {
            $db->rollBack();
            fail($e->getMessage());
        } catch (Throwable $e) {
            $db->rollBack();
            fail('No se pudo registrar el pedido: ' . $e->getMessage(), 500);
        }

        $stmtFecha = $db->prepare('SELECT fecha FROM pedidos WHERE id = ?');
        $stmtFecha->execute([$pedidoId]);

        ok([
            'id' => $pedidoId,
            'folio' => $folio,
            'cliente' => $cliente,
            'fecha' => $stmtFecha->fetchColumn(),
            'estado' => 'pendiente',
            'total' => round($total, 2),
            'fechaVenta' => null,
            'items' => array_map(static function (array $l): array {
                return [
                    'id' => $l['id'],
                    'nombre' => $l['nombre'],
                    'precio' => $l['precio'],
                    'cantidad' => $l['cantidad'],
                ];
            }, $lineas),
        ]);
        break;

    case 'PUT':
        $id = (int) (param('id') ?? 0);
        if ($id <= 0) {
            fail('Falta el id del pedido');
        }

        $accion = (string) (body()['accion'] ?? '');

        if ($accion === 'vender') {
            $db->beginTransaction();

            try {
                $stmt = $db->prepare('SELECT * FROM pedidos WHERE id = ? FOR UPDATE');
                $stmt->execute([$id]);
                $pedido = $stmt->fetch();

                if (!$pedido) {
                    throw new RuntimeException('El pedido no existe');
                }
                if ($pedido['estado'] !== 'pendiente') {
                    throw new RuntimeException('El pedido ya fue procesado');
                }

                $stmtDetalle = $db->prepare(
                    'SELECT producto_id, nombre_producto, cantidad FROM pedido_detalle WHERE pedido_id = ?'
                );
                $stmtDetalle->execute([$id]);
                $detalles = $stmtDetalle->fetchAll();

                $stmtProducto = $db->prepare('SELECT stock FROM productos WHERE id = ? FOR UPDATE');
                $stmtStock = $db->prepare('UPDATE productos SET stock = ? WHERE id = ?');
                $stmtMov = $db->prepare(
                    'INSERT INTO movimientos_inventario
                        (producto_id, tipo, cantidad, stock_anterior, stock_nuevo, motivo, pedido_id)
                     VALUES (?, ?, ?, ?, ?, ?, ?)'
                );

                foreach ($detalles as $detalle) {
                    if ($detalle['producto_id'] === null) {
                        throw new RuntimeException('El producto "' . $detalle['nombre_producto'] . '" ya no está disponible');
                    }

                    $productoId = (int) $detalle['producto_id'];
                    $cantidad = (int) $detalle['cantidad'];

                    $stmtProducto->execute([$productoId]);
                    $producto = $stmtProducto->fetch();

                    if (!$producto) {
                        throw new RuntimeException('El producto "' . $detalle['nombre_producto'] . '" ya no existe');
                    }

                    $stockAnterior = (int) $producto['stock'];
                    $stockNuevo = $stockAnterior - $cantidad;

                    if ($stockNuevo < 0) {
                        throw new RuntimeException('Stock insuficiente de: ' . $detalle['nombre_producto']);
                    }

                    $stmtStock->execute([$stockNuevo, $productoId]);
                    $stmtMov->execute([
                        $productoId,
                        'salida',
                        $cantidad,
                        $stockAnterior,
                        $stockNuevo,
                        'Venta del pedido ' . $pedido['folio'],
                        $id,
                    ]);
                }

                $fechaVenta = date('Y-m-d H:i:s');

                $db->prepare('UPDATE pedidos SET estado = ?, fecha_venta = ? WHERE id = ?')
                    ->execute(['completado', $fechaVenta, $id]);

                $db->prepare('INSERT INTO ventas (pedido_id, fecha_venta, total) VALUES (?, ?, ?)')
                    ->execute([$id, $fechaVenta, $pedido['total']]);

                $db->commit();
            } catch (RuntimeException $e) {
                $db->rollBack();
                fail($e->getMessage());
            } catch (Throwable $e) {
                $db->rollBack();
                fail('No se pudo registrar la venta: ' . $e->getMessage(), 500);
            }

            ok(['id' => $id, 'estado' => 'completado', 'fechaVenta' => $fechaVenta]);
        } elseif ($accion === 'cancelar') {
            $stmt = $db->prepare('SELECT estado FROM pedidos WHERE id = ?');
            $stmt->execute([$id]);
            $estado = $stmt->fetchColumn();

            if ($estado === false) {
                fail('El pedido no existe', 404);
            }
            if ($estado !== 'pendiente') {
                fail('Solo se pueden cancelar pedidos pendientes');
            }

            $db->prepare('UPDATE pedidos SET estado = ? WHERE id = ?')
                ->execute(['cancelado', $id]);

            ok(['id' => $id, 'estado' => 'cancelado']);
        } else {
            fail('Acción no válida. Usa "vender" o "cancelar"');
        }
        break;

    default:
        fail('Método no permitido', 405);
}
