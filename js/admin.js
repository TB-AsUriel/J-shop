/* ===== Panel de administración ===== */
const panel = $("#panelAdmin");
let productosAdmin = [];
let productosProveedor = [];
let seleccionProveedor = new Set();
let pedidosAdmin = [];
const STOCK_BAJO = 3;

/* ----- Sesión ----- */
$("#btnSalir").addEventListener("click", () => {
  sessionStorage.removeItem("admin");
  location.replace("login.html");
});

/* ----- Pestañas ----- */
$$(".pestana").forEach(b => b.addEventListener("click", () => {
  $$(".pestana").forEach(x => x.classList.toggle("activa", x === b));
  $$(".tab").forEach(t => t.hidden = t.id !== "tab-" + b.dataset.tab);
  renderTodo();
}));

async function renderTodo() {
  await Promise.all([renderVentas(), renderPedidos(), renderInventario(), renderProveedores(), renderUtilidad()]);
}

/* ===== Helpers de gráficas ===== */
function barrasVerticales(filas) {
  const max = Math.max(1, ...filas.map(f => Math.abs(Number(f.valor) || 0)));
  return filas.map(f => {
    const valor = Number(f.valor) || 0;
    const alto = Math.min(100, (Math.abs(valor) / max) * 100);
    return `<div class="barra-dia">
      <b>${esc(f.texto)}</b>
      <div class="col ${f.clase || ""}" style="height:${alto}%"></div>
      <span>${esc(f.etiqueta)}</span>
    </div>`;
  }).join("");
}

function barrasHorizontales(filas) {
  const max = Math.max(1, ...filas.map(f => Math.abs(Number(f.valor) || 0)));
  return filas.map(f => {
    const valor = Number(f.valor) || 0;
    const ancho = Math.min(100, (Math.abs(valor) / max) * 100);
    return `<div class="barra-h">
      <span class="barra-h-etiqueta" title="${esc(f.etiqueta)}">${esc(f.etiqueta)}</span>
      <div class="pista"><div class="relleno ${f.clase || ""}" style="width:${ancho}%"></div></div>
      <span class="barra-h-valor">${esc(f.texto)}</span>
    </div>`;
  }).join("");
}

function etiquetaStock(stock) {
  const n = Number(stock);
  if (n === 0) return "Agotado";
  if (n === 1) return "Solo queda 1";
  if (n <= STOCK_BAJO) return `Solo quedan ${n}`;
  return "";
}

