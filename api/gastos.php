<?php
declare(strict_types=1);

require_once __DIR__ . '/_helpers.php';

function fecha_iso(?string $valor): bool
{
    if ($valor === null || $valor === '') {
        return false;
    }

    $fecha = DateTimeImmutable::createFromFormat('Y-m-d', $valor);

    return $fecha !== false && $fecha->format('Y-m-d') === $valor;
}

function normalizar_gasto(array $fila): array
{
    return [
        'id' => (int) $fila['id'],
        'concepto' => $fila['concepto'],
        'monto' => (float) $fila['monto'],
        'fecha' => $fila['fecha'],
    ];
}

$db = db();
$metodo = method();

switch ($metodo) {
    case 'GET':
        $desde = (string) param('desde', '');
        $hasta = (string) param('hasta', '');

        $sql = 'SELECT id, concepto, monto, fecha FROM gastos';
        $params = [];

        if (fecha_iso($desde) && fecha_iso($hasta)) {
            $sql .= ' WHERE fecha >= ? AND fecha <= ?';
            $params = [$desde, $hasta];
        }

        $sql .= ' ORDER BY fecha DESC, id DESC';

        $stmt = $db->prepare($sql);
        $stmt->execute($params);

        ok(array_map('normalizar_gasto', $stmt->fetchAll()));
        break;

    case 'POST':
        $data = body();
        require_fields($data, ['concepto', 'monto', 'fecha']);

        $concepto = trim((string) $data['concepto']);
        $monto = is_numeric($data['monto']) ? (float) $data['monto'] : -1;
        $fecha = (string) $data['fecha'];

        if ($concepto === '') {
            fail('Escribe el concepto del gasto');
        }
        if ($monto < 0) {
            fail('El monto no puede ser negativo');
        }
        if (!fecha_iso($fecha)) {
            fail('La fecha del gasto no es válida');
        }

        $stmt = $db->prepare('INSERT INTO gastos (concepto, monto, fecha) VALUES (?, ?, ?)');
        $stmt->execute([$concepto, round($monto, 2), $fecha]);
        $id = (int) $db->lastInsertId();

        $stmt = $db->prepare('SELECT id, concepto, monto, fecha FROM gastos WHERE id = ?');
        $stmt->execute([$id]);

        ok(normalizar_gasto($stmt->fetch()));
        break;

    case 'DELETE':
        $id = (int) (param('id') ?? 0);
        if ($id <= 0) {
            fail('Falta el id del gasto');
        }

        $stmt = $db->prepare('DELETE FROM gastos WHERE id = ?');
        $stmt->execute([$id]);

        if ($stmt->rowCount() === 0) {
            fail('El gasto no existe', 404);
        }

        ok(['id' => $id, 'eliminado' => true]);
        break;

    default:
        fail('Método no permitido', 405);
}
