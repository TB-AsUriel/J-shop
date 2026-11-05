<?php
declare(strict_types=1);

require_once __DIR__ . '/_helpers.php';

if (method() !== 'GET') {
    fail('Método no permitido', 405);
}

$filas = db()
    ->query('SELECT id, nombre, icono FROM categorias ORDER BY nombre')
    ->fetchAll();

ok($filas);