/* ===== VENTAS: día, semana, mes ===== */
function isoLocal(fecha) {
  return new Date(fecha.getTime() - fecha.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

function inicializarPeriodo() {
  const desde = $("#reporteDesde");
  const hasta = $("#reporteHasta");
  const hoy = new Date();
  if (!desde.value) {
    desde.value = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}-01`;
  }
  if (!hasta.value) {
    hasta.value = isoLocal(hoy);
  }
}

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

    const entregas = datos.entregas || [];
    const maxEntregas = Math.max(...entregas.map(e => e.pedidos), 1);
    $("#graficaEntregas").innerHTML = entregas.map(e =>
      `<div class="barra-dia"><b>${e.pedidos} pedido(s)</b><div class="col" style="height:${(e.pedidos / maxEntregas) * 100}%"></div><span>${esc(e.etiqueta)} · ${dinero(e.total)}</span></div>`
    ).join("");
  } catch (e) {
    avisar(e.message);
  }

  inicializarPeriodo();
  await renderReporteProductos();
}

async function renderReporteProductos() {
  const desde = $("#reporteDesde").value;
  const hasta = $("#reporteHasta").value;

  try {
    const datos = await API.reporteVentas(desde, hasta);
    if (!desde) $("#reporteDesde").value = datos.desde;
    if (!hasta) $("#reporteHasta").value = datos.hasta;

    if (!datos.productos.length) {
      $("#tablaReporteProductos").innerHTML = `<tr><td colspan="3" class="nota">No hay ventas en este periodo.</td></tr>`;
    } else {
      $("#tablaReporteProductos").innerHTML = datos.productos.map(p => `
        <tr>
          <td>${esc(p.nombre)}</td>
          <td>${p.piezas}</td>
          <td>${dinero(p.total)}</td>
        </tr>`).join("");
    }

    $("#resumenReporte").textContent =
      `Periodo ${datos.desde} a ${datos.hasta} · ${datos.piezas} pieza(s) · ${dinero(datos.total)}`;
  } catch (e) {
    avisar(e.message);
  }
}

function aplicarPeriodo(tipo) {
  const hoy = new Date();
  let desde;
  if (tipo === "hoy") {
    desde = new Date(hoy);
  } else if (tipo === "semana") {
    desde = new Date(hoy);
    desde.setDate(desde.getDate() - 6);
  } else {
    desde = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
  }
  $("#reporteDesde").value = isoLocal(desde);
  $("#reporteHasta").value = isoLocal(hoy);
  renderReporteProductos();
}

$("#reporteDesde").addEventListener("change", renderReporteProductos);
$("#reporteHasta").addEventListener("change", renderReporteProductos);
$$("[data-periodo]").forEach(b => b.addEventListener("click", () => aplicarPeriodo(b.dataset.periodo)));

/* ===== UTILIDAD ===== */
function inicializarPeriodoUtilidad() {
  const desde = $("#utilidadDesde");
  const hasta = $("#utilidadHasta");
  const hoy = new Date();
  if (!desde.value) {
    desde.value = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}-01`;
  }
  if (!hasta.value) {
    hasta.value = isoLocal(hoy);
  }
  if (!$("#gFecha").value) {
    $("#gFecha").value = isoLocal(hoy);
  }
}

async function renderUtilidad() {
  inicializarPeriodoUtilidad();
  const desde = $("#utilidadDesde").value;
  const hasta = $("#utilidadHasta").value;

  try {
    const datos = await API.utilidad(desde, hasta);
    if (!desde) $("#utilidadDesde").value = datos.desde;
    if (!hasta) $("#utilidadHasta").value = datos.hasta;

    const tarjetas = [
      ["Ingresos", dinero(datos.ingresos), `${datos.piezas} pieza(s)`],
      ["Costo de productos", dinero(datos.costo_total), "Costo del proveedor"],
      ["Utilidad bruta", dinero(datos.utilidad_bruta), "Ventas − costo"],
      ["Margen", `${Number(datos.margen).toFixed(2)}%`, "Utilidad ÷ ventas"],
      ["Gastos del periodo", dinero(datos.gastos), "Gastos del negocio"],
      ["Utilidad neta", dinero(datos.utilidad_neta), "Utilidad bruta − gastos"]
    ];

    $("#metricasUtilidad").innerHTML = tarjetas.map(([titulo, valor, nota], i) => {
      const negativa = (i === 2 && datos.utilidad_bruta < 0) || (i === 5 && datos.utilidad_neta < 0);
      return `<div class="metrica${negativa ? " metrica-negativa" : ""}">
        <span>${titulo}</span><strong>${valor}</strong><small>${nota}</small>
      </div>`;
    }).join("");

    renderGraficasUtilidad(datos);

    if (!datos.productos.length) {
      $("#tablaUtilidad").innerHTML = `<tr><td colspan="7" class="nota">No hay ventas en este periodo.</td></tr>`;
    } else {
      $("#tablaUtilidad").innerHTML = datos.productos.map(p => `
        <tr>
          <td>${esc(p.nombre)}</td>
          <td>${p.piezas}</td>
          <td>${dinero(p.ingresos)}</td>
          <td>${dinero(p.costo_unitario)}</td>
          <td>${dinero(p.costo_total)}</td>
          <td class="${p.utilidad_bruta < 0 ? "valor-negativo" : "valor-positivo"}">${dinero(p.utilidad_bruta)}</td>
          <td class="${p.margen < 0 ? "valor-negativo" : "valor-positivo"}">${Number(p.margen).toFixed(2)}%</td>
        </tr>`).join("");
    }

    $("#resumenUtilidad").textContent =
      `Periodo ${datos.desde} a ${datos.hasta} · ${datos.piezas} pieza(s) · Margen ${Number(datos.margen).toFixed(2)}%`;
  } catch (e) {
    avisar(e.message);
  }

  await renderGastos(desde, hasta);
}

function renderGraficasUtilidad(datos) {
  const filas = [
    { etiqueta: "Ingresos", valor: datos.ingresos, texto: dinero(datos.ingresos), clase: "ingreso" },
    { etiqueta: "Costo de productos", valor: datos.costo_total, texto: dinero(datos.costo_total), clase: "costo" },
    {
      etiqueta: "Utilidad bruta",
      valor: datos.utilidad_bruta,
      texto: dinero(datos.utilidad_bruta),
      clase: datos.utilidad_bruta < 0 ? "negativo" : "positivo"
    },
    { etiqueta: "Gastos", valor: datos.gastos, texto: dinero(datos.gastos), clase: "gasto" },
    {
      etiqueta: "Utilidad neta",
      valor: datos.utilidad_neta,
      texto: dinero(datos.utilidad_neta),
      clase: datos.utilidad_neta < 0 ? "negativo" : "positivo"
    }
  ];

  $("#graficaUtilidadComparativo").innerHTML = barrasHorizontales(filas);

  const productos = [...datos.productos].sort((a, b) => Number(b.utilidad_bruta) - Number(a.utilidad_bruta));
  $("#graficaUtilidadProductos").innerHTML = productos.length
    ? barrasHorizontales(productos.map(p => ({
        etiqueta: p.nombre,
        valor: p.utilidad_bruta,
        texto: `${dinero(p.utilidad_bruta)} · ${Number(p.margen).toFixed(1)}%`,
        clase: Number(p.utilidad_bruta) < 0 ? "negativo" : "positivo"
      })))
    : `<p class="nota">No hay ventas en este periodo.</p>`;
}

async function renderGastos(desde, hasta) {
  try {
    const gastos = await API.gastos(desde, hasta);

    if (!gastos.length) {
      $("#tablaGastos").innerHTML = `<tr><td colspan="4" class="nota">No hay gastos registrados en este periodo.</td></tr>`;
    } else {
      $("#tablaGastos").innerHTML = gastos.map(g => `
        <tr>
          <td>${esc(g.fecha)}</td>
          <td>${esc(g.concepto)}</td>
          <td>${dinero(g.monto)}</td>
          <td><button class="btn-borrar" data-borrar-gasto="${g.id}">Eliminar</button></td>
        </tr>`).join("");
    }

    const total = gastos.reduce((suma, g) => suma + Number(g.monto), 0);
    $("#totalGastos").textContent = `Total de gastos del periodo: ${dinero(total)}`;
  } catch (e) {
    avisar(e.message);
  }
}

function aplicarPeriodoUtilidad(tipo) {
  const hoy = new Date();
  let desde;
  if (tipo === "hoy") {
    desde = new Date(hoy);
  } else if (tipo === "semana") {
    desde = new Date(hoy);
    desde.setDate(desde.getDate() - 6);
  } else {
    desde = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
  }
  $("#utilidadDesde").value = isoLocal(desde);
  $("#utilidadHasta").value = isoLocal(hoy);
  renderUtilidad();
}

$("#utilidadDesde").addEventListener("change", renderUtilidad);
$("#utilidadHasta").addEventListener("change", renderUtilidad);
$$("[data-periodo-utilidad]").forEach(b => b.addEventListener("click", () => aplicarPeriodoUtilidad(b.dataset.periodoUtilidad)));

$("#formGasto").addEventListener("submit", async e => {
  e.preventDefault();
  try {
    await API.crearGasto({
      concepto: $("#gConcepto").value.trim(),
      monto: parseFloat($("#gMonto").value),
      fecha: $("#gFecha").value
    });
    $("#gConcepto").value = "";
    $("#gMonto").value = "";
    avisar("Gasto agregado");
    renderUtilidad();
  } catch (err) {
    avisar(err.message);
  }
});

/* ===== PEDIDOS ===== */
function renderResumenPedidos(todos) {
  const estados = [
    { id: "pendiente", nombre: "Pendientes" },
    { id: "completado", nombre: "Vendidos" },
    { id: "cancelado", nombre: "Cancelados" }
  ];

  const resumen = estados.map(e => {
    const pedidos = todos.filter(p => p.estado === e.id);
    return {
      ...e,
      cantidad: pedidos.length,
      total: pedidos.reduce((suma, p) => suma + Number(p.total || 0), 0)
    };
  });

  $("#metricasPedidos").innerHTML = [
    ["Pedidos totales", todos.length, "Todos los estados"],
    ...resumen.map(r => [r.nombre, r.cantidad, dinero(r.total)])
  ].map(([titulo, valor, nota]) =>
    `<div class="metrica">
      <span>${titulo}</span><strong>${valor}</strong><small>${nota}</small>
    </div>`
  ).join("");

  if (!todos.length) {
    $("#graficaPedidosEstado").innerHTML = `<p class="nota">Aún no hay pedidos registrados.</p>`;
    $("#graficaPedidosDias").innerHTML = `<p class="nota">Aún no hay pedidos registrados.</p>`;
    return;
  }

  $("#graficaPedidosEstado").innerHTML = barrasVerticales(resumen.map(r => ({
    etiqueta: r.nombre,
    valor: r.cantidad,
    texto: `${r.cantidad} · ${dinero(r.total)}`,
    clase: r.id
  })));

  const abreviaturas = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];
  const hoy = new Date();
  const porDia = {};
  todos.forEach(p => {
    if (!p.fecha) return;
    const fecha = new Date(p.fecha.replace(" ", "T"));
    if (Number.isNaN(fecha.getTime())) return;
    const clave = isoLocal(fecha);
    porDia[clave] = (porDia[clave] || 0) + 1;
  });

  const dias = [];
  for (let i = 6; i >= 0; i--) {
    const dia = new Date(hoy);
    dia.setDate(hoy.getDate() - i);
    const cantidad = porDia[isoLocal(dia)] || 0;
    dias.push({
      etiqueta: `${abreviaturas[dia.getDay()]} ${dia.getDate()}`,
      valor: cantidad,
      texto: `${cantidad} pedido(s)`
    });
  }

  $("#graficaPedidosDias").innerHTML = barrasVerticales(dias);
}

