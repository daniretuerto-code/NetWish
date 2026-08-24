// js/restaurant.js

window.restaurantState = {
    selectedTable: null,
    splitDinnersCount: 1,
    tableOrders: {
        1: { items: [{ name: 'Chuletón de Ternera', price: 24.00, qty: 1 }, { name: 'Vino Ribera del Duero', price: 16.00, qty: 1 }], total: 40.00 },
        2: { items: [{ name: 'Ensalada Burrata', price: 11.50, qty: 1 }, { name: 'Agua Mineral', price: 2.50, qty: 2 }], total: 16.50 },
        3: { items: [], total: 0.00 },
        4: { items: [{ name: 'Menú del Día', price: 14.50, qty: 3 }], total: 43.50 }
    },
    tablesLayout: [
        { id: 1, name: 'Mesa 1', capacity: 4, status: 'occupied', zone: 'Sala Principal' },
        { id: 2, name: 'Mesa 2', capacity: 2, status: 'occupied', zone: 'Sala Principal' },
        { id: 3, name: 'Mesa 3', capacity: 4, status: 'free', zone: 'Terraza' },
        { id: 4, name: 'Mesa 4', capacity: 6, status: 'occupied', zone: 'Sala Principal' },
        { id: 5, name: 'Mesa 5', capacity: 2, status: 'free', zone: 'Terraza' },
        { id: 6, name: 'Mesa 6', capacity: 8, status: 'free', zone: 'Reservado' }
    ]
};

