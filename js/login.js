/* ===== Acceso al panel de administración ===== */
if (sessionStorage.getItem("admin") === "1") {
  location.replace("admin.html");
}

$("#formLogin").addEventListener("submit", e => {
  e.preventDefault();
  if ($("#clave").value === CONFIG.adminPassword) {
    sessionStorage.setItem("admin", "1");
    location.replace("admin.html");
  } else {
    $("#errorLogin").hidden = false;
  }
});
