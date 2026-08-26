// js/restaurant-admin.js

let tempRestaurantTables = [];

async function openDailyMenuConfigModal() {
    if (!currentBusiness) return;

    window.openModalCustom(`
        <div class="space-y-4 text-center py-6">
            <i data-lucide="loader-2" class="w-6 h-6 mx-auto animate-spin text-black mb-2"></i>
            <p class="text-xs text-neutral-500">Cargando Menú del Día...</p>
        </div>
    `);

    let menu = {
        active: true,
        price: 14.50,
        first_courses: ["Alubias Blancas de Saldaña con Matanza", "Sopa Castellana Tradicional", "Ensalada de Cecina con Frutos Secos"],
        second_courses: ["Lechazo Churro Guisado", "Bacalao con Pimientos Asados", "Carrillera Ibérica al Vino Tinto"],
        includes: "Pan de leña, Agua o Vino de la casa y Postre casero"
    };

    try {
        const { data } = await supabaseClient
            .from('restaurant_settings')
            .select('daily_menu')
            .ilike('business_name', `%${currentBusiness.name}%`)
            .maybeSingle();

        if (data && data.daily_menu) menu = data.daily_menu;
    } catch (e) {
        console.warn("Aviso cargando menú del día:", e);
    }

    const modalBody = document.getElementById('modalBody');
    if (!modalBody) return;

    modalBody.innerHTML = `
        <div class="space-y-4 text-left">
            <div class="text-center space-y-1">
                <span class="text-[9px] font-mono uppercase tracking-widest text-neutral-400">HOSTELERÍA NETWISH</span>
                <h3 class="text-base font-bold text-black">Editar Menú del Día</h3>
                <p class="text-[11px] text-neutral-500">Actualiza los platos del día y el precio al instante.</p>
            </div>

            <div class="space-y-3 pt-2 border-t border-neutral-100 max-h-72 overflow-y-auto pr-1 allow-scroll">
                <div class="flex items-center justify-between p-3 bg-neutral-50 rounded-2xl border border-neutral-200/70">
                    <label class="text-xs font-bold text-black flex items-center space-x-2">
                        <span>Menú Activo Hoy</span>
                    </label>
                    <input type="checkbox" id="cfgMenuIsActive" ${menu.active ? 'checked' : ''} class="w-4 h-4 rounded text-black border-neutral-300 focus:ring-0">
                </div>

                <div>
                    <label class="text-[9px] font-mono text-neutral-500 uppercase block mb-1">Precio por Persona (€)</label>
                    <input type="number" step="0.50" id="cfgMenuPrice" value="${menu.price}" class="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-3 py-2 text-xs font-mono font-bold focus:border-black outline-none">
                </div>

                <div>
                    <label class="text-[9px] font-mono text-neutral-500 uppercase block mb-1">Primeros Platos (Uno por línea)</label>
                    <textarea id="cfgMenuFirsts" rows="3" class="w-full bg-neutral-50 border border-neutral-200 rounded-xl p-3 text-xs text-black focus:border-black outline-none transition">${(menu.first_courses || []).join('\n')}</textarea>
                </div>

                <div>
                    <label class="text-[9px] font-mono text-neutral-500 uppercase block mb-1">Segundos Platos (Uno por línea)</label>
                    <textarea id="cfgMenuSeconds" rows="3" class="w-full bg-neutral-50 border border-neutral-200 rounded-xl p-3 text-xs text-black focus:border-black outline-none transition">${(menu.second_courses || []).join('\n')}</textarea>
                </div>

                <div>
                    <label class="text-[9px] font-mono text-neutral-500 uppercase block mb-1">Incluye (Bebida, pan, postre...)</label>
                    <input type="text" id="cfgMenuIncludes" value="${menu.includes || ''}" class="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-3 py-2 text-xs text-black focus:border-black outline-none">
                </div>
            </div>

            <div class="grid grid-cols-2 gap-2 pt-2 border-t border-neutral-100">
                <button onclick="window.closeCustomModal()" class="w-full py-3 bg-neutral-100 text-black font-bold rounded-xl text-xs hover:bg-neutral-200 transition">
                    Cancelar
                </button>
                <button onclick="saveDailyMenuSettings()" class="w-full py-3 bg-black text-white font-bold rounded-xl text-xs shadow-md active:scale-95 transition">
                    Publicar Menú
                </button>
            </div>
        </div>
    `;

    if (typeof lucide !== 'undefined') lucide.createIcons();
}