async function renderPedidos() {
  let todos;
  try {
    todos = await API.pedidos();
  } catch (e) {
    avisar(e.message);
    $("#listaPedidos").innerHTML = `<p class="nota">No se pudieron cargar los pedidos.</p>`;
    return;
  }
  pedidosAdmin = todos;

  renderResumenPedidos(todos);

  const pend = todos.filter(p => p.estado === "pendiente").length;
  $("#badgePedidos").textContent = pend || "";
  $("#badgePedidos").hidden = !pend;

  const filtro = $("#filtroEstado").value;
  const lista = todos.filter(p => filtro === "todos" || p.estado === filtro);
  if (!lista.length) { $("#listaPedidos").innerHTML = `<p class="nota">No hay pedidos en esta lista.</p>`; return; }

  const nombres = { pendiente: "Pendiente", completado: "Vendido", cancelado: "Cancelado" };
  $("#listaPedidos").innerHTML = lista.map(p => {
    const entrega = [];
    if (p.fechaEntrega) entrega.push(`${icono("calendar")} ${esc(p.fechaEntrega)}`);
    if (p.horaEntrega) entrega.push(`${icono("clock")} ${esc(p.horaEntrega)}`);
    if (p.lugar) entrega.push(`${icono("map-pin")} ${esc(p.lugar)}`);

    const acciones = p.estado === "pendiente"
      ? `<button class="btn-vender" data-vender="${p.id}">Marcar como vendido</button><button class="btn-cancelar" data-cancelar="${p.id}">Cancelar</button>`
      : p.estado === "completado"
        ? `<button class="btn-cancelar" data-cancelar="${p.id}">Cancelar venta</button>`
        : "";

    return `
    <article class="pedido">
      <div class="pedido-cab">
        <div><strong>${esc(p.cliente)}</strong> <span class="nota">· ${esc(p.folio)} · ${new Date(p.fecha.replace(" ", "T")).toLocaleString("es-MX")}</span></div>
        <span class="etiqueta ${p.estado}">${nombres[p.estado]}</span>
      </div>
      ${entrega.length ? `<div class="pedido-entrega nota">${entrega.join(" · ")}</div>` : ""}
      <ul>${p.items.map(i => `<li>${i.cantidad} × ${esc(i.nombre)} (${dinero(i.precio)})</li>`).join("")}</ul>
      <div class="acciones-pedido">
        <strong>${dinero(p.total)}</strong>
        ${acciones}
      </div>
    </article>`;
  }).join("");
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
  const pedido = pedidosAdmin.find(p => Number(p.id) === Number(id));
  const mensaje = pedido && pedido.estado === "completado"
    ? "¿Cancelar esta venta? Solo se marcará como cancelada."
    : "¿Cancelar este pedido?";
  if (!confirm(mensaje)) return;
  try {
    await API.accionPedido(id, "cancelar");
    avisar("Pedido cancelado");
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
    productosAdmin = await API.productos(true);
  } catch (e) {
    avisar(e.message);
    return;
  }

  renderResumenInventario();

  $("#tablaProductos").innerHTML = productosAdmin.map(p => {
    const alerta = etiquetaStock(p.stock);
    const agotado = Number(p.stock) === 0;
    return `
    <tr>
      <td>${esc(p.nombre)}</td>
      <td>${esc(categoriaDe(p.categoria).nombre)}</td>
      <td><input type="number" min="0" step="0.01" value="${p.precio}" data-precio="${p.id}" aria-label="Precio de ${esc(p.nombre)}"></td>
      <td><input type="number" min="0" step="0.01" value="${p.costo}" data-costo="${p.id}" aria-label="Costo de ${esc(p.nombre)}"></td>
      <td>
        <div class="stock-ctrl ${Number(p.stock) <= STOCK_BAJO ? "stock-bajo" : ""}">
          <button data-stock-menos="${p.id}" aria-label="Restar uno">−</button>
          <input type="number" min="0" step="1" value="${p.stock}" data-stock="${p.id}" aria-label="Stock de ${esc(p.nombre)}">
          <button data-stock-mas="${p.id}" aria-label="Sumar uno">+</button>
        </div>
        ${alerta ? `<span class="alerta-stock${agotado ? " agotado" : ""}">${alerta}</span>` : ""}
      </td>
      <td><button class="btn-borrar" data-borrar="${p.id}">Eliminar</button></td>
    </tr>`;
  }).join("");
}

