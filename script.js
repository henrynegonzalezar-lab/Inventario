
const STORAGE_KEY = "ecci_inventory_v1";
const MOVEMENTS_KEY = "ecci_inventory_movements_v1";

let products = loadData(STORAGE_KEY, []);
let movements = loadData(MOVEMENTS_KEY, []);
let toastTimer;

// ==========================================
// ALMACENAMIENTO
// ==========================================

function loadData(key, fallback) {
    try {
        const value = localStorage.getItem(key);
        return value ? JSON.parse(value) : fallback;
    } catch (error) {
        console.warn("Error al leer almacenamiento", error);
        return fallback;
    }
}

function saveData() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(products));
    localStorage.setItem(MOVEMENTS_KEY, JSON.stringify(movements));
}

function uid() {
    return "p-" + Date.now().toString(36) +
        Math.random().toString(36).slice(2, 7);
}

// ==========================================
// FECHAS
// ==========================================

function todayISO() {
    const date = new Date();
    date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
    return date.toISOString().slice(0, 10);
}

function formatDate(value) {
    if (!value) return "Sin fecha";

    const date = new Date(value + "T00:00:00");

    if (Number.isNaN(date.getTime())) {
        return "Fecha inválida";
    }

    return date.toLocaleDateString("es-CO", {
        year: "numeric",
        month: "short",
        day: "2-digit"
    });
}

function daysToExpiry(date) {
    if (!date) return null;

    const today = new Date(todayISO() + "T00:00:00");
    const expiry = new Date(date + "T00:00:00");

    return Math.ceil((expiry - today) / 86400000);
}

// ==========================================
// ESTADO DEL STOCK
// ==========================================

function stockState(product) {
    const quantity = Number(product.quantity);
    const min = Number(product.min);
    const max = Number(product.max);

    if (quantity <= 0) {
        return {
            key: "out",
            label: "Agotado",
            color: "red"
        };
    }

    if (quantity < min) {
        return {
            key: "low",
            label: "Stock bajo",
            color: "orange"
        };
    }

    if (quantity > max) {
        return {
            key: "over",
            label: "Sobre el máximo",
            color: "blue"
        };
    }

    return {
        key: "normal",
        label: "Stock normal",
        color: "green"
    };
}

// ==========================================
// ESTADO DEL VENCIMIENTO
// ==========================================

function expiryState(product) {
    const days = daysToExpiry(product.expiry);

    if (days === null) return null;

    if (days < 0) {
        return {
            key: "expired",
            label: "Vencido hace " + Math.abs(days) + " día(s)",
            color: "red",
            days
        };
    }

    if (days === 0) {
        return {
            key: "soon",
            label: "Vence hoy",
            color: "orange",
            days
        };
    }

    if (days <= 30) {
        return {
            key: "soon",
            label: "Vence en " + days + " día(s)",
            color: "orange",
            days
        };
    }

    return {
        key: "fresh",
        label: "Vigente",
        color: "green",
        days
    };
}

// ==========================================
// GENERACIÓN DE ALERTAS
// ==========================================

function productAlerts(product) {
    const alerts = [];

    const stock = stockState(product);
    const expiry = expiryState(product);

    if (stock.key === "out") {
        alerts.push({
            color: "red",
            title: "Producto agotado",
            text: product.name + " no tiene existencias."
        });
    } else if (stock.key === "low") {
        alerts.push({
            color: "orange",
            title: "Stock bajo",
            text: product.name +
                " está por debajo del mínimo (" +
                product.min + ")."
        });
    } else if (stock.key === "over") {
        alerts.push({
            color: "blue",
            title: "Sobreinventario",
            text: product.name +
                " supera el máximo (" +
                product.max + ")."
        });
    }

    if (expiry && expiry.key === "expired") {
        alerts.push({
            color: "red",
            title: "Producto vencido",
            text: product.name +
                " venció el " +
                formatDate(product.expiry) + "."
        });
    } else if (expiry && expiry.key === "soon") {
        alerts.push({
            color: "orange",
            title: "Vencimiento próximo",
            text: product.name + " — " +
                expiry.label + "."
        });
    }

    return alerts;
}