async function saveDailyMenuSettings() {
    if (!currentBusiness) return;

    const isActive = document.getElementById('cfgMenuIsActive')?.checked || false;
    const price = parseFloat(document.getElementById('cfgMenuPrice')?.value || '14.50');
    const firstsRaw = document.getElementById('cfgMenuFirsts')?.value || '';
    const secondsRaw = document.getElementById('cfgMenuSeconds')?.value || '';
    const includes = document.getElementById('cfgMenuIncludes')?.value.trim() || '';

    const firsts = firstsRaw.split('\n').map(s => s.trim()).filter(Boolean);
    const seconds = secondsRaw.split('\n').map(s => s.trim()).filter(Boolean);

    const dailyMenuPayload = {
        active: isActive,
        price: price,
        first_courses: firsts,
        second_courses: seconds,
        includes: includes
    };

    try {
        const { error } = await supabaseClient
            .from('restaurant_settings')
            .upsert([{ 
                business_name: currentBusiness.name,
                daily_menu: dailyMenuPayload 
            }], { onConflict: 'business_name' });

        if (error) throw error;

        if (window.restaurantState) {
            window.restaurantState.dailyMenu = dailyMenuPayload;
        }

        window.closeCustomModal();
        if (typeof window.showToast === 'function') {
            window.showToast("Menú del día actualizado y publicado en directo.", "success");
        }
        renderBusinessOrders();
    } catch (err) {
        alert("Error al guardar menú: " + err.message);
    }
}

