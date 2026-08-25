// js/restaurant.js

window.restaurantState = {
    selectedTable: null,
    splitDinnersCount: 1,
    filterDate: '',
    filterTime: '14:00',
    filterGuests: 2,
    hasFiltered: false,
    realtimeSubscription: null,
    tableOrders: {
        1: { items: [{ name: 'Chuletón de Ternera', price: 24.00, qty: 1 }, { name: 'Vino Ribera del Duero', price: 16.00, qty: 1 }], total: 40.00 },
        2: { items: [{ name: 'Ensalada Burrata', price: 11.50, qty: 1 }, { name: 'Agua Mineral', price: 2.50, qty: 2 }], total: 16.50 },
        3: { items: [], total: 0.00 },
        4: { items: [{ name: 'Menú del Día', price: 14.50, qty: 3 }], total: 43.50 },
        5: { items: [], total: 0.00 },
        6: { items: [], total: 0.00 }
    },
    tablesLayout: [
        { id: 1, table_number: 1, name: 'Mesa 1', capacity: 4, status: 'occupied', zone: 'Sala Principal', current_bill: 40.00 },
        { id: 2, table_number: 2, name: 'Mesa 2', capacity: 2, status: 'occupied', zone: 'Sala Principal', current_bill: 16.50 },
        { id: 3, table_number: 3, name: 'Mesa 3', capacity: 4, status: 'free', zone: 'Terraza', current_bill: 0.00 },
        { id: 4, table_number: 4, name: 'Mesa 4', capacity: 6, status: 'occupied', zone: 'Sala Principal', current_bill: 43.50 },
        { id: 5, table_number: 5, name: 'Mesa 5', capacity: 2, status: 'free', zone: 'Terraza', current_bill: 0.00 },
        { id: 6, table_number: 6, name: 'Mesa 6', capacity: 8, status: 'free', zone: 'Reservado', current_bill: 0.00 }
    ]
};

// 1. HUB PRINCIPAL DEL RESTAURANTE
window.renderRestaurantHub = function(container) {
    if (!container) return;

    container.innerHTML = `
        <div class="space-y-4">
            
            <!-- Acceso: Menú del Día -->
            <button onclick="window.openDailyMenuModal()" class="w-full p-4 rounded-3xl bg-neutral-50 hover:bg-neutral-100 border border-neutral-200/80 flex items-center justify-between shadow-sm active:scale-[0.98] transition group">
                <div class="flex items-center space-x-3.5">
                    <div class="w-10 h-10 rounded-2xl bg-black text-white flex items-center justify-center shadow-md shrink-0">
                        <i data-lucide="chef-hat" class="w-5 h-5 text-amber-400"></i>
                    </div>
                    <div class="text-left">
                        <div class="flex items-center space-x-2">
                            <span class="block text-xs font-bold text-black tracking-tight">Menú del Día</span>
                            <span class="text-[9px] bg-emerald-500/10 text-emerald-600 font-bold px-2 py-0.5 rounded-full border border-emerald-500/20">Disponible Hoy</span>
                        </div>
                        <span class="block text-[10px] text-neutral-400 mt-0.5">Primero, segundo, postre y bebida incluida</span>
                    </div>
                </div>
                <div class="w-7 h-7 rounded-full bg-white border border-neutral-200/60 flex items-center justify-center text-neutral-400 group-hover:text-black transition shrink-0 ml-2">
                    <i data-lucide="chevron-right" class="w-4 h-4"></i>
                </div>
            </button>

            <!-- Acceso: Mapa de Mesas y Reservas -->
            <button onclick="window.openTableMapModal()" class="w-full p-4 rounded-3xl bg-neutral-50 hover:bg-neutral-100 border border-neutral-200/80 flex items-center justify-between shadow-sm active:scale-[0.98] transition group">
                <div class="flex items-center space-x-3.5">
                    <div class="w-10 h-10 rounded-2xl bg-black text-white flex items-center justify-center shadow-md shrink-0">
                        <i data-lucide="layout-grid" class="w-5 h-5 text-white"></i>
                    </div>
                    <div class="text-left">
                        <span class="block text-xs font-bold text-black tracking-tight">Mapa de Mesas & Reservas</span>
                        <span class="block text-[10px] text-neutral-400 mt-0.5">Consulta disponibilidad en vivo o gestiona tu mesa</span>
                    </div>
                </div>
                <div class="w-7 h-7 rounded-full bg-white border border-neutral-200/60 flex items-center justify-center text-neutral-400 group-hover:text-black transition shrink-0 ml-2">
                    <i data-lucide="chevron-right" class="w-4 h-4"></i>
                </div>
            </button>

            <!-- Carta Digital -->
            <div class="space-y-3 pt-2">
                <div class="flex items-center justify-between px-1">
                    <h4 class="text-[10px] font-mono font-bold text-neutral-400 uppercase tracking-widest">Carta Digital</h4>
                    <span class="text-[9px] text-neutral-400 font-mono">Precios con IVA</span>
                </div>
                <div class="space-y-3" id="restaurantMenuSectionsContainer">
                    ${window.renderRestaurantMenuCards()}
                </div>
            </div>

        </div>
    `;

    if (typeof lucide !== 'undefined') lucide.createIcons();
};

