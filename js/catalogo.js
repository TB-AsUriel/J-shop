/* ===== Vista del cliente ===== */
let productos = [];
let carrito = DB.leer("carrito", [])
  .map(i => ({ id: Number(i.id), cantidad: Number(i.cantidad) || 0 }))
  .filter(i => Number.isFinite(i.id) && i.id > 0 && i.cantidad > 0);
let categoriaActiva = "todos";
let texto = "";

function guardarCarrito() { DB.guardar("carrito", carrito); }

function renderCategorias() {
  const todas = [{ id: "todos", nombre: "Todo", icono: "✨" }, ...CATEGORIAS];
  $("#categorias").innerHTML = todas.map(c =>
    `<button class="chip ${c.id === categoriaActiva ? "activo" : ""}" data-cat="${c.id}"><span>${c.icono}</span>${esc(c.nombre)}</button>`
  ).join("");
}

function renderProductos() {
  const q = texto.toLowerCase();
  const lista = productos.filter(p =>
    p.stock > 0 &&
    (categoriaActiva === "todos" || p.categoria === categoriaActiva) &&
    p.nombre.toLowerCase().includes(q)
  );
  if (!lista.length) {
    $("#productos").innerHTML = `<p class="vacio">No encontramos productos con ese filtro. Prueba otra categoría o borra la búsqueda.</p>`;
    return;
  }
  $("#productos").innerHTML = lista.map(p => {
    const cat = categoriaDe(p.categoria);
    const img = p.imagen
      ? `<img src="${p.imagen}" alt="${esc(p.nombre)}" loading="lazy" decoding="async" onerror="this.remove()">`
      : "";
    return `<article class="tarjeta">
      <div class="tarjeta-img cat-${p.categoria}">
        <span class="img-fallback" aria-hidden="true">${cat.icono}</span>
        ${img}${p.stock <= 5 ? `<span class="pocas">Quedan ${p.stock}</span>` : ""}
      </div>
      <div class="tarjeta-cuerpo">
        <span class="categoria">${esc(cat.nombre)}</span>
        <h3>${esc(p.nombre)}</h3>
        <span class="precio">${dinero(p.precio)}</span>
        <button class="btn-agregar" data-agregar="${p.id}">Agregar al pedido</button>
      </div>
    </article>`;
  }).join("");
}

/* ----- Carrito ----- */
function itemsDetallados() {
  return carrito.map(i => {
    const p = productos.find(x => Number(x.id) === Number(i.id));
    return p ? { ...p, cantidad: Math.min(i.cantidad, p.stock) } : null;
  }).filter(Boolean);
}

function renderCarrito() {
  const items = itemsDetallados();
  const total = items.reduce((s, i) => s + i.precio * i.cantidad, 0);
  const piezas = items.reduce((s, i) => s + i.cantidad, 0);
  $("#contadorCarrito").textContent = piezas;
  $("#totalCarrito").textContent = dinero(total);
  $("#btnEnviar").disabled = !items.length;
  const resumen = $("#panelResumen");
  if (resumen) resumen.textContent = piezas ? `${piezas} producto${piezas === 1 ? "" : "s"}` : "Aún vacío";
  $("#itemsCarrito").innerHTML = items.length ? items.map(i => {
    const cat = categoriaDe(i.categoria);
    const foto = i.imagen
      ? `<img class="item-img" src="${i.imagen}" alt="${esc(i.nombre)}" loading="lazy" onerror="this.remove()">`
      : `<span class="item-img item-img-icono" aria-hidden="true">${cat.icono}</span>`;
    return `
    <div class="item">
      ${foto}
      <div class="item-info">
        <span class="item-nombre">${esc(i.nombre)}</span>
        <span class="item-precio">${dinero(i.precio * i.cantidad)}</span>
        <div class="cantidad">
          <button data-menos="${i.id}" aria-label="Quitar uno">−</button>
          <span>${i.cantidad}</span>
          <button data-mas="${i.id}" aria-label="Agregar uno">+</button>
        </div>
      </div>
      <button class="item-quitar" data-quitar="${i.id}" aria-label="Quitar ${esc(i.nombre)}">✕</button>
    </div>`;
  }).join("") : `<p class="vacio">Tu pedido está vacío. Agrega productos del catálogo.</p>`;
}