async function openRestaurantConfigModal() {
    if (!currentBusiness) return;

    window.openModalCustom(`
        <div class="space-y-4 text-center py-6">
            <i data-lucide="loader-2" class="w-6 h-6 mx-auto animate-spin text-black mb-2"></i>
            <p class="text-xs text-neutral-500">Cargando configuración de sala...</p>
        </div>
    `);

    let settings = {
        lunch_start: '13:00',
        lunch_end: '16:00',
        dinner_start: '20:30',
        dinner_end: '23:30',
        turn_duration_min: 90,
        tables: [
            { id: 1, table_number: 1, capacity: 2, zone: 'Sala Principal' },
            { id: 2, table_number: 2, capacity: 4, zone: 'Sala Principal' },
            { id: 3, table_number: 3, capacity: 6, zone: 'Sala Principal' },
            { id: 4, table_number: 4, capacity: 4, zone: 'Terraza' },
            { id: 5, table_number: 5, capacity: 6, zone: 'Terraza' }
        ]
    };

    try {
        const { data } = await supabaseClient
            .from('restaurant_settings')
            .select('*')
            .ilike('business_name', `%${currentBusiness.name}%`)
            .maybeSingle();

        if (data) settings = data;
    } catch (e) {
        console.warn("Aviso cargando ajustes de sala:", e);
    }

    tempRestaurantTables = [...(settings.tables || [])];

    const modalBody = document.getElementById('modalBody');
    if (!modalBody) return;

    modalBody.innerHTML = `
        <div class="space-y-4 text-left">
            <div class="text-center space-y-1">
                <span class="text-[9px] font-mono uppercase tracking-widest text-neutral-400">HOSTELERÍA NETWISH</span>
                <h3 class="text-base font-bold text-black">Ajustes de Sala & Reservas</h3>
                <p class="text-[11px] text-neutral-500">Configura turnos de servicio y capacidad de mesas.</p>
            </div>

            <div class="space-y-2.5 pt-2 border-t border-neutral-100">
                <span class="text-[10px] font-mono uppercase tracking-widest text-neutral-400 block">Horarios de Servicio</span>
                <div class="grid grid-cols-2 gap-2">
                    <div>
                        <label class="text-[9px] font-mono text-neutral-500 block mb-1">Inicio Comidas</label>
                        <input type="time" id="cfgLunchStart" value="${settings.lunch_start}" class="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-2.5 py-2 text-xs font-mono font-bold focus:border-black outline-none">
                    </div>
                    <div>
                        <label class="text-[9px] font-mono text-neutral-500 block mb-1">Fin Comidas</label>
                        <input type="time" id="cfgLunchEnd" value="${settings.lunch_end}" class="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-2.5 py-2 text-xs font-mono font-bold focus:border-black outline-none">
                    </div>
                    <div>
                        <label class="text-[9px] font-mono text-neutral-500 block mb-1">Inicio Cenas</label>
                        <input type="time" id="cfgDinnerStart" value="${settings.dinner_start}" class="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-2.5 py-2 text-xs font-mono font-bold focus:border-black outline-none">
                    </div>
                    <div>
                        <label class="text-[9px] font-mono text-neutral-500 block mb-1">Fin Cenas</label>
                        <input type="time" id="cfgDinnerEnd" value="${settings.dinner_end}" class="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-2.5 py-2 text-xs font-mono font-bold focus:border-black outline-none">
                    </div>
                </div>
            </div>

            <div class="space-y-2.5 pt-2 border-t border-neutral-100">
                <div class="flex justify-between items-center">
                    <span class="text-[10px] font-mono uppercase tracking-widest text-neutral-400">Inventario de Mesas</span>
                    <span class="text-[10px] font-mono text-neutral-500 font-bold" id="tablesCountIndicator">${tempRestaurantTables.length} mesas</span>
                </div>

                <div class="grid grid-cols-3 gap-1.5 p-2.5 bg-neutral-50 rounded-2xl border border-neutral-200/60">
                    <input type="number" id="newTableNumber" placeholder="Nº Mesa" class="bg-white border border-neutral-200 rounded-xl px-2 py-1.5 text-xs font-mono focus:border-black outline-none">
                    <select id="newTableZone" class="bg-white border border-neutral-200 rounded-xl px-2 py-1.5 text-xs font-medium focus:border-black outline-none">
                        <option value="Sala Principal">Sala</option>
                        <option value="Terraza">Terraza</option>
                    </select>
                    <div class="flex space-x-1">
                        <select id="newTableCapacity" class="bg-white border border-neutral-200 rounded-xl px-1.5 py-1.5 text-xs font-mono font-bold focus:border-black outline-none w-1/2">
                            <option value="2">2p</option>
                            <option value="4" selected>4p</option>
                            <option value="6">6p</option>
                            <option value="8">8p</option>
                        </select>
                        <button onclick="addTableToRestaurantList()" class="w-1/2 bg-black text-white rounded-xl text-xs font-bold flex items-center justify-center active:scale-90 transition shadow-sm">
                            +
                        </button>
                    </div>
                </div>

                <div id="cfgTablesListContainer" class="space-y-1.5 max-h-36 overflow-y-auto pr-1 allow-scroll">
                    ${renderTablesListHTML()}
                </div>
            </div>

            <div class="grid grid-cols-2 gap-2 pt-2 border-t border-neutral-100">
                <button onclick="window.closeCustomModal()" class="w-full py-3 bg-neutral-100 text-black font-semibold rounded-xl text-xs hover:bg-neutral-200 transition">
                    Cancelar
                </button>
                <button onclick="saveRestaurantSettingsToDB()" class="w-full py-3 bg-black text-white font-bold rounded-xl text-xs shadow-md active:scale-95 transition">
                    Guardar Cambios
                </button>
            </div>
        </div>
    `;
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

function renderTablesListHTML() {
    if (!tempRestaurantTables || tempRestaurantTables.length === 0) {
        return `<p class="text-[11px] text-neutral-400 text-center py-2">No hay mesas configuradas.</p>`;
    }

    return tempRestaurantTables.map((t, idx) => `
        <div class="flex items-center justify-between p-2.5 bg-neutral-50 rounded-xl border border-neutral-200/60 text-xs">
            <div class="flex items-center space-x-2">
                <span class="font-bold text-black font-mono">Mesa ${t.table_number}</span>
                <span class="text-[10px] text-neutral-400">(${t.zone})</span>
            </div>
            <div class="flex items-center space-x-2">
                <span class="font-mono font-extrabold text-black bg-white px-2 py-0.5 rounded-lg border border-neutral-200/60">${t.capacity} pax</span>
                <button onclick="removeTableFromRestaurantList(${idx})" class="w-6 h-6 rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100 font-bold flex items-center justify-center transition">
                    ×
                </button>
            </div>
        </div>
    `).join('');
}

function addTableToRestaurantList() {
    const numInput = document.getElementById('newTableNumber');
    const zoneInput = document.getElementById('newTableZone');
    const capInput = document.getElementById('newTableCapacity');

    const num = parseInt(numInput?.value || '0', 10);
    const zone = zoneInput?.value || 'Sala Principal';
    const cap = parseInt(capInput?.value || '4', 10);

    if (num <= 0) {
        alert("Introduce un número de mesa válido.");
        return;
    }

    tempRestaurantTables.push({
        id: Date.now(),
        table_number: num,
        zone: zone,
        capacity: cap
    });

    tempRestaurantTables.sort((a, b) => a.table_number - b.table_number);

    numInput.value = '';
    const container = document.getElementById('cfgTablesListContainer');
    const countEl = document.getElementById('tablesCountIndicator');
    if (container) container.innerHTML = renderTablesListHTML();
    if (countEl) countEl.innerText = `${tempRestaurantTables.length} mesas`;
}

function removeTableFromRestaurantList(index) {
    tempRestaurantTables.splice(index, 1);
    const container = document.getElementById('cfgTablesListContainer');
    const countEl = document.getElementById('tablesCountIndicator');
    if (container) container.innerHTML = renderTablesListHTML();
    if (countEl) countEl.innerText = `${tempRestaurantTables.length} mesas`;
}

async function saveRestaurantSettingsToDB() {
    if (!currentBusiness) return;

    const lunchStart = document.getElementById('cfgLunchStart')?.value || '13:00';
    const lunchEnd = document.getElementById('cfgLunchEnd')?.value || '16:00';
    const dinnerStart = document.getElementById('cfgDinnerStart')?.value || '20:30';
    const dinnerEnd = document.getElementById('cfgDinnerEnd')?.value || '23:30';

    const payload = {
        business_name: currentBusiness.name,
        lunch_start: lunchStart,
        lunch_end: lunchEnd,
        dinner_start: dinnerStart,
        dinner_end: dinnerEnd,
        turn_duration_min: 90,
        tables: tempRestaurantTables
    };

    try {
        const { error } = await supabaseClient
            .from('restaurant_settings')
            .upsert([payload], { onConflict: 'business_name' });

        if (error) throw error;

        if (window.restaurantState) {
            window.restaurantState.config = payload;
        }

        window.closeCustomModal();
        if (typeof window.showToast === 'function') {
            window.showToast("Ajustes de sala guardados.", "success");
        }
        renderBusinessOrders();
    } catch (err) {
        alert("Error al guardar ajustes: " + err.message);
    }
}

async function openTablesQRManagerModal() {
    if (!currentBusiness) return;

    window.openModalCustom(`
        <div class="space-y-4 text-center py-6">
            <i data-lucide="loader-2" class="w-6 h-6 mx-auto animate-spin text-black mb-2"></i>
            <p class="text-xs text-neutral-500">Cargando mesas del establecimiento...</p>
        </div>
    `);

    let tables = [
        { id: 1, table_number: 1, capacity: 2, zone: 'Sala Principal' },
        { id: 2, table_number: 2, capacity: 4, zone: 'Sala Principal' },
        { id: 3, table_number: 3, capacity: 6, zone: 'Sala Principal' },
        { id: 4, table_number: 4, capacity: 4, zone: 'Terraza' },
        { id: 5, table_number: 5, capacity: 6, zone: 'Terraza' }
    ];

    try {
        const { data } = await supabaseClient
            .from('restaurant_settings')
            .select('tables')
            .ilike('business_name', `%${currentBusiness.name}%`)
            .maybeSingle();

        if (data && data.tables && data.tables.length > 0) {
            tables = data.tables;
        }
    } catch (e) {
        console.warn("Aviso cargando mesas para QR:", e);
    }

    const modalBody = document.getElementById('modalBody');
    if (!modalBody) return;

    modalBody.innerHTML = `
        <div class="space-y-4 text-left">
            <div class="text-center space-y-1">
                <span class="text-[9px] font-mono uppercase tracking-widest text-neutral-400">HOSTELERÍA NETWISH</span>
                <h3 class="text-base font-bold text-black">QRs Oficiales de Mesa</h3>
                <p class="text-[11px] text-neutral-500">Genera e imprime el identificador QR de cada mesa.</p>
            </div>

            <div class="space-y-2 max-h-64 overflow-y-auto pr-1 allow-scroll pt-2 border-t border-neutral-100">
                ${tables.map(t => `
                    <div class="p-3.5 bg-neutral-50 rounded-2xl border border-neutral-200/70 flex items-center justify-between">
                        <div>
                            <span class="text-xs font-bold text-black font-mono block">Mesa ${t.table_number}</span>
                            <span class="text-[10px] text-neutral-400 font-mono">${t.zone} • ${t.capacity} comensales</span>
                        </div>
                        <button onclick="showSingleTableQRModal(${t.table_number}, '${encodeURIComponent(t.zone)}', ${t.capacity})" class="px-3 py-2 bg-black text-white text-[11px] font-bold rounded-xl active:scale-95 transition shadow-sm flex items-center space-x-1.5">
                            <i data-lucide="qr-code" class="w-3.5 h-3.5"></i>
                            <span>Ver QR</span>
                        </button>
                    </div>
                `).join('')}
            </div>

            <button onclick="window.closeCustomModal()" class="w-full py-2.5 bg-neutral-100 hover:bg-neutral-200 text-black font-bold rounded-xl text-xs transition">
                Cerrar
            </button>
        </div>
    `;

    if (typeof lucide !== 'undefined') lucide.createIcons();
}

function showSingleTableQRModal(tableNumber, encodedZone, capacity) {
    const zone = decodeURIComponent(encodedZone);
    const modalBody = document.getElementById('modalBody');
    if (!modalBody || !currentBusiness) return;

    const bizName = currentBusiness.name;
    const qrPayload = `https://netwish.es/?biz=${encodeURIComponent(bizName)}&table=${tableNumber}`;

    modalBody.innerHTML = `
        <div class="space-y-4 text-center">
            <div id="printableTableQRCard" class="p-6 bg-white border border-neutral-200/80 rounded-[32px] shadow-sm space-y-4 text-center">
                <div>
                    <span class="text-[9px] font-mono uppercase tracking-widest text-neutral-400 font-bold block">NETWISH • ${bizName.toUpperCase()}</span>
                    <h2 class="text-2xl font-black text-black tracking-tight mt-0.5">MESA ${tableNumber}</h2>
                    <span class="text-[10px] font-mono text-neutral-500">${zone} • Hasta ${capacity} personas</span>
                </div>

                <div class="p-4 bg-white rounded-2xl border border-neutral-100 inline-block shadow-inner">
                    <div id="tableQRCodeTarget" class="flex justify-center items-center"></div>
                </div>

                <div class="space-y-0.5">
                    <p class="text-[11px] font-bold text-black">Escanea para Carta & Pedidos</p>
                    <p class="text-[9px] text-neutral-400 font-mono">Sin esperas desde tu móvil</p>
                </div>
            </div>

            <div class="grid grid-cols-2 gap-2 pt-1">
                <button onclick="openTablesQRManagerModal()" class="w-full py-3 bg-neutral-100 text-black font-bold rounded-xl text-xs hover:bg-neutral-200 transition">
                    Volver
                </button>
                <button onclick="printTableQRCard()" class="w-full py-3 bg-black text-white font-bold rounded-xl text-xs shadow-md active:scale-95 transition flex items-center justify-center space-x-1.5">
                    <i data-lucide="printer" class="w-4 h-4"></i>
                    <span>Imprimir QR</span>
                </button>
            </div>
        </div>
    `;

    if (typeof lucide !== 'undefined') lucide.createIcons();

    setTimeout(() => {
        const qrContainer = document.getElementById('tableQRCodeTarget');
        if (qrContainer && typeof QRCode !== 'undefined') {
            qrContainer.innerHTML = '';
            new QRCode(qrContainer, {
                text: qrPayload,
                width: 170,
                height: 170,
                colorDark: "#000000",
                colorLight: "#ffffff",
                correctLevel: QRCode.CorrectLevel.H
            });
        }
    }, 50);
}

function printTableQRCard() {
    const card = document.getElementById('printableTableQRCard');
    if (!card) return;

    const qrImg = card.querySelector('img') || card.querySelector('canvas');
    let qrSrc = '';
    if (qrImg) {
        if (qrImg.tagName.toLowerCase() === 'img') {
            qrSrc = qrImg.src;
        } else if (qrImg.tagName.toLowerCase() === 'canvas') {
            qrSrc = qrImg.toDataURL();
        }
    }

    const tableTitle = card.querySelector('h2')?.innerText || 'MESA';
    const subTitle = card.querySelector('span.font-mono')?.innerText || '';
    const bizName = currentBusiness?.name || 'NetWish';

    const printWindow = window.open('', '_blank', 'width=600,height=700');
    if (!printWindow) {
        window.print();
        return;
    }

    printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>Imprimir QR - ${tableTitle}</title>
            <style>
                @page { margin: 0; size: auto; }
                body {
                    margin: 0;
                    padding: 40px;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    min-height: 100vh;
                    background: #ffffff;
                    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
                    box-sizing: border-box;
                }
                .card {
                    width: 300px;
                    padding: 32px 24px;
                    border: 3px solid #000000;
                    border-radius: 28px;
                    text-align: center;
                    background: #ffffff;
                    box-sizing: border-box;
                }
                .header-tag {
                    font-size: 10px;
                    font-family: monospace;
                    font-weight: 800;
                    letter-spacing: 2px;
                    text-transform: uppercase;
                    color: #000000;
                    margin-bottom: 6px;
                }
                h1 {
                    font-size: 28px;
                    font-weight: 900;
                    margin: 0 0 4px 0;
                    color: #000000;
                    letter-spacing: -0.5px;
                }
                .zone {
                    font-size: 11px;
                    color: #555555;
                    font-family: monospace;
                    margin-bottom: 20px;
                }
                .qr-box {
                    display: inline-block;
                    padding: 12px;
                    border: 2px solid #000000;
                    border-radius: 20px;
                    margin-bottom: 20px;
                    background: #ffffff;
                }
                .qr-box img {
                    display: block;
                    width: 180px;
                    height: 180px;
                }
                .footer-title {
                    font-size: 12px;
                    font-weight: 800;
                    color: #000000;
                    margin: 0 0 2px 0;
                }
                .footer-sub {
                    font-size: 9px;
                    font-family: monospace;
                    color: #666666;
                    margin: 0;
                }
            </style>
        </head>
        <body>
            <div class="card">
                <div class="header-tag">NETWISH • ${bizName.toUpperCase()}</div>
                <h1>${tableTitle}</h1>
                <div class="zone">${subTitle}</div>
                <div class="qr-box">
                    <img src="${qrSrc}" alt="QR Mesa" />
                </div>
                <div class="footer-title">Escanea para Carta & Pedidos</div>
                <div class="footer-sub">Sin esperas desde tu móvil</div>
            </div>
            <script>
                window.onload = function() {
                    window.focus();
                    window.print();
                    window.close();
                };
            <\/script>
        </body>
        </html>
    `);
    printWindow.document.close();
}