// 2. RENDERIZADO DE PLATOS CON BOTONES REACTIVOS (+ / -)
window.renderRestaurantMenuCards = function() {
    const dishes = [
        { id: 'rest_1', name: 'Tabla de Quesos de Cerrato', desc: 'Selección de quesos curados palentinos con mermelada artesana', price: 14.00, tag: 'Entrante' },
        { id: 'rest_2', name: 'Lechazo Asado de Palencia', desc: 'Cuarto de lechazo churro asado en horno tradicional', price: 26.50, tag: 'Principal' },
        { id: 'rest_3', name: 'Croquetas de Jamón Ibérico (6 uds)', desc: 'Rebozado crujiente y bechamel melosa', price: 9.50, tag: 'Tapa' },
        { id: 'rest_4', name: 'Brazo de San Antolín', desc: 'Postre tradicional hojaldrado con crema pastelera', price: 5.50, tag: 'Postre' }
    ];

    return dishes.map(dish => {
        const itemIdStr = String(dish.id);
        const existingInCart = (window.appState?.cartItemsList || []).find(i => String(i.id) === itemIdStr);
        const qty = existingInCart ? existingInCart.qty : 0;
        const safeItemId = encodeURIComponent(itemIdStr);
        const safeItemName = encodeURIComponent(dish.name);

        return `
            <div class="p-4 rounded-3xl border border-neutral-200/80 bg-white shadow-sm flex items-center justify-between transition">
                <div class="space-y-1 max-w-[65%]">
                    <span class="inline-block px-2 py-0.5 rounded-md bg-neutral-100 text-neutral-600 text-[8px] font-mono uppercase tracking-wider">${dish.tag}</span>
                    <h4 class="text-xs font-bold text-black truncate">${dish.name}</h4>
                    <p class="text-[10px] text-neutral-400 line-clamp-2">${dish.desc}</p>
                    <span class="text-xs font-extrabold text-black font-mono block pt-1">${dish.price.toFixed(2)} €</span>
                </div>
                <div id="btn-container-${dish.id}" class="flex items-center space-x-2 shrink-0">
                    ${typeof renderItemButtonHTML === 'function' ? renderItemButtonHTML(dish.id, safeItemId, safeItemName, dish.price, qty) : ''}
                </div>
            </div>
        `;
    }).join('');
};

