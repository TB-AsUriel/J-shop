/* ===== Cliente del API PHP ===== */
const API = {
  base: "api/",

  async pedir(recurso, { method = "GET", body, query } = {}) {
    let url = this.base + recurso;

    if (query) {
      const params = new URLSearchParams();
      Object.entries(query).forEach(([clave, valor]) => {
        if (valor !== undefined && valor !== null && valor !== "") params.append(clave, valor);
      });
      const qs = params.toString();
      if (qs) url += "?" + qs;
    }

    const config = { method, headers: {} };
    if (body !== undefined) {
      config.headers["Content-Type"] = "application/json";
      config.body = JSON.stringify(body);
    }

    let respuesta;
    try {
      respuesta = await fetch(url, config);
    } catch (e) {
      throw new Error("No se pudo conectar con el servidor. ¿Están Apache y MySQL encendidos en XAMPP?");
    }

    let datos;
    try {
      datos = await respuesta.json();
    } catch (e) {
      throw new Error("El servidor devolvió una respuesta no válida. Revisa que el proyecto esté en htdocs y que la base de datos exista.");
    }

    if (!respuesta.ok || !datos.ok) {
      throw new Error(datos.error || "Error al comunicarse con el servidor");
    }

    return datos.data;
  },

  categorias() {
    return this.pedir("categorias.php");
  },

  productos() {
    return this.pedir("productos.php");
  },

  crearProducto(producto) {
    return this.pedir("productos.php", { method: "POST", body: producto });
  },

  actualizarProducto(id, campos) {
    return this.pedir("productos.php", { method: "PUT", query: { id }, body: campos });
  },

  eliminarProducto(id) {
    return this.pedir("productos.php", { method: "DELETE", query: { id } });
  },

  pedidos(estado) {
    return this.pedir("pedidos.php", { query: { estado } });
  },

  crearPedido(pedido) {
    return this.pedir("pedidos.php", { method: "POST", body: pedido });
  },

  accionPedido(id, accion) {
    return this.pedir("pedidos.php", { method: "PUT", query: { id }, body: { accion } });
  },

  ventas() {
    return this.pedir("ventas.php");
  },

  reporteVentas(desde, hasta) {
    return this.pedir("reporte_ventas.php", { query: { desde, hasta } });
  }
};
