#!/usr/bin/env bash
set -euo pipefail

DOMAIN="basta.lan"
VM_IP="192.168.10.1"
WEBROOT="/var/www/jshop"
NIC="${NIC:-enp0s8}"

if [[ "${EUID}" -ne 0 ]]; then
  echo "Ejecuta este script como root" >&2
  exit 1
fi

read -r -s -p "Contraseña para el usuario jshop de MariaDB: " DB_PASSWORD
echo
if [[ ! "${DB_PASSWORD}" =~ ^[A-Za-z0-9_.@!#%^&*+=-]{8,}$ ]]; then
  echo "La contraseña debe tener al menos 8 caracteres y solo letras, números y . _ @ ! # % ^ & * + = -" >&2
  exit 1
fi

echo "Instalando paquetes..."
dnf install -y httpd mod_proxy_fcgi php php-fpm php-mysqlnd mariadb-server bind bind-utils firewalld policycoreutils-python-utils curl

echo "Configurando ${NIC} con ${VM_IP}/24..."
if nmcli con show | grep -q '^intnet '; then
  nmcli con mod intnet connection.interface-name "${NIC}" ipv4.method manual ipv4.addresses "${VM_IP}/24" ipv4.gateway "" ipv4.dns "127.0.0.1"
else
  nmcli con add type ethernet con-name intnet ifname "${NIC}" ipv4.method manual ipv4.addresses "${VM_IP}/24" ipv4.gateway "" ipv4.dns "127.0.0.1"
fi
nmcli con up intnet

echo "Configurando MariaDB..."
systemctl enable --now mariadb
mysql -u root <<SQL
CREATE DATABASE IF NOT EXISTS jshop_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS 'jshop'@'localhost' IDENTIFIED BY '${DB_PASSWORD}';
CREATE USER IF NOT EXISTS 'jshop'@'127.0.0.1' IDENTIFIED BY '${DB_PASSWORD}';
GRANT ALL PRIVILEGES ON jshop_db.* TO 'jshop'@'localhost';
GRANT ALL PRIVILEGES ON jshop_db.* TO 'jshop'@'127.0.0.1';
FLUSH PRIVILEGES;
SQL
mysql -u root < "${WEBROOT}/database/jshop.sql"

printf '%s\n' '<?php' "define('DB_HOST', '127.0.0.1');" "define('DB_NAME', 'jshop_db');" "define('DB_USER', 'jshop');" "define('DB_PASS', '${DB_PASSWORD}');" "define('DB_CHARSET', 'utf8mb4');" > "${WEBROOT}/config/db.local.php"
chown root:apache "${WEBROOT}/config/db.local.php"
chmod 640 "${WEBROOT}/config/db.local.php"

echo "Configurando Apache y PHP-FPM..."
install -m 0644 "${WEBROOT}/deploy/jshop.conf" /etc/httpd/conf.d/jshop.conf

echo "Configurando BIND..."
install -m 0644 "${WEBROOT}/deploy/named.conf" /etc/named.conf
install -m 0644 "${WEBROOT}/deploy/named.conf.local" /etc/named.conf.local
install -m 0640 -o root -g named "${WEBROOT}/deploy/basta.lan.zone" /var/named/basta.lan.zone
install -m 0640 -o root -g named "${WEBROOT}/deploy/10.168.192.in-addr.arpa.zone" /var/named/10.168.192.in-addr.arpa.zone

semanage fcontext -a -t httpd_sys_content_t "${WEBROOT}(/.*)?" 2>/dev/null || semanage fcontext -m -t httpd_sys_content_t "${WEBROOT}(/.*)?"
restorecon -Rv "${WEBROOT}"
restorecon -v /etc/named.conf /etc/named.conf.local /var/named/basta.lan.zone /var/named/10.168.192.in-addr.arpa.zone /etc/httpd/conf.d/jshop.conf
setsebool -P httpd_can_network_connect_db on

named-checkconf /etc/named.conf
named-checkzone "${DOMAIN}" /var/named/basta.lan.zone
named-checkzone "10.168.192.in-addr.arpa" /var/named/10.168.192.in-addr.arpa.zone
httpd -t

echo "Activando servicios y firewall..."
systemctl enable --now named httpd php-fpm firewalld
firewall-cmd --permanent --add-service=http
firewall-cmd --permanent --add-service=dns
firewall-cmd --reload

echo "Verificando..."
nslookup "jshop.${DOMAIN}" "${VM_IP}"
nslookup "${VM_IP}" "${VM_IP}"
curl -fsS -o /dev/null -w "HTTP %{http_code}\n" "http://jshop.${DOMAIN}/"
curl -fsS "http://jshop.${DOMAIN}/api/categorias.php"

echo "Listo. Configura la VM cliente con DNS ${VM_IP} y abre http://jshop.${DOMAIN}"