// 3. MAPA DE MESAS CON FILTRO Y SINCRONIZACIÓN SUPABASE
window.openTableMapModal = async function() {
    const modal = document.getElementById('customModal');
    const modalBody = document.getElementById('modalBody');
    if (!modal || !modalBody) return;

    const today = new Date().toISOString().split('T')[0];
    if (!window.restaurantState.filterDate) window.restaurantState.filterDate = today;

    modalBody.innerHTML = `
        <div class="space-y-4 text-left">
            <div class="flex items-center justify-between border-b border-neutral-100 pb-3">
                <div>
                    <h3 class="text-sm font-bold text-black">Reserva & Mapa de Mesas</h3>
                    <p class="text-[10px] text-neutral-400">Selecciona franja horaria para ver disponibilidad</p>
                </div>
                <button onclick="window.closeCustomModal()" class="w-7 h-7 rounded-full bg-neutral-100 flex items-center justify-center text-neutral-500">
                    <i data-lucide="x" class="w-4 h-4"></i>
                </button>
            </div>

            <!-- Selector de Fecha, Turno y Personas -->
            <div class="p-3.5 bg-neutral-50 rounded-2xl border border-neutral-200/80 space-y-3">
                <div class="grid grid-cols-2 gap-2">
                    <div>
                        <label class="text-[9px] font-mono uppercase text-neutral-400 block mb-1">Fecha</label>
                        <input type="date" id="resvDateInput" value="${window.restaurantState.filterDate}" min="${today}" class="w-full bg-white border border-neutral-200 rounded-xl px-2.5 py-2 text-xs text-black font-medium focus:border-black outline-none">
                    </div>
                    <div>
                        <label class="text-[9px] font-mono uppercase text-neutral-400 block mb-1">Hora / Turno</label>
                        <select id="resvTimeInput" class="w-full bg-white border border-neutral-200 rounded-xl px-2.5 py-2 text-xs text-black font-medium focus:border-black outline-none">
                            <option value="13:30" ${window.restaurantState.filterTime === '13:30' ? 'selected' : ''}>13:30 (Comida)</option>
                            <option value="14:00" ${window.restaurantState.filterTime === '14:00' ? 'selected' : ''}>14:00 (Comida)</option>
                            <option value="14:30" ${window.restaurantState.filterTime === '14:30' ? 'selected' : ''}>14:30 (Comida)</option>
                            <option value="21:00" ${window.restaurantState.filterTime === '21:00' ? 'selected' : ''}>21:00 (Cena)</option>
                            <option value="21:30" ${window.restaurantState.filterTime === '21:30' ? 'selected' : ''}>21:30 (Cena)</option>
                            <option value="22:00" ${window.restaurantState.filterTime === '22:00' ? 'selected' : ''}>22:00 (Cena)</option>
                        </select>
                    </div>
                </div>

                <div class="flex items-center justify-between pt-1">
                    <div class="flex items-center space-x-2">
                        <label class="text-[9px] font-mono uppercase text-neutral-400">Comensales:</label>
                        <select id="resvGuestsInput" class="bg-white border border-neutral-200 rounded-xl px-2 py-1 text-xs text-black font-bold outline-none">
                            <option value="2" ${window.restaurantState.filterGuests == 2 ? 'selected' : ''}>2 pax</option>
                            <option value="4" ${window.restaurantState.filterGuests == 4 ? 'selected' : ''}>4 pax</option>
                            <option value="6" ${window.restaurantState.filterGuests == 6 ? 'selected' : ''}>6 pax</option>
                            <option value="8" ${window.restaurantState.filterGuests == 8 ? 'selected' : ''}>8 pax</option>
                        </select>
                    </div>
                    <button onclick="window.applyTableFilter()" class="px-4 py-2 bg-black text-white text-[11px] font-bold rounded-xl active:scale-95 transition shadow-sm">
                        Buscar Mesas
                    </button>
                </div>
            </div>

            <!-- Contenedor del Mapa de Mesas -->
            <div id="tableGridContainer" class="space-y-2">
                <div class="py-8 text-center text-xs text-neutral-400">
                    <i data-lucide="loader-2" class="w-5 h-5 mx-auto animate-spin mb-2"></i>
                    Sincronizando mesas en vivo...
                </div>
            </div>
        </div>
    `;

    modal.classList.remove('hidden', 'opacity-0');
    modal.classList.add('opacity-100');
    if (typeof lucide !== 'undefined') lucide.createIcons();

    await window.fetchRestaurantTablesLive();
    window.subscribeRestaurantRealtime();
};

