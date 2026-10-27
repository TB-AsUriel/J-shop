/* ===== Configuración general (edita aquí) ===== */
const CONFIG = {
  tienda: "iStore Accesorios",
  // Número con lada de país y sin "+" ni espacios. Ej. México: 52 + 10 dígitos
  whatsapp: "5210000000000",
  moneda: "$",
  adminPassword: "admin123" // CÁMBIALA. Solo es protección de demostración
};

const CATEGORIAS = [
  { id: "audifonos-cable", nombre: "Audífonos con cable", icono: "🎧" },
  { id: "audifonos-inalambricos", nombre: "Audífonos inalámbricos", icono: "🎵" },
  { id: "cables", nombre: "Cables", icono: "🔌" },
  { id: "cargadores", nombre: "Cargadores", icono: "⚡" },
  { id: "fundas", nombre: "Fundas", icono: "📱" },
  { id: "relojes", nombre: "Relojes", icono: "⌚" },
  { id: "otros", nombre: "Otros", icono: "🧩" }
];

const PRODUCTOS_INICIALES = [
  { id: "p1", nombre: "EarPods con conector Lightning", categoria: "audifonos-cable", precio: 450, stock: 12, imagen: "" },
  { id: "p2", nombre: "Audífonos Bluetooth con estuche de carga", categoria: "audifonos-inalambricos", precio: 899, stock: 8, imagen: "" },
  { id: "p3", nombre: "Cable USB-C a Lightning 1 m", categoria: "cables", precio: 249, stock: 25, imagen: "" },
  { id: "p4", nombre: "Cargador de pared 20 W USB-C", categoria: "cargadores", precio: 329, stock: 15, imagen: "" },
  { id: "p5", nombre: "Funda de silicón transparente", categoria: "fundas", precio: 199, stock: 3, imagen: "" },
  { id: "p6", nombre: "Reloj inteligente con llamadas", categoria: "relojes", precio: 1290, stock: 5, imagen: "" }
];

/* ===== Capa de datos (localStorage) ===== */
const DB = {
  leer(clave, defecto) {
    try {
      const v = localStorage.getItem(clave);
      return v ? JSON.parse(v) : defecto;
    } catch (e) { return defecto; }
  },
  guardar(clave, valor) { localStorage.setItem(clave, JSON.stringify(valor)); },
  productos() {
    let lista = this.leer("productos", null);
    if (!lista) { lista = PRODUCTOS_INICIALES; this.guardar("productos", lista); }
    return lista;
  },
  guardarProductos(l) { this.guardar("productos", l); },
  pedidos() { return this.leer("pedidos", []); },
  guardarPedidos(l) { this.guardar("pedidos", l); }
};

/* ===== Utilidades ===== */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const dinero = n => CONFIG.moneda + Number(n).toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const esc = t => String(t).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const categoriaDe = id => CATEGORIAS.find(c => c.id === id) || CATEGORIAS[CATEGORIAS.length - 1];
const nuevoId = p => p + Date.now().toString(36).toUpperCase() + Math.floor(Math.random() * 99);

function avisar(texto) {
  let t = $("#aviso");
  if (!t) { t = document.createElement("div"); t.id = "aviso"; t.setAttribute("role", "status"); document.body.appendChild(t); }
  t.textContent = texto;
  t.classList.add("visible");
  clearTimeout(avisar._t);
  avisar._t = setTimeout(() => t.classList.remove("visible"), 2600);
}
