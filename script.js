
"use strict";

/* ==========================================
   CONTROL DE INVENTARIOS ECCI
   ========================================== */

const STORAGE_KEY = "ecci_inventory_products";
const MOVEMENTS_KEY = "ecci_inventory_movements";

let products = loadData(STORAGE_KEY, []);
let movements = loadData(MOVEMENTS_KEY, []);
let toastTimer = null;

/* ==========================================
   PRODUCTOS INICIALES
   ========================================== */

const DEFAULT_PRODUCTS = [
  {
    id: "ecci-default-01",
    name: "Yogur líquido (Colanta / Finesse)",
    code: "YOG-001",
    kitchen: "La Scala",
    category: "Buffet",
    unit: "Botellas",
    content: 1500,
    contentUnit: "ml",
    cd: 1,
    min: 2,
    pr: 4,
    max: 6,
    quantity: 12,
    expiry: "2026-10-26",
    notes: ""
  },
  {
    id: "ecci-default-02",
    name: "Queso doble crema (250 g)",
    code: "QUE-001",
    kitchen: "La Scala",
    category: "Spa y Buffet",
    unit: "Unidades",
    content: 250,
    contentUnit: "g",
    cd: 2,
    min: 4,
    pr: 8,
    max: 14,
    quantity: 32,
    expiry: "2026-12-12",
    notes: ""
  },
  {
    id: "ecci-default-03",
    name: "Leche entera UHT",
    code: "LEC-001",
    kitchen: "La Scala",
    category: "Buffet",
    unit: "Litros",
    content: 1,
    contentUnit: "L",
    cd: 6,
    min: 12,
    pr: 18,
    max: 30,
    quantity: 10,
    expiry: "2026-11-30",
    notes: ""
  },
  {
    id: "ecci-default-04",
    name: "Jamón de pierna tajado",
    code: "JAM-001",
    kitchen: "La Scala",
    category: "Buffet",
    unit: "Paquetes",
    content: 500,
    contentUnit: "g",
    cd: 2,
    min: 4,
    pr: 6,
    max: 10,
    quantity: 4,
    expiry: "2026-11-28",
    notes: ""
  },
  {
    id: "ecci-default-05",
    name: "Bresaola",
    code: "BRE-001",
    kitchen: "El Mirador",
    category: "Carta / Eventos",
    unit: "Paquetes",
    content: 100,
    contentUnit: "g",
    cd: 0,
    min: 0,
    pr: 0,
    max: 1,
    quantity: 7,
    expiry: "2026-06-18",
    notes: ""
  },
  {
    id: "ecci-default-06",
    name: "Yogur griego",
    code: "YOG-002",
    kitchen: "La Scala",
    category: "Buffet",
    unit: "Tarros",
    content: 1,
    contentUnit: "unidades",
    cd: 0,
    min: 0,
    pr: 0,
    max: 1,
    quantity: 2,
    expiry: "2026-11-29",
    notes: ""
  },
  {
    id: "ecci-default-07",
    name: "Tofu",
    code: "TOF-001",
    kitchen: "El Mirador",
    category: "Carta",
    unit: "Paquetes",
    content: 250,
    contentUnit: "g",
    cd: 0,
    min: 0,
    pr: 0,
    max: 1,
    quantity: 0,
    expiry: "",
    notes: ""
  }
];

/* ==========================================
   ALMACENAMIENTO
   ========================================== */

function loadData(key, fallback) {
  try {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : fallback;
  } catch (error) {
    console.error("Error leyendo almacenamiento:", error);
    return fallback;
  }
}

function saveData() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(products));
  localStorage.setItem(MOVEMENTS_KEY, JSON.stringify(movements));
}

function addDefaultProducts() {
  const ids = new Set(products.map(p => p.id));
  const names = new Set(
    products.map(p => String(p.name || "").trim().toLowerCase())
  );

  DEFAULT_PRODUCTS.forEach(item => {
    if (!ids.has(item.id) && !names.has(item.name.toLowerCase())) {
      products.push({ ...item });
    }
  });

  saveData();
}