window.fetchRestaurantTablesLive = async function() {
    const client = (typeof supabaseClient !== 'undefined') ? supabaseClient : window.supabase;
    const bizName = window.appState?.activeBusinessName || 'Restaurante Dani';

    if (client) {
        try {
            const { data, error } = await client
                .from('restaurant_tables')
                .select('*')
                .ilike('business_name', `%${bizName}%`);

            if (!error && data && data.length > 0) {
                window.restaurantState.tablesLayout = data.map(t => ({
                    id: t.table_number || t.id,
                    db_id: t.id,
                    table_number: t.table_number || t.id,
                    name: `Mesa ${t.table_number || t.id}`,
                    capacity: t.capacity || 4,
                    status: t.status || 'free',
                    zone: t.zone || 'Sala Principal',
                    current_bill: parseFloat(t.current_bill || 0)
                }));
            }
        } catch (e) {
            console.warn("Consulta Supabase mesas fallida, usando estado local:", e);
        }
    }

    const grid = document.getElementById('tableGridContainer');
    if (grid) {
        grid.innerHTML = window.renderTableGridHTML();
        if (typeof lucide !== 'undefined') lucide.createIcons();
    }
};

window.applyTableFilter = function() {
    window.restaurantState.filterDate = document.getElementById('resvDateInput')?.value || '';
    window.restaurantState.filterTime = document.getElementById('resvTimeInput')?.value || '14:00';
    window.restaurantState.filterGuests = parseInt(document.getElementById('resvGuestsInput')?.value || '2', 10);
    window.restaurantState.hasFiltered = true;

    window.fetchRestaurantTablesLive();
};

window.renderTableGridHTML = function() {
    return `
        <div class="flex items-center justify-between text-[10px] font-mono text-neutral-500 pt-1">
            <span>Mesas para ${window.restaurantState.filterDate} (${window.restaurantState.filterTime})</span>
            <div class="flex items-center space-x-3">
                <span class="flex items-center gap-1"><span class="w-2 h-2 rounded-full bg-emerald-500"></span>Libre</span>
                <span class="flex items-center gap-1"><span class="w-2 h-2 rounded-full bg-neutral-300"></span>Ocupada</span>
            </div>
        </div>

        <div class="grid grid-cols-2 gap-2.5 max-h-56 overflow-y-auto pr-1">
            ${window.restaurantState.tablesLayout.map(table => {
                const isFree = table.status === 'free';
                const hasBill = (table.current_bill && table.current_bill > 0) || 
                                (window.restaurantState.tableOrders[table.id] && window.restaurantState.tableOrders[table.id].total > 0);
                const billTotal = table.current_bill || (window.restaurantState.tableOrders[table.id]?.total || 0);

                return `
                    <div onclick="window.selectTableForAction(${table.id})" class="p-3 rounded-2xl border ${isFree ? 'border-emerald-200 bg-emerald-50/40 hover:border-emerald-500' : 'border-neutral-200 bg-neutral-50/70 hover:border-black'} cursor-pointer transition active:scale-95 space-y-1 text-left">
                        <div class="flex items-center justify-between">
                            <span class="text-xs font-bold text-black">${table.name}</span>
                            <span class="w-2 h-2 rounded-full ${isFree ? 'bg-emerald-500 animate-pulse' : 'bg-neutral-400'}"></span>
                        </div>
                        <p class="text-[9px] text-neutral-400 font-mono">${table.zone} • ${table.capacity} pax</p>
                        ${isFree ? `<span class="inline-block text-[9px] font-bold text-emerald-700 bg-emerald-100/60 px-2 py-0.5 rounded-md">Reservar Mesa</span>` 
                                : `<span class="inline-block text-[9px] font-bold text-neutral-600 bg-neutral-200/60 px-2 py-0.5 rounded-md">${hasBill ? `${billTotal.toFixed(2)} € pend.` : 'Ocupada'}</span>`}
                    </div>
                `;
            }).join('')}
        </div>
    `;
};

