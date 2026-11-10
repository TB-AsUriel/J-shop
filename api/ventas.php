<?php
declare(strict_types=1);

require_once __DIR__ . '/_helpers.php';

if (method() !== 'GET') {
    fail('Método no permitido', 405);
}

function resumen_ventas(PDO $db, string $desde): array
{
    $stmt = $db->prepare(
        'SELECT COALESCE(SUM(total), 0) AS total, COUNT(*) AS pedidos
         FROM ventas
         WHERE fecha_venta >= ?'
    );
    $stmt->execute([$desde]);
    $resumen = $stmt->fetch();

    $stmt = $db->prepare(
        'SELECT COALESCE(SUM(pd.cantidad), 0) AS piezas
         FROM ventas v
         JOIN pedido_detalle pd ON pd.pedido_id = v.pedido_id
         WHERE v.fecha_venta >= ?'
    );
    $stmt->execute([$desde]);
    $piezas = $stmt->fetch();

    return [
        'total' => (float) $resumen['total'],
        'pedidos' => (int) $resumen['pedidos'],
        'piezas' => (int) $piezas['piezas'],
    ];
}

$db = db();

// Se toma la fecha actual del servidor MySQL para que los cortes de
// día/semana/mes coincidan con la zona horaria en que se guardan las ventas.
$hoyDb = $db->query('SELECT CURDATE()')->fetchColumn();
$hoyDate = new DateTimeImmutable($hoyDb);

$desdeHoy = $hoyDate->format('Y-m-d 00:00:00');
$desdeSemana = $hoyDate->modify('monday this week')->format('Y-m-d 00:00:00');
$desdeMes = $hoyDate->modify('first day of this month')->format('Y-m-d 00:00:00');

$dias = [];
$abreviaturas = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];

for ($i = 6; $i >= 0; $i--) {
    $dia = $hoyDate->modify("-$i day");
    $desde = $dia->format('Y-m-d 00:00:00');
    $hasta = $dia->modify('+1 day')->format('Y-m-d 00:00:00');

    $stmt = $db->prepare(
        'SELECT COALESCE(SUM(total), 0) FROM ventas WHERE fecha_venta >= ? AND fecha_venta < ?'
    );
    $stmt->execute([$desde, $hasta]);

    $dias[] = [
        'etiqueta' => $abreviaturas[(int) $dia->format('w')] . ' ' . $dia->format('j'),
        'total' => (float) $stmt->fetchColumn(),
    ];
}

$entregas = [];
$etiquetasEntrega = [0 => 'Hoy', 1 => 'Mañana'];

foreach ([0, 1] as $offset) {
    $dia = $hoyDate->modify("+$offset day")->format('Y-m-d');

    $stmt = $db->prepare(
        "SELECT COUNT(*) AS pedidos, COALESCE(SUM(total), 0) AS total
         FROM pedidos
         WHERE fecha_entrega = ? AND estado <> 'cancelado'"
    );
    $stmt->execute([$dia]);
    $fila = $stmt->fetch();

    $entregas[] = [
        'etiqueta' => $etiquetasEntrega[$offset],
        'fecha' => $dia,
        'pedidos' => (int) $fila['pedidos'],
        'total' => (float) $fila['total'],
    ];
}

ok([
    'hoy' => resumen_ventas($db, $desdeHoy),
    'semana' => resumen_ventas($db, $desdeSemana),
    'mes' => resumen_ventas($db, $desdeMes),
    'dias' => $dias,
    'entregas' => $entregas,
]);