function allAlerts() {
    return products.flatMap(product =>
        productAlerts(product).map(alert => ({
            ...alert,
            productId: product.id
        }))
    );
}

// ==========================================
// UTILIDADES VISUALES
// ==========================================

function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, character => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    }[character]));
}

function pill(label, color) {
    return `<span class="pill ${color}">
        ${escapeHTML(label)}
    </span>`;
}

function showToast(message) {
    const element = document.getElementById("toast");

    element.textContent = message;
    element.classList.add("show");

    clearTimeout(toastTimer);

    toastTimer = setTimeout(() => {
        element.classList.remove("show");
    }, 2800);
}

// ==========================================
// NAVEGACIÓN
// ==========================================

function goToView(view) {
    document.querySelectorAll(".view").forEach(element => {
        element.classList.toggle(
            "active",
            element.id === view + "View"
        );
    });

    document.querySelectorAll(".nav-link[data-view]").forEach(element => {
        element.classList.toggle(
            "active",
            element.dataset.view === view
        );
    });

    const titles = {
        dashboard: "Panel principal",
        products: "Productos",
        movements: "Movimientos",
        alerts: "Alertas"
    };

    document.getElementById("pageTitle").textContent =
        titles[view] || "Inventario";

    document.getElementById("sidebar").classList.remove("open");

    if (view === "products") renderProducts();
    if (view === "movements") renderMovements();
    if (view === "alerts") renderAlerts();
}

// ==========================================
// PANEL PRINCIPAL
// ==========================================

function renderDashboard() {
    const alerts = allAlerts();

    document.getElementById("statProducts").textContent =
        products.length;

    document.getElementById("statUnits").textContent =
        products.reduce(
            (sum, product) => sum + Number(product.quantity || 0),
            0
        ).toLocaleString("es-CO");

    document.getElementById("statLow").textContent =
        products.filter(product =>
            ["out", "low"].includes(stockState(product).key)
        ).length;

    document.getElementById("statExpired").textContent =
        products.filter(product =>
            expiryState(product)?.key === "expired"
        ).length;

    document.getElementById("countOut").textContent =
        products.filter(product =>
            stockState(product).key === "out"
        ).length;

    document.getElementById("countLow").textContent =
        products.filter(product =>
            stockState(product).key === "low"
        ).length;

    document.getElementById("countNormal").textContent =
        products.filter(product =>
            stockState(product).key === "normal"
        ).length;

    document.getElementById("countOver").textContent =
        products.filter(product =>
            stockState(product).key === "over"
        ).length;

    const alertBox = document.getElementById("dashboardAlerts");

    alertBox.innerHTML = alerts.length
        ? alerts.slice(0, 4).map(alert => `
            <div class="alert-item alert-${alert.color}">
                <span class="alert-symbol">!</span>
                <div>
                    <strong>${escapeHTML(alert.title)}</strong>
                    ${escapeHTML(alert.text)}
                </div>
            </div>
        `).join("")
        : '<div class="empty-state">No hay alertas pendientes.</div>';

    const recent = [...products].slice(-5).reverse();

    document.getElementById("recentTable").innerHTML =
        recent.length
            ? recent.map(product => {
                const stock = stockState(product);
                const expiry = expiryState(product);

                let status = pill(stock.label, stock.color);

                if (expiry?.key === "expired") {
                    status = pill("Vencido", "red");
                } else if (expiry?.key === "soon") {
                    status = pill("Próximo a vencer", "orange");
                }

                return `
                    <tr>
                        <td>
                            <div class="product-name">
                                ${escapeHTML(product.name)}
                            </div>
                            <div class="product-sub">
                                ${escapeHTML(product.code || "Sin código")}
                            </div>
                        </td>
                        <td>${escapeHTML(product.category || "General")}</td>
                        <td>${Number(product.quantity)} ${escapeHTML(product.unit)}</td>
                        <td>${Number(product.min)} / ${Number(product.max)}</td>
                        <td>${formatDate(product.expiry)}</td>
                        <td>${status}</td>
                    </tr>
                `;
            }).join("")
            : `
                <tr>
                    <td colspan="6">
                        <div class="empty-state">
                            Aún no has registrado productos.
                        </div>
                    </td>
                </tr>
            `;
}

