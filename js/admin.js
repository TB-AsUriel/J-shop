/* ===== Panel de administración ===== */
const login = $("#login"), panel = $("#panelAdmin");
let productosAdmin = [];

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

async function renderTodo() {
  await Promise.all([renderVentas(), renderPedidos(), renderInventario()]);
}

/* ===== VENTAS: día, semana, mes ===== */
async function renderVentas() {
  try {
    const datos = await API.ventas();
    const filas = [["Hoy", datos.hoy], ["Esta semana", datos.semana], ["Este mes", datos.mes]];

    $("#metricas").innerHTML = filas.map(([titulo, r]) =>
      `<div class="metrica"><span>${titulo}</span><strong>${dinero(r.total)}</strong><small>${r.pedidos} pedido(s) · ${r.piezas} pieza(s)</small></div>`
    ).join("");

    const max = Math.max(...datos.dias.map(d => d.total), 1);
    $("#grafica").innerHTML = datos.dias.map(d =>
      `<div class="barra-dia"><b>${d.total ? dinero(d.total) : ""}</b><div class="col" style="height:${(d.total / max) * 100}%"></div><span>${esc(d.etiqueta)}</span></div>`
    ).join("");
  } catch (e) {
    avisar(e.message);
  }
}

/* ===== PEDIDOS ===== */
async function renderPedidos() {
  let todos;
  try {
    todos = await API.pedidos();
  } catch (e) {
    avisar(e.message);
    $("#listaPedidos").innerHTML = `<p class="nota">No se pudieron cargar los pedidos.</p>`;
    return;
  }

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
        <div><strong>${esc(p.cliente)}</strong> <span class="nota">· ${esc(p.folio)} · ${new Date(p.fecha.replace(" ", "T")).toLocaleString("es-MX")}</span></div>
        <span class="etiqueta ${p.estado}">${nombres[p.estado]}</span>
      </div>
      <ul>${p.items.map(i => `<li>${i.cantidad} × ${esc(i.nombre)} (${dinero(i.precio)})</li>`).join("")}</ul>
      <div class="acciones-pedido">
        <strong>${dinero(p.total)}</strong>
        ${p.estado === "pendiente" ? `<button class="btn-vender" data-vender="${p.id}">Marcar como vendido</button><button class="btn-cancelar" data-cancelar="${p.id}">Cancelar</button>` : ""}
      </div>
    </article>`).join("");
}

async function marcarVendido(id) {
  try {
    await API.accionPedido(id, "vender");
    avisar("Venta registrada y stock actualizado");
    renderTodo();
  } catch (e) {
    avisar(e.message);
  }
}

async function cancelarPedido(id) {
  if (!confirm("¿Cancelar este pedido?")) return;
  try {
    await API.accionPedido(id, "cancelar");
    renderTodo();
  } catch (e) {
    avisar(e.message);
  }
}
$("#filtroEstado").addEventListener("change", renderPedidos);

/* ===== INVENTARIO ===== */
$("#pCategoria").innerHTML = CATEGORIAS.map(c => `<option value="${c.id}">${esc(c.nombre)}</option>`).join("");

async function renderInventario() {
  try {
    productosAdmin = await API.productos();
  } catch (e) {
    avisar(e.message);
    return;
  }

  $("#tablaProductos").innerHTML = productosAdmin.map(p => `
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

async function actualizarProducto(id, campos) {
  try {
    await API.actualizarProducto(id, campos);
    await renderInventario();
  } catch (e) {
    avisar(e.message);
  }
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
  const imagen = await leerImagen($("#pImagen").files[0]);

  try {
    await API.crearProducto({
      nombre: $("#pNombre").value.trim(),
      categoria: $("#pCategoria").value,
      precio: parseFloat($("#pPrecio").value),
      stock: parseInt($("#pStock").value, 10),
      imagen
    });
    e.target.reset();
    avisar("Producto agregado al catálogo");
    renderInventario();
  } catch (err) {
    avisar(err.message);
  }
});

/* ----- Eventos delegados ----- */
document.addEventListener("click", async e => {
  const d = e.target.dataset;

  if (d.vender) { marcarVendido(Number(d.vender)); return; }
  if (d.cancelar) { cancelarPedido(Number(d.cancelar)); return; }

  if (d.stockMas || d.stockMenos) {
    const id = Number(d.stockMas || d.stockMenos);
    const p = productosAdmin.find(x => Number(x.id) === id);
    if (!p) return;
    const stock = Math.max(0, Number(p.stock) + (d.stockMas ? 1 : -1));
    await actualizarProducto(id, { stock });
    return;
  }

  if (d.borrar && confirm("¿Eliminar este producto del catálogo?")) {
    try {
      await API.eliminarProducto(Number(d.borrar));
      avisar("Producto eliminado del catálogo");
      renderInventario();
    } catch (err) {
      avisar(err.message);
    }
  }
});

document.addEventListener("change", async e => {
  const d = e.target.dataset;

  if (d.stock) {
    await actualizarProducto(Number(d.stock), { stock: Math.max(0, parseInt(e.target.value, 10) || 0) });
  }

  if (d.precio) {
    try {
      await API.actualizarProducto(Number(d.precio), { precio: Math.max(0, parseFloat(e.target.value) || 0) });
      avisar("Precio actualizado");
    } catch (err) {
      avisar(err.message);
    }
  }
});