function renderResumenInventario() {
  const unidades = productosAdmin.reduce((suma, p) => suma + Number(p.stock || 0), 0);
  const bajos = productosAdmin
    .filter(p => Number(p.stock) > 0 && Number(p.stock) <= STOCK_BAJO)
    .sort((a, b) => Number(a.stock) - Number(b.stock));
  const agotados = productosAdmin.filter(p => Number(p.stock) === 0);

  $("#metricasInventario").innerHTML = [
    ["Productos", productosAdmin.length, "En catálogo"],
    ["Unidades en stock", unidades, "Piezas disponibles"],
    ["Stock bajo", bajos.length, `Quedan ${STOCK_BAJO} o menos`],
    ["Agotados", agotados.length, "Sin unidades"]
  ].map(([titulo, valor, nota], i) => {
    const alerta = i >= 2 && valor > 0 ? " metrica-alerta" : "";
    return `<div class="metrica${alerta}">
      <span>${titulo}</span><strong>${valor}</strong><small>${nota}</small>
    </div>`;
  }).join("");

  const alertas = [...agotados, ...bajos].sort((a, b) => Number(a.stock) - Number(b.stock));
  const banner = $("#alertasInventario");
  if (alertas.length) {
    banner.hidden = false;
    banner.innerHTML = `
      <div class="alerta-cab">
        ${icono("alert-triangle")}
        <strong>${alertas.length} producto(s) requieren reposición</strong>
      </div>
      <div class="alerta-chips">
        ${alertas.map(p => {
          const agotado = Number(p.stock) === 0;
          return `<span class="alerta-chip${agotado ? " agotado" : ""}">
            ${esc(p.nombre)} · ${etiquetaStock(p.stock)}
          </span>`;
        }).join("")}
      </div>`;
  } else {
    banner.hidden = true;
    banner.innerHTML = "";
  }

  const ordenados = [...productosAdmin].sort((a, b) => Number(a.stock) - Number(b.stock));
  $("#graficaInventario").innerHTML = ordenados.length
    ? barrasHorizontales(ordenados.map(p => {
        const stock = Number(p.stock);
        return {
          etiqueta: p.nombre,
          valor: stock,
          texto: stock === 0 ? "Agotado" : `${stock} ud${stock === 1 ? "" : "s"}.`,
          clase: stock === 0 ? "agotado" : stock <= STOCK_BAJO ? "bajo" : "normal"
        };
      }))
    : `<p class="nota">No hay productos en el inventario.</p>`;
}