/* ==========================================
   FUNCIONES GENERALES
   ========================================== */

function uid() {
  return "prod-" + Date.now().toString(36) +
    Math.random().toString(36).slice(2, 7);
}

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[char]);
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString("es-CO", {
    maximumFractionDigits: 2
  });
}

function formatDate(date) {
  if (!date) return "Bajo reserva";

  const parts = date.split("-");
  if (parts.length !== 3) return "Sin fecha";

  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

function dateDifference(date) {
  if (!date) return null;

  const [year, month, day] = date.split("-").map(Number);
  const expiry = Date.UTC(year, month - 1, day);

  const now = new Date();
  const today = Date.UTC(
    now.getFullYear(),
    now.getMonth(),
    now.getDate()
  );

  return Math.round((expiry - today) / 86400000);
}

function showToast(message) {
  const toast = document.getElementById("toast");

  toast.textContent = message;
  toast.classList.add("show");

  clearTimeout(toastTimer);

  toastTimer = setTimeout(() => {
    toast.classList.remove("show");
  }, 3000);
}

function getProduct(id) {
  return products.find(p => p.id === id);
}

/* ==========================================
   ESTADO DEL STOCK
   ========================================== */

function stockState(product) {
  const quantity = Number(product.quantity || 0);
  const min = Number(product.min || 0);
  const pr = Number(product.pr ?? min);
  const max = Number(product.max || 0);
  const cd = Number(product.cd || 0);

  if (quantity === 0) {
    return {
      key: "out",
      label: "Stock agotado",
      color: "red"
    };
  }

  if (quantity <= min) {
    return {
      key: "low",
      label: "Stock mínimo - pedir",
      color: "red"
    };
  }

  if (cd === 0 && quantity > max) {
    return {
      key: "rotation",
      label: "Baja rotación - priorizar",
      color: "orange"
    };
  }

  if (quantity > max) {
    return {
      key: "over",
      label: "Stock máximo - sobrestock",
      color: "blue"
    };
  }

  if (quantity <= pr) {
    return {
      key: "reorder",
      label: "Punto de reposición",
      color: "orange"
    };
  }

  if (cd === 0) {
    return {
      key: "normal",
      label: "Óptimo / bajo pedido",
      color: "green"
    };
  }

  return {
    key: "normal",
    label: "Stock óptimo",
    color: "green"
  };
}

/* ==========================================
   ESTADO DE VENCIMIENTOS
   ========================================== */

function expiryState(product) {
  if (!product.expiry) return null;

  const days = dateDifference(product.expiry);

  if (days < 0) {
    return {
      key: "expired",
      label: "Vencido",
      color: "red",
      days
    };
  }

  if (days <= 7) {
    return {
      key: "soon",
      label: "Vence pronto",
      color: "orange",
      days
    };
  }

  if (days <= 30) {
    return {
      key: "upcoming",
      label: "Próximo a vencer",
      color: "orange",
      days
    };
  }

  return {
    key: "valid",
    label: "Vigente",
    color: "green",
    days
  };
}

function pill(text, color) {
  return `<span class="badge ${color}">${escapeHTML(text)}</span>`;
}

function getPresentation(product) {
  return `${escapeHTML(product.unit)} ${formatNumber(product.content)} ${escapeHTML(product.contentUnit || "")}`;
}

/* ==========================================
   ALERTAS
   ========================================== */

function productAlerts(product) {
  const alerts = [];
  const stock = stockState(product);
  const expiry = expiryState(product);

  if (stock.key === "out") {
    alerts.push({
      color: "red",
      title: "Producto agotado",
      text: `${product.name}: no quedan existencias.`,
      product
    });
  } else if (stock.key === "low") {
    alerts.push({
      color: "red",
      title: "Stock mínimo",
      text: `${product.name}: quedan ${formatNumber(product.quantity)}. Se requiere reposición.`,
      product
    });
  } else if (stock.key === "reorder") {
    alerts.push({
      color: "orange",
      title: "Punto de reposición",
      text: `${product.name}: alcanzó el punto de reposición.`,
      product
    });
  } else if (stock.key === "over") {
    alerts.push({
      color: "blue",
      title: "Sobrestock",
      text: `${product.name}: supera el stock máximo.`,
      product
    });
  } else if (stock.key === "rotation") {
    alerts.push({
      color: "orange",
      title: "Baja rotación",
      text: `${product.name}: tiene existencias sin consumo diario registrado.`,
      product
    });
  }

  if (expiry?.key === "expired") {
    alerts.push({
      color: "red",
      title: "Producto vencido",
      text: `${product.name}: venció el ${formatDate(product.expiry)}.`,
      product
    });
  } else if (expiry?.key === "soon") {
    alerts.push({
      color: "orange",
      title: "Vencimiento próximo",
      text: `${product.name}: vence en ${expiry.days} día(s), el ${formatDate(product.expiry)}.`,
      product
    });
  } else if (expiry?.key === "upcoming") {
    alerts.push({
      color: "orange",
      title: "Próximo vencimiento",
      text: `${product.name}: vence en ${expiry.days} días.`,
      product
    });
  }

  return alerts;
}

function getAllAlerts() {
  return products.flatMap(productAlerts);
}

/* ==========================================
   NAVEGACIÓN
   ========================================== */

const pageNames = {
  dashboard: "Panel principal",
  products: "Productos",
  movements: "Movimientos",
  alerts: "Alertas"
};

function showView(viewName) {
  document.querySelectorAll(".view").forEach(view => {
    view.classList.remove("active");
  });

  document.querySelectorAll(".nav-link[data-view]").forEach(button => {
    button.classList.toggle(
      "active",
      button.dataset.view === viewName
    );
  });

  const target = document.getElementById(viewName + "View");

  if (target) target.classList.add("active");

  document.getElementById("pageTitle").textContent =
    pageNames[viewName] || "Inventario";

  document.getElementById("sidebar").classList.remove("open");
}

document.querySelectorAll("[data-view]").forEach(button => {
  button.addEventListener("click", () => {
    showView(button.dataset.view);
  });
});

document.querySelectorAll("[data-go]").forEach(button => {
  button.addEventListener("click", () => {
    showView(button.dataset.go);
  });
});

document.getElementById("mobileMenu").addEventListener("click", () => {
  document.getElementById("sidebar").classList.toggle("open");
});

/* ==========================================
   MODALES
   ========================================== */

function openModal(id) {
  document.getElementById(id).classList.add("open");
}

function closeModal(id) {
  document.getElementById(id).classList.remove("open");
}

document.querySelectorAll("[data-close]").forEach(button => {
  button.addEventListener("click", () => {
    closeModal(button.dataset.close);
  });
});

document.querySelectorAll(".modal-backdrop").forEach(backdrop => {
  backdrop.addEventListener("click", event => {
    if (event.target === backdrop) {
      backdrop.classList.remove("open");
    }
  });
});

/* ==========================================
   FORMULARIO DE PRODUCTOS
   ========================================== */

function openProductModal(product = null) {
  document.getElementById("productForm").reset();

  document.getElementById("productId").value = product?.id || "";

  document.getElementById("productModalTitle").textContent =
    product ? "Editar producto" : "Nuevo producto";

  document.getElementById("productName").value = product?.name || "";
  document.getElementById("productCode").value = product?.code || "";
  document.getElementById("productKitchen").value = product?.kitchen || "La Scala";
  document.getElementById("productCategory").value = product?.category || "";
  document.getElementById("productUnit").value = product?.unit || "Unidades";

  document.getElementById("productContent").value = product?.content ?? 500;
  document.getElementById("productContentUnit").value = product?.contentUnit || "g";

  document.getElementById("productCD").value = product?.cd ?? 0;
  document.getElementById("productMin").value = product?.min ?? 0;
  document.getElementById("productPR").value = product?.pr ?? product?.min ?? 0;
  document.getElementById("productMax").value = product?.max ?? 1;
  document.getElementById("productQuantity").value = product?.quantity ?? 0;

  document.getElementById("productExpiry").value = product?.expiry || "";
  document.getElementById("productNotes").value = product?.notes || "";

  openModal("productModal");
}

document.getElementById("quickAdd").addEventListener("click", () => {
  openProductModal();
});

document.getElementById("addProductBtn").addEventListener("click", () => {
  openProductModal();
});

document.getElementById("productForm").addEventListener("submit", event => {
  event.preventDefault();

  const id = document.getElementById("productId").value;
  const name = document.getElementById("productName").value.trim();
  const code = document.getElementById("productCode").value.trim();

  const kitchen = document.getElementById("productKitchen").value;
  const category = document.getElementById("productCategory").value.trim();
  const unit = document.getElementById("productUnit").value;

  const content = Number(document.getElementById("productContent").value);
  const contentUnit = document.getElementById("productContentUnit").value;

  const cd = Number(document.getElementById("productCD").value);
  const min = Number(document.getElementById("productMin").value);
  const pr = Number(document.getElementById("productPR").value);
  const max = Number(document.getElementById("productMax").value);
  const quantity = Number(document.getElementById("productQuantity").value);

  const expiry = document.getElementById("productExpiry").value;
  const notes = document.getElementById("productNotes").value.trim();

  if (!name) {
    showToast("Escribe el nombre del producto.");
    return;
  }

  const values = [content, cd, min, pr, max, quantity];

  if (!values.every(Number.isFinite) || content <= 0 ||
      values.slice(1).some(value => value < 0)) {
    showToast("Revisa las cantidades ingresadas.");
    return;
  }

  if (!(min <= pr && pr <= max)) {
    showToast("Los niveles deben cumplir SMIN ≤ PR ≤ SMAX.");
    return;
  }

  const duplicateCode = products.some(product =>
    product.id !== id &&
    code &&
    product.code &&
    product.code.toLowerCase() === code.toLowerCase()
  );

  if (duplicateCode) {
    showToast("Ese código ya está registrado.");
    return;
  }

  const data = {
    id: id || uid(),
    name,
    code,
    kitchen,
    category,
    unit,
    content,
    contentUnit,
    cd,
    min,
    pr,
    max,
    quantity,
    expiry,
    notes,
    updatedAt: new Date().toISOString()
  };

  if (id) {
    products = products.map(product =>
      product.id === id ? { ...product, ...data } : product
    );
  } else {
    products.push({
      ...data,
      createdAt: new Date().toISOString()
    });
  }

  saveData();
  closeModal("productModal");
  renderAll();

  showToast(id ? "Producto actualizado." : "Producto agregado.");
});

/* ==========================================
   TABLA DE PRODUCTOS
   ========================================== */

function renderProducts() {
  const query = document.getElementById("productSearch").value
    .trim().toLowerCase();

  const filter = document.getElementById("statusFilter").value;
  const kitchen = document.getElementById("kitchenFilter").value;

  const list = products.filter(product => {
    const searchable = [
      product.name,
      product.code,
      product.category,
      product.kitchen,
      product.unit
    ].join(" ").toLowerCase();

    const matchSearch = searchable.includes(query);
    const matchKitchen = kitchen === "all" || product.kitchen === kitchen;

    const stock = stockState(product).key;
    const expiry = expiryState(product)?.key;

    const matchStatus =
      filter === "all" ||
      filter === stock ||
      filter === expiry;

    return matchSearch && matchKitchen && matchStatus;
  });

  const tbody = document.getElementById("productsTable");

  if (!list.length) {
    tbody.innerHTML = `
      <tr><td colspan="11">
        <div class="empty-state">No se encontraron productos.</div>
      </td></tr>`;
  } else {
    tbody.innerHTML = list.map(product => {
      const stock = stockState(product);
      const expiry = expiryState(product);

      let statusHTML = pill(stock.label, stock.color);

      if (expiry?.key === "expired") {
        statusHTML += `<br>${pill("VENCIDO", "red")}`;
      } else if (expiry?.key === "soon") {
        statusHTML += `<br>${pill("VENCE PRONTO", "orange")}`;
      } else if (expiry?.key === "upcoming") {
        statusHTML += `<br>${pill("PRÓXIMO A VENCER", "orange")}`;
      }

      const kitchenClass =
        product.kitchen === "El Mirador" ? "mirador" : "";

      const expiryClass =
        expiry?.key === "expired" ? "expiry-danger" :
        expiry?.key === "soon" || expiry?.key === "upcoming" ? "expiry-warning" : "";

      return `
        <tr>
          <td>
            <div class="product-details">
              <strong>${escapeHTML(product.name)}</strong>
              <small>${escapeHTML(product.category || "General")} · ${escapeHTML(product.code || "Sin código")}</small>
            </div>
          </td>

          <td>
            <span class="kitchen-tag ${kitchenClass}">
              ${escapeHTML(product.kitchen || "Sin asignar")}
            </span>
          </td>

          <td>${getPresentation(product)}</td>
          <td>${formatNumber(product.cd)}</td>
          <td class="number-warning">${formatNumber(product.min)}</td>
          <td>${formatNumber(product.pr)}</td>
          <td class="number-warning">${formatNumber(product.max)}</td>

          <td>
            <div class="stock-control">
              <button type="button" data-stock="-1" data-id="${escapeHTML(product.id)}" title="Disminuir">−</button>
              <strong>${formatNumber(product.quantity)}</strong>
              <button type="button" data-stock="1" data-id="${escapeHTML(product.id)}" title="Aumentar">+</button>
            </div>
          </td>

          <td class="${expiryClass}">
            ${formatDate(product.expiry)}
          </td>

          <td>${statusHTML}</td>

          <td>
            <div class="row-actions">
              <button class="icon-btn" data-edit="${escapeHTML(product.id)}" title="Editar">✎</button>
              <button class="icon-btn" data-move="${escapeHTML(product.id)}" title="Movimiento">⇄</button>
              <button class="icon-btn delete" data-delete="${escapeHTML(product.id)}" title="Eliminar">×</button>
            </div>
          </td>
        </tr>`;
    }).join("");
  }

  document.getElementById("productsFooter").textContent =
    `Mostrando ${list.length} de ${products.length} producto(s)`;
}

/* ==========================================
   ACCIONES DE LA TABLA
   ========================================== */

document.getElementById("productsTable").addEventListener("click", event => {
  const editButton = event.target.closest("[data-edit]");
  const deleteButton = event.target.closest("[data-delete]");
  const moveButton = event.target.closest("[data-move]");
  const stockButton = event.target.closest("[data-stock]");

  if (editButton) {
    const product = getProduct(editButton.dataset.edit);
    if (product) openProductModal(product);
  }

  if (deleteButton) {
    const product = getProduct(deleteButton.dataset.delete);

    if (product && confirm(`¿Eliminar "${product.name}" del inventario?`)) {
      products = products.filter(p => p.id !== product.id);
      saveData();
      renderAll();
      showToast("Producto eliminado.");
    }
  }

  if (moveButton) {
    openMovementModal(moveButton.dataset.move);
  }

  if (stockButton) {
    const product = getProduct(stockButton.dataset.id);
    const amount = Number(stockButton.dataset.stock);

    if (product) {
      const newQuantity = Number(product.quantity) + amount;

      if (newQuantity < 0) {
        showToast("No hay existencias suficientes.");
        return;
      }

      product.quantity = newQuantity;

      movements.unshift({
        id: uid(),
        productId: product.id,
        productName: product.name,
        kitchen: product.kitchen,
        type: amount > 0 ? "entrada" : "salida",
        quantity: Math.abs(amount),
        detail: "Ajuste rápido de inventario",
        result: newQuantity,
        date: new Date().toISOString()
      });

      saveData();
      renderAll();
      showToast("Existencia actualizada.");
    }
  }
});

document.getElementById("productSearch").addEventListener("input", renderProducts);
document.getElementById("statusFilter").addEventListener("change", renderProducts);
document.getElementById("kitchenFilter").addEventListener("change", renderProducts);

/* ==========================================
   MOVIMIENTOS
   ========================================== */

function openMovementModal(productId = "") {
  const select = document.getElementById("movementProduct");

  select.innerHTML = products.map(product => `
    <option value="${escapeHTML(product.id)}">
      ${escapeHTML(product.name)} (${escapeHTML(product.kitchen || "")})
    </option>
  `).join("");

  if (productId) select.value = productId;

  document.getElementById("movementForm").reset();

  if (productId) select.value = productId;

  document.getElementById("movementQuantity").value = "";
  document.getElementById("movementDetail").value = "";

  if (!products.length) {
    showToast("Primero registra un producto.");
    return;
  }

  openModal("movementModal");
}

document.getElementById("newMovementBtn").addEventListener("click", () => {
  openMovementModal();
});

document.getElementById("movementForm").addEventListener("submit", event => {
  event.preventDefault();

  const productId = document.getElementById("movementProduct").value;
  const type = document.getElementById("movementType").value;
  const quantity = Number(document.getElementById("movementQuantity").value);
  const detail = document.getElementById("movementDetail").value.trim();

  const product = getProduct(productId);

  if (!product || !Number.isFinite(quantity) || quantity <= 0) {
    showToast("Revisa el producto y la cantidad.");
    return;
  }

  let newQuantity = Number(product.quantity);

  if (type === "entrada") {
    newQuantity += quantity;
  } else {
    if (quantity > newQuantity) {
      showToast("No puedes retirar más unidades de las disponibles.");
      return;
    }

    newQuantity -= quantity;
  }

  product.quantity = newQuantity;

  movements.unshift({
    id: uid(),
    productId: product.id,
    productName: product.name,
    kitchen: product.kitchen,
    type,
    quantity,
    detail: detail || (type === "entrada" ? "Entrada de inventario" : "Salida de inventario"),
    result: newQuantity,
    date: new Date().toISOString()
  });

  saveData();
  closeModal("movementModal");
  renderAll();
  showToast("Movimiento registrado correctamente.");
});

function renderMovements() {
  const tbody = document.getElementById("movementsTable");

  if (!movements.length) {
    tbody.innerHTML = `
      <tr><td colspan="7">
        <div class="empty-state">Todavía no hay movimientos registrados.</div>
      </td></tr>`;
  } else {
    tbody.innerHTML = movements.map(move => {
      const date = new Date(move.date);
      const dateText = Number.isNaN(date.getTime())
        ? "Fecha no disponible"
        : date.toLocaleString("es-CO");

      return `
        <tr>
          <td>${escapeHTML(dateText)}</td>
          <td><strong>${escapeHTML(move.productName)}</strong></td>
          <td>${escapeHTML(move.kitchen || "—")}</td>
          <td>${pill(
            move.type === "entrada" ? "ENTRADA" : "SALIDA",
            move.type === "entrada" ? "green" : "red"
          )}</td>
          <td>${formatNumber(move.quantity)}</td>
          <td>${escapeHTML(move.detail || "")}</td>
          <td><strong>${formatNumber(move.result)}</strong></td>
        </tr>`;
    }).join("");
  }

  document.getElementById("movementsFooter").textContent =
    `${movements.length} movimiento(s) registrado(s)`;
}

/* ==========================================
   PANEL PRINCIPAL
   ========================================== */

function renderDashboard() {
  const total = products.length;

  const units = products.reduce(
    (sum, product) => sum + Number(product.quantity || 0), 0
  );

  const low = products.filter(p =>
    ["out", "low", "reorder"].includes(stockState(p).key)
  ).length;

  const expired = products.filter(p =>
    expiryState(p)?.key === "expired"
  ).length;

  document.getElementById("statProducts").textContent = formatNumber(total);
  document.getElementById("statUnits").textContent = formatNumber(units);
  document.getElementById("statLow").textContent = formatNumber(low);
  document.getElementById("statExpired").textContent = formatNumber(expired);

  document.getElementById("countOut").textContent =
    products.filter(p => stockState(p).key === "out").length;

  document.getElementById("countLow").textContent =
    products.filter(p =>
      ["low", "reorder"].includes(stockState(p).key)
    ).length;

  document.getElementById("countNormal").textContent =
    products.filter(p => stockState(p).key === "normal").length;

  document.getElementById("countOver").textContent =
    products.filter(p =>
      ["over", "rotation"].includes(stockState(p).key)
    ).length;

  const recent = [...products].sort((a, b) =>
    (b.updatedAt || b.createdAt || "").localeCompare(
      a.updatedAt || a.createdAt || ""
    )
  ).slice(0, 5);

  document.getElementById("recentTable").innerHTML = recent.length
    ? recent.map(product => {
        const stock = stockState(product);
        const expiry = expiryState(product);

        return `
          <tr>
            <td><strong>${escapeHTML(product.name)}</strong></td>
            <td>${escapeHTML(product.kitchen || "—")}</td>
            <td>${formatNumber(product.quantity)}</td>
            <td>${formatNumber(product.min)} / ${formatNumber(product.pr)} / ${formatNumber(product.max)}</td>
            <td>${formatDate(product.expiry)}</td>
            <td>${pill(stock.label, stock.color)} ${expiry?.key === "expired" ? pill("VENCIDO", "red") : ""}</td>
          </tr>`;
      }).join("")
    : `<tr><td colspan="6"><div class="empty-state">No hay productos registrados.</div></td></tr>`;

  const alerts = getAllAlerts().slice(0, 4);

  document.getElementById("dashboardAlerts").innerHTML = alerts.length
    ? alerts.map(alert => `
        <div class="preview-item ${alert.color}">
          <strong>${escapeHTML(alert.title)}</strong>
          <small>${escapeHTML(alert.text)}</small>
        </div>
      `).join("")
    : `<div class="empty-state">No hay alertas pendientes.</div>`;
}

/* ==========================================
   CENTRO DE ALERTAS
   ========================================== */

function renderAlerts() {
  const alerts = getAllAlerts();

  const expired = products.filter(p => expiryState(p)?.key === "expired").length;
  const stockLow = products.filter(p =>
    ["out", "low", "reorder"].includes(stockState(p).key)
  ).length;
  const soon = products.filter(p =>
    ["soon", "upcoming"].includes(expiryState(p)?.key)
  ).length;

  const over = products.filter(p =>
    ["over", "rotation"].includes(stockState(p).key)
  ).length;

  document.getElementById("alertSummary").innerHTML = `
    <div class="alert-summary-card"><strong>${expired}</strong><span>Productos vencidos</span></div>
    <div class="alert-summary-card"><strong>${stockLow}</strong><span>Stock bajo / agotado</span></div>
    <div class="alert-summary-card"><strong>${soon}</strong><span>Próximos vencimientos</span></div>
    <div class="alert-summary-card"><strong>${over}</strong><span>Sobrestock / rotación</span></div>
  `;

  document.getElementById("navAlertCount").textContent = alerts.length;

  document.getElementById("alertsList").innerHTML = alerts.length
    ? alerts.map(alert => `
        <div class="alert-item ${alert.color}">
          <div class="alert-symbol">!</div>
          <div>
            <strong>${escapeHTML(alert.title)} · ${escapeHTML(alert.product.name)}</strong>
            <p>${escapeHTML(alert.text)}</p>
            <p>Cocina: ${escapeHTML(alert.product.kitchen || "Sin asignar")}</p>
          </div>
        </div>
      `).join("")
    : `<div class="empty-state">¡Excelente! No hay alertas pendientes.</div>`;
}

/* ==========================================
   EXPORTAR CSV
   ========================================== */

document.getElementById("exportBtn").addEventListener("click", () => {
  const headers = [
    "Producto", "Código", "Cocina", "Categoría",
    "Presentación", "Contenido", "Unidad contenido",
    "CD", "SMIN", "PR", "SMAX",
    "Existencia", "Vencimiento", "Estado", "Observaciones"
  ];

  const rows = products.map(p => [
    p.name, p.code, p.kitchen, p.category,
    p.unit, p.content, p.contentUnit,
    p.cd, p.min, p.pr, p.max,
    p.quantity, p.expiry, stockState(p).label, p.notes
  ]);

  const csv = [headers, ...rows].map(row =>
    row.map(value =>
      `"${String(value ?? "").replace(/"/g, '""')}"`
    ).join(";")
  ).join("\r\n");

  const blob = new Blob(["\uFEFF" + csv], {
    type: "text/csv;charset=utf-8;"
  });

  downloadFile(blob, "inventario_ecci.csv");
  showToast("Archivo CSV exportado.");
});

/* ==========================================
   COPIA DE SEGURIDAD
   ========================================== */

document.getElementById("backupBtn").addEventListener("click", () => {
  const backup = {
    application: "Inventario ECCI",
    version: 2,
    createdAt: new Date().toISOString(),
    products,
    movements
  };

  const blob = new Blob(
    [JSON.stringify(backup, null, 2)],
    { type: "application/json" }
  );

  downloadFile(blob, "respaldo_inventario_ecci.json");
  showToast("Copia de seguridad creada.");
});

function downloadFile(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = filename;
  link.click();

  URL.revokeObjectURL(url);
}


/* ==========================================
   IMPORTAR RESPALDO
   ========================================== */

document.getElementById("importInput").addEventListener("change", event => {
    const file = event.target.files[0];

    if (!file) return;

    if (!file.name.toLowerCase().endsWith(".json")) {
        showToast("Selecciona un archivo JSON válido.");
        event.target.value = "";
        return;
    }

    const reader = new FileReader();

    reader.onload = () => {
        try {
            const backup = JSON.parse(reader.result);

            if (!Array.isArray(backup.products)) {
                throw new Error("El respaldo no contiene productos válidos.");
            }

            if (!confirm(
                "¿Deseas importar este respaldo? Se reemplazarán los productos y movimientos actuales."
            )) {
                event.target.value = "";
                return;
            }

            // Recuperar y normalizar productos
            products = backup.products.map(product =>
                normalizeProduct(product)
            );

            // Recuperar movimientos
            movements = Array.isArray(backup.movements)
                ? backup.movements
                : [];

            // Guardar información
            saveData();

            // Actualizar todas las pantallas
            renderAll();

            showToast(
                `Respaldo importado correctamente. ${products.length} productos recuperados.`
            );

        } catch (error) {
            console.error("Error al importar:", error);
            showToast("Error: el archivo no es un respaldo válido.");
        }

        event.target.value = "";
    };

    reader.onerror = () => {
        showToast("No se pudo leer el archivo.");
        event.target.value = "";
    };

    reader.readAsText(file);
});


/* ==========================================
   NORMALIZAR DATOS ANTIGUOS
   ========================================== */

function normalizeProduct(product) {
  return {
    ...product,
    id: product.id || uid(),
    name: product.name || "Producto sin nombre",
    code: product.code || "",
    kitchen: product.kitchen || "La Scala",
    category: product.category || "General",
    unit: product.unit || "Unidades",
    content: Number(product.content ?? 1),
    contentUnit: product.contentUnit || "unidades",
    cd: Number(product.cd ?? 0),
    min: Number(product.min ?? 0),
    pr: Number(product.pr ?? product.min ?? 0),
    max: Number(product.max ?? 1),
    quantity: Number(product.quantity ?? 0),
    expiry: product.expiry || "",
    notes: product.notes || ""
  };
}

/* ==========================================
   ACTUALIZACIÓN GENERAL
   ========================================== */

function renderAll() {
  products = products.map(normalizeProduct);

  renderDashboard();
  renderProducts();
  renderMovements();
  renderAlerts();
  saveData();
}

/* ==========================================
   INICIO DEL SISTEMA
   ========================================== */

function initializeApp() {
  products = products.map(normalizeProduct);

  addDefaultProducts();

  document.getElementById("todayLabel").textContent =
    new Date().toLocaleDateString("es-CO", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric"
    });

  renderAll();
}

initializeApp();
