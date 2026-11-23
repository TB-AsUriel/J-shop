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
    'SELECT pd.producto_id AS producto_id,
            pd.nombre_producto AS nombre,
            COALESCE(p.costo, 0) AS costo,
            COALESCE(SUM(pd.cantidad), 0) AS piezas,
            COALESCE(SUM(pd.subtotal), 0) AS ingresos
     FROM ventas v
     JOIN pedido_detalle pd ON pd.pedido_id = v.pedido_id
     LEFT JOIN productos p ON p.id = pd.producto_id
     WHERE v.fecha_venta >= ? AND v.fecha_venta < ?
     GROUP BY pd.producto_id, pd.nombre_producto, p.costo
     ORDER BY ingresos DESC, nombre ASC'
);
$stmt->execute([$inicio, $fin]);

$productos = array_map(static function (array $fila): array {
    $piezas = (int) $fila['piezas'];
    $ingresos = (float) $fila['ingresos'];
    $costoUnitario = (float) $fila['costo'];
    $costoTotal = round($costoUnitario * $piezas, 2);
    $utilidad = round($ingresos - $costoTotal, 2);
    $margen = $ingresos > 0 ? round($utilidad / $ingresos * 100, 2) : 0.0;

    return [
        'producto_id' => $fila['producto_id'] !== null ? (int) $fila['producto_id'] : null,
        'nombre' => $fila['nombre'],
        'piezas' => $piezas,
        'ingresos' => round($ingresos, 2),
        'costo_unitario' => $costoUnitario,
        'costo_total' => $costoTotal,
        'utilidad_bruta' => $utilidad,
        'margen' => $margen,
    ];
}, $stmt->fetchAll());

$piezas = array_sum(array_column($productos, 'piezas'));
$ingresos = array_sum(array_column($productos, 'ingresos'));
$costoTotal = array_sum(array_column($productos, 'costo_total'));
$utilidadBruta = round($ingresos - $costoTotal, 2);
$margen = $ingresos > 0 ? round($utilidadBruta / $ingresos * 100, 2) : 0.0;

$stmt = $db->prepare('SELECT COALESCE(SUM(monto), 0) FROM gastos WHERE fecha >= ? AND fecha <= ?');
$stmt->execute([$desde, $hasta]);
$gastos = round((float) $stmt->fetchColumn(), 2);

ok([
    'desde' => $desde,
    'hasta' => $hasta,
    'productos' => $productos,
    'piezas' => (int) $piezas,
    'ingresos' => round((float) $ingresos, 2),
    'costo_total' => round((float) $costoTotal, 2),
    'utilidad_bruta' => $utilidadBruta,
    'margen' => $margen,
    'gastos' => $gastos,
    'utilidad_neta' => round($utilidadBruta - $gastos, 2),
]);
