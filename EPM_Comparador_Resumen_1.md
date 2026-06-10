# EPM Comparador de Facturas — Resumen del Proyecto

**Proyecto:** Aplicación web para analizar, comparar y visualizar facturas de servicios públicos de EPM (Medellín, Colombia)  
**Stack:** HTML · CSS · JavaScript Vanilla · PDF.js · Chart.js · Lucide Icons  
**Archivos:** `index.html` (592 líneas) · `app.js` (2.190 líneas) · `styles.css` (1.632 líneas)  
**Total:** 4.414 líneas de código · 37 funciones JS

---

## Estructura del Proyecto

```
/
├── index.html        # Estructura y layout de la app
├── app.js            # Toda la lógica de negocio y UI
└── styles.css        # Sistema de diseño y estilos
```

Para correr localmente:
```bash
python -m http.server 8080
# Abrir http://localhost:8080
```

---

## Funcionalidades Principales

### 📄 Lectura de PDF sin API key
- Usa **PDF.js** (Mozilla) — corre 100% en el navegador, sin internet, sin costo
- Extrae automáticamente del PDF de EPM: periodo, estrato, consumos (kWh, m³ agua, m³ gas), totales por servicio y tarifas unitarias
- Patrones de extracción calibrados con facturas reales de EPM (formato 2025-2026)
- Sin ningún diálogo de API key — funciona directamente al subir el archivo

### 📊 Dashboard de Resumen
- 4 KPI cards: Total factura, Energía, Agua, Gas con consumo y costo
- Badge de variación porcentual vs mes anterior (verde/rojo)
- Panel de análisis inteligente que explica en texto el principal driver del cambio
- Gráfica principal de evolución histórica (costo o consumo)
- Gráfica de distribución por servicio

### ⚡ Pestaña Energía
- Tarifa exacta del último recibo resaltada en número grande (amarillo)
- Badge `+X%` / `-X%` vs mes anterior
- Barras de historial de los últimos 5 meses con la tarifa por kWh
- Detalle de subsidio o contribución de solidaridad según estrato
- Texto dinámico explicando si la tarifa subió o bajó

### 💧 Pestaña Acueducto
- Tarifa m³ destacada en azul con comparación vs mes anterior
- Gauge visual que se vuelve rojo si superas los 13 m³ subsidiados
- Texto inteligente: "dentro del límite" o "excediste X m³"
- Barras de historial de tarifa de acueducto
- Cargos fijos de acueducto y alcantarillado desglosados

### 🔥 Pestaña Gas Natural
- Tarifa m³ destacada en naranja con badge de variación
- Badge de eficiencia dinámico: "¡Consumo eficiente!", "Consumo normal" o "Consumo alto"
- Comparación vs promedio de los últimos 3 meses
- Barras de historial del precio por m³

### 📈 Control de Tarifas
- Gráfica de evolución de tarifas unitarias ($/kWh y $/m³) en el tiempo
- Panel con tarifas vigentes y subsidios por estrato

---

## Corrección de Bugs

| Bug | Severidad | Estado |
|-----|-----------|--------|
| Estrato por defecto desincronizado (HTML: 4, JS: 3) | 🔴 Alta | ✅ Corregido |
| `getNextMonthName()` producía `"undefined NaN"` con mes inválido | 🔴 Alta | ✅ Corregido |
| `calculateSingleMockInvoice` duplicaba lógica causando inconsistencias en preview PDF | 🟡 Media | ✅ Corregido |
| `alert()` y `confirm()` nativos del navegador | 🟡 Media | ✅ Corregido |
| Mensajes engañosos "extrayendo datos de EPM" cuando era simulado | 🟢 Baja | ✅ Corregido |
| Campo de API key validaba solo `sk-ant-` rechazando otras keys | 🔴 Alta | ✅ Eliminado (sin API key) |
| Año del periodo extraído mal (`"Abril 2025"` en vez de `"Abril 2026"`) | 🔴 Alta | ✅ Corregido |
| Energía mostraba `$0` por patrón regex que no coincidía con PDF real | 🔴 Alta | ✅ Corregido |
| Total factura sumaba duplicados ($916.121 en vez de $352.124) | 🔴 Alta | ✅ Corregido |

---

## Nuevas Funcionalidades Agregadas

### 🔔 Alertas Inteligentes de Consumo
- Aparecen automáticamente cuando detectan variaciones significativas
- **Alerta roja** si algún servicio sube más del 30% vs el promedio
- **Alerta amarilla** si sube entre 15% y 30%
- **Alerta verde** si baja más del 15% (felicita el ahorro)
- **Alerta azul** si la tarifa de EPM subió más del 5% (avisa que no es culpa del usuario)
- Se ocultan si no hay nada relevante que reportar

### 📈 Proyección del Próximo Mes
- Panel verde que estima consumos y costo del siguiente mes
- Basado en el promedio ponderado de los últimos 3 meses registrados
- Muestra energía (kWh), agua (m³), gas (m³) y total estimado
- Indica si se espera subida o bajada vs el mes actual

### 📄 Exportar Resumen PDF
- Botón "Exportar PDF" junto al de CSV en la tabla de historial
- Genera una página HTML con diseño limpio lista para imprimir
- Incluye: última factura detallada, alertas del mes, proyección y tabla de historial de 12 meses
- No requiere librerías externas — usa `window.print()` del navegador