// 4. ACCIÓN AL PULSAR UNA MESA (RESERVAR O PAGAR CUENTA POR QR)
window.selectTableForAction = function(tableId) {
    const table = window.restaurantState.tablesLayout.find(t => t.id === tableId || t.table_number === tableId);
    const tableOrder = window.restaurantState.tableOrders[tableId] || { items: [], total: table?.current_bill || 0 };
    window.restaurantState.selectedTable = tableId;

    const modalBody = document.getElementById('modalBody');
    if (!modalBody) return;

    if (table && table.status === 'free') {
        // Reservar mesa libre
        modalBody.innerHTML = `
            <div class="space-y-4 text-left">
                <div class="flex items-center justify-between border-b border-neutral-100 pb-3">
                    <div>
                        <span class="text-[9px] font-mono uppercase tracking-widest text-emerald-600">CONFIRMAR RESERVA</span>
                        <h3 class="text-sm font-bold text-black">${table.name} (${table.zone})</h3>
                    </div>
                    <button onclick="window.closeCustomModal()" class="w-7 h-7 rounded-full bg-neutral-100 flex items-center justify-center text-neutral-500">
                        <i data-lucide="x" class="w-4 h-4"></i>
                    </button>
                </div>

                <div class="p-3.5 bg-neutral-50 rounded-2xl border border-neutral-200/70 space-y-1.5 text-xs text-neutral-700">
                    <p><strong>Fecha:</strong> ${window.restaurantState.filterDate}</p>
                    <p><strong>Hora:</strong> ${window.restaurantState.filterTime}</p>
                    <p><strong>Comensales:</strong> ${window.restaurantState.filterGuests} personas (Capacidad: ${table.capacity})</p>
                </div>

                <button onclick="window.confirmTableReservation(${tableId})" class="w-full py-3.5 bg-black text-white rounded-2xl text-xs font-bold active:scale-95 transition shadow-md">
                    Confirmar Reserva en ${table.name}
                </button>
            </div>
        `;
        if (typeof lucide !== 'undefined') lucide.createIcons();
        return;
    }

    // Mesa ocupada con cuenta activa: Split Bill QR
    window.restaurantState.splitDinnersCount = 1;
    const itemsList = tableOrder.items.length > 0 ? tableOrder.items : [{ name: 'Consumo en Sala / Mesa', qty: 1, price: tableOrder.total }];

    modalBody.innerHTML = `
        <div class="space-y-4 text-left">
            <div class="flex items-center justify-between border-b border-neutral-100 pb-3">
                <div>
                    <span class="text-[9px] font-mono uppercase tracking-widest text-neutral-400">QR MESA ACTIVA</span>
                    <h3 class="text-sm font-bold text-black">Mesa ${tableId} — Cuenta en Directo</h3>
                </div>
                <button onclick="window.closeCustomModal()" class="w-7 h-7 rounded-full bg-neutral-100 flex items-center justify-center text-neutral-500">
                    <i data-lucide="x" class="w-4 h-4"></i>
                </button>
            </div>

            <div class="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                ${itemsList.map(it => `
                    <div class="flex justify-between items-center text-xs py-1 border-b border-neutral-100/60">
                        <span class="text-neutral-700">${it.qty}x ${it.name}</span>
                        <span class="font-mono font-bold text-black">${(it.price * it.qty).toFixed(2)} €</span>
                    </div>
                `).join('')}
            </div>

            <div class="p-3.5 rounded-2xl bg-neutral-50 border border-neutral-200/80 space-y-2">
                <div class="flex justify-between items-center text-xs">
                    <span class="text-neutral-500 font-medium">Total de la mesa:</span>
                    <span class="font-extrabold font-mono text-base text-black">${tableOrder.total.toFixed(2)} €</span>
                </div>

                <div class="pt-2 border-t border-neutral-200/60 flex items-center justify-between">
                    <span class="text-[10px] text-neutral-500 font-mono">Dividir entre comensales:</span>
                    <div class="flex items-center space-x-2">
                        <button onclick="window.updateBillSplit(-1, ${tableOrder.total})" class="w-6 h-6 rounded-lg bg-white border border-neutral-200 text-xs font-bold text-black">-</button>
                        <span class="font-mono font-extrabold text-xs" id="splitCountLabel">1</span>
                        <button onclick="window.updateBillSplit(1, ${tableOrder.total})" class="w-6 h-6 rounded-lg bg-black text-white text-xs font-bold">+</button>
                    </div>
                </div>

                <div class="flex justify-between items-center text-xs pt-1">
                    <span class="text-xs font-bold text-neutral-700">Tu parte a pagar:</span>
                    <span class="font-mono font-extrabold text-sm text-emerald-600" id="splitIndividualAmount">${tableOrder.total.toFixed(2)} €</span>
                </div>
            </div>

            <button onclick="window.proceedWithTablePayment(${tableId})" class="w-full py-3.5 bg-black text-white rounded-2xl text-xs font-bold tracking-wide active:scale-95 transition shadow-md flex items-center justify-center space-x-2">
                <i data-lucide="credit-card" class="w-4 h-4"></i>
                <span>Pagar Mi Parte con NetWish</span>
            </button>
        </div>
    `;

    if (typeof lucide !== 'undefined') lucide.createIcons();
};