async function actualizarProducto(id, campos) {
  try {
    await API.actualizarProducto(id, campos);
    await renderInventario();
    await renderProveedores();
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
      costo: parseFloat($("#pCosto").value),
      stock: parseInt($("#pStock").value, 10),
      imagen
    });
    e.target.reset();
    avisar("Producto agregado al catálogo");
    renderInventario();
    renderProveedores();
  } catch (err) {
    avisar(err.message);
  }
});

/* ===== PROVEEDORES ===== */
async function renderProveedores() {
  try {
    const todos = await API.productos(true);
    productosProveedor = todos.sort((a, b) => a.stock - b.stock);
  } catch (e) {
    avisar(e.message);
    return;
  }

  const sinProductos = productosProveedor.length === 0;
  $("#sinProveedores").hidden = !sinProductos;
  $("#btnMensajeProveedor").disabled = sinProductos;

  $("#graficaProveedores").innerHTML = productosProveedor.length
    ? barrasHorizontales(productosProveedor.map(p => {
        const stock = Number(p.stock);
        return {
          etiqueta: p.nombre,
          valor: stock,
          texto: stock === 0 ? "Agotado" : `${stock} ud${stock === 1 ? "" : "s"}.`,
          clase: stock === 0 ? "agotado" : stock <= STOCK_BAJO ? "bajo" : "normal"
        };
      }))
    : `<p class="nota">No hay productos en el inventario.</p>`;

  seleccionProveedor = new Set();
  $("#seleccionarTodos").checked = false;

  $("#listaProveedores").innerHTML = productosProveedor.map(p => `
    <div class="proveedor-item">
      <label class="proveedor-check">
        <input type="checkbox" data-proveedor="${p.id}" ${seleccionProveedor.has(Number(p.id)) ? "checked" : ""}>
        <span class="proveedor-info">
          <strong>${esc(p.nombre)}</strong>
          <small>${p.stock === 0 ? "Agotado" : `Stock actual: ${p.stock}`} · ${esc(categoriaDe(p.categoria).nombre)}</small>
        </span>
      </label>
      <label class="proveedor-cantidad">
        <span>Solicitar</span>
        <input type="number" min="1" step="1" value="10" data-cantidad="${p.id}" aria-label="Cantidad a solicitar de ${esc(p.nombre)}">
      </label>
    </div>`).join("");
}