### 🔔 Sistema de Notificaciones (Toast + Confirm Dialog)
Reemplaza los `alert()` y `confirm()` nativos del navegador por:
- **Toasts** en esquina inferior derecha con 4 tipos: `success`, `warning`, `error`, `info`
- **Diálogo de confirmación** propio con diseño glassmorphism para acciones destructivas (vaciar historial, eliminar factura)

---

## Mejoras de Diseño y UI

### Paso 1 — Tipografía y Jerarquía
- Fuente **Inter** para datos + **Outfit** para títulos (display)
- Sistema de escala tipográfica con variables CSS: `--text-xs` hasta `--text-hero`
- Labels en `uppercase + letter-spacing` sutil
- Valores numéricos con `font-variant-numeric: tabular-nums` para alineación
- Totales de servicio en tamaño notablemente mayor que filas secundarias

### Paso 2 — Sidebar Colapsable
- Botón circular `‹` / `›` en el borde del sidebar
- Colapsa de 240px a 64px mostrando solo iconos
- El contenido principal se expande automáticamente
- Estado persistido en `localStorage`

### Paso 3 — Empty State con CTA
- Cuando no hay facturas: ícono + título + descripción + botón de acción directo
- Los KPI cards se ocultan para no mostrar ceros confusos
- El botón abre el modal de importar directamente

### Paso 4 — Badge en Gráfico Principal
- Badge en esquina superior del gráfico: `+X%` (rojo) o `-X%` (verde) vs mes anterior
- Contextualiza la tendencia sin tener que leer el eje Y

### Paso 5 — Pulido General
- Breadcrumb con punto verde decorativo
- `tip-box` con estilo consistente en todas las pestañas
- Tabla con mejor espaciado y tracking en headers
- Fondo del gauge de agua cambia a rojo cuando se supera el límite subsidiado

---

## Arquitectura del Código (`app.js`)

```
EPM_CONFIG              → Tarifas, subsidios y cargos fijos por servicio
DEFAULT_HISTORY         → Datos de ejemplo para primera carga
invoiceHistory[]        → Estado principal — array de facturas

calculateInvoices()     → Motor de cálculo con tarifas EPM reales por estrato
updateDashboardUI()     → Orquesta toda la actualización visual
updateDetailTabs()      → Actualiza las 3 pestañas de servicio
renderAlerts()          → Genera y muestra alertas inteligentes
renderProyeccion()      → Calcula y muestra proyección del próximo mes
generateSmartExplanation() → Texto explicativo del cambio mes a mes

parsePdfLocal()         → Lee PDF con PDF.js
extractEPMData()        → Extrae datos con regex calibrados para EPM
parseCOP()              → Convierte formato colombiano "$ 93.146,73" a número

exportToPDF()           → Genera resumen HTML para imprimir
exportToCSV()           → Exporta historial en CSV

showToast()             → Notificaciones tipo toast
showConfirmDialog()     → Diálogos de confirmación propios

renderCharts()          → Gráficas Chart.js (historial, distribución, tarifas)
populateHistoryTable()  → Tabla de historial con acciones
```

---

## Configuración de Tarifas EPM (Mayo 2026)

| Servicio | Tarifa Plena | Cargo Fijo |
|----------|-------------|------------|
| Energía | $801.24 / kWh | — |
| Acueducto | $4.864,82 / m³ | $9.851,98 |
| Alcantarillado | $3.885,68 / m³ | $5.668,99 |
| Gas | $3.158,46 / m³ | $4.253,03 |
| Alumbrado Público | $6.000 fijos | — |

### Subsidios por Estrato

| Estrato | Energía | Agua | Gas |
|---------|---------|------|-----|
| 1 | 60% | 70% | 60% |
| 2 | 50% | 40% | 50% |
| 3 | 15% | 12.5% | 0% |
| 4 | 0% | 0% | 0% |
| 5 | -20% (contribución) | -50% | -20% |
| 6 | -20% (contribución) | -60% | -20% |

---

## Pendientes / Roadmap

- [ ] **Responsive / Mobile** — adaptación completa para celular (prioridad alta)
- [ ] **Meta de ahorro mensual** — el usuario define cuánto quiere pagar y la app calcula consumos máximos
- [ ] **Comparador de estratos** — tabla con el mismo consumo en todos los estratos
- [ ] **Compartir resumen por WhatsApp** — generar imagen o tarjeta del mes
- [ ] **PWA (Progressive Web App)** — `manifest.json` + service worker para instalar en celular
- [ ] **Múltiples contratos** — soporte para más de un inmueble EPM
- [ ] **Onboarding** — pantalla de bienvenida para usuarios nuevos

---

## Notas Técnicas

- La app corre como archivos estáticos — no requiere backend ni base de datos
- Los datos se persisten en `localStorage` del navegador
- PDF.js se carga desde CDN (requiere internet la primera vez)
- Necesita `python -m http.server 8080` para evitar restricciones CORS al leer PDFs
- Compatible con Chrome, Firefox, Edge (versiones modernas)
- Facturas probadas: formato EPM Medellín 2025-2026

---

*Generado el 8 de junio de 2026 · Proyecto en desarrollo activo*
