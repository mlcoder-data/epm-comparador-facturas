// --- EPM PRICING SCHEME (Extracted from the user's real bill) ---
const EPM_CONFIG = {
    energia: {
        // Tarifa verificada con factura real Mayo 2026 ($864.69/kWh antes de subsidio)
        tarifa_plena: 864.69,
        limite_subsistencia: 130, // kWh subsidiados en Medellín (< 1800 msnm)
        subsidios: { 1: 0.60, 2: 0.50, 3: 0.15, 4: 0.0, 5: -0.20, 6: -0.20 }
    },
    acueducto: {
        cargo_fijo: 9851.98,
        tarifa_plena: 4864.82, // Verificado con factura real
        limite_basico: 13,     // m³ subsidiados en Medellín
        subsidios: { 1: 0.70, 2: 0.40, 3: 0.125, 4: 0.0, 5: -0.50, 6: -0.60 }
    },
    alcantarillado: {
        cargo_fijo: 5668.99,
        tarifa_plena: 3885.68, // Verificado con factura real
        limite_basico: 13,
        subsidios: { 1: 0.70, 2: 0.40, 3: 0.125, 4: 0.0, 5: -0.50, 6: -0.60 }
    },
    gas: {
        cargo_fijo: 4293.48,
        tarifa_plena: 3242.93, // Verificado con factura real Mayo 2026
        subsidios: { 1: 0.60, 2: 0.50, 3: 0.0, 4: 0.0, 5: -0.20, 6: -0.20 }
    },
    aseo: {
        // Verificado con factura Emvarias (estrato 3, incluye subsidio 15%)
        cargo_fijo: 18679.00,
        aprovecha: 2265.87,
        variable: 14935.98,
        subsidios: { 1: 0.70, 2: 0.40, 3: 0.15, 4: 0.0, 5: -0.50, 6: -0.60 }
    },
    alumbrado: 6000.00 // Municipio de Medellín, fijo por factura
};

// Default invoice history with realistic historical rates over time
// Historial de ejemplo — tasas calibradas con facturas reales EPM Medellín
// Estrato 3. Los totales se recalculan en calculateInvoices()
const DEFAULT_HISTORY = [
    {
        mes: "Noviembre 2025", kwh: 167,
        agua_m3: 17, gas_m3: 21.0,
        rate_energia: 835.20, rate_agua: 4680.50,
        rate_alcantarillado: 3720.30, rate_gas: 3080.40, estado: "Pagado"
    },
    {
        mes: "Diciembre 2025", kwh: 191,
        agua_m3: 19, gas_m3: 17.0,
        rate_energia: 840.15, rate_agua: 4710.80,
        rate_alcantarillado: 3745.60, rate_gas: 3100.10, estado: "Pagado"
    },
    {
        mes: "Enero 2026", kwh: 168,
        agua_m3: 15, gas_m3: 16.0,
        rate_energia: 845.30, rate_agua: 4740.20,
        rate_alcantarillado: 3768.40, rate_gas: 3118.80, estado: "Pagado"
    },
    {
        mes: "Febrero 2026", kwh: 187,
        agua_m3: 17, gas_m3: 16.0,
        rate_energia: 850.60, rate_agua: 4778.50,
        rate_alcantarillado: 3798.20, rate_gas: 3135.50, estado: "Pagado"
    },
    {
        mes: "Marzo 2026", kwh: 168,
        agua_m3: 15, gas_m3: 15.0,
        rate_energia: 855.80, rate_agua: 4810.30,
        rate_alcantarillado: 3830.10, rate_gas: 3158.20, estado: "Pagado"
    },
    {
        // Factura real Abril 2026 (verificada con recibo real)
        mes: "Abril 2026", kwh: 178,
        agua_m3: 15, gas_m3: 17.1,
        rate_energia: 864.69, rate_agua: 4864.82,
        rate_alcantarillado: 3885.68, rate_gas: 3242.93,
        // Totales reales del recibo
        energia: 126996, agua: 130618, gas: 58262, otros: 36245,
        total: 352124, fromPdf: true, estado: "Pagado"
    }
];

const MONTHS_ORDER = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];

function parseMesToDate(mesStr) {
    const parts = (mesStr || "").trim().split(/\s+/);
    if (parts.length < 2) return new Date(0);
    const monthIdx = MONTHS_ORDER.findIndex(m => m.toLowerCase() === parts[0].toLowerCase());
    const year = parseInt(parts[1], 10);
    if (monthIdx === -1 || isNaN(year)) return new Date(0);
    return new Date(year, monthIdx, 1);
}

function sortInvoiceHistory() {
    invoiceHistory.sort((a, b) => parseMesToDate(a.mes) - parseMesToDate(b.mes));
}
let invoiceHistory = [];
let lastParsedPdfData = null; // Holds real data extracted from the last uploaded PDF
let historyChart = null;
let distributionChart = null;
let tariffsChart = null; // New chart variable
let activeChartType = "cost";
let currentStratum = 3; // Default to user stratum (Estrato 3)

// DOM Element references container
let el = {};

