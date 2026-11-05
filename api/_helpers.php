<?php
declare(strict_types=1);

require_once __DIR__ . '/../config/db.php';

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

set_exception_handler(function (Throwable $e): void {
    http_response_code(500);
    echo json_encode([
        'ok' => false,
        'error' => 'Error del servidor: ' . $e->getMessage(),
    ], JSON_UNESCAPED_UNICODE);
    exit;
});

function json_response($data, int $code = 200): void
{
    http_response_code($code);
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function ok($data = null): void
{
    json_response(['ok' => true, 'data' => $data]);
}

function fail(string $mensaje, int $code = 400): void
{
    json_response(['ok' => false, 'error' => $mensaje], $code);
}

function method(): string
{
    return strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');
}

function body(): array
{
    $raw = file_get_contents('php://input');

    if ($raw === false || $raw === '') {
        return [];
    }

    $data = json_decode($raw, true);

    if (!is_array($data)) {
        fail('El cuerpo de la solicitud no es un JSON válido');
    }

    return $data;
}

function param(string $nombre, $defecto = null)
{
    return $_GET[$nombre] ?? $defecto;
}

function require_fields(array $data, array $campos): void
{
    foreach ($campos as $campo) {
        if (!isset($data[$campo]) || $data[$campo] === '') {
            fail('Falta el campo: ' . $campo);
        }
    }
}