window.confirmTableReservation = async function(tableId) {
    const table = window.restaurantState.tablesLayout.find(t => t.id === tableId || t.table_number === tableId);
    const date = window.restaurantState.filterDate || new Date().toISOString().split('T')[0];
    const time = window.restaurantState.filterTime || '14:00';
    const guests = window.restaurantState.filterGuests || 2;
    const bizName = window.appState?.activeBusinessName || 'Restaurante Dani';
    const client = (typeof supabaseClient !== 'undefined') ? supabaseClient : window.supabase;
    const customerUser = (typeof currentUser !== 'undefined') ? currentUser : null;

    // Actualización en Supabase
    if (client && table?.db_id) {
        try {
            await client.from('restaurant_tables').update({ status: 'reserved' }).eq('id', table.db_id);
        } catch (e) {
            console.warn("Aviso actualizando mesa en Supabase:", e);
        }
    }

    // Actualización local optimista
    if (table) table.status = 'reserved';

    // Disparo de confirmación por email
    if (window.emailService) {
        const resvData = {
            businessName: bizName,
            clientName: customerUser?.user_metadata?.full_name || customerUser?.email || 'Cliente NetWish',
            date: date,
            time: `${time} (${guests} comensales)`,
            items: [{ name: `Reserva Mesa ${tableId} (${table?.zone || 'Sala'})`, qty: 1, price: 0 }],
            total: 0,
            action: 'reserve'
        };

        if (customerUser?.email) {
            window.emailService.sendClientReceipt(customerUser.email, resvData);
        }

        const bizEmail = window.appState?.activeBusinessEmail || 'contacto@netwish.es';
        window.emailService.sendBusinessAlert(bizEmail, resvData);
    }

    window.closeCustomModal();
    alert(`¡Reserva confirmada en Mesa ${tableId} para el ${date} a las ${time}! Comprobante digital enviado.`);
};

window.updateBillSplit = function(delta, total) {
    let current = window.restaurantState.splitDinnersCount + delta;
    if (current < 1) current = 1;
    if (current > 12) current = 12;

    window.restaurantState.splitDinnersCount = current;
    const splitAmount = (total / current).toFixed(2);

    const countEl = document.getElementById('splitCountLabel');
    const amountEl = document.getElementById('splitIndividualAmount');

    if (countEl) countEl.innerText = current;
    if (amountEl) amountEl.innerText = `${splitAmount} €`;
};

window.proceedWithTablePayment = function(tableId) {
    const table = window.restaurantState.tablesLayout.find(t => t.id === tableId || t.table_number === tableId);
    const tableOrder = window.restaurantState.tableOrders[tableId] || { total: table?.current_bill || 0 };
    if (!tableOrder || tableOrder.total <= 0) return;

    const amountToPay = (tableOrder.total / window.restaurantState.splitDinnersCount).toFixed(2);
    window.closeCustomModal();

    window.rawAmountString = Math.round(parseFloat(amountToPay) * 100).toString();
    if (typeof window.updateAmountDisplay === 'function') {
        window.updateAmountDisplay();
    }

    const payeeNameEl = document.getElementById('payeeNameDisplay');
    if (payeeNameEl) payeeNameEl.innerText = `${window.appState?.activeBusinessName || 'Restaurante'} (Mesa ${tableId})`;

    if (typeof switchTab === 'function') {
        switchTab('payment');
    }
};