function enviarMensajeProveedor() {
  const elegidos = productosProveedor.filter(p => seleccionProveedor.has(Number(p.id)));
  if (!elegidos.length) {
    avisar("Selecciona al menos un producto para solicitar");
    return;
  }

  const lineas = elegidos.map(p => {
    const campo = document.querySelector(`[data-cantidad="${p.id}"]`);
    const cantidad = Math.max(1, parseInt(campo ? campo.value : "1", 10) || 1);
    const estado = p.stock === 0 ? "agotado" : `stock actual: ${p.stock}`;
    return `• ${p.nombre} (${estado}) — solicito: ${cantidad}`;
  });

  const mensaje = `Hola, soy de ${CONFIG.tienda}. Necesito reponer los siguientes productos:\n${lineas.join("\n")}`;
  const numero = CONFIG.whatsappProveedor || CONFIG.whatsapp;
  window.open(`https://wa.me/${numero}?text=${encodeURIComponent(mensaje)}`, "_blank");
}

$("#btnMensajeProveedor").addEventListener("click", enviarMensajeProveedor);

$("#seleccionarTodos").addEventListener("change", e => {
  const marcar = e.target.checked;
  $$("[data-proveedor]").forEach(chk => {
    chk.checked = marcar;
    const id = Number(chk.dataset.proveedor);
    if (marcar) seleccionProveedor.add(id);
    else seleccionProveedor.delete(id);
  });
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

  if (d.borrarGasto && confirm("¿Eliminar este gasto?")) {
    try {
      await API.eliminarGasto(Number(d.borrarGasto));
      avisar("Gasto eliminado");
      renderUtilidad();
    } catch (err) {
      avisar(err.message);
    }
    return;
  }

  if (d.borrar && confirm("¿Eliminar este producto del catálogo?")) {
    try {
      await API.eliminarProducto(Number(d.borrar));
      avisar("Producto eliminado del catálogo");
      renderInventario();
      renderProveedores();
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

  if (d.costo) {
    try {
      await API.actualizarProducto(Number(d.costo), { costo: Math.max(0, parseFloat(e.target.value) || 0) });
      avisar("Costo actualizado");
      renderUtilidad();
    } catch (err) {
      avisar(err.message);
    }
  }

  if (d.proveedor) {
    const id = Number(d.proveedor);
    if (e.target.checked) seleccionProveedor.add(id);
    else seleccionProveedor.delete(id);
    $("#seleccionarTodos").checked = seleccionProveedor.size === productosProveedor.length && productosProveedor.length > 0;
  }
});

/* ----- Arranque / guardia de sesión ----- */
if (sessionStorage.getItem("admin") !== "1") {
  location.replace("login.html");
} else {
  panel.hidden = false;
  renderTodo();
}