// ==========================================
// LISTADO DE PRODUCTOS
// ==========================================

function renderProducts() {
    const query = document.getElementById("productSearch")
        .value.trim().toLowerCase();

    const filter = document.getElementById("statusFilter").value;

    const list = products.filter(product => {
        const searchable = [
            product.name,
            product.code,
            product.category
        ].join(" ").toLowerCase();

        const match = searchable.includes(query);

        const stock = stockState(product).key;
        const expiry = expiryState(product)?.key;

        const statusMatch =
            filter === "all" ||
            filter === stock ||
            filter === expiry;

        return match && statusMatch;
    });

    document.getElementById("productsTable").innerHTML =
        list.length
            ? list.map(product => {
                const stock = stockState(product);
                const expiry = expiryState(product);

                let status = pill(stock.label, stock.color);

                if (expiry?.key === "expired") {
                    status += pill("Vencido", "red");
                } else if (expiry?.key === "soon") {
                    status += pill("Próximo", "orange");
                }

                return `
                    <tr>
                        <td>
                            <div class="product-name">
                                ${escapeHTML(product.name)}
                            </div>
                            <div class="product-sub">
                                ${escapeHTML(product.category || "General")}
                                · ${escapeHTML(product.unit)}
                            </div>
                        </td>

                        <td>${escapeHTML(product.code || "—")}</td>
                        <td><strong>${Number(product.quantity)}</strong></td>
                        <td>${Number(product.min)}</td>
                        <td>${Number(product.max)}</td>
                        <td>${formatDate(product.expiry)}</td>
                        <td>${status}</td>

                        <td>
                            <div class="row-actions">
                                <button class="icon-btn"
                                    title="Editar"
                                    data-edit="${product.id}">✎</button>

                                <button class="icon-btn"
                                    title="Movimiento"
                                    data-move="${product.id}">⇄</button>

                                <button class="icon-btn delete"
                                    title="Eliminar"
                                    data-delete="${product.id}">×</button>
                            </div>
                        </td>
                    </tr>
                `;
            }).join("")
            : `
                <tr>
                    <td colspan="8">
                        <div class="empty-state">
                            No se encontraron productos.
                        </div>
                    </td>
                </tr>
            `;

    document.getElementById("productsFooter").textContent =
        `Mostrando ${list.length} de ${products.length} producto(s)`;
}

// ==========================================
// HISTORIAL DE MOVIMIENTOS
// ==========================================

function renderMovements() {
    const tbody = document.getElementById("movementsTable");

    tbody.innerHTML = movements.length
        ? [...movements].reverse().map(movement => `
            <tr>
                <td>
                    ${new Date(movement.date).toLocaleString("es-CO")}
                </td>

                <td>
                    <div class="product-name">
                        ${escapeHTML(movement.productName)}
                    </div>
                </td>

                <td class="${movement.type === "entrada"
                    ? "type-entry" : "type-exit"}">
                    ${movement.type === "entrada" ? "Entrada" : "Salida"}
                </td>

                <td>${Number(movement.quantity)}</td>
                <td>${escapeHTML(movement.detail || "—")}</td>
                <td>${Number(movement.result)}</td>
            </tr>
        `).join("")
        : `
            <tr>
                <td colspan="6">
                    <div class="empty-state">
                        Todavía no hay movimientos registrados.
                    </div>
                </td>
            </tr>
        `;

    document.getElementById("movementsFooter").textContent =
        `${movements.length} movimiento(s) registrado(s)`;
}

