<?php
declare(strict_types=1);

/**
 * Conexión a MySQL / MariaDB de XAMPP.
 * Ajusta estas constantes si tu instalación usa otro usuario o contraseña.
 */
const DB_HOST = 'localhost';
const DB_NAME = 'jshop_db';
const DB_USER = 'root';
const DB_PASS = '';
const DB_CHARSET = 'utf8mb4';

function db(): PDO
{
    static $pdo = null;

    if ($pdo instanceof PDO) {
        return $pdo;
    }

    $dsn = 'mysql:host=' . DB_HOST . ';dbname=' . DB_NAME . ';charset=' . DB_CHARSET;

    try {
        $pdo = new PDO($dsn, DB_USER, DB_PASS, [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false,
        ]);
    } catch (PDOException $e) {
        http_response_code(500);
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode([
            'ok' => false,
            'error' => 'No se pudo conectar a la base de datos. Verifica que MySQL esté encendido en XAMPP y que la base jshop_db exista.',
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }

    return $pdo;
}