// 1. RENDERIZADO DEL PANEL PRINCIPAL DEL RESTAURANTE
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
                        <span class="block text-[10px] text-neutral-400 mt-0.5">Elige tu mesa y gestiona tu cuenta en vivo</span>
                    </div>
                </div>
                <div class="w-7 h-7 rounded-full bg-white border border-neutral-200/60 flex items-center justify-center text-neutral-400 group-hover:text-black transition shrink-0 ml-2">
                    <i data-lucide="chevron-right" class="w-4 h-4"></i>
                </div>
            </button>

            <!-- Carta Digital por Categorías -->
            <div class="space-y-3 pt-2">
                <div class="flex items-center justify-between px-1">
                    <h4 class="text-[10px] font-mono font-bold text-neutral-400 uppercase tracking-widest">Carta Digital</h4>
                    <span class="text-[9px] text-neutral-400 font-mono">Precios con IVA</span>
                </div>
                <div class="space-y-2.5" id="restaurantMenuSectionsContainer">
                    ${window.renderRestaurantMenuCards()}
                </div>
            </div>

        </div>
    `;

    if (typeof lucide !== 'undefined') lucide.createIcons();
};

// 2. RENDERIZADO DE PLATOS DE LA CARTA
window.renderRestaurantMenuCards = function() {
    const defaultDishes = [
        { id: 'rest_1', name: 'Tabla de Quesos de Cerrato', desc: 'Selección de quesos curados palentinos con mermelada artesana', price: 14.00, tag: 'Entrante' },
        { id: 'rest_2', name: 'Lechazo Asado de Palencia', desc: 'Cuarto de lechazo churro asado en horno tradicional', price: 26.50, tag: 'Principal' },
        { id: 'rest_3', name: 'Croquetas de Jamón Ibérico (6 uds)', desc: 'Rebozado crujiente y bechamel melosa', price: 9.50, tag: 'Tapa' },
        { id: 'rest_4', name: 'Brazo de San Antolín', desc: 'Postre tradicional hojaldrado con crema pastelera', price: 5.50, tag: 'Postre' }
    ];

    return defaultDishes.map(dish => `
        <div class="p-4 rounded-3xl border border-neutral-200/80 bg-white flex items-center justify-between shadow-sm">
            <div class="space-y-1 max-w-[65%]">
                <span class="inline-block px-2 py-0.5 rounded-md bg-neutral-100 text-neutral-600 text-[8px] font-mono uppercase tracking-wider">${dish.tag}</span>
                <h4 class="text-xs font-bold text-black truncate">${dish.name}</h4>
                <p class="text-[10px] text-neutral-400 line-clamp-2">${dish.desc}</p>
                <span class="text-xs font-extrabold text-black font-mono block pt-1">${dish.price.toFixed(2)} €</span>
            </div>
            <button onclick="window.changeItemQuantity('${dish.id}', '${encodeURIComponent(dish.name)}', ${dish.price}, 1)" class="w-10 h-10 rounded-2xl bg-black text-white shadow-md flex items-center justify-center active:scale-90 transition font-bold shrink-0">
                <i data-lucide="plus" class="w-4 h-4"></i>
            </button>
        </div>
    `).join('');
};

// 3. MAPA INTERACTIVO DE DISTRIBUCIÓN DE MESAS
window.openTableMapModal = function() {
    const modal = document.getElementById('customModal');
    const modalBody = document.getElementById('modalBody');
    if (!modal || !modalBody) return;

    modalBody.innerHTML = `
        <div class="space-y-4">
            <div class="flex items-center justify-between border-b border-neutral-100 pb-3">
                <div>
                    <h3 class="text-sm font-bold text-black">Distribución de Mesas</h3>
                    <p class="text-[10px] text-neutral-400">Selecciona tu mesa para pedir o pagar la cuenta</p>
                </div>
                <button onclick="window.closeCustomModal()" class="w-7 h-7 rounded-full bg-neutral-100 flex items-center justify-center text-neutral-500">
                    <i data-lucide="x" class="w-4 h-4"></i>
                </button>
            </div>

            <!-- Leyenda -->
            <div class="flex items-center space-x-4 text-[10px] font-mono text-neutral-500">
                <div class="flex items-center space-x-1.5">
                    <span class="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                    <span>Libre</span>
                </div>
                <div class="flex items-center space-x-1.5">
                    <span class="w-2.5 h-2.5 rounded-full bg-neutral-300"></span>
                    <span>Ocupada</span>
                </div>
            </div>

            <!-- Rejilla de Mesas -->
            <div class="grid grid-cols-2 gap-3 max-h-60 overflow-y-auto pr-1">
                ${window.restaurantState.tablesLayout.map(table => {
                    const isFree = table.status === 'free';
                    const hasBill = window.restaurantState.tableOrders[table.id] && window.restaurantState.tableOrders[table.id].total > 0;
                    return `
                        <div onclick="window.selectTableForAction(${table.id})" class="p-3.5 rounded-2xl border ${isFree ? 'border-emerald-200 bg-emerald-50/40 hover:border-emerald-500' : 'border-neutral-200 bg-neutral-50/70 hover:border-black'} cursor-pointer transition active:scale-95 space-y-1.5 text-left">
                            <div class="flex items-center justify-between">
                                <span class="text-xs font-bold text-black">${table.name}</span>
                                <span class="w-2 h-2 rounded-full ${isFree ? 'bg-emerald-500 animate-pulse' : 'bg-neutral-400'}"></span>
                            </div>
                            <p class="text-[9px] text-neutral-400 font-mono">${table.zone} • ${table.capacity} pax</p>
                            ${hasBill ? `<p class="text-[10px] font-extrabold text-black pt-1">${window.restaurantState.tableOrders[table.id].total.toFixed(2)} € pend.</p>` : `<p class="text-[9px] text-emerald-600 font-bold pt-1">Disponible</p>`}
                        </div>
                    `;
                }).join('')}
            </div>

            <p class="text-[9px] text-neutral-400 text-center font-mono">Toca una mesa ocupada para abrir el terminal QR de pago dividido.</p>
        </div>
    `;

    modal.classList.remove('hidden', 'opacity-0');
    modal.classList.add('opacity-100');
    if (typeof lucide !== 'undefined') lucide.createIcons();
};

// 4. TERMINAL DE PAGO QR Y CUENTA DIVIDIDA (SPLIT BILL)
window.selectTableForAction = function(tableId) {
    const tableOrder = window.restaurantState.tableOrders[tableId];
    window.restaurantState.selectedTable = tableId;

    if (!tableOrder || tableOrder.total <= 0) {
        window.closeCustomModal();
        if (window.showToast) window.showToast(`Mesa ${tableId} libre. Puedes reservar o empezar a pedir.`, 'info');
        return;
    }

    const modalBody = document.getElementById('modalBody');
    if (!modalBody) return;

    window.restaurantState.splitDinnersCount = 1;

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

            <!-- Desglose de Consumiciones -->
            <div class="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                ${tableOrder.items.map(it => `
                    <div class="flex justify-between items-center text-xs py-1 border-b border-neutral-100/60">
                        <span class="text-neutral-700">${it.qty}x ${it.name}</span>
                        <span class="font-mono font-bold text-black">${(it.price * it.qty).toFixed(2)} €</span>
                    </div>
                `).join('')}
            </div>

            <div class="p-3.5 rounded-2xl bg-neutral-50 border border-neutral-200/80 space-y-2">
                <div class="flex justify-between items-center text-xs">
                    <span class="text-neutral-500 font-medium">Total de la mesa:</span>
                    <span class="font-extrabold font-mono text-base text-black" id="totalTableBill">${tableOrder.total.toFixed(2)} €</span>
                </div>

                <!-- Selector de división de comensales -->
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
    const tableOrder = window.restaurantState.tableOrders[tableId];
    if (!tableOrder) return;

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