// ==========================================
// CENTRO DE ALERTAS
// ==========================================

function renderAlerts() {
    const alerts = allAlerts();

    const expired = alerts.filter(alert =>
        alert.title === "Producto vencido"
    ).length;

    const stock = alerts.filter(alert =>
        ["Producto agotado", "Stock bajo"].includes(alert.title)
    ).length;

    const soon = alerts.filter(alert =>
        alert.title === "Vencimiento próximo"
    ).length;

    document.getElementById("alertSummary").innerHTML = `
        <div class="alert-summary-card">
            <span>Stock bajo / agotado</span>
            <strong>${stock}</strong>
        </div>

        <div class="alert-summary-card">
            <span>Vencimientos próximos</span>
            <strong>${soon}</strong>
        </div>

        <div class="alert-summary-card">
            <span>Productos vencidos</span>
            <strong>${expired}</strong>
        </div>
    `;

    document.getElementById("alertsList").innerHTML =
        alerts.length
            ? alerts.map(alert => `
                <div class="alert-item alert-${alert.color}">
                    <span class="alert-symbol">!</span>
                    <div>
                        <strong>${escapeHTML(alert.title)}</strong>
                        ${escapeHTML(alert.text)}
                    </div>
                </div>
            `).join("")
            : `
                <div class="empty-state">
                    ¡Excelente! No hay alertas pendientes.
                </div>
            `;
}

// ==========================================
// ACTUALIZAR TODA LA INTERFAZ
// ==========================================

function renderAll() {
    renderDashboard();
    renderProducts();
    renderMovements();
    renderAlerts();
}

// ==========================================
// FORMULARIO DE PRODUCTOS
// ==========================================

function openProductModal(product = null) {
    document.getElementById("productForm").reset();

    document.getElementById("productId").value =
        product?.id || "";

    document.getElementById("productModalTitle").textContent =
        product ? "Editar producto" : "Nuevo producto";

    document.getElementById("productName").value =
        product?.name || "";

    document.getElementById("productCode").value =
        product?.code || "";

    document.getElementById("productCategory").value =
        product?.category || "";

    document.getElementById("productUnit").value =
        product?.unit || "Unidades";

    document.getElementById("productQuantity").value =
        product?.quantity ?? 0;

    document.getElementById("productMin").value =
        product?.min ?? 5;

    document.getElementById("productMax").value =
        product?.max ?? 50;

    document.getElementById("productExpiry").value =
        product?.expiry || "";

    document.getElementById("productNotes").value =
        product?.notes || "";

    document.getElementById("productModal").classList.add("open");
}

function closeModal(id) {
    document.getElementById(id).classList.remove("open");
}

// ==========================================
// FORMULARIO DE MOVIMIENTOS
// ==========================================

function openMovementModal(productId = "") {
    const select = document.getElementById("movementProduct");

    select.innerHTML = products.map(product => `
        <option value="${product.id}">
            ${escapeHTML(product.name)}
            — stock: ${Number(product.quantity)}
        </option>
    `).join("");

    if (!products.length) {
        showToast("Primero registra un producto.");
        return;
    }

    document.getElementById("movementForm").reset();

    if (productId) {
        select.value = productId;
    }

    document.getElementById("movementModal").classList.add("open");
}

// ==========================================
// ELIMINAR PRODUCTOS
// ==========================================

function deleteProduct(id) {
    const product = products.find(product => product.id === id);

    if (!product) return;

    const confirmed = confirm(
        `¿Eliminar "${product.name}" del inventario?`
    );

    if (!confirmed) return;

    products = products.filter(product => product.id !== id);

    saveData();
    renderAll();

    showToast("Producto eliminado.");
}

// ==========================================
// EXPORTAR INVENTARIO A CSV
// ==========================================