function cambiarCantidad(id, delta) {
  id = Number(id);
  const p = productos.find(x => Number(x.id) === id);
  if (!p) return;
  let item = carrito.find(i => Number(i.id) === id);
  if (!item) { item = { id, cantidad: 0 }; carrito.push(item); }
  const nueva = item.cantidad + delta;
  if (nueva > p.stock) { avisar("No hay más piezas en stock de este producto"); return; }
  item.cantidad = nueva;
  carrito = carrito.filter(i => i.cantidad > 0);
  guardarCarrito(); renderCarrito();
}

function abrirCarrito(abrir) {
  $("#panelCarrito").classList.toggle("abierto", abrir);
  $("#velo").classList.toggle("visible", abrir);
  $("#panelCarrito").setAttribute("aria-hidden", String(!abrir));
}

/* ----- Enviar pedido ----- */
async function pedirPorWhatsApp() {
  const nombre = $("#nombreCliente").value.trim();
  const items = itemsDetallados();
  if (!items.length) return;
  if (!nombre) { avisar("Escribe tu nombre para enviar el pedido"); $("#nombreCliente").focus(); return; }

  $("#btnEnviar").disabled = true;

  try {
    const pedido = await API.crearPedido({
      cliente: nombre,
      items: items.map(i => ({ id: Number(i.id), cantidad: i.cantidad }))
    });

    const lineas = items.map(i => `• ${i.cantidad} x ${i.nombre} - ${dinero(i.precio * i.cantidad)}`);
    const mensaje = `Hola, soy ${nombre}. Quiero hacer este pedido (${pedido.folio}):\n${lineas.join("\n")}\nTotal: ${dinero(pedido.total)}`;
    window.open(`https://wa.me/${CONFIG.whatsapp}?text=${encodeURIComponent(mensaje)}`, "_blank");

    carrito = []; guardarCarrito(); renderCarrito(); abrirCarrito(false);
    avisar("Pedido recibido. Continúa la conversación en WhatsApp");
  } catch (e) {
    avisar(e.message);
  } finally {
    renderCarrito();
  }
}

/* ----- Eventos ----- */
document.addEventListener("click", e => {
  const chip = e.target.closest("[data-cat]");
  if (chip) { categoriaActiva = chip.dataset.cat; renderCategorias(); renderProductos(); }
  const t = e.target;
  if (t.dataset.agregar) { cambiarCantidad(t.dataset.agregar, 1); avisar("Agregado a tu pedido"); }
  if (t.dataset.mas) cambiarCantidad(t.dataset.mas, 1);
  if (t.dataset.menos) cambiarCantidad(t.dataset.menos, -1);
  if (t.dataset.quitar) { carrito = carrito.filter(i => Number(i.id) !== Number(t.dataset.quitar)); guardarCarrito(); renderCarrito(); }
});
$("#buscador").addEventListener("input", e => { texto = e.target.value; renderProductos(); });
$("#btnCarrito").addEventListener("click", () => abrirCarrito(true));
$("#cerrarCarrito").addEventListener("click", () => abrirCarrito(false));
$("#velo").addEventListener("click", () => abrirCarrito(false));
$("#btnEnviar").addEventListener("click", pedirPorWhatsApp);
const enlaceWa = `https://wa.me/${CONFIG.whatsapp}?text=${encodeURIComponent("Hola, me interesa un accesorio para iPhone.")}`;
$("#btnWhatsapp").href = enlaceWa;
const pieWa = $("#pieWhatsapp");
if (pieWa) pieWa.href = enlaceWa;
const anio = $("#anio");
if (anio) anio.textContent = new Date().getFullYear();

/* ----- Arranque ----- */
async function iniciarCatalogo() {
  renderCategorias();
  renderCarrito();

  try {
    productos = await API.productos();
  } catch (e) {
    $("#productos").innerHTML = `<p class="vacio">${esc(e.message)}</p>`;
    $("#btnEnviar").disabled = true;
    return;
  }

  renderProductos();
  renderCarrito();
}

iniciarCatalogo();
