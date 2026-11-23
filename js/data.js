/* ===== Configuración general (edita aquí) ===== */
const CONFIG = {
  tienda: "J-Shop",
  // Número con lada de país y sin "+" ni espacios. Ej. México: 52 + 10 dígitos
  whatsapp: "522224809352",
  // Número del proveedor (con lada de país, sin "+" ni espacios)
  whatsappProveedor: "2212631704",
  moneda: "$",
  adminPassword: "admin123" // CÁMBIALA. Solo es protección de demostración
};

const LUGARES = [
  "Parque Puebla",
  "CU BUAP",
  "ITP",
  "Plaza Cristal",
  "Plaza Dorada",
  "Angelopolis"
];

const CATEGORIAS = [
  { id: "audifonos-cable", nombre: "Audífonos con cable", icono: "headphones" },
  { id: "audifonos-inalambricos", nombre: "Audífonos inalámbricos", icono: "music" },
  { id: "cables", nombre: "Cables", icono: "plug" },
  { id: "cargadores", nombre: "Cargadores", icono: "zap" },
  { id: "fundas", nombre: "Fundas", icono: "smartphone" },
  { id: "relojes", nombre: "Relojes", icono: "watch" },
  { id: "otros", nombre: "Otros", icono: "shapes" }
];

/* ===== Almacenamiento local del carrito ===== */
const DB = {
  leer(clave, defecto) {
    try {
      const v = localStorage.getItem(clave);
      return v ? JSON.parse(v) : defecto;
    } catch (e) { return defecto; }
  },
  guardar(clave, valor) { localStorage.setItem(clave, JSON.stringify(valor)); }
};

/* ===== Utilidades ===== */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const dinero = n => CONFIG.moneda + Number(n).toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const esc = t => String(t).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const categoriaDe = id => CATEGORIAS.find(c => c.id === id) || CATEGORIAS[CATEGORIAS.length - 1];

function avisar(texto) {
  let t = $("#aviso");
  if (!t) { t = document.createElement("div"); t.id = "aviso"; t.setAttribute("role", "status"); document.body.appendChild(t); }
  t.textContent = texto;
  t.classList.add("visible");
  clearTimeout(avisar._t);
  avisar._t = setTimeout(() => t.classList.remove("visible"), 3200);
}
