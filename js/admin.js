/* ===== Panel de administración ===== */
const login = $("#login"), panel = $("#panelAdmin");

function mostrarPanel() {
  login.hidden = true; panel.hidden = false;
  renderTodo();
}
if (sessionStorage.getItem("admin") === "1") mostrarPanel();

$("#formLogin").addEventListener("submit", e => {
  e.preventDefault();
  if ($("#clave").value === CONFIG.adminPassword) {
    sessionStorage.setItem("admin", "1");
    mostrarPanel();
  } else {
    $("#errorLogin").hidden = false;
  }
});
$("#btnSalir").addEventListener("click", () => { sessionStorage.removeItem("admin"); location.reload(); });

/* ----- Pestañas ----- */
$$(".pestana").forEach(b => b.addEventListener("click", () => {
  $$(".pestana").forEach(x => x.classList.toggle("activa", x === b));
  $$(".tab").forEach(t => t.hidden = t.id !== "tab-" + b.dataset.tab);
  renderTodo();
}));

function renderTodo() { renderVentas(); renderPedidos(); renderInventario(); }

/* ===== VENTAS: día, semana, mes ===== */
const inicioDia = (d = new Date()) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
function inicioSemana(d = new Date()) {
  const x = inicioDia(d);
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); // semana desde el lunes
  return x;
}
const inicioMes = (d = new Date()) => new Date(d.getFullYear(), d.getMonth(), 1);

function ventasDesde(fecha) {
  const v = DB.pedidos().filter(p => p.estado === "completado" && new Date(p.fechaVenta) >= fecha);
  return { total: v.reduce((s, p) => s + p.total, 0), pedidos: v.length, piezas: v.reduce((s, p) => s + p.items.reduce((a, i) => a + i.cantidad, 0), 0) };
}

function renderVentas() {
  const datos = [["Hoy", inicioDia()], ["Esta semana", inicioSemana()], ["Este mes", inicioMes()]];
  $("#metricas").innerHTML = datos.map(([t, f]) => {
    const r = ventasDesde(f);
    return `<div class="metrica"><span>${t}</span><strong>${dinero(r.total)}</strong><small>${r.pedidos} pedido(s) · ${r.piezas} pieza(s)</small></div>`;
  }).join("");

  const dias = [];
  for (let i = 6; i >= 0; i--) {
    const d = inicioDia(); d.setDate(d.getDate() - i);
    const fin = new Date(d); fin.setDate(fin.getDate() + 1);
    const total = DB.pedidos().filter(p => p.estado === "completado" && new Date(p.fechaVenta) >= d && new Date(p.fechaVenta) < fin)
      .reduce((s, p) => s + p.total, 0);
    dias.push({ etiqueta: d.toLocaleDateString("es-MX", { weekday: "short", day: "numeric" }), total });
  }
  const max = Math.max(...dias.map(d => d.total), 1);
  $("#grafica").innerHTML = dias.map(d =>
    `<div class="barra-dia"><b>${d.total ? dinero(d.total) : ""}</b><div class="col" style="height:${(d.total / max) * 100}%"></div><span>${esc(d.etiqueta)}</span></div>`
  ).join("");
}

/* ===== PEDIDOS ===== */
function renderPedidos() {
  const todos = DB.pedidos();
  const pend = todos.filter(p => p.estado === "pendiente").length;
  $("#badgePedidos").textContent = pend || "";
  $("#badgePedidos").hidden = !pend;

  const filtro = $("#filtroEstado").value;
  const lista = todos.filter(p => filtro === "todos" || p.estado === filtro);
  if (!lista.length) { $("#listaPedidos").innerHTML = `<p class="nota">No hay pedidos en esta lista.</p>`; return; }

  const nombres = { pendiente: "Pendiente", completado: "Vendido", cancelado: "Cancelado" };
  $("#listaPedidos").innerHTML = lista.map(p => `
    <article class="pedido">
      <div class="pedido-cab">
        <div><strong>${esc(p.cliente)}</strong> <span class="nota">· ${esc(p.id)} · ${new Date(p.fecha).toLocaleString("es-MX")}</span></div>
        <span class="etiqueta ${p.estado}">${nombres[p.estado]}</span>
      </div>
      <ul>${p.items.map(i => `<li>${i.cantidad} × ${esc(i.nombre)} (${dinero(i.precio)})</li>`).join("")}</ul>
      <div class="acciones-pedido">
        <strong>${dinero(p.total)}</strong>
        ${p.estado === "pendiente" ? `<button class="btn-vender" data-vender="${p.id}">Marcar como vendido</button><button class="btn-cancelar" data-cancelar="${p.id}">Cancelar</button>` : ""}
      </div>
    </article>`).join("");
}