// 5. MODAL DEL MENÚ DEL DÍA
window.openDailyMenuModal = function() {
    const modal = document.getElementById('customModal');
    const modalBody = document.getElementById('modalBody');
    if (!modal || !modalBody) return;

    modalBody.innerHTML = `
        <div class="space-y-4 text-left">
            <div class="flex items-center justify-between border-b border-neutral-100 pb-3">
                <div>
                    <span class="text-[9px] font-mono uppercase tracking-widest text-neutral-400">MENÚ DEL DÍA</span>
                    <h3 class="text-sm font-bold text-black">14,50 € / Persona</h3>
                </div>
                <button onclick="window.closeCustomModal()" class="w-7 h-7 rounded-full bg-neutral-100 flex items-center justify-center text-neutral-500">
                    <i data-lucide="x" class="w-4 h-4"></i>
                </button>
            </div>

            <div class="space-y-3 max-h-64 overflow-y-auto pr-1 text-xs">
                <div>
                    <h5 class="font-mono text-[9px] uppercase tracking-wider text-neutral-400 mb-1">Primeros (A elegir)</h5>
                    <div class="space-y-1 text-neutral-700">
                        <p class="p-2 rounded-xl bg-neutral-50 border border-neutral-100">• Alubias Blancas de Saldaña con Matanza</p>
                        <p class="p-2 rounded-xl bg-neutral-50 border border-neutral-100">• Sopa Castellana Tradicional</p>
                        <p class="p-2 rounded-xl bg-neutral-50 border border-neutral-100">• Ensalada de Cecina con Frutos Secos</p>
                    </div>
                </div>

                <div>
                    <h5 class="font-mono text-[9px] uppercase tracking-wider text-neutral-400 mb-1">Segundos (A elegir)</h5>
                    <div class="space-y-1 text-neutral-700">
                        <p class="p-2 rounded-xl bg-neutral-50 border border-neutral-100">• Carrillera Ibérica al Vino Tinto</p>
                        <p class="p-2 rounded-xl bg-neutral-50 border border-neutral-100">• Bacalao con Pimientos Asados</p>
                    </div>
                </div>

                <div>
                    <h5 class="font-mono text-[9px] uppercase tracking-wider text-neutral-400 mb-1">Incluye</h5>
                    <p class="text-[10px] text-neutral-500">Pan de leña, Agua o Vino de la casa y Postre casero.</p>
                </div>
            </div>

            <button onclick="window.changeItemQuantity('menu_dia', 'Menú del Día', 14.50, 1); window.closeCustomModal();" class="w-full py-3.5 bg-black text-white rounded-2xl text-xs font-bold active:scale-95 transition shadow-md">
                Añadir Menú a Mi Pedido (14,50 €)
            </button>
        </div>
    `;

    modal.classList.remove('hidden', 'opacity-0');
    modal.classList.add('opacity-100');
    if (typeof lucide !== 'undefined') lucide.createIcons();
};

window.closeCustomModal = function() {
    const modal = document.getElementById('customModal');
    if (modal) {
        modal.classList.add('opacity-0');
        setTimeout(() => modal.classList.add('hidden'), 200);
    }
};

// 6. DETECCIÓN AL ESCANEAR EL QR DE UNA MESA
window.handleRestaurantTableQRScan = function(qrContent) {
    if (qrContent && qrContent.includes('mesa:')) {
        const parts = qrContent.split(':');
        const tableId = parseInt(parts[parts.length - 1], 10);
        if (!isNaN(tableId)) {
            window.selectTableForAction(tableId);
            return true;
        }
    }
    return false;
};

// 7. SUSCRIPCIÓN EN TIEMPO REAL A SUPABASE
window.subscribeRestaurantRealtime = function() {
    const client = (typeof supabaseClient !== 'undefined') ? supabaseClient : window.supabase;
    if (!client || window.restaurantState.realtimeSubscription) return;

    window.restaurantState.realtimeSubscription = client
        .channel('realtime:restaurant_tables')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'restaurant_tables' }, () => {
            window.fetchRestaurantTablesLive();
        })
        .subscribe();
};