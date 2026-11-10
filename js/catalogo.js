/* ===== Vista del cliente ===== */
let productos = [];

function nuevoIdLinea() {
  if (window.crypto && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return "L" + Date.now() + Math.random().toString(36).slice(2);
}

let carrito = DB.leer("carrito", [])
  .map(i => ({
    linea: i.linea || nuevoIdLinea(),
    id: Number(i.id),
    cantidad: Number(i.cantidad) || 0,
    modelo: i.modelo || null
  }))
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
    const variantes = p.variantes || [];
    const precio = variantes.length
      ? `Desde ${dinero(Math.min(...variantes.map(v => Number(v.precio))))}`
      : dinero(p.precio);
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
        <span class="precio">${precio}</span>
        <button class="btn-agregar" data-agregar="${p.id}">Agregar al pedido</button>
      </div>
    </article>`;
  }).join("");
}

/* ----- Carrito ----- */
function precioLinea(item, p) {
  if (item.modelo) {
    const variante = (p.variantes || []).find(v => v.modelo === item.modelo);
    if (variante) return Number(variante.precio);
  }
  return Number(p.precio);
}

function itemsDetallados() {
  const usados = {};
  return carrito.map(i => {
    const p = productos.find(x => Number(x.id) === Number(i.id));
    if (!p) return null;
    usados[i.id] = (usados[i.id] || 0) + i.cantidad;
    const disponible = Math.max(0, p.stock - (usados[i.id] - i.cantidad));
    const variantes = p.variantes || [];
    let modelo = i.modelo;
    if (variantes.length && !variantes.some(v => v.modelo === modelo)) {
      modelo = variantes[0].modelo;
    }
    return {
      ...p,
      linea: i.linea,
      modelo: variantes.length ? modelo : null,
      cantidad: Math.min(i.cantidad, disponible),
      precio: precioLinea({ ...i, modelo }, p)
    };
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
    const variantes = i.variantes || [];
    const foto = i.imagen
      ? `<img class="item-img" src="${i.imagen}" alt="${esc(i.nombre)}" loading="lazy" onerror="this.remove()">`
      : `<span class="item-img item-img-icono" aria-hidden="true">${cat.icono}</span>`;
    const selector = variantes.length
      ? `<label class="item-modelo">Modelo
           <select data-modelo="${i.linea}">
             ${variantes.map(v => `<option value="${esc(v.modelo)}" ${v.modelo === i.modelo ? "selected" : ""}>${esc(v.modelo)} · ${dinero(v.precio)}</option>`).join("")}
           </select>
         </label>`
      : "";
    const detalle = i.modelo ? `${esc(i.nombre)} · ${esc(i.modelo)}` : esc(i.nombre);
    return `
    <div class="item">
      ${foto}
      <div class="item-info">
        <span class="item-nombre">${detalle}</span>
        ${selector}
        <span class="item-precio">${dinero(i.precio * i.cantidad)}</span>
        <div class="cantidad">
          <button data-menos="${i.linea}" aria-label="Quitar uno">−</button>
          <span>${i.cantidad}</span>
          <button data-mas="${i.linea}" aria-label="Agregar uno">+</button>
        </div>
      </div>
      <button class="item-quitar" data-quitar="${i.linea}" aria-label="Quitar ${esc(i.nombre)}">✕</button>
    </div>`;
  }).join("") : `<p class="vacio">Tu pedido está vacío. Agrega productos del catálogo.</p>`;
}

function cambiarCantidad(linea, delta) {
  const item = carrito.find(i => i.linea === linea);
  if (!item) return;
  const p = productos.find(x => Number(x.id) === Number(item.id));
  if (!p) return;
  const enCarrito = carrito
    .filter(i => Number(i.id) === Number(item.id))
    .reduce((s, i) => s + i.cantidad, 0);
  if (delta > 0 && enCarrito >= p.stock) {
    avisar("No hay más piezas en stock de este producto");
    return;
  }
  item.cantidad += delta;
  carrito = carrito.filter(i => i.cantidad > 0);
  guardarCarrito(); renderCarrito();
}

function agregarAlCarrito(id) {
  id = Number(id);
  const p = productos.find(x => Number(x.id) === id);
  if (!p) return;
  const variantes = p.variantes || [];
  const modelo = variantes.length ? variantes[0].modelo : null;
  const existente = carrito.find(i => Number(i.id) === id && (i.modelo || null) === modelo);
  if (existente) {
    cambiarCantidad(existente.linea, 1);
    return;
  }
  const enCarrito = carrito
    .filter(i => Number(i.id) === id)
    .reduce((s, i) => s + i.cantidad, 0);
  if (enCarrito >= p.stock) {
    avisar("No hay más piezas en stock de este producto");
    return;
  }
  carrito.push({ linea: nuevoIdLinea(), id, cantidad: 1, modelo });
  guardarCarrito(); renderCarrito();
}

function cambiarModelo(linea, modelo) {
  const item = carrito.find(i => i.linea === linea);
  if (!item) return;
  item.modelo = modelo;
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
  const fechaEntrega = $("#fechaEntrega").value;
  const horaEntrega = $("#horaEntrega").value;
  const lugarEntrega = $("#lugarEntrega").value;
  const items = itemsDetallados();
  if (!items.length) return;
  if (!nombre) { avisar("Escribe tu nombre para enviar el pedido"); $("#nombreCliente").focus(); return; }
  if (horaEntrega && !fechaEntrega) { avisar("Selecciona el día de entrega para indicar la hora"); $("#fechaEntrega").focus(); return; }

  $("#btnEnviar").disabled = true;

  try {
    const pedido = await API.crearPedido({
      cliente: nombre,
      fechaEntrega,
      horaEntrega,
      lugar: lugarEntrega,
      items: items.map(i => ({ id: Number(i.id), cantidad: i.cantidad, modelo: i.modelo }))
    });

    const lineas = items.map(i => {
      const nombre = i.modelo ? `${i.nombre} (${i.modelo})` : i.nombre;
      return `• ${i.cantidad} x ${nombre} - ${dinero(i.precio * i.cantidad)}`;
    });
    const entrega = [];
    if (fechaEntrega) entrega.push(`Día de entrega: ${fechaEntrega}`);
    if (horaEntrega) entrega.push(`Hora de entrega: ${horaEntrega}`);
    if (lugarEntrega) entrega.push(`Lugar de entrega: ${lugarEntrega}`);
    const mensaje = `Hola, soy ${nombre}. Quiero hacer este pedido (${pedido.folio}):\n${lineas.join("\n")}\nTotal: ${dinero(pedido.total)}${entrega.length ? "\n" + entrega.join("\n") : ""}`;
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
  if (t.dataset.agregar) { agregarAlCarrito(t.dataset.agregar); avisar("Agregado a tu pedido"); }
  if (t.dataset.mas) cambiarCantidad(t.dataset.mas, 1);
  if (t.dataset.menos) cambiarCantidad(t.dataset.menos, -1);
  if (t.dataset.quitar) { carrito = carrito.filter(i => i.linea !== t.dataset.quitar); guardarCarrito(); renderCarrito(); }
});
document.addEventListener("change", e => {
  const select = e.target.closest("[data-modelo]");
  if (select) cambiarModelo(select.dataset.modelo, select.value);
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

/* ----- Entrega: lugares y fecha mínima ----- */
const selectLugar = $("#lugarEntrega");
if (selectLugar) {
  selectLugar.innerHTML += LUGARES.map(l => `<option value="${esc(l)}">${esc(l)}</option>`).join("");
}
const campoFecha = $("#fechaEntrega");
if (campoFecha) {
  const hoy = new Date();
  const iso = new Date(hoy.getTime() - hoy.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  campoFecha.min = iso;
}

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

  const antes = carrito.length;
  carrito = carrito.filter(i => {
    const p = productos.find(x => Number(x.id) === Number(i.id));
    if (!p) return false;
    const variantes = p.variantes || [];
    if (variantes.length && !variantes.some(v => v.modelo === i.modelo)) {
      i.modelo = variantes[0].modelo;
    }
    return true;
  });
  if (carrito.length !== antes) guardarCarrito();

  renderProductos();
  renderCarrito();
}

iniciarCatalogo();