function marcarVendido(id) {
  const pedidos = DB.pedidos(), productos = DB.productos();
  const pedido = pedidos.find(p => p.id === id);
  const faltante = pedido.items.find(i => (productos.find(p => p.id === i.id)?.stock ?? 0) < i.cantidad);
  if (faltante) { avisar(`Stock insuficiente de: ${faltante.nombre}`); return; }
  pedido.items.forEach(i => { productos.find(p => p.id === i.id).stock -= i.cantidad; });
  pedido.estado = "completado";
  pedido.fechaVenta = new Date().toISOString();
  DB.guardarProductos(productos); DB.guardarPedidos(pedidos);
  avisar("Venta registrada y stock actualizado");
  renderTodo();
}

function cancelarPedido(id) {
  if (!confirm("¿Cancelar este pedido?")) return;
  const pedidos = DB.pedidos();
  pedidos.find(p => p.id === id).estado = "cancelado";
  DB.guardarPedidos(pedidos); renderTodo();
}
$("#filtroEstado").addEventListener("change", renderPedidos);

/* ===== INVENTARIO ===== */
$("#pCategoria").innerHTML = CATEGORIAS.map(c => `<option value="${c.id}">${esc(c.nombre)}</option>`).join("");

function renderInventario() {
  $("#tablaProductos").innerHTML = DB.productos().map(p => `
    <tr>
      <td>${esc(p.nombre)}</td>
      <td>${esc(categoriaDe(p.categoria).nombre)}</td>
      <td><input type="number" min="0" step="0.01" value="${p.precio}" data-precio="${p.id}" aria-label="Precio de ${esc(p.nombre)}"></td>
      <td><div class="stock-ctrl ${p.stock <= 3 ? "stock-bajo" : ""}">
        <button data-stock-menos="${p.id}" aria-label="Restar uno">−</button>
        <input type="number" min="0" step="1" value="${p.stock}" data-stock="${p.id}" aria-label="Stock de ${esc(p.nombre)}">
        <button data-stock-mas="${p.id}" aria-label="Sumar uno">+</button>
      </div></td>
      <td><button class="btn-borrar" data-borrar="${p.id}">Eliminar</button></td>
    </tr>`).join("");
}

function actualizarProducto(id, campos) {
  const productos = DB.productos();
  Object.assign(productos.find(p => p.id === id), campos);
  DB.guardarProductos(productos);
}

function leerImagen(archivo) {
  return new Promise(res => {
    if (!archivo) return res("");
    const lector = new FileReader();
    lector.onload = () => {
      const img = new Image();
      img.onload = () => { // reduce la foto para no llenar el almacenamiento
        const esc = Math.min(1, 400 / Math.max(img.width, img.height));
        const c = document.createElement("canvas");
        c.width = img.width * esc; c.height = img.height * esc;
        c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
        res(c.toDataURL("image/jpeg", 0.8));
      };
      img.src = lector.result;
    };
    lector.readAsDataURL(archivo);
  });
}

$("#formProducto").addEventListener("submit", async e => {
  e.preventDefault();
  const productos = DB.productos();
  productos.unshift({
    id: nuevoId("p"),
    nombre: $("#pNombre").value.trim(),
    categoria: $("#pCategoria").value,
    precio: parseFloat($("#pPrecio").value),
    stock: parseInt($("#pStock").value, 10),
    imagen: await leerImagen($("#pImagen").files[0])
  });
  DB.guardarProductos(productos);
  e.target.reset();
  avisar("Producto agregado al catálogo");
  renderInventario();
});

/* ----- Eventos delegados ----- */
document.addEventListener("click", e => {
  const d = e.target.dataset;
  if (d.vender) marcarVendido(d.vender);
  if (d.cancelar) cancelarPedido(d.cancelar);
  if (d.stockMas || d.stockMenos) {
    const id = d.stockMas || d.stockMenos;
    const p = DB.productos().find(x => x.id === id);
    actualizarProducto(id, { stock: Math.max(0, p.stock + (d.stockMas ? 1 : -1)) });
    renderInventario();
  }
  if (d.borrar && confirm("¿Eliminar este producto del catálogo?")) {
    DB.guardarProductos(DB.productos().filter(p => p.id !== d.borrar));
    renderInventario();
  }
});
document.addEventListener("change", e => {
  const d = e.target.dataset;
  if (d.stock) { actualizarProducto(d.stock, { stock: Math.max(0, parseInt(e.target.value, 10) || 0) }); renderInventario(); }
  if (d.precio) { actualizarProducto(d.precio, { precio: Math.max(0, parseFloat(e.target.value) || 0) }); avisar("Precio actualizado"); }
});