function exportCSV() {
    const headers = [
        "Nombre",
        "Codigo",
        "Categoria",
        "Unidad",
        "Cantidad",
        "Stock minimo",
        "Stock maximo",
        "Vencimiento",
        "Estado stock",
        "Observaciones"
    ];

    const rows = products.map(product => [
        product.name,
        product.code,
        product.category,
        product.unit,
        product.quantity,
        product.min,
        product.max,
        product.expiry,
        stockState(product).label,
        product.notes
    ]);

    const csv = [headers, ...rows]
        .map(row =>
            row.map(value =>
                `"${String(value ?? "").replace(/"/g, '""')}"`
            ).join(";")
        )
        .join("\r\n");

    const blob = new Blob(["\ufeff" + csv], {
        type: "text/csv;charset=utf-8;"
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = "inventario.csv";
    link.click();

    URL.revokeObjectURL(url);
}

// ==========================================
// COPIA DE SEGURIDAD
// ==========================================

function backupJSON() {
    const backup = {
        products,
        movements,
        exportedAt: new Date().toISOString()
    };

    const blob = new Blob(
        [JSON.stringify(backup, null, 2)],
        { type: "application/json" }
    );

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = "respaldo_inventario.json";
    link.click();

    URL.revokeObjectURL(url);
}

// ==========================================
// IMPORTAR RESPALDO
// ==========================================

function importJSON(file) {
    const reader = new FileReader();

    reader.onload = () => {
        try {
            const data = JSON.parse(reader.result);

            if (!Array.isArray(data.products)) {
                throw new Error("Formato inválido");
            }

            if (!confirm(
                "Importar reemplazará los datos actuales. ¿Continuar?"
            )) {
                return;
            }

            products = data.products;

            movements = Array.isArray(data.movements)
                ? data.movements
                : [];

            saveData();
            renderAll();

            showToast("Respaldo importado correctamente.");
        } catch (error) {
            showToast("El archivo no es un respaldo válido.");
        }
    };

    reader.readAsText(file);
}

// ==========================================
// EVENTOS DE NAVEGACIÓN
// ==========================================

document.querySelectorAll(".nav-link[data-view]")
    .forEach(button => {
        button.addEventListener("click", () => {
            goToView(button.dataset.view);
        });
    });

document.querySelectorAll("[data-go]")
    .forEach(button => {
        button.addEventListener("click", () => {
            goToView(button.dataset.go);
        });
    });

document.getElementById("quickAdd")
    .addEventListener("click", () => openProductModal());

document.getElementById("addProductBtn")
    .addEventListener("click", () => openProductModal());

document.getElementById("newMovementBtn")
    .addEventListener("click", () => openMovementModal());

document.getElementById("mobileMenu")
    .addEventListener("click", () => {
        document.getElementById("sidebar").classList.toggle("open");
    });

// ==========================================
// EVENTOS DE BÚSQUEDA Y FILTROS
// ==========================================

document.getElementById("productSearch")
    .addEventListener("input", renderProducts);

document.getElementById("statusFilter")
    .addEventListener("change", renderProducts);

// ==========================================
// EXPORTAR E IMPORTAR
// ==========================================

document.getElementById("exportBtn")
    .addEventListener("click", exportCSV);

document.getElementById("backupBtn")
    .addEventListener("click", backupJSON);

document.getElementById("importInput")
    .addEventListener("change", event => {
        if (event.target.files[0]) {
            importJSON(event.target.files[0]);
        }

        event.target.value = "";
    });

// ==========================================
// CERRAR MODALES
// ==========================================

document.querySelectorAll("[data-close]")
    .forEach(button => {
        button.addEventListener("click", () => {
            closeModal(button.dataset.close);
        });
    });

document.querySelectorAll(".modal-backdrop")
    .forEach(backdrop => {
        backdrop.addEventListener("click", event => {
            if (event.target === backdrop) {
                closeModal(backdrop.id);
            }
        });
    });

// ==========================================
// GUARDAR PRODUCTO
// ==========================================

document.getElementById("productForm")
    .addEventListener("submit", event => {
        event.preventDefault();

        const id = document.getElementById("productId").value;

        const name = document.getElementById("productName")
            .value.trim();

        const code = document.getElementById("productCode")
            .value.trim();

        const quantity = Number(
            document.getElementById("productQuantity").value
        );

        const min = Number(
            document.getElementById("productMin").value
        );

        const max = Number(
            document.getElementById("productMax").value
        );

        if (!name) {
            return showToast("Escribe el nombre del producto.");
        }

        if (
            ![quantity, min, max].every(Number.isFinite) ||
            quantity < 0 || min < 0 || max < 0
        ) {
            return showToast(
                "Las cantidades deben ser mayores o iguales a cero."
            );
        }

        if (min > max) {
            return showToast(
                "El stock mínimo no puede ser mayor que el máximo."
            );
        }

        const duplicateCode = products.some(product =>
            product.id !== id &&
            code &&
            product.code &&
            product.code.toLowerCase() === code.toLowerCase()
        );

        if (duplicateCode) {
            return showToast(
                "Ya existe un producto con ese código."
            );
        }

        const data = {
            id: id || uid(),
            name,
            code,
            category: document.getElementById("productCategory")
                .value.trim(),
            unit: document.getElementById("productUnit").value,
            quantity,
            min,
            max,
            expiry: document.getElementById("productExpiry").value,
            notes: document.getElementById("productNotes")
                .value.trim(),
            updatedAt: new Date().toISOString()
        };

        if (id) {
            products = products.map(product =>
                product.id === id
                    ? { ...product, ...data }
                    : product
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

        showToast(id
            ? "Producto actualizado."
            : "Producto agregado.");
    });

// ==========================================
// REGISTRAR ENTRADA O SALIDA
// ==========================================

document.getElementById("movementForm")
    .addEventListener("submit", event => {
        event.preventDefault();

        const id = document.getElementById("movementProduct").value;
        const type = document.getElementById("movementType").value;

        const quantity = Number(
            document.getElementById("movementQuantity").value
        );

        const detail = document.getElementById("movementDetail")
            .value.trim();

        const product = products.find(product => product.id === id);

        if (!product) {
            return showToast("Selecciona un producto.");
        }

        if (!Number.isFinite(quantity) || quantity <= 0) {
            return showToast(
                "La cantidad debe ser mayor que cero."
            );
        }

        if (
            type === "salida" &&
            quantity > Number(product.quantity)
        ) {
            return showToast(
                "No hay suficientes existencias para esta salida."
            );
        }

        const newQuantity = type === "entrada"
            ? Number(product.quantity) + quantity
            : Number(product.quantity) - quantity;

        products = products.map(item =>
            item.id === id
                ? {
                    ...item,
                    quantity: newQuantity,
                    updatedAt: new Date().toISOString()
                }
                : item
        );

        movements.push({
            id: uid(),
            date: new Date().toISOString(),
            productId: id,
            productName: product.name,
            type,
            quantity,
            detail,
            result: newQuantity
        });

        saveData();
        closeModal("movementModal");
        renderAll();

        showToast("Movimiento registrado correctamente.");
    });

// ==========================================
// ACCIONES EN TABLA DE PRODUCTOS
// ==========================================

document.getElementById("productsTable")
    .addEventListener("click", event => {
        const edit = event.target.closest("[data-edit]");
        const del = event.target.closest("[data-delete]");
        const move = event.target.closest("[data-move]");

        if (edit) {
            const product = products.find(
                product => product.id === edit.dataset.edit
            );

            if (product) openProductModal(product);
        }

        if (del) {
            deleteProduct(del.dataset.delete);
        }

        if (move) {
            openMovementModal(move.dataset.move);
        }
    });

// ==========================================
// INICIALIZAR SISTEMA
// ==========================================

document.getElementById("todayLabel").textContent =
    new Date().toLocaleDateString("es-CO", {
        weekday: "short",
        day: "2-digit",
        month: "short",
        year: "numeric"
    });

renderAll();
