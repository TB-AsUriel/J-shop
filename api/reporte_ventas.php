<?php
declare(strict_types=1);

require_once __DIR__ . '/_helpers.php';

if (method() !== 'GET') {
    fail('Método no permitido', 405);
}

function fecha_iso(?string $valor): bool
{
    if ($valor === null || $valor === '') {
        return false;
    }

    $fecha = DateTimeImmutable::createFromFormat('Y-m-d', $valor);

    return $fecha !== false && $fecha->format('Y-m-d') === $valor;
}

$db = db();
$hoyDb = $db->query('SELECT CURDATE()')->fetchColumn();
$hoy = new DateTimeImmutable($hoyDb);

$desde = (string) param('desde', '');
$hasta = (string) param('hasta', '');

if (!fecha_iso($desde)) {
    $desde = $hoy->modify('first day of this month')->format('Y-m-d');
}
if (!fecha_iso($hasta)) {
    $hasta = $hoy->format('Y-m-d');
}
if ($desde > $hasta) {
    fail('La fecha inicial no puede ser mayor que la fecha final');
}

$inicio = $desde . ' 00:00:00';
$fin = (new DateTimeImmutable($hasta))->modify('+1 day')->format('Y-m-d 00:00:00');

$stmt = $db->prepare(
    'SELECT pd.nombre_producto AS nombre,
            COALESCE(SUM(pd.cantidad), 0) AS piezas,
            COALESCE(SUM(pd.subtotal), 0) AS total
     FROM ventas v
     JOIN pedido_detalle pd ON pd.pedido_id = v.pedido_id
     WHERE v.fecha_venta >= ? AND v.fecha_venta < ?
     GROUP BY pd.nombre_producto
     ORDER BY piezas DESC, total DESC'
);
$stmt->execute([$inicio, $fin]);

$productos = array_map(static function (array $fila): array {
    return [
        'nombre' => $fila['nombre'],
        'piezas' => (int) $fila['piezas'],
        'total' => (float) $fila['total'],
    ];
}, $stmt->fetchAll());

$piezas = array_sum(array_column($productos, 'piezas'));
$total = array_sum(array_column($productos, 'total'));

ok([
    'desde' => $desde,
    'hasta' => $hasta,
    'productos' => $productos,
    'piezas' => $piezas,
    'total' => round((float) $total, 2),
]);