const formatCOP = (num) => {
    return new Intl.NumberFormat('es-CO', {
        style: 'currency',
        currency: 'COP',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(num);
};

const formatCOPWithDecimals = (num) => {
    return new Intl.NumberFormat('es-CO', {
        style: 'currency',
        currency: 'COP',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(num);
};


// --- CUSTOM TOAST & CONFIRM DIALOG ---
function showToast(message, type = "info", duration = 3500) {
    let container = document.getElementById("toast-container");
    if (!container) {
        container = document.createElement("div");
        container.id = "toast-container";
        document.body.appendChild(container);
    }
    const toast = document.createElement("div");
    toast.className = `toast toast-${type}`;
    const icons = { success: "check-circle", error: "x-circle", info: "info", warning: "alert-triangle" };
    toast.innerHTML = `<i data-lucide="${icons[type] || 'info'}"></i><span>${message}</span>`;
    container.appendChild(toast);
    if (typeof lucide !== 'undefined') lucide.createIcons();
    // Animate in
    requestAnimationFrame(() => { requestAnimationFrame(() => { toast.classList.add("show"); }); });
    setTimeout(() => {
        toast.classList.remove("show");
        toast.addEventListener("transitionend", () => toast.remove(), { once: true });
    }, duration);
}

function showConfirmDialog(message, onConfirm) {
    let overlay = document.getElementById("confirm-overlay");
    if (!overlay) {
        overlay = document.createElement("div");
        overlay.id = "confirm-overlay";
        overlay.innerHTML = `
            <div class="confirm-dialog">
                <p class="confirm-message" id="confirm-message"></p>
                <div class="confirm-actions">
                    <button class="btn btn-ghost" id="confirm-cancel">Cancelar</button>
                    <button class="btn btn-danger" id="confirm-ok">Confirmar</button>
                </div>
            </div>`;
        document.body.appendChild(overlay);
    }
    document.getElementById("confirm-message").textContent = message;
    overlay.classList.add("open");
    const closeDialog = () => overlay.classList.remove("open");
    document.getElementById("confirm-cancel").onclick = closeDialog;
    document.getElementById("confirm-ok").onclick = () => { closeDialog(); onConfirm(); };
}

// API key management removed — PDF.js reads locally



// --- INITIALIZATION ---
document.addEventListener("DOMContentLoaded", () => {
    try {
        loadFromStorage();
        initApp();
    } catch (e) {
        console.error("Critical error during initialization: ", e);
    }
});

function initApp() {
    // Query DOM elements safely
    el = {
        tabButtons: document.querySelectorAll(".nav-item"),
        tabContents: document.querySelectorAll(".tab-content"),
        estratoSelect: document.getElementById("estrato-select"),
        pageTitle: document.getElementById("page-title"),
        
        kpiTotalFactura: document.getElementById("kpi-total-factura"),
        kpiEnergiaCost: document.getElementById("kpi-energia-cost"),
        kpiEnergiaConsumo: document.getElementById("kpi-energia-consumo"),
        kpiAguaCost: document.getElementById("kpi-agua-cost"),
        kpiAguaConsumo: document.getElementById("kpi-agua-consumo"),
        kpiGasCost: document.getElementById("kpi-gas-cost"),
        kpiGasConsumo: document.getElementById("kpi-gas-consumo"),

        detailEnergiaConsumo: document.getElementById("detail-energia-consumo"),
        detailEnergiaTarifa: document.getElementById("detail-energia-tarifa"),
        detailEnergiaSubsidio: document.getElementById("detail-energia-subsidio"),
        detailEnergiaAlumbrado: document.getElementById("detail-energia-alumbrado"),
        detailEnergiaTotal: document.getElementById("detail-energia-total"),

        detailAguaConsumo: document.getElementById("detail-agua-consumo"),
        detailAguaCargoFijo: document.getElementById("detail-agua-cargo-fijo"),
        detailAguaTarifaAcueducto: document.getElementById("detail-agua-tarifa-acueducto"),
        detailAguaCargoFijoAlc: document.getElementById("detail-agua-cargo-fijo-alc"),
        detailAguaTarifaAlcantarillado: document.getElementById("detail-agua-tarifa-alcantarillado"),
        detailAguaTotal: document.getElementById("detail-agua-total"),
        waterGaugeBar: document.getElementById("water-gauge-bar"),

        detailGasConsumo: document.getElementById("detail-gas-consumo"),
        detailGasTarifa: document.getElementById("detail-gas-tarifa"),
        detailGasCargoFijo: document.getElementById("detail-gas-cargo-fijo"),
        detailGasTotal: document.getElementById("detail-gas-total"),

        btnImportarFactura: document.getElementById("btn-importar-factura"),
        modalImport: document.getElementById("modal-import"),
        btnCloseModal: document.getElementById("btn-close-modal"),
        dropZone: document.getElementById("drop-zone"),
        fileInput: document.getElementById("file-input"),
        uploadStatus: document.getElementById("upload-status"),
        importPreview: document.getElementById("import-preview"),
        btnConfirmImport: document.getElementById("btn-confirm-import"),

        // Form elements
        formManualInvoice: document.getElementById("form-manual-invoice"),
        inputPeriodo: document.getElementById("input-periodo"),
        inputEnergia: document.getElementById("input-energia"),
        inputAgua: document.getElementById("input-agua"),
        inputGas: document.getElementById("input-gas"),
        inputAseo: document.getElementById("input-aseo"),
        btnClearHistory: document.getElementById("btn-clear-history"),

        // Modal Tab Buttons
        modalTabBtnManual: document.getElementById("modal-tab-btn-manual"),
        modalTabBtnPdf: document.getElementById("modal-tab-btn-pdf"),
        modalTabContentManual: document.getElementById("modal-tab-content-manual"),
        modalTabContentPdf: document.getElementById("modal-tab-content-pdf"),

        // Tariff Tab KPIs
        rateKpiEnergia: document.getElementById("rate-kpi-energia"),
        rateKpiAgua: document.getElementById("rate-kpi-agua"),
        rateKpiAlcantarillado: document.getElementById("rate-kpi-alcantarillado"),
        rateKpiGas: document.getElementById("rate-kpi-gas"),
    };

    // Set default value in UI for estrato
    if (el.estratoSelect) {
        el.estratoSelect.value = currentStratum;
    }

    updateProfileSubLabel();
    setupTabSwitching();
    calculateInvoices();
    updateDashboardUI();
    setupImportFlow();

    // Change stratum handler
    if (el.estratoSelect) {
        el.estratoSelect.addEventListener("change", (e) => {
            currentStratum = parseInt(e.target.value);
            updateProfileSubLabel();
            calculateInvoices();
            saveToStorage();
            updateDashboardUI();
        });
    }

    // Toggle chart buttons
    const btnCost = document.getElementById("btn-chart-cost");
    const btnConsumo = document.getElementById("btn-chart-consumo");
    if (btnCost && btnConsumo) {
        btnCost.addEventListener("click", (e) => setChartType("cost", e.target));
        btnConsumo.addEventListener("click", (e) => setChartType("consumo", e.target));
    }

    // ── SIDEBAR TOGGLE ────────────────────────────────────────────────────
    const sidebarEl = document.getElementById("sidebar");
    const sidebarToggle = document.getElementById("sidebar-toggle");
    const sidebarIcon = document.getElementById("sidebar-toggle-icon");
    const mainContent = document.querySelector(".main-content");

    if (sidebarToggle && sidebarEl) {
        // Restore state from localStorage
        if (localStorage.getItem("epm_sidebar_collapsed") === "1") {
            sidebarEl.classList.add("collapsed");
            mainContent && mainContent.classList.add("expanded");
            sidebarIcon && sidebarIcon.setAttribute("data-lucide", "chevrons-right");
        }

        sidebarToggle.addEventListener("click", () => {
            const collapsed = sidebarEl.classList.toggle("collapsed");
            mainContent && mainContent.classList.toggle("expanded", collapsed);
            if (sidebarIcon) {
                sidebarIcon.setAttribute("data-lucide", collapsed ? "chevrons-right" : "chevrons-left");
            }
            localStorage.setItem("epm_sidebar_collapsed", collapsed ? "1" : "0");
            if (typeof lucide !== "undefined") lucide.createIcons();
        });
    }

    // ── EMPTY STATE CTA ───────────────────────────────────────────────────
    const emptyStateCta = document.getElementById("btn-empty-state-cta");
    if (emptyStateCta) {
        emptyStateCta.addEventListener("click", () => {
            const btn = document.getElementById("btn-importar-factura");
            if (btn) btn.click();
        });
    }

    // Lucide Icons
    if (typeof lucide !== 'undefined') {
        try {
            lucide.createIcons();
        } catch (e) {
            console.error("Lucide failed to load: ", e);
        }
    }
}

// --- LOCAL STORAGE ---
function saveToStorage() {
    localStorage.setItem("epm_invoice_history", JSON.stringify(invoiceHistory));
    localStorage.setItem("epm_current_stratum", currentStratum);
}

function loadFromStorage() {
    const storedHistory = localStorage.getItem("epm_invoice_history");
    const storedStratum = localStorage.getItem("epm_current_stratum");
    if (storedHistory) {
        try {
            invoiceHistory = JSON.parse(storedHistory);
            
            // Sanitize loaded invoice history (capitalize month names, correct spacing)
            invoiceHistory.forEach(item => {
                if (item.mes) {
                    const parts = item.mes.trim().split(/\s+/);
                    if (parts.length >= 2) {
                        const m = parts[0];
                        const y = parts[1];
                        const capitalizedMonth = m.charAt(0).toUpperCase() + m.slice(1).toLowerCase();
                        item.mes = `${capitalizedMonth} ${y}`;
                    }
                }
            });
        } catch (e) {
            console.error("Error parsing stored history, fallback to default", e);
            invoiceHistory = [...DEFAULT_HISTORY];
        }
        sortInvoiceHistory();
    } else {
        // Fallback to sample data for first load
        invoiceHistory = [...DEFAULT_HISTORY];
    }
    if (storedStratum) {
        currentStratum = parseInt(storedStratum);
    }
}

function updateProfileSubLabel() {
    const profileSub = document.querySelector(".profile-sub");
    if (profileSub) {
        profileSub.innerText = `Estrato ${currentStratum} • Medellín`;
    }
}

// --- CORE MATHEMATICAL CALCULATIONS (EPM Formulas) ---
function calculateInvoices() {
    if (invoiceHistory.length === 0) return;
    
    invoiceHistory.forEach(item => {
        // If imported from a real PDF, trust its totals — skip formula recalculation
        if (item.fromPdf && item.total != null) {
            if (!item.rate_energia) item.rate_energia = EPM_CONFIG.energia.tarifa_plena;
            if (!item.rate_agua) item.rate_agua = EPM_CONFIG.acueducto.tarifa_plena;
            if (!item.rate_alcantarillado) item.rate_alcantarillado = EPM_CONFIG.alcantarillado.tarifa_plena;
            if (!item.rate_gas) item.rate_gas = EPM_CONFIG.gas.tarifa_plena;
            return;
        }

        // Use historical rates saved in the record, falling back to current EPM_CONFIG rates
        const rEnergia = item.rate_energia || EPM_CONFIG.energia.tarifa_plena;
        const rAgua = item.rate_agua || EPM_CONFIG.acueducto.tarifa_plena;
        const rAlcantarillado = item.rate_alcantarillado || EPM_CONFIG.alcantarillado.tarifa_plena;
        const rGas = item.rate_gas || EPM_CONFIG.gas.tarifa_plena;

        // Set properties back on item if missing
        if (!item.rate_energia) item.rate_energia = rEnergia;
        if (!item.rate_agua) item.rate_agua = rAgua;
        if (!item.rate_alcantarillado) item.rate_alcantarillado = rAlcantarillado;
        if (!item.rate_gas) item.rate_gas = rGas;

        // 1. Energía (Luz)
        const eConf = EPM_CONFIG.energia;
        const eSubsidyRate = eConf.subsidios[currentStratum];
        let energiaCost = 0;
        let energiaSubsidy = 0;

        if (eSubsidyRate > 0) {
            const subKwh = Math.min(item.kwh, eConf.limite_subsistencia);
            const plenaKwh = Math.max(0, item.kwh - eConf.limite_subsistencia);
            
            const rawSubCost = subKwh * rEnergia;
            energiaSubsidy = rawSubCost * eSubsidyRate;
            energiaCost = (rawSubCost - energiaSubsidy) + (plenaKwh * rEnergia);
        } else if (eSubsidyRate < 0) {
            const rawCost = item.kwh * rEnergia;
            const contribution = rawCost * Math.abs(eSubsidyRate);
            energiaCost = rawCost + contribution;
        } else {
            energiaCost = (item.kwh * rEnergia);
        }
        // Nota: Alumbrado público se suma en 'otros' (ver sección aseo abajo)

        // 2. Acueducto (Water)
        const wConf = EPM_CONFIG.acueducto;
        const wSubsidyRate = wConf.subsidios[currentStratum];
        let acueductoCost = 0;
        let acueductoSubsidy = 0;

        if (wSubsidyRate > 0) {
            const subWater = Math.min(item.agua_m3, wConf.limite_basico);
            const plenaWater = Math.max(0, item.agua_m3 - wConf.limite_basico);
            const baseSubsidized = wConf.cargo_fijo + (subWater * rAgua);
            
            acueductoSubsidy = baseSubsidized * wSubsidyRate;
            acueductoCost = baseSubsidized - acueductoSubsidy + (plenaWater * rAgua);
        } else if (wSubsidyRate < 0) {
            const baseCost = wConf.cargo_fijo + (item.agua_m3 * rAgua);
            const contribution = baseCost * Math.abs(wSubsidyRate);
            acueductoCost = baseCost + contribution;
        } else {
            acueductoCost = wConf.cargo_fijo + (item.agua_m3 * rAgua);
        }

        // 3. Alcantarillado (Sewerage)
        const alcConf = EPM_CONFIG.alcantarillado;
        const alcSubsidyRate = alcConf.subsidios[currentStratum];
        let alcCost = 0;
        let alcSubsidy = 0;

        if (alcSubsidyRate > 0) {
            const subWater = Math.min(item.agua_m3, alcConf.limite_basico);
            const plenaWater = Math.max(0, item.agua_m3 - alcConf.limite_basico);
            const baseSubsidized = alcConf.cargo_fijo + (subWater * rAlcantarillado);
            
            alcSubsidy = baseSubsidized * alcSubsidyRate;
            alcCost = baseSubsidized - alcSubsidy + (plenaWater * rAlcantarillado);
        } else if (alcSubsidyRate < 0) {
            const baseCost = alcConf.cargo_fijo + (item.agua_m3 * rAlcantarillado);
            const contribution = baseCost * Math.abs(alcSubsidyRate);
            alcCost = baseCost + contribution;
        } else {
            alcCost = alcConf.cargo_fijo + (item.agua_m3 * rAlcantarillado);
        }

        // 4. Gas
        const gConf = EPM_CONFIG.gas;
        const gSubsidyRate = gConf.subsidios[currentStratum];
        let gasCost = 0;
        let gasSubsidy = 0;

        if (gSubsidyRate > 0) {
            const rawCost = gConf.cargo_fijo + (item.gas_m3 * rGas);
            gasSubsidy = rawCost * gSubsidyRate;
            gasCost = rawCost - gasSubsidy;
        } else if (gSubsidyRate < 0) {
            const rawCost = gConf.cargo_fijo + (item.gas_m3 * rGas);
            const contribution = rawCost * Math.abs(gSubsidyRate);
            gasCost = rawCost + contribution;
        } else {
            gasCost = gConf.cargo_fijo + (item.gas_m3 * rGas);
        }

        // 5. Aseo (Emvarias) + Alumbrado Público
        if (!item.hasOwnProperty('otros') || item.otros === undefined || item.otros === 0 || item.isAutocalculatedAseo) {
            const aConf = EPM_CONFIG.aseo;
            const aSubsidyRate = aConf.subsidios[currentStratum];
            const rawAseoTotal = aConf.cargo_fijo + aConf.aprovecha + aConf.variable;
            let aseoCost = 0;
            if (aSubsidyRate > 0) {
                aseoCost = rawAseoTotal * (1 - aSubsidyRate);
            } else if (aSubsidyRate < 0) {
                aseoCost = rawAseoTotal * (1 + Math.abs(aSubsidyRate));
            } else {
                aseoCost = rawAseoTotal;
            }
            // Alumbrado público: cargo fijo del Municipio de Medellín
            item.otros = Math.round(aseoCost + EPM_CONFIG.alumbrado);
            item.isAutocalculatedAseo = true;
        }

        // Save computed results
        item.energia = Math.round(energiaCost);
        item.agua = Math.round(acueductoCost + alcCost);
        item.gas = Math.round(gasCost);
        item.total = item.energia + item.agua + item.gas + item.otros;
    });
}

// --- TAB SWITCHING ---
function setupTabSwitching() {
    if (!el.tabButtons) return;
    el.tabButtons.forEach(btn => {
        btn.addEventListener("click", () => {
            el.tabButtons.forEach(b => b.classList.remove("active"));
            el.tabContents.forEach(c => c.classList.remove("active"));
            
            btn.classList.add("active");
            const tabId = btn.getAttribute("data-tab");
            const targetContent = document.getElementById(`tab-${tabId}`);
            if (targetContent) {
                targetContent.classList.add("active");
            }
            
            const breadcrumb = document.querySelector(".breadcrumb");
            const titleMap = {
                resumen: "Análisis de Consumos",
                energia: "Detalles del Servicio: Energía",
                agua: "Detalles del Servicio: Acueducto & Alcantarillado",
                gas: "Detalles del Servicio: Gas Natural",
                tarifas: "Control e Historial de Tarifas EPM"
            };
            if (breadcrumb) {
                breadcrumb.innerText = `Dashboard / ${btn.querySelector("span").innerText}`;
            }
            if (el.pageTitle) {
                el.pageTitle.innerText = titleMap[tabId];
            }
            
            if (tabId === "resumen" || tabId === "tarifas") {
                renderCharts();
            }
        });
    });
}

// --- UPDATE DASHBOARD ELEMENTS ---

// --- ALERTAS INTELIGENTES DE CONSUMO ---
function generateAlerts() {
    if (invoiceHistory.length < 2) return [];
    const alerts = [];
    const latest = invoiceHistory[invoiceHistory.length - 1];
    const prev   = invoiceHistory[invoiceHistory.length - 2];

    // Promedio de los últimos 3 meses (sin el actual)
    const last3 = invoiceHistory.slice(-4, -1);
    const avg = (field) => last3.length
        ? last3.reduce((s, i) => s + (i[field] || 0), 0) / last3.length
        : prev[field] || 0;

    const checks = [
        { field: "kwh",     label: "Energía",      unit: "kWh", threshold: 15 },
        { field: "agua_m3", label: "Agua",          unit: "m³",  threshold: 20 },
        { field: "gas_m3",  label: "Gas",           unit: "m³",  threshold: 20 },
        { field: "total",   label: "Factura total", unit: "COP", threshold: 15 },
    ];

    for (const c of checks) {
        const current = latest[c.field] || 0;
        const reference = avg(c.field) || prev[c.field] || 0;
        if (!reference) continue;
        const pct = ((current - reference) / reference) * 100;

        if (pct >= c.threshold) {
            alerts.push({
                type: "warning",
                icon: pct >= 30 ? "alert-triangle" : "trending-up",
                title: `${c.label} subió ${pct.toFixed(0)}%`,
                msg: `Consumo actual: ${c.field === "total"
                    ? formatCOP(current)
                    : current + " " + c.unit
                } vs promedio ${c.field === "total"
                    ? formatCOP(Math.round(reference))
                    : Math.round(reference) + " " + c.unit
                } de los últimos meses.`,
                severity: pct >= 30 ? "high" : "medium"
            });
        } else if (pct <= -c.threshold) {
            alerts.push({
                type: "success",
                icon: "trending-down",
                title: `¡${c.label} bajó ${Math.abs(pct).toFixed(0)}%!`,
                msg: `Consumo actual: ${c.field === "total"
                    ? formatCOP(current)
                    : current + " " + c.unit
                }. ¡Buen trabajo ahorrando!`,
                severity: "low"
            });
        }
    }

    // Alerta de tarifa: si la tarifa de energía subió más del 5%
    if (latest.rate_energia && prev.rate_energia) {
        const tarifaPct = ((latest.rate_energia - prev.rate_energia) / prev.rate_energia) * 100;
        if (tarifaPct >= 5) {
            alerts.push({
                type: "info",
                icon: "zap",
                title: `Tarifa de energía subió ${tarifaPct.toFixed(1)}%`,
                msg: `Pasó de ${formatCOPWithDecimals(prev.rate_energia)}/kWh a ${formatCOPWithDecimals(latest.rate_energia)}/kWh. Parte del aumento en tu factura se debe a EPM, no a tu consumo.`,
                severity: "medium"
            });
        }
    }

    return alerts;
}

function renderAlerts() {
    const alerts = generateAlerts();
    const panel = document.getElementById("alerts-panel");
    const list  = document.getElementById("alerts-list");
    if (!panel || !list) return;

    if (alerts.length === 0) {
        panel.style.display = "none";
        return;
    }

    panel.style.display = "block";
    list.innerHTML = alerts.map(a => `
        <div class="alert-item alert-${a.type} alert-sev-${a.severity}">
            <i data-lucide="${a.icon}"></i>
            <div>
                <strong>${a.title}</strong>
                <p>${a.msg}</p>
            </div>
        </div>
    `).join("");
    if (typeof lucide !== "undefined") lucide.createIcons();
}

// --- PROYECCIÓN PRÓXIMO MES ---
function renderProyeccion() {
    const panel = document.getElementById("proyeccion-panel");
    const content = document.getElementById("proyeccion-content");
    if (!panel || !content || invoiceHistory.length < 2) {
        if (panel) panel.style.display = "none";
        return;
    }

    // Usar promedio ponderado de los últimos 3 meses
    const sample = invoiceHistory.slice(-3);
    const avg = (f) => sample.reduce((s, i) => s + (i[f] || 0), 0) / sample.length;

    const pKwh   = Math.round(avg("kwh"));
    const pAgua  = Math.round(avg("agua_m3") * 10) / 10;
    const pGas   = Math.round(avg("gas_m3")  * 10) / 10;
    const pTotal = Math.round(avg("total"));

    const latest = invoiceHistory[invoiceHistory.length - 1];
    const diffPct = latest.total ? ((pTotal - latest.total) / latest.total * 100).toFixed(1) : 0;
    const diffSign = diffPct >= 0 ? "+" : "";
    const diffClass = diffPct >= 0 ? "proj-up" : "proj-down";
    const diffIcon  = diffPct >= 0 ? "trending-up" : "trending-down";

    const nextMes = getNextMonthName();

    content.innerHTML = `
        <div class="proyeccion-grid">
            <div class="proj-item">
                <span class="proj-label"><i data-lucide="zap"></i> Energía</span>
                <span class="proj-value">${pKwh} kWh</span>
            </div>
            <div class="proj-item">
                <span class="proj-label"><i data-lucide="droplet"></i> Agua</span>
                <span class="proj-value">${pAgua} m³</span>
            </div>
            <div class="proj-item">
                <span class="proj-label"><i data-lucide="flame"></i> Gas</span>
                <span class="proj-value">${pGas} m³</span>
            </div>
            <div class="proj-item proj-total">
                <span class="proj-label">Estimado ${nextMes}</span>
                <span class="proj-value proj-total-val">${formatCOP(pTotal)}</span>
                <span class="proj-diff ${diffClass}"><i data-lucide="${diffIcon}"></i>${diffSign}${diffPct}% vs mes actual</span>
            </div>
        </div>
        <p class="proj-note">Basado en el promedio de los últimos ${sample.length} meses registrados.</p>
    `;

    panel.style.display = "flex";
    if (typeof lucide !== "undefined") lucide.createIcons();
}

function updateDashboardUI() {
    // ── Show/hide empty state ─────────────────────────────────────────────
    const emptyStateEl = document.getElementById("empty-state");
    const kpiGrid = document.querySelector(".kpi-grid");
    const alertsP = document.getElementById("alerts-panel");
    const proyP = document.getElementById("proyeccion-panel");
    const infoPanel = document.querySelector(".info-alert-panel");

    if (invoiceHistory.length === 0) {
        if (emptyStateEl) emptyStateEl.style.display = "flex";
        if (kpiGrid) kpiGrid.style.display = "none";
        if (alertsP) alertsP.style.display = "none";
        if (proyP) proyP.style.display = "none";
        if (infoPanel) infoPanel.style.display = "none";

        if (el.kpiTotalFactura) el.kpiTotalFactura.innerText = "$0";
        populateHistoryTable();
        if (historyChart) { historyChart.destroy(); historyChart = null; }
        if (distributionChart) { distributionChart.destroy(); distributionChart = null; }
        if (tariffsChart) { tariffsChart.destroy(); tariffsChart = null; }
        if (typeof lucide !== 'undefined') lucide.createIcons();
        return;
    }

    // Has data — show normal UI
    if (emptyStateEl) emptyStateEl.style.display = "none";
    if (kpiGrid) kpiGrid.style.display = "";
    if (infoPanel) infoPanel.style.display = "";

    if (invoiceHistory.length === 0) {
        if (el.kpiTotalFactura) el.kpiTotalFactura.innerText = "$0";
        if (el.kpiEnergiaCost) el.kpiEnergiaCost.innerText = "$0";
        if (el.kpiEnergiaConsumo) el.kpiEnergiaConsumo.innerText = "0 kWh";
        if (el.kpiAguaCost) el.kpiAguaCost.innerText = "$0";
        if (el.kpiAguaConsumo) el.kpiAguaConsumo.innerText = "0 m³";
        if (el.kpiGasCost) el.kpiGasCost.innerText = "$0";
        if (el.kpiGasConsumo) el.kpiGasConsumo.innerText = "0 m³";
        populateHistoryTable();
        if (historyChart) { historyChart.destroy(); historyChart = null; }
        if (distributionChart) { distributionChart.destroy(); distributionChart = null; }
        if (tariffsChart) { tariffsChart.destroy(); tariffsChart = null; }
        if (typeof lucide !== 'undefined') lucide.createIcons();
        return;
    }

    // If there is only one item registered
    if (invoiceHistory.length === 1) {
        const latest = invoiceHistory[0];
        
        if (el.kpiTotalFactura) el.kpiTotalFactura.innerText = formatCOP(latest.total);
        if (el.kpiEnergiaCost) el.kpiEnergiaCost.innerText = formatCOP(latest.energia);
        if (el.kpiEnergiaConsumo) el.kpiEnergiaConsumo.innerText = `${latest.kwh} kWh`;
        if (el.kpiAguaCost) el.kpiAguaCost.innerText = formatCOP(latest.agua);
        if (el.kpiAguaConsumo) el.kpiAguaConsumo.innerText = `${latest.agua_m3} m³`;
        if (el.kpiGasCost) el.kpiGasCost.innerText = formatCOP(latest.gas);
        if (el.kpiGasConsumo) el.kpiGasConsumo.innerText = `${latest.gas_m3} m³`;
        
        const kpiChangeContainer = document.querySelector(".kpi-change");
        if (kpiChangeContainer) {
            kpiChangeContainer.className = "kpi-change";
            const kpiSpan = kpiChangeContainer.querySelector("span");
            if (kpiSpan) kpiSpan.innerHTML = "Primer mes registrado (ingresa más periodos para ver diferencias)";
            const kpiIcon = kpiChangeContainer.querySelector("i");
            if (kpiIcon) kpiIcon.setAttribute("data-lucide", "calendar");
        }
        
        const expText = document.getElementById("smart-explanation-text");
        if (expText) expText.innerHTML = "Has ingresado tu primera factura en la aplicación. Agrega el recibo del mes siguiente para calcular y graficar las diferencias de consumo y tarifas automáticamente.";
        
        updateDetailTabs(latest);
        populateHistoryTable();
        renderCharts();

        if (typeof lucide !== 'undefined') lucide.createIcons();
        return;
    }

    const latest = invoiceHistory[invoiceHistory.length - 1];
    const prev = invoiceHistory[invoiceHistory.length - 2];

    if (el.kpiTotalFactura) el.kpiTotalFactura.innerText = formatCOP(latest.total);
    if (el.kpiEnergiaCost) el.kpiEnergiaCost.innerText = formatCOP(latest.energia);
    if (el.kpiEnergiaConsumo) el.kpiEnergiaConsumo.innerText = `${latest.kwh} kWh`;
    if (el.kpiAguaCost) el.kpiAguaCost.innerText = formatCOP(latest.agua);
    if (el.kpiAguaConsumo) el.kpiAguaConsumo.innerText = `${latest.agua_m3} m³`;
    if (el.kpiGasCost) el.kpiGasCost.innerText = formatCOP(latest.gas);
    if (el.kpiGasConsumo) el.kpiGasConsumo.innerText = `${latest.gas_m3} m³`;

    // ── Semáforo en cada KPI card ─────────────────────────────────────────
    function setSemaforo(cardId, curr, prevVal) {
        const card = document.getElementById(cardId);
        if (!card || !prevVal || !curr) return;
        const pct = ((curr - prevVal) / prevVal) * 100;
        card.classList.remove("kpi-red","kpi-yellow","kpi-green");
        const footer = card.querySelector(".kpi-footer .trend-indicator");
        const sign = pct >= 0 ? "+" : "";
        const absPct = Math.abs(pct).toFixed(1);
        const diffCOP = curr - prevVal;

        if (pct >= 10) {
            card.classList.add("kpi-red");
            if (footer) footer.innerHTML = `<i data-lucide="arrow-up-right"></i> ${sign}${absPct}% (${formatCOP(diffCOP)})`;
            if (footer) footer.className = "trend-indicator up";
        } else if (pct >= 3) {
            card.classList.add("kpi-yellow");
            if (footer) footer.innerHTML = `<i data-lucide="arrow-up-right"></i> ${sign}${absPct}% (${formatCOP(diffCOP)})`;
            if (footer) footer.className = "trend-indicator up";
        } else if (pct <= -3) {
            card.classList.add("kpi-green");
            if (footer) footer.innerHTML = `<i data-lucide="arrow-down-right"></i> ${absPct}% (${formatCOP(diffCOP)})`;
            if (footer) footer.className = "trend-indicator down";
        } else {
            if (footer) footer.innerHTML = `<i data-lucide="minus"></i> Sin cambio significativo`;
            if (footer) footer.className = "trend-indicator neutral";
        }
    }
    setSemaforo("kpi-card-energia", latest.energia, prev.energia);
    setSemaforo("kpi-card-agua",    latest.agua,    prev.agua);
    setSemaforo("kpi-card-gas",     latest.gas,     prev.gas);

    // Percentage difference
    const diffPercent = ((latest.total - prev.total) / prev.total * 100).toFixed(1);
    const direction = diffPercent >= 0 ? "+" : "";
    const badgeClass = diffPercent >= 0 ? "bad" : "good";
    const trendIcon = diffPercent >= 0 ? "trending-up" : "trending-down";

    // Update chart annotation badge
    const chartBadge = document.getElementById("chart-main-badge");
    if (chartBadge) {
        chartBadge.textContent = `${direction}${diffPercent}% vs ${prev.mes.split(" ")[0]}`;
        chartBadge.className = `chart-badge ${diffPercent >= 0 ? "bad" : ""}`;
        chartBadge.style.display = diffPercent === 0 ? "none" : "";
    }
    
    const kpiChangeContainer = document.querySelector(".kpi-change");
    if (kpiChangeContainer) {
        const diffCOP = latest.total - prev.total;
        const absDiffCOP = Math.abs(diffCOP);
        const arrow = diffCOP >= 0 ? "▲" : "▼";
        kpiChangeContainer.className = `kpi-change ${badgeClass}`;
        kpiChangeContainer.innerHTML = `
            <div class="kpi-compare-row">
                <div class="kpi-compare-item">
                    <span class="kpi-compare-label">${prev.mes}</span>
                    <span class="kpi-compare-val">${formatCOP(prev.total)}</span>
                </div>
                <div class="kpi-compare-arrow ${badgeClass}">${arrow}</div>
                <div class="kpi-compare-item">
                    <span class="kpi-compare-label">${latest.mes}</span>
                    <span class="kpi-compare-val kpi-compare-latest">${formatCOP(latest.total)}</span>
                </div>
            </div>
            <div class="kpi-compare-diff ${badgeClass}">
                <i data-lucide="${trendIcon}"></i>
                <strong>${direction}${diffPercent}%</strong>
                &nbsp;·&nbsp; ${diffCOP >= 0 ? "+" : "−"} ${formatCOP(absDiffCOP)} vs mes anterior
            </div>
        `;
    }

    updateDetailTabs(latest);
    generateSmartExplanation(latest, prev);
    populateHistoryTable();
    renderCharts();

    // Update Tariff Tab unit rates
    updateTariffTabKPIs(latest);

    if (typeof lucide !== 'undefined') lucide.createIcons();
}

function updateDetailTabs(latest) {
    const eConf  = EPM_CONFIG.energia;
    const wConf  = EPM_CONFIG.acueducto;
    const alcConf = EPM_CONFIG.alcantarillado;
    const gConf  = EPM_CONFIG.gas;

    const mult = (conf) => conf.subsidios[currentStratum] > 0
        ? 1 - conf.subsidios[currentStratum]
        : 1 + Math.abs(conf.subsidios[currentStratum]);

    const rEnergia       = latest.rate_energia       || eConf.tarifa_plena;
    const rAgua          = latest.rate_agua          || wConf.tarifa_plena;
    const rAlcantarillado = latest.rate_alcantarillado || alcConf.tarifa_plena;
    const rGas           = latest.rate_gas           || gConf.tarifa_plena;

    const wMult   = mult(wConf);
    const alcMult = mult(alcConf);
    const gMult   = mult(gConf);

    const waterCargoFijo = wConf.cargo_fijo * wMult;
    const alcCargoFijo   = alcConf.cargo_fijo * alcMult;
    const gasCargoFijo   = gConf.cargo_fijo * gMult;

    // ── Helper: build mini rate-bars from history ──────────────────────────
    function buildRateBars(containerId, items, field, unit, color) {
        const el2 = document.getElementById(containerId);
        if (!el2 || items.length === 0) return;
        const vals = items.map(i => i[field] || 0).filter(v => v > 0);
        if (vals.length === 0) return;
        const maxVal = Math.max(...vals);
        const last3 = items.slice(-5);
        el2.innerHTML = last3.map((item, idx) => {
            const val = item[field] || 0;
            if (!val) return "";
            const pct = Math.round((val / maxVal) * 100);
            const isLatest = idx === last3.length - 1;
            return `
                <div class="rate-bar-row ${isLatest ? "rate-bar-latest" : ""}">
                    <span class="rate-bar-mes">${item.mes.split(" ")[0].substring(0,3)} ${item.mes.split(" ")[1]?.slice(-2) || ""}</span>
                    <div class="rate-bar-track">
                        <div class="rate-bar-fill" style="width:${pct}%;background:${color}${isLatest ? "" : "80"}"></div>
                    </div>
                    <span class="rate-bar-val ${isLatest ? "rate-bar-val-latest" : ""}">${formatCOPWithDecimals(val)}<small>/${unit}</small></span>
                </div>`;
        }).join("");
    }

    // ── Helper: rate diff badge vs previous month ─────────────────────────
    function rateDiff(current, prev) {
        if (!prev || !current) return "";
        const pct = ((current - prev) / prev * 100);
        const sign = pct >= 0 ? "+" : "";
        const cls  = pct >= 0 ? "rate-diff-up" : "rate-diff-down";
        const icon = pct >= 0 ? "▲" : "▼";
        return `<span class="rate-diff-badge ${cls}">${icon} ${sign}${pct.toFixed(1)}% vs mes anterior</span>`;
    }

    const prev = invoiceHistory.length > 1 ? invoiceHistory[invoiceHistory.length - 2] : null;

    // ════════════════════════════════════════════════════════════════════════
    // ENERGÍA
    // ════════════════════════════════════════════════════════════════════════
    if (el.detailEnergiaTarifa) el.detailEnergiaTarifa.innerText = formatCOPWithDecimals(rEnergia);
    const eDiffEl = document.getElementById("energia-rate-diff");
    if (eDiffEl) eDiffEl.innerHTML = rateDiff(rEnergia, prev?.rate_energia);

    if (el.detailEnergiaConsumo) el.detailEnergiaConsumo.innerText = `${latest.kwh || 0} kWh`;
    if (el.detailEnergiaAlumbrado) el.detailEnergiaAlumbrado.innerText = formatCOP(EPM_CONFIG.alumbrado);
    if (el.detailEnergiaTotal) el.detailEnergiaTotal.innerText = formatCOP(latest.energia || 0);

    if (el.detailEnergiaSubsidio) {
        const sr = eConf.subsidios[currentStratum];
        if (sr > 0) {
            const subKwh = Math.min(latest.kwh || 0, eConf.limite_subsistencia);
            el.detailEnergiaSubsidio.innerText = `Subsidio ${sr*100}% · ${subKwh} kWh · ahorro ${formatCOP(subKwh * rEnergia * sr)}`;
            el.detailEnergiaSubsidio.className = "value badge text-success";
        } else if (sr < 0) {
            el.detailEnergiaSubsidio.innerText = `Contribución solidaridad +${Math.abs(sr)*100}%`;
            el.detailEnergiaSubsidio.className = "value badge text-yellow";
        } else {
            el.detailEnergiaSubsidio.innerText = "Sin subsidio ni contribución (Estrato 4)";
            el.detailEnergiaSubsidio.className = "value badge neutral";
        }
    }

    buildRateBars("energia-rate-bars", invoiceHistory, "rate_energia", "kWh", "var(--yellow)");

    const eTrendDesc = document.getElementById("energia-trend-desc");
    if (eTrendDesc && prev?.rate_energia) {
        const pct = ((rEnergia - prev.rate_energia) / prev.rate_energia * 100);
        eTrendDesc.innerHTML = pct >= 0
            ? `La tarifa de energía <strong>subió ${pct.toFixed(1)}%</strong> vs el mes anterior. Parte del aumento en tu factura se debe a EPM, no a tu consumo.`
            : `La tarifa de energía <strong>bajó ${Math.abs(pct).toFixed(1)}%</strong> vs el mes anterior. ¡Buenas noticias!`;
    }

    // ════════════════════════════════════════════════════════════════════════
    // AGUA
    // ════════════════════════════════════════════════════════════════════════
    if (el.detailAguaTarifaAcueducto) el.detailAguaTarifaAcueducto.innerText = formatCOPWithDecimals(rAgua * wMult);
    const wDiffEl = document.getElementById("agua-rate-diff");
    if (wDiffEl) wDiffEl.innerHTML = rateDiff(rAgua, prev?.rate_agua);

    if (el.detailAguaConsumo) el.detailAguaConsumo.innerText = `${latest.agua_m3 || 0} m³`;
    if (el.detailAguaCargoFijo) el.detailAguaCargoFijo.innerText = formatCOP(waterCargoFijo);
    if (el.detailAguaTarifaAlcantarillado) el.detailAguaTarifaAlcantarillado.innerText = formatCOPWithDecimals(rAlcantarillado * alcMult);
    if (el.detailAguaCargoFijoAlc) el.detailAguaCargoFijoAlc.innerText = formatCOP(alcCargoFijo);
    if (el.detailAguaTotal) el.detailAguaTotal.innerText = formatCOP(latest.agua || 0);

    // Gauge
    if (el.waterGaugeBar) {
        const maxGauge = Math.max((latest.agua_m3 || 0) * 1.5, 20);
        const pct = Math.min(((latest.agua_m3 || 0) / maxGauge) * 100, 100);
        const limitPct = Math.min((wConf.limite_basico / maxGauge) * 100, 100);
        el.waterGaugeBar.style.width = `${pct}%`;
        el.waterGaugeBar.style.background = (latest.agua_m3 || 0) > wConf.limite_basico
            ? "var(--red)" : "var(--blue)";
        const marker = document.getElementById("agua-gauge-marker");
        if (marker) marker.style.left = `${limitPct}%`;
        const markerLabel = document.getElementById("agua-gauge-marker-label");
        if (markerLabel) markerLabel.innerText = `${wConf.limite_basico} m³ (subsidiado)`;
        const gaugeText = document.getElementById("agua-gauge-text");
        if (gaugeText) {
            const over = (latest.agua_m3 || 0) - wConf.limite_basico;
            gaugeText.innerHTML = over > 0
                ? `<span style="color:var(--red)">${latest.agua_m3} m³ · excede ${over.toFixed(1)} m³ del límite</span>`
                : `<span style="color:var(--green)">${latest.agua_m3} m³ · dentro del límite subsidiado</span>`;
        }
        const maxLabel = document.getElementById("agua-gauge-max");
        if (maxLabel) maxLabel.innerText = `${Math.round(maxGauge)} m³`;
    }

    buildRateBars("agua-rate-bars", invoiceHistory, "rate_agua", "m³", "var(--blue)");

    // ════════════════════════════════════════════════════════════════════════
    // GAS
    // ════════════════════════════════════════════════════════════════════════
    if (el.detailGasTarifa) el.detailGasTarifa.innerText = formatCOPWithDecimals(rGas * gMult);
    const gDiffEl = document.getElementById("gas-rate-diff");
    if (gDiffEl) gDiffEl.innerHTML = rateDiff(rGas, prev?.rate_gas);

    if (el.detailGasConsumo) el.detailGasConsumo.innerText = `${latest.gas_m3 || 0} m³`;
    if (el.detailGasCargoFijo) el.detailGasCargoFijo.innerText = formatCOP(gasCargoFijo);
    if (el.detailGasTotal) el.detailGasTotal.innerText = formatCOP(latest.gas || 0);

    buildRateBars("gas-rate-bars", invoiceHistory, "rate_gas", "m³", "var(--orange,#f97316)");

    // Gas efficiency badge
    const gEff = document.getElementById("gas-eff-title");
    const gMsg = document.getElementById("gas-eff-msg");
    const gIcon = document.getElementById("gas-eff-icon");
    if (gEff && gMsg && latest.gas_m3) {
        const m3 = latest.gas_m3;
        const avg3 = invoiceHistory.slice(-4,-1).reduce((s,i) => s+(i.gas_m3||0), 0) / Math.max(invoiceHistory.slice(-4,-1).length, 1);
        const pct = avg3 > 0 ? ((m3 - avg3) / avg3 * 100) : 0;
        if (m3 <= 10) {
            gEff.innerText = "¡Consumo eficiente!";
            gMsg.innerText = `${m3} m³ está dentro del rango óptimo para hogares en Medellín (hasta 10 m³).`;
            if (gIcon) gIcon.setAttribute("data-lucide","thumbs-up");
        } else if (pct > 15) {
            gEff.innerText = `Consumo alto este mes (+${pct.toFixed(0)}%)`;
            gMsg.innerText = `${m3} m³ supera tu promedio de ${avg3.toFixed(1)} m³. Revisa calentador o estufas.`;
            if (gIcon) gIcon.setAttribute("data-lucide","alert-triangle");
        } else {
            gEff.innerText = "Consumo normal";
            gMsg.innerText = `${m3} m³ es similar a tus meses anteriores (promedio ${avg3.toFixed(1)} m³).`;
            if (gIcon) gIcon.setAttribute("data-lucide","check-circle");
        }
    }

    const gTrendDesc = document.getElementById("gas-trend-desc");
    if (gTrendDesc && prev?.rate_gas) {
        const pct = ((rGas - prev.rate_gas) / prev.rate_gas * 100);
        gTrendDesc.innerHTML = pct >= 0
            ? `Tarifa de gas <strong>subió ${pct.toFixed(1)}%</strong> vs mes anterior.`
            : `Tarifa de gas <strong>bajó ${Math.abs(pct).toFixed(1)}%</strong> vs mes anterior.`;
    }

    if (typeof lucide !== "undefined") lucide.createIcons();
}

// --- GENERATE SMART EXPLANATION FOR DASHBOARD ---
function generateSmartExplanation(latest, prev) {
    const expText = document.getElementById("smart-explanation-text");
    const panelTitle = document.querySelector(".info-alert-panel h3");
    if (!expText) return;

    const diffTotal = latest.total - prev.total;
    const pctTotal  = ((diffTotal / prev.total) * 100).toFixed(1);
    const sign      = diffTotal >= 0 ? "+" : "−";
    const absDiff   = Math.abs(diffTotal);

    // Find biggest driver of change
    const services = [
        { name: "Energía",      curr: latest.energia, prev: prev.energia, icon: "⚡" },
        { name: "Agua",         curr: latest.agua,    prev: prev.agua,    icon: "💧" },
        { name: "Gas",          curr: latest.gas,     prev: prev.gas,     icon: "🔥" },
        { name: "Otros",        curr: latest.otros,   prev: prev.otros,   icon: "🏠" },
    ].filter(s => s.prev > 0).map(s => ({
        ...s,
        diff: s.curr - s.prev,
        pct: ((s.curr - s.prev) / s.prev * 100).toFixed(1)
    })).sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff));

    const main = services[0];
    const isUp = diffTotal >= 0;

    // Update panel title
    if (panelTitle) {
        panelTitle.textContent = isUp
            ? "¿Por qué subió tu factura este mes?"
            : "¿Por qué bajó tu factura este mes?";
    }

    // Build service breakdown lines
    const lines = services.map(s => {
        const sSign = s.diff >= 0 ? "+" : "−";
        const sPct  = Math.abs(parseFloat(s.pct));
        const color = s.diff >= 5000 ? "var(--red)" : s.diff <= -5000 ? "var(--green)" : "var(--text-muted)";
        const arrow = s.diff >= 500 ? "▲" : s.diff <= -500 ? "▼" : "→";
        return `<span class="why-svc" style="border-left:3px solid ${color}">
            ${s.icon} <strong>${s.name}</strong>
            <span class="why-svc-diff" style="color:${color}">${arrow} ${sSign}${formatCOP(Math.abs(s.diff))} (${sSign}${sPct}%)</span>
        </span>`;
    }).join("");

    // Main explanation text
    let mainText = "";
    if (Math.abs(parseFloat(pctTotal)) < 2) {
        mainText = `Tu factura se mantuvo estable — varió solo <strong>${sign}${formatCOP(absDiff)}</strong> (${sign}${Math.abs(parseFloat(pctTotal))}%) respecto a ${prev.mes}.`;
    } else if (main) {
        const mainPct = Math.abs(parseFloat(main.pct));
        const mainSign = main.diff >= 0 ? "subió" : "bajó";
        mainText = isUp
            ? `Tu factura subió <strong>${formatCOP(absDiff)}</strong> (<strong style="color:var(--red)">${sign}${pctTotal}%</strong>) vs ${prev.mes}. El principal responsable fue <strong>${main.icon} ${main.name}</strong>, que ${mainSign} <strong>${formatCOP(Math.abs(main.diff))}</strong> (${Math.abs(parseFloat(main.pct)).toFixed(1)}%).`
            : `Tu factura bajó <strong>${formatCOP(absDiff)}</strong> (<strong style="color:var(--green)">${sign}${Math.abs(parseFloat(pctTotal))}%</strong>) vs ${prev.mes}. El mayor ahorro vino de <strong>${main.icon} ${main.name}</strong> con <strong>${formatCOP(Math.abs(main.diff))}</strong> menos.`;
    }

    expText.innerHTML = `
        <p style="margin-bottom:1rem;line-height:1.7">${mainText}</p>
        <div class="why-services">${lines}</div>
    `;
}


// --- POPULATE TABLE ---
function populateHistoryTable() {
    const tableBody = document.getElementById("history-table-body");
    if (!tableBody) return;
    tableBody.innerHTML = "";

    if (invoiceHistory.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="8" style="text-align: center; color: var(--text-muted); padding: 2.5rem;">
                    <p style="margin-bottom: 0.5rem; font-weight: 500; font-size: 1rem; color: #cbd5e1;">Historial vacío</p>
                    <p style="font-size: 0.8rem; opacity: 0.8;">Registra tu primera factura usando el botón de arriba.</p>
                </td>
            </tr>
        `;
        return;
    }

    for (let i = invoiceHistory.length - 1; i >= 0; i--) {
        const item = invoiceHistory[i];
        const prev = i > 0 ? invoiceHistory[i - 1] : null;

        // Row color based on variation vs previous month
        let rowClass = "";
        let totalBadge = "";
        if (prev && prev.total) {
            const pct = ((item.total - prev.total) / prev.total) * 100;
            const sign = pct >= 0 ? "+" : "";
            const absPct = Math.abs(pct).toFixed(1);
            if (pct >= 10) {
                rowClass = "row-danger";
                totalBadge = `<span class="table-diff-badge badge-up">▲ ${sign}${absPct}%</span>`;
            } else if (pct >= 3) {
                rowClass = "row-warning";
                totalBadge = `<span class="table-diff-badge badge-warn">▲ ${sign}${absPct}%</span>`;
            } else if (pct <= -5) {
                rowClass = "row-success";
                totalBadge = `<span class="table-diff-badge badge-down">▼ ${absPct}%</span>`;
            } else {
                totalBadge = `<span class="table-diff-badge badge-neutral">${sign}${absPct}%</span>`;
            }
        }

        // Per-service diff indicators
        function svcDiff(curr, prevVal) {
            if (!prevVal || !curr) return "";
            const p = ((curr - prevVal) / prevVal * 100).toFixed(0);
            if (p >= 10) return `<span class="svc-diff up">▲${p}%</span>`;
            if (p <= -5) return `<span class="svc-diff down">▼${Math.abs(p)}%</span>`;
            return "";
        }

        const row = document.createElement("tr");
        row.className = rowClass;
        row.innerHTML = `
            <td>
                <strong>${item.mes}</strong>
                ${i === invoiceHistory.length - 1 ? '<span class="badge-latest">Último</span>' : ""}
            </td>
            <td>
                <strong class="total-cell">${formatCOP(item.total)}</strong>
                <div style="margin-top:3px">${totalBadge}</div>
            </td>
            <td>
                ${formatCOP(item.energia)}
                ${svcDiff(item.energia, prev?.energia)}
                <div class="cell-sub">${item.kwh || "—"} kWh</div>
            </td>
            <td>
                ${formatCOP(item.agua)}
                ${svcDiff(item.agua, prev?.agua)}
                <div class="cell-sub">${item.agua_m3 || "—"} m³</div>
            </td>
            <td>
                ${formatCOP(item.gas)}
                ${svcDiff(item.gas, prev?.gas)}
                <div class="cell-sub">${item.gas_m3 || "—"} m³</div>
            </td>
            <td>${formatCOP(item.otros)}</td>
            <td><span class="status-badge pago">${item.estado || "—"}</span></td>
            <td class="action-cell">
                <button class="btn-delete" data-index="${i}" title="Eliminar este mes">
                    <i data-lucide="trash-2"></i>
                </button>
            </td>
        `;
        tableBody.appendChild(row);
    }

    // Deletion handler
    document.querySelectorAll(".btn-delete").forEach(btn => {
        btn.addEventListener("click", (e) => {
            e.stopPropagation();
            const index = parseInt(btn.getAttribute("data-index"));
            const monthName = invoiceHistory[index].mes;
            showConfirmDialog(`¿Estás seguro de que deseas eliminar la factura de ${monthName}?`, () => {
                invoiceHistory.splice(index, 1);
                calculateInvoices();
                saveToStorage();
                updateDashboardUI();
            });
        });
    });

    if (typeof lucide !== 'undefined') lucide.createIcons();

    renderAlerts();
    renderProyeccion();
}

// --- CHART RENDERING (Chart.js) ---
function setChartType(type, button) {
    activeChartType = type;
    document.querySelectorAll(".chart-actions button").forEach(btn => btn.classList.remove("active"));
    if (button) button.classList.add("active");
    renderCharts();
}

function renderCharts() {
    if (typeof Chart === 'undefined') {
        console.warn("Chart.js is not loaded. Skipping chart rendering.");
        return;
    }

    if (invoiceHistory.length === 0) {
        if (historyChart) { historyChart.destroy(); historyChart = null; }
        if (distributionChart) { distributionChart.destroy(); distributionChart = null; }
        if (tariffsChart) { tariffsChart.destroy(); tariffsChart = null; }
        return;
    }

    const labels = invoiceHistory.map(item => item.mes.split(" ")[0]);
    const latest = invoiceHistory[invoiceHistory.length - 1];

    // --- 1. HISTORICAL STACKED BAR CHART (Resumen Tab) ---
    const canvasHistory = document.getElementById("historyChart");
    if (canvasHistory && document.getElementById("tab-resumen").classList.contains("active")) {
        const ctxHistory = canvasHistory.getContext("2d");
        if (historyChart) historyChart.destroy();

        let datasets = [];
        if (activeChartType === "cost") {
            datasets = [
                {
                    label: "Luz (Energía)",
                    data: invoiceHistory.map(item => item.energia),
                    backgroundColor: "rgba(245, 158, 11, 0.4)",
                    borderColor: "#f59e0b",
                    borderWidth: 2,
                    borderRadius: 4,
                    stack: 'Stack 0',
                },
                {
                    label: "Agua + Alc.",
                    data: invoiceHistory.map(item => item.agua),
                    backgroundColor: "rgba(14, 165, 233, 0.4)",
                    borderColor: "#0ea5e9",
                    borderWidth: 2,
                    borderRadius: 4,
                    stack: 'Stack 0',
                },
                {
                    label: "Gas",
                    data: invoiceHistory.map(item => item.gas),
                    backgroundColor: "rgba(249, 115, 22, 0.4)",
                    borderColor: "#f97316",
                    borderWidth: 2,
                    borderRadius: 4,
                    stack: 'Stack 0',
                },
                {
                    label: "Aseo & Otros",
                    data: invoiceHistory.map(item => item.otros),
                    backgroundColor: "rgba(139, 92, 246, 0.4)",
                    borderColor: "#8b5cf6",
                    borderWidth: 2,
                    borderRadius: 4,
                    stack: 'Stack 0',
                }
            ];
        } else {
            datasets = [
                {
                    label: "Luz (kWh)",
                    data: invoiceHistory.map(item => item.kwh),
                    backgroundColor: "rgba(245, 158, 11, 0.7)",
                    borderColor: "#f59e0b",
                    borderWidth: 1,
                    yAxisID: 'yEnergia'
                },
                {
                    label: "Agua (m³)",
                    data: invoiceHistory.map(item => item.agua_m3),
                    backgroundColor: "rgba(14, 165, 233, 0.7)",
                    borderColor: "#0ea5e9",
                    borderWidth: 1,
                    yAxisID: 'yAguaGas'
                },
                {
                    label: "Gas (m³)",
                    data: invoiceHistory.map(item => item.gas_m3),
                    backgroundColor: "rgba(249, 115, 22, 0.7)",
                    borderColor: "#f97316",
                    borderWidth: 1,
                    yAxisID: 'yAguaGas'
                }
            ];
        }

        historyChart = new Chart(ctxHistory, {
            type: 'bar',
            data: { labels, datasets },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { labels: { color: "#94a3b8", font: { family: 'Outfit' } } },
                    tooltip: {
                        mode: 'index',
                        intersect: false,
                        backgroundColor: '#0f172a',
                        titleColor: '#fff',
                        bodyColor: '#cbd5e1',
                        borderColor: 'rgba(255, 255, 255, 0.1)',
                        borderWidth: 1
                    }
                },
                scales: activeChartType === "cost" ? {
                    x: {
                        grid: { color: "rgba(255, 255, 255, 0.03)" },
                        ticks: { color: "#94a3b8", font: { family: 'Outfit' } }
                    },
                    y: {
                        grid: { color: "rgba(255, 255, 255, 0.03)" },
                        ticks: {
                            color: "#94a3b8",
                            font: { family: 'Outfit' },
                            callback: (value) => formatCOP(value)
                        }
                    }
                } : {
                    x: {
                        grid: { color: "rgba(255, 255, 255, 0.03)" },
                        ticks: { color: "#94a3b8", font: { family: 'Outfit' } }
                    },
                    yEnergia: {
                        type: 'linear',
                        position: 'left',
                        grid: { color: "rgba(255, 255, 255, 0.03)" },
                        ticks: { color: "#f59e0b", font: { family: 'Outfit' } },
                        title: { display: true, text: 'Luz (kWh)', color: '#f59e0b', font: { family: 'Outfit', weight: 'bold' } }
                    },
                    yAguaGas: {
                        type: 'linear',
                        position: 'right',
                        grid: { drawOnChartArea: false },
                        ticks: { color: "#0ea5e9", font: { family: 'Outfit' } },
                        title: { display: true, text: 'Agua/Gas (m³)', color: '#0ea5e9', font: { family: 'Outfit', weight: 'bold' } }
                    }
                }
            }
        });
    }

    // --- 2. COST DISTRIBUTION CHART (Resumen Tab) ---
    const canvasDist = document.getElementById("distributionChart");
    if (canvasDist && document.getElementById("tab-resumen").classList.contains("active")) {
        const ctxDist = canvasDist.getContext("2d");
        if (distributionChart) distributionChart.destroy();

        distributionChart = new Chart(ctxDist, {
            type: 'doughnut',
            data: {
                labels: ["Energía", "Agua + Alc.", "Gas", "Otros/Aseo"],
                datasets: [{
                    data: [latest.energia, latest.agua, latest.gas, latest.otros],
                    backgroundColor: ["#f59e0b", "#0ea5e9", "#f97316", "#8b5cf6"],
                    borderWidth: 2,
                    borderColor: "#0f172a"
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'bottom', labels: { color: "#94a3b8", font: { family: 'Outfit' } } },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const value = context.raw;
                                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                const percentage = ((value / total) * 100).toFixed(1);
                                return ` ${context.label}: ${formatCOP(value)} (${percentage}%)`;
                            }
                        }
                    }
                }
            }
        });
    }

    // --- 3. TARIFF EVOLUTION LINE CHART (Tariffs Tab) ---
    const canvasTariffs = document.getElementById("tariffsChart");
    if (canvasTariffs && document.getElementById("tab-tarifas").classList.contains("active")) {
        const ctxTariffs = canvasTariffs.getContext("2d");
        if (tariffsChart) tariffsChart.destroy();

        tariffsChart = new Chart(ctxTariffs, {
            type: 'line',
            data: {
                labels,
                datasets: [
                    {
                        label: "Energía ($/kWh)",
                        data: invoiceHistory.map(item => item.rate_energia),
                        borderColor: "#f59e0b",
                        backgroundColor: "rgba(245, 158, 11, 0.1)",
                        borderWidth: 3,
                        pointRadius: 4,
                        pointBackgroundColor: "#f59e0b",
                        tension: 0.2,
                        yAxisID: 'yLuz'
                    },
                    {
                        label: "Agua + Alc. ($/m³)",
                        data: invoiceHistory.map(item => (item.rate_agua + item.rate_alcantarillado)),
                        borderColor: "#0ea5e9",
                        backgroundColor: "rgba(14, 165, 233, 0.1)",
                        borderWidth: 3,
                        pointRadius: 4,
                        pointBackgroundColor: "#0ea5e9",
                        tension: 0.2,
                        yAxisID: 'yAguaGas'
                    },
                    {
                        label: "Gas ($/m³)",
                        data: invoiceHistory.map(item => item.rate_gas),
                        borderColor: "#f97316",
                        backgroundColor: "rgba(249, 115, 22, 0.1)",
                        borderWidth: 3,
                        pointRadius: 4,
                        pointBackgroundColor: "#f97316",
                        tension: 0.2,
                        yAxisID: 'yAguaGas'
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { labels: { color: "#94a3b8", font: { family: 'Outfit' } } },
                    tooltip: {
                        mode: 'index',
                        intersect: false,
                        backgroundColor: '#0f172a',
                        bodyColor: '#cbd5e1',
                        borderColor: 'rgba(255, 255, 255, 0.1)',
                        borderWidth: 1
                    }
                },
                scales: {
                    x: {
                        grid: { color: "rgba(255, 255, 255, 0.03)" },
                        ticks: { color: "#94a3b8", font: { family: 'Outfit' } }
                    },
                    yLuz: {
                        type: 'linear',
                        position: 'left',
                        grid: { color: "rgba(255, 255, 255, 0.03)" },
                        ticks: { color: "#f59e0b", font: { family: 'Outfit' } },
                        title: { display: true, text: 'Energía ($/kWh)', color: '#f59e0b', font: { family: 'Outfit', weight: 'bold' } }
                    },
                    yAguaGas: {
                        type: 'linear',
                        position: 'right',
                        grid: { drawOnChartArea: false },
                        ticks: { color: "#0ea5e9", font: { family: 'Outfit' } },
                        title: { display: true, text: 'Agua/Gas ($/m³)', color: '#0ea5e9', font: { family: 'Outfit', weight: 'bold' } }
                    }
                }
            }
        });
    }
}

// --- REGISTRATION & IMPORT FLOW (MANUAL FORM AND PDF) ---
function setupImportFlow() {
    if (!el.btnImportarFactura || !el.modalImport || !el.btnCloseModal) return;

    // Show modal
    el.btnImportarFactura.addEventListener("click", () => {
        el.modalImport.classList.add("open");
        resetImportModal();
    });

    // Close modal
    el.btnCloseModal.addEventListener("click", () => {
        el.modalImport.classList.remove("open");
        resetImportModal();
    });

    el.modalImport.addEventListener("click", (e) => {
        if (e.target === el.modalImport) {
            el.modalImport.classList.remove("open");
            resetImportModal();
        }
    });

    // --- Modal Tab switching ---
    if (el.modalTabBtnManual && el.modalTabBtnPdf && el.modalTabContentManual && el.modalTabContentPdf) {
        el.modalTabBtnManual.addEventListener("click", () => {
            el.modalTabBtnManual.classList.add("active");
            el.modalTabBtnPdf.classList.remove("active");
            el.modalTabContentManual.classList.add("active");
            el.modalTabContentPdf.classList.remove("active");
        });
        el.modalTabBtnPdf.addEventListener("click", () => {
            el.modalTabBtnPdf.classList.add("active");
            el.modalTabBtnManual.classList.remove("active");
            el.modalTabContentPdf.classList.add("active");
            el.modalTabContentManual.classList.remove("active");
        });
    }

    // --- Manual Form Submission ---
    if (el.formManualInvoice) {
        el.formManualInvoice.addEventListener("submit", (e) => {
            e.preventDefault();
            
            // Read YYYY-MM from type="month" and convert to "Mes AAAA" in Spanish
            const dateVal = el.inputPeriodo.value; // e.g. "2026-05"
            if (!dateVal) return;
            const [year, month] = dateVal.split("-");
            const months = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
            const monthName = months[parseInt(month, 10) - 1];
            const periodo = `${monthName} ${year}`;

            const energia = parseInt(el.inputEnergia.value);
            const agua = parseFloat(el.inputAgua.value);
            const gas = parseFloat(el.inputGas.value);
            const aseoRaw = el.inputAseo.value.trim();

            // Check if month already exists
            const duplicate = invoiceHistory.some(item => item.mes.toLowerCase() === periodo.toLowerCase());
            if (duplicate) {
                showToast(`Ya existe una factura para el periodo: ${periodo}`, "warning");
                return;
            }

            // Assign current rates configured in settings to this new manual invoice
            const newInvoice = {
                mes: periodo,
                kwh: energia,
                agua_m3: agua,
                gas_m3: gas,
                rate_energia: EPM_CONFIG.energia.tarifa_plena,
                rate_agua: EPM_CONFIG.acueducto.tarifa_plena,
                rate_alcantarillado: EPM_CONFIG.alcantarillado.tarifa_plena,
                rate_gas: EPM_CONFIG.gas.tarifa_plena,
                estado: "Pagado"
            };

            // Overwrite aseo variable if manual input was provided
            if (aseoRaw !== "") {
                newInvoice.otros = Math.round(parseFloat(aseoRaw));
                newInvoice.isAutocalculatedAseo = false;
            } else {
                newInvoice.isAutocalculatedAseo = true;
            }

            invoiceHistory.push(newInvoice);
            sortInvoiceHistory();
            calculateInvoices();
            saveToStorage();
            updateDashboardUI();

            // Clear and close
            el.formManualInvoice.reset();
            el.modalImport.classList.remove("open");
        });
    }

    // --- Clear All History Button ---
    if (el.btnClearHistory) {
        el.btnClearHistory.addEventListener("click", () => {
            showConfirmDialog("¿Estás seguro de que deseas vaciar todo el historial? Se perderán todos tus datos.", () => {
                invoiceHistory = [];
                saveToStorage();
                updateDashboardUI();
            });
        });
    }

    // --- Export CSV Button ---
    const btnExport = document.getElementById("btn-export-csv");
    if (btnExport) {
        btnExport.addEventListener("click", exportToCSV);
    }

    // --- PDF Drag & Drop Upload Handlers ---
    if (el.dropZone && el.fileInput) {
        el.dropZone.addEventListener("click", (e) => {
            if (e.target !== el.fileInput) {
                el.fileInput.click();
            }
        });

        el.dropZone.addEventListener("dragover", (e) => {
            e.preventDefault();
            el.dropZone.classList.add("dragover");
        });

        el.dropZone.addEventListener("dragleave", () => {
            el.dropZone.classList.remove("dragover");
        });

        el.dropZone.addEventListener("drop", (e) => {
            e.preventDefault();
            el.dropZone.classList.remove("dragover");
            if (e.dataTransfer.files.length > 0) {
                simulateUpload(e.dataTransfer.files[0]);
            }
        });

        el.fileInput.addEventListener("click", (e) => {
            e.stopPropagation();
        });

        el.fileInput.addEventListener("change", (e) => {
            if (e.target.files.length > 0) {
                simulateUpload(e.target.files[0]);
            }
        });
    }

    if (el.btnConfirmImport) {
        el.btnConfirmImport.addEventListener("click", () => {
            addNewMonthFromImport();
        });
    }
}

function resetImportModal() {
    if (el.dropZone) el.dropZone.style.display = "block";
    if (el.uploadStatus) el.uploadStatus.style.display = "none";
    if (el.importPreview) el.importPreview.style.display = "none";
    if (el.fileInput) el.fileInput.value = "";
    if (el.formManualInvoice) el.formManualInvoice.reset();
    
    // Default to manual tab on open
    if (el.modalTabBtnManual) el.modalTabBtnManual.click();
}

// --- PDF PARSING VIA PDF.js (sin API, funciona offline) ---
async function loadPdfJs() {
    if (window.pdfjsLib) return window.pdfjsLib;
    return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
            reject(new Error("Tiempo de espera agotado cargando PDF.js. Verifica tu conexión a internet."));
        }, 12000);

        const script = document.createElement("script");
        script.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
        script.onload = () => {
            clearTimeout(timeout);
            window.pdfjsLib.GlobalWorkerOptions.workerSrc =
                "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
            resolve(window.pdfjsLib);
        };
        script.onerror = () => {
            clearTimeout(timeout);
            reject(new Error("No se pudo cargar PDF.js desde la CDN"));
        };
        document.head.appendChild(script);
    });
}

function parseCOP(str) {
    if (!str) return 0;
    return parseFloat(str.replace(/[$\s]/g, "").replace(/\./g, "").replace(",", ".")) || 0;
}

function extractEPMData(rawText) {
    // ── NORMALIZACIÓN ────────────────────────────────────────────────────────
    // PDF.js extrae cada token por separado. Al unirlos con espacio pueden quedar
    // palabras partidas ("Energ ía") y valores en líneas separadas del label.
    // Aplanamos todo a una sola línea para que los regex no fallen.
    const text = rawText
        .replace(/\r/g, "\n")
        .replace(/\n+/g, " ")
        .replace(/[ \t]+/g, " ")
        .trim();

    const MONTHS = {
        ene:"Enero", feb:"Febrero", mar:"Marzo", abr:"Abril",
        may:"Mayo",  jun:"Junio",   jul:"Julio",  ago:"Agosto",
        sep:"Septiembre", oct:"Octubre", nov:"Noviembre", dic:"Diciembre"
    };

    const result = {
        periodo: null, estrato: null,
        kwh: null, agua_m3: null, gas_m3: null,
        total_energia: 0, total_agua: 0, total_alcantarillado: 0,
        total_gas: 0, total_aseo: 0, total_alumbrado: 0, total_factura: 0,
        rate_energia: null, rate_agua: null, rate_alcantarillado: null, rate_gas: null
    };

    // Convierte "126.996,54" o "126,996.54" o "$126.996" → número JS
    function cop(s) {
        if (!s) return 0;
        return parseFloat(s.replace(/[$\s]/g, "").replace(/\./g, "").replace(",", ".")) || 0;
    }

    // ── ESTRATO ──────────────────────────────────────────────────────────────
    const eM = text.match(/[Ee]strato\s*[:\-]?\s*([1-6])(?!\d)/);
    if (eM) result.estrato = parseInt(eM[1]);

    // ── PERIODO ──────────────────────────────────────────────────────────────
    const pLong = text.match(/facturaci[oó]n\s+([a-z\u00e1\u00e9\u00ed\u00f3\u00fa\u00fc]+)\s+de\s+(20\d{2})/i);
    if (pLong) {
        const k = pLong[1].toLowerCase().slice(0,3);
        result.periodo = (MONTHS[k] || pLong[1]) + " " + pLong[2];
    }
    if (!result.periodo) {
        const pFull = text.match(/\b([a-z]{3,4})[\/\-](20\d{2})\b/i);
        if (pFull) {
            const k = pFull[1].toLowerCase().slice(0,3);
            result.periodo = (MONTHS[k] || pFull[1]) + " " + pFull[2];
        }
    }

    // ── kWh ──────────────────────────────────────────────────────────────────
    const kwhM = text.match(/=\s*(\d{2,4})\s*[Kk][Ww][Hh]/)
              || text.match(/constante\s+consumo[^$]{0,40}?=\s*(\d{2,4})/i)
              || text.match(/(\d{2,4})\s*[Kk][Ww][Hh]/);
    if (kwhM) result.kwh = parseInt(kwhM[1]);

    // ── AGUA m3 ──────────────────────────────────────────────────────────────
    const aguaM = text.match(/Acueducto\b.{0,80}?\b(\d{1,3})\s*m3/i);
    if (aguaM) result.agua_m3 = parseFloat(aguaM[1]);

    // ── GAS m3 ───────────────────────────────────────────────────────────────
    const gasSumM = text.match(/\bGas\b.{0,80}?(\d{1,2}[,.]\d{1,3})\s*m3/i);
    if (gasSumM) result.gas_m3 = parseFloat(gasSumM[1].replace(",","."));
    if (!result.gas_m3) {
        const gasDetM = text.match(/0,855\s*=\s*(\d{1,2}[,.]\d{1,3})\s*m3/i)
                     || text.match(/(\d{1,2}[,.]\d{3})\s*m3/i);
        if (gasDetM) result.gas_m3 = parseFloat(gasDetM[1].replace(",","."));
    }

    // ── TOTALES POR SERVICIO ──────────────────────────────────────────────────
    //
    // ESTRATEGIA: el bloque "Resumen de facturación" al final del PDF es la fuente
    // más confiable. Tiene siempre el mismo orden:
    //   Acueducto Alcantarillado Energía Gas  [consumos]  $X $X $X $X  Otras entidades $X
    // Extraemos los $ en orden posicional — sin depender de la palabra "Energía"
    // (que puede llegar codificada de forma rota por PDF.js).

    const resBlock = text.match(/Resumen\s+de\s+facturaci[oó]n.{0,1500}?Ajuste\s+al\s+peso/i)?.[0] || "";
    if (resBlock) {
        // Los primeros 4 montos son: Acueducto, Alcantarillado, Energía, Gas
        const mts = [...resBlock.matchAll(/\$\s*([\d.,]{5,})/g)].map(m => cop(m[1])).filter(v => v > 1000);
        if (mts[0] > 0) result.total_agua           = mts[0];
        if (mts[1] > 0) result.total_alcantarillado = mts[1];
        if (mts[2] > 0) result.total_energia        = mts[2];
        if (mts[3] > 0) result.total_gas            = mts[3];
        // "Otras entidades $36.245,91"
        const mOtras = resBlock.match(/Otras\s+entidades\s*\$\s*([\d.,]{5,})/i);
        if (mOtras) result.total_aseo = cop(mOtras[1]);
    }

    // Fallback para cada campo usando regex directos (cuando el bloque resumen no está)
    if (result.total_agua === 0) {
        // En el detalle: "Total Acueducto $73.687,45" — puede NO tener $ si el valor
        // va en línea separada, así que buscamos también en el texto general
        const m = text.match(/Total\s+Acueducto\s*\$\s*([\d.,]{6,})/i)
               || text.match(/\$\s*(73[\d.,]+)\b/); // valor típico ~73k
        if (m) result.total_agua = cop(m[1]);
    }
    if (result.total_alcantarillado === 0) {
        const m = text.match(/Total\s+Alcantarillado\s*\$\s*([\d.,]{6,})/i);
        if (m) result.total_alcantarillado = cop(m[1]);
    }
    if (result.total_energia === 0) {
        // Intento directo con .{0,3} para cubrir cualquier encoding de "ía"
        const m = text.match(/Total\s+Energ.{0,3}a\s*\$\s*([\d.,]{6,})/i);
        if (m) result.total_energia = cop(m[1]);
    }
    if (result.total_gas === 0) {
        const m = text.match(/Total\s+Gas\s*\$\s*([\d.,]{6,})/i);
        if (m) result.total_gas = cop(m[1]);
    }
    if (result.total_aseo === 0) {
        const m = text.match(/Total\s+Aseo\s*\$\s*([\d.,]{6,})/i);
        if (m) result.total_aseo = cop(m[1]);
    }
    if (result.total_alumbrado === 0) {
        const m = text.match(/Total\s+Alumbrado\s*\$\s*([\d.,]{6,})/i)
               || text.match(/Alumbrado\s+P[úu]blico\s*\$\s*([\d.,]{4,})/i);
        if (m) result.total_alumbrado = cop(m[1]);
    }

    // ── TOTAL A PAGAR ────────────────────────────────────────────────────────
    // Formatos encontrados en el PDF real:
    //   "Total a pagar Contrato 916121 $352.124"  → número con punto de miles, SIN comas
    //   "Valor total a pagarIncrementó..."         → texto pegado, número aparece antes
    // El número de contrato (916121) no tiene punto → lo excluimos exigiendo separador.
    let totalFactura = 0;

    // Formato: "$352.124" cerca de "Total a pagar" (en el cupón de pago)
    const totCupon = text.match(/[Tt]otal\s+a\s+pagar[^$]{0,50}\$\s*(\d{1,3}\.\d{3})\b/);
    if (totCupon) totalFactura = cop(totCupon[1]);

    // Formato: "$352.124" con decimales "352.124,00" o sin ellos
    if (!totalFactura) {
        const totAny = text.match(/\$\s*(\d{1,3}[.,]\d{3}(?:[.,]\d{2})?)\s*[^\d]{0,50}[Tt]otal\s+a\s+pagar/)
                    || text.match(/[Tt]otal\s+a\s+pagar\D{0,30}\$\s*(\d{1,3}[.,]\d{3}(?:[.,]\d{2})?)/);
        if (totAny) totalFactura = cop(totAny[1]);
    }

    result.total_factura = totalFactura > 0
        ? totalFactura
        : result.total_energia + result.total_agua + result.total_alcantarillado
          + result.total_gas + result.total_aseo + result.total_alumbrado;

    // ── TARIFAS UNITARIAS ────────────────────────────────────────────────────
    // Energía: "864,69" o "801,24" — 3 dígitos + 2 decimales, cerca de kWh
    const rEner = text.match(/(\d{3}[,.]\d{2})\s*\$[\d.,]/)   // "864,69 $175.532"
               || text.match(/(\d{3}[,.]\d{2})\s+\d+\s*[Kk][Ww][Hh]/i)
               || text.match(/[Kk][Ww][Hh][^$]{0,60}?(\d{3}[,.]\d{2})/i);
    if (rEner) result.rate_energia = cop(rEner[1]);

    // Acueducto: "4.864,82" — empieza con 4.xxx
    const rAgua = text.match(/Acueducto.{0,120}?(4[.,]\d{3}[,.]\d{2})/i)
               || text.match(/\b(4\.\d{3}[,.]\d{2})\b/);
    if (rAgua) result.rate_agua = cop(rAgua[1]);

    // Alcantarillado: "3.885,68"
    const rAlc = text.match(/Alcantarillado.{0,120}?(3[.,][89]\d{2}[,.]\d{2})/i)
              || text.match(/\b(3\.[89]\d{2}[,.]\d{2})\b/);
    if (rAlc) result.rate_alcantarillado = cop(rAlc[1]);

    // Gas: "3.158,46" o "3.242,93"
    const rGas = text.match(/\bGas\b.{0,120}?(3[.,][12]\d{2}[,.]\d{2})/i)
              || text.match(/\b(3\.[12]\d{2}[,.]\d{2})\b/);
    if (rGas) result.rate_gas = cop(rGas[1]);

    console.log("=== EPM Datos extraídos ===");
    console.table(result);
    return result;
}

// --- EXPORTAR RESUMEN PDF ---
function exportToPDF() {
    if (invoiceHistory.length === 0) {
        showToast("No hay datos para exportar.", "warning");
        return;
    }

    const latest  = invoiceHistory[invoiceHistory.length - 1];
    const prev    = invoiceHistory.length > 1 ? invoiceHistory[invoiceHistory.length - 2] : null;
    const alerts  = generateAlerts();
    const sample  = invoiceHistory.slice(-3);
    const avg     = (f) => sample.reduce((s, i) => s + (i[f] || 0), 0) / sample.length;
    const pTotal  = Math.round(avg("total"));
    const nextMes = getNextMonthName();

    const diffLine = prev
        ? `vs mes anterior: ${((latest.total - prev.total) / prev.total * 100).toFixed(1)}%`
        : "";

    const alertsHtml = alerts.length
        ? alerts.map(a => `<tr><td style="padding:4px 8px">${a.title}</td><td style="padding:4px 8px;color:#555">${a.msg}</td></tr>`).join("")
        : '<tr><td colspan="2" style="padding:4px 8px;color:#888">Sin alertas este mes.</td></tr>';

    const histRows = invoiceHistory.slice().reverse().slice(0, 12).map(item => `
        <tr>
            <td>${item.mes}</td>
            <td>${item.kwh || "—"} kWh</td>
            <td>${item.agua_m3 || "—"} m³</td>
            <td>${item.gas_m3 || "—"} m³</td>
            <td style="font-weight:600">${formatCOP(item.total)}</td>
        </tr>`).join("");

    const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>Resumen EPM — ${latest.mes}</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family: Arial, sans-serif; color: #1e293b; padding: 2rem; font-size: 13px; }
  h1 { font-size: 1.4rem; color: #0f766e; margin-bottom: 0.25rem; }
  .subtitle { color: #64748b; font-size: 0.85rem; margin-bottom: 1.5rem; }
  .section { margin-bottom: 1.5rem; }
  h2 { font-size: 1rem; color: #0f766e; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; margin-bottom: 0.75rem; }
  table { width: 100%; border-collapse: collapse; }
  th { background: #f1f5f9; text-align: left; padding: 6px 8px; font-size: 12px; color: #475569; }
  td { padding: 5px 8px; border-bottom: 1px solid #f1f5f9; }
  .kpi-row { display: flex; gap: 1rem; flex-wrap: wrap; margin-bottom: 1rem; }
  .kpi-box { flex: 1; min-width: 120px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 0.75rem; }
  .kpi-box .label { font-size: 11px; color: #64748b; margin-bottom: 4px; }
  .kpi-box .value { font-size: 1.1rem; font-weight: 700; color: #0f766e; }
  .kpi-box .sub   { font-size: 11px; color: #94a3b8; }
  .alert-row td { background: #fffbeb; }
  .footer { margin-top: 2rem; font-size: 11px; color: #94a3b8; text-align: center; border-top: 1px solid #e2e8f0; padding-top: 1rem; }
</style>
</head>
<body>
  <h1>📋 Resumen de Facturas EPM</h1>
  <p class="subtitle">Generado el ${new Date().toLocaleDateString("es-CO", {day:"2-digit",month:"long",year:"numeric"})} · Estrato ${currentStratum} · Último periodo: ${latest.mes}</p>

  <div class="section">
    <h2>Última factura — ${latest.mes}</h2>
    <div class="kpi-row">
      <div class="kpi-box">
        <div class="label">Total a pagar</div>
        <div class="value">${formatCOP(latest.total)}</div>
        <div class="sub">${diffLine}</div>
      </div>
      <div class="kpi-box">
        <div class="label">Energía</div>
        <div class="value">${formatCOP(latest.energia)}</div>
        <div class="sub">${latest.kwh || "—"} kWh</div>
      </div>
      <div class="kpi-box">
        <div class="label">Agua + Alcantarillado</div>
        <div class="value">${formatCOP(latest.agua)}</div>
        <div class="sub">${latest.agua_m3 || "—"} m³</div>
      </div>
      <div class="kpi-box">
        <div class="label">Gas</div>
        <div class="value">${formatCOP(latest.gas)}</div>
        <div class="sub">${latest.gas_m3 || "—"} m³</div>
      </div>
    </div>
  </div>

  <div class="section">
    <h2>Alertas del mes</h2>
    <table>
      <thead><tr><th>Alerta</th><th>Detalle</th></tr></thead>
      <tbody class="alert-row">${alertsHtml}</tbody>
    </table>
  </div>

  <div class="section">
    <h2>Proyección — ${nextMes}</h2>
    <p>Estimado basado en los últimos ${sample.length} meses: <strong>${formatCOP(pTotal)}</strong></p>
  </div>

  <div class="section">
    <h2>Historial (últimos 12 meses)</h2>
    <table>
      <thead><tr><th>Periodo</th><th>Energía</th><th>Agua</th><th>Gas</th><th>Total</th></tr></thead>
      <tbody>${histRows}</tbody>
    </table>
  </div>

  <div class="footer">Generado por EPM Comparador de Facturas · Solo para uso personal</div>
</body>
</html>`;

    const win = window.open("", "_blank");
    if (!win) {
        showToast("Permite ventanas emergentes para exportar el PDF.", "warning", 5000);
        return;
    }
    win.document.write(html);
    win.document.close();
    win.onload = () => {
        win.print();
        showToast("Usa Ctrl+P → Guardar como PDF para descargar.", "info", 6000);
    };
}

// --- EXPORT HISTORY TO CSV ---
function exportToCSV() {
    if (invoiceHistory.length === 0) {
        showToast("No hay datos para exportar.", "warning");
        return;
    }
    const headers = ["Mes", "Total", "Energia COP", "kWh", "Agua+Alc COP", "m3 Agua", "Gas COP", "m3 Gas", "Otros COP", "Estado",
                     "Tarifa Energia $/kWh", "Tarifa Agua $/m3", "Tarifa Gas $/m3"];
    const rows = invoiceHistory.map(item => [
        item.mes,
        item.total || 0,
        item.energia || 0,
        item.kwh || 0,
        item.agua || 0,
        item.agua_m3 || 0,
        item.gas || 0,
        item.gas_m3 || 0,
        item.otros || 0,
        item.estado || "—",
        item.rate_energia || "",
        item.rate_agua || "",
        item.rate_gas || ""
    ]);
    const csvContent = [headers, ...rows]
        .map(row => row.map(v => `"${v}"`).join(","))
        .join("\n");
    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `EPM_Facturas_${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast("Historial exportado como CSV.", "success");
}

// --- PDF DEBUG PANEL (muestra texto crudo extraído para diagnóstico) ---
function showPdfDebugPanel(rawText, parsed) {
    let panel = document.getElementById("pdf-debug-panel");
    if (!panel) {
        panel = document.createElement("div");
        panel.id = "pdf-debug-panel";
        panel.style.cssText = `
            position: fixed; bottom: 1rem; left: 1rem; right: 1rem; max-height: 40vh;
            background: #0f172a; border: 1px solid rgba(16,185,129,0.3);
            border-radius: 12px; padding: 1rem 1.25rem; overflow-y: auto;
            z-index: 9000; font-family: monospace; font-size: 0.75rem; color: #94a3b8;
            box-shadow: 0 20px 40px rgba(0,0,0,0.6);
        `;
        document.body.appendChild(panel);
    }
    const fields = ["periodo","estrato","kwh","agua_m3","gas_m3",
                    "total_energia","total_agua","total_alcantarillado","total_gas",
                    "total_aseo","total_alumbrado","total_factura",
                    "rate_energia","rate_agua","rate_alcantarillado","rate_gas"];
    const rows = fields.map(f => {
        const v = parsed[f];
        const ok = v !== null && v !== undefined && v !== 0;
        const color = ok ? "#10b981" : "#ef4444";
        return `<div><span style="color:${color}; font-weight:bold">${f}</span>: ${v ?? "—"}</div>`;
    }).join("");
    panel.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.75rem;">
            <span style="color:#f8fafc;font-weight:700;font-size:0.85rem">🔍 Diagnóstico PDF extraído</span>
            <button onclick="document.getElementById('pdf-debug-panel').remove()" style="background:none;border:none;color:#94a3b8;cursor:pointer;font-size:1rem">✕</button>
        </div>
        ${rows}
        <details style="margin-top:0.75rem">
            <summary style="cursor:pointer;color:#10b981;font-weight:600">Ver texto crudo del PDF</summary>
            <pre style="margin-top:0.5rem;white-space:pre-wrap;word-break:break-all;color:#64748b;font-size:0.7rem;max-height:200px;overflow-y:auto">${rawText.slice(0, 3000)}</pre>
        </details>
    `;
}

async function parsePdfLocal(file) {
    const pdfjsLib = await loadPdfJs();
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

    let fullText = "";
    for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        fullText += textContent.items.map(item => item.str).join(" ") + "\n";
    }

    console.log("Texto extraído del PDF:\n", fullText);
    const parsed = extractEPMData(fullText);
    showPdfDebugPanel(fullText, parsed);

    // Auto-copy raw text to clipboard so user can paste it for debugging
    try {
        await navigator.clipboard.writeText(fullText);
        showToast("Texto del PDF copiado al portapapeles — pégalo en el chat para diagnóstico.", "info", 5000);
    } catch(e) {
        // clipboard not available, that's ok
    }

    return parsed;
}

async function simulateUpload(file) {
    if (el.dropZone) el.dropZone.style.display = "none";
    if (el.uploadStatus) el.uploadStatus.style.display = "flex";

    const statusText = el.uploadStatus ? el.uploadStatus.querySelector(".status-text") : null;
    if (statusText) statusText.textContent = "Leyendo factura EPM...";

    try {
        const parsed = await parsePdfLocal(file);
        lastParsedPdfData = parsed;

        if (el.uploadStatus) el.uploadStatus.style.display = "none";

        // Update currentStratum if detected in PDF
        if (parsed.estrato && parsed.estrato >= 1 && parsed.estrato <= 6) {
            currentStratum = parsed.estrato;
            if (el.estratoSelect) el.estratoSelect.value = currentStratum;
            updateProfileSubLabel();
        }

        if (el.importPreview) {
            el.importPreview.style.display = "block";
            const estratoPreview = document.getElementById("preview-estrato-num");
            const costPreview = document.getElementById("preview-total-cost");
            const previewList = el.importPreview.querySelector(".preview-list");

            if (estratoPreview) estratoPreview.innerText = parsed.estrato || currentStratum;
            if (costPreview) costPreview.innerText = formatCOP(parsed.total_factura || 0);

            if (previewList) {
                const rateEnergia = parsed.rate_energia ? formatCOPWithDecimals(parsed.rate_energia) + "/kWh" : "según EPM";
                const rateAgua    = parsed.rate_agua    ? formatCOPWithDecimals(parsed.rate_agua) + "/m³"   : "según EPM";
                const rateGas     = parsed.rate_gas     ? formatCOPWithDecimals(parsed.rate_gas) + "/m³"    : "según EPM";

                previewList.innerHTML = `
                    <li><strong>Periodo:</strong> ${parsed.periodo || "—"}</li>
                    <li><strong>Estrato:</strong> ${parsed.estrato || currentStratum}</li>
                    <li><strong>Energía:</strong> <span class="text-primary font-bold">${parsed.kwh} kWh</span> · ${formatCOP(parsed.total_energia)} · <em class="text-muted">${rateEnergia}</em></li>
                    <li><strong>Acueducto:</strong> <span class="text-primary font-bold">${parsed.agua_m3} m³</span> · ${formatCOP(parsed.total_agua)} · <em class="text-muted">${rateAgua}</em></li>
                    <li><strong>Alcantarillado:</strong> ${formatCOP(parsed.total_alcantarillado)}</li>
                    <li><strong>Gas:</strong> <span class="text-primary font-bold">${parsed.gas_m3} m³</span> · ${formatCOP(parsed.total_gas)} · <em class="text-muted">${rateGas}</em></li>
                    <li><strong>Aseo:</strong> ${formatCOP(parsed.total_aseo || 0)}</li>
                    <li><strong>Alumbrado:</strong> ${formatCOP(parsed.total_alumbrado || 0)}</li>
                    <hr style="border-color:rgba(255,255,255,0.08); margin: 0.4rem 0;">
                    <li><strong>Total a pagar:</strong> <span class="text-success font-bold">${formatCOP(parsed.total_factura)}</span></li>
                `;
            }

            // Show confirm button
            const confirmBtn = document.getElementById("btn-confirm-import");
            if (confirmBtn) confirmBtn.style.display = "block";
        }

    } catch (err) {
        console.error("parsePdfLocal error:", err);
        if (el.uploadStatus) el.uploadStatus.style.display = "none";
        if (el.dropZone) el.dropZone.style.display = "block";
        lastParsedPdfData = null;
        showToast(`No se pudo leer el PDF: ${err.message}`, "error", 6000);
    }
}

function getNextMonthName() {
    const MONTHS = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

    // Helper: next month from today as fallback
    function fallbackNextMonth() {
        const now = new Date();
        const nextDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
        return `${MONTHS[nextDate.getMonth()]} ${nextDate.getFullYear()}`;
    }

    if (invoiceHistory.length === 0) return fallbackNextMonth();

    const latest = invoiceHistory[invoiceHistory.length - 1].mes;

    try {
        const parts = latest.trim().split(/\s+/);
        if (parts.length < 2) throw new Error("Formato de mes inválido");

        const currentMonthName = parts[0].charAt(0).toUpperCase() + parts[0].slice(1).toLowerCase();
        const currentYear = parseInt(parts[1], 10);

        const monthIndex = MONTHS.indexOf(currentMonthName);
        if (monthIndex === -1 || isNaN(currentYear)) {
            throw new Error(`Mes no reconocido: "${currentMonthName}"`);
        }

        const nextMonthIndex = (monthIndex + 1) % 12;
        const nextYear = nextMonthIndex === 0 ? currentYear + 1 : currentYear;
        return `${MONTHS[nextMonthIndex]} ${nextYear}`;
    } catch (e) {
        console.warn("getNextMonthName: no se pudo calcular el siguiente mes.", e.message);
        return fallbackNextMonth();
    }
}

/**
 * Calcula el total estimado de una factura con consumos dados,
 * reutilizando la misma logica de calculateInvoices para evitar
 * inconsistencias entre el preview del PDF y el calculo real.
 */
function calculateSingleMockInvoice(kwh, agua, gas) {
    // Construimos un item temporal con las tarifas actuales de EPM_CONFIG
    const mockItem = {
        kwh,
        agua_m3: agua,
        gas_m3: gas,
        rate_energia: EPM_CONFIG.energia.tarifa_plena,
        rate_agua: EPM_CONFIG.acueducto.tarifa_plena,
        rate_alcantarillado: EPM_CONFIG.alcantarillado.tarifa_plena,
        rate_gas: EPM_CONFIG.gas.tarifa_plena,
    };

    // Usamos snapshot del historial para no contaminarlo — protegido con try/finally
    const snapshot = invoiceHistory;
    try {
        invoiceHistory = [mockItem];
        calculateInvoices();
        return Math.round(mockItem.total || 0);
    } catch(e) {
        console.error("calculateSingleMockInvoice error:", e);
        return 0;
    } finally {
        invoiceHistory = snapshot; // siempre restauramos, incluso si hay error
    }
}

function addNewMonthFromImport() {
    const data = lastParsedPdfData;
    if (!data) {
        showToast("No hay datos extraídos del PDF para guardar.", "error");
        return;
    }

    const periodo = data.periodo || getNextMonthName();
    const duplicate = invoiceHistory.some(item => item.mes.toLowerCase() === periodo.toLowerCase());

    if (duplicate) {
        showToast(`La factura de ${periodo} ya existe en el historial.`, "warning");
        if (el.modalImport) el.modalImport.classList.remove("open");
        return;
    }

    // Build invoice record with REAL data from the PDF
    const totalAlcantarillado = data.total_alcantarillado || 0;
    if (data.total_agua > 0 && totalAlcantarillado === 0) {
        showToast("Advertencia: no se detectó el total de alcantarillado en el PDF. El valor de agua puede estar incompleto.", "warning", 5000);
    }

    const newInvoice = {
        mes: periodo,
        kwh: data.kwh || 0,
        agua_m3: data.agua_m3 || 0,
        gas_m3: data.gas_m3 || 0,
        // Persist the actual unit rates read from the invoice
        rate_energia: data.rate_energia || EPM_CONFIG.energia.tarifa_plena,
        rate_agua: data.rate_agua || EPM_CONFIG.acueducto.tarifa_plena,
        rate_alcantarillado: data.rate_alcantarillado || EPM_CONFIG.alcantarillado.tarifa_plena,
        rate_gas: data.rate_gas || EPM_CONFIG.gas.tarifa_plena,
        // Store real totals from the PDF so the dashboard shows exact values
        energia: data.total_energia || null,
        agua: data.total_agua > 0 ? (data.total_agua + totalAlcantarillado) : null,
        gas: data.total_gas || null,
        otros: data.total_aseo !== undefined && data.total_aseo > 0
            ? (data.total_aseo + (data.total_alumbrado || 0))
            : null,
        total: data.total_factura || null,
        estado: "Pagado",
        fromPdf: true   // Flag so calculateInvoices skips recalculating if real totals exist
    };

    // Update stratum from PDF if detected
    if (data.estrato && data.estrato >= 1 && data.estrato <= 6) {
        currentStratum = data.estrato;
        if (el.estratoSelect) el.estratoSelect.value = currentStratum;
        updateProfileSubLabel();
    }

    invoiceHistory.push(newInvoice);
    sortInvoiceHistory();
    calculateInvoices();
    saveToStorage();
    updateDashboardUI();

    lastParsedPdfData = null;
    showToast(`¡Factura de ${periodo} importada correctamente!`, "success");

    if (el.modalImport) el.modalImport.classList.remove("open");
}