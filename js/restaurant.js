// js/restaurant.js

window.restaurantState = {
    selectedDate: '',
    selectedTime: '',
    selectedGuests: 2,
    selectedZone: 'Sala Principal',
    activeMenuCategory: 'Entrantes',
    allocatedTable: null,
    currentTableSession: null,
    sessionRealtimeSub: null,

    dailyMenu: {
        active: true,
        price: 14.50,
        first_courses: ["Alubias Blancas de Saldaña con Matanza", "Sopa Castellana Tradicional", "Ensalada de Cecina con Frutos Secos"],
        second_courses: ["Lechazo Churro Guisado", "Bacalao con Pimientos Asados", "Carrillera Ibérica al Vino Tinto"],
        includes: "Pan de leña, Agua o Vino de la casa y Postre casero"
    },

    catalogDishes: [
        { id: 'rest_1', name: 'Tabla de Quesos de Cerrato', description: 'Selección de quesos curados palentinos', price: 14.00, section: 'Entrantes' },
        { id: 'rest_2', name: 'Croquetas de Jamón Ibérico (6 uds)', description: 'Rebozado crujiente y bechamel melosa', price: 9.50, section: 'Entrantes' },
        { id: 'rest_3', name: 'Lechazo Churro Asado de Palencia', description: 'Cuarto de lechazo en horno de leña', price: 26.50, section: 'Carnes' },
        { id: 'rest_4', name: 'Solomillo de Ternera de la Montaña', description: 'A la brasa con guarnición', price: 22.00, section: 'Carnes' },
        { id: 'rest_5', name: 'Bacalao al Ajoarriero con Pimientos', description: 'Lomo confitado con pimientos asados', price: 18.50, section: 'Pescados' }
    ],

    config: {
        lunch_start: '13:00',
        lunch_end: '16:00',
        dinner_start: '20:30',
        dinner_end: '23:30',
        turn_duration_min: 90,
        tables: [
            { id: 1, table_number: 1, capacity: 2, zone: 'Sala Principal' },
            { id: 2, table_number: 2, capacity: 4, zone: 'Sala Principal' },
            { id: 3, table_number: 3, capacity: 6, zone: 'Sala Principal' },
            { id: 4, table_number: 4, capacity: 8, zone: 'Sala Principal' },
            { id: 5, table_number: 5, capacity: 2, zone: 'Terraza' },
            { id: 6, table_number: 6, capacity: 4, zone: 'Terraza' },
            { id: 7, table_number: 7, capacity: 6, zone: 'Terraza' },
            { id: 8, table_number: 8, capacity: 8, zone: 'Terraza' }
        ]
    }
};

// =======================================================
// 1. HUB PRINCIPAL DEL RESTAURANTE (VISTA PÚBLICA)
// =======================================================
window.renderRestaurantHub = function(container) {
    if (!container) return;

    window.drawRestaurantHubHTML(container);

    window.loadRestaurantLiveCatalog().then(() => {
        window.drawRestaurantHubHTML(container);
    });
    window.loadRestaurantSettingsFromDB().then(() => {
        window.drawRestaurantHubHTML(container);
    });
};

window.drawRestaurantHubHTML = function(container) {
    if (!container) return;

    const isMenuActive = window.restaurantState.dailyMenu?.active;
    const menuPrice = window.restaurantState.dailyMenu?.price || 14.50;
    const totalDishes = window.restaurantState.catalogDishes.length;

    container.innerHTML = `
        <div class="space-y-4">
            <!-- 1. Menú del Día -->
            <button onclick="window.openDailyMenuModal()" class="w-full p-4 rounded-3xl bg-neutral-50 hover:bg-neutral-100 border border-neutral-200/80 flex items-center justify-between shadow-sm active:scale-[0.98] transition group">
                <div class="flex items-center space-x-3.5">
                    <div class="w-10 h-10 rounded-2xl bg-black text-white flex items-center justify-center shadow-md shrink-0">
                        <i data-lucide="chef-hat" class="w-5 h-5 text-amber-400"></i>
                    </div>
                    <div class="text-left">
                        <div class="flex items-center space-x-2">
                            <span class="block text-xs font-bold text-black tracking-tight">Menú del Día</span>
                            ${isMenuActive 
                                ? `<span class="text-[9px] bg-emerald-500/10 text-emerald-600 font-bold px-2 py-0.5 rounded-full border border-emerald-500/20">${menuPrice.toFixed(2)} €</span>` 
                                : '<span class="text-[9px] bg-neutral-200 text-neutral-600 font-bold px-2 py-0.5 rounded-full">No disponible</span>'}
                        </div>
                        <span class="block text-[10px] text-neutral-400 mt-0.5">Primero, segundo, postre y bebida incluida</span>
                    </div>
                </div>
                <div class="w-7 h-7 rounded-full bg-white border border-neutral-200/60 flex items-center justify-center text-neutral-400 group-hover:text-black transition shrink-0 ml-2">
                    <i data-lucide="chevron-right" class="w-4 h-4"></i>
                </div>
            </button>

            <!-- 2. Reservar Mesa -->
            <button onclick="window.openModernReservationModal()" class="w-full p-4 rounded-3xl bg-neutral-50 hover:bg-neutral-100 border border-neutral-200/80 flex items-center justify-between shadow-sm active:scale-[0.98] transition group">
                <div class="flex items-center space-x-3.5">
                    <div class="w-10 h-10 rounded-2xl bg-black text-white flex items-center justify-center shadow-md shrink-0">
                        <i data-lucide="calendar-check" class="w-5 h-5 text-white"></i>
                    </div>
                    <div class="text-left">
                        <div class="flex items-center space-x-2">
                            <span class="block text-xs font-bold text-black tracking-tight">Reservar Mesa</span>
                            <span class="text-[9px] bg-black text-white font-mono px-2 py-0.5 rounded-full">En Vivo</span>
                        </div>
                        <span class="block text-[10px] text-neutral-400 mt-0.5">Disponibilidad por turnos y aforo</span>
                    </div>
                </div>
                <div class="w-7 h-7 rounded-full bg-white border border-neutral-200/60 flex items-center justify-center text-neutral-400 group-hover:text-black transition shrink-0 ml-2">
                    <i data-lucide="chevron-right" class="w-4 h-4"></i>
                </div>
            </button>

            <!-- 3. Carta Digital Completa -->
            <button onclick="window.openCategorizedMenuPage('Entrantes')" class="w-full p-4 rounded-3xl bg-neutral-50 hover:bg-neutral-100 border border-neutral-200/80 flex items-center justify-between shadow-sm active:scale-[0.98] transition group">
                <div class="flex items-center space-x-3.5">
                    <div class="w-10 h-10 rounded-2xl bg-black text-white flex items-center justify-center shadow-md shrink-0">
                        <i data-lucide="book-open" class="w-5 h-5 text-white"></i>
                    </div>
                    <div class="text-left">
                        <div class="flex items-center space-x-2">
                            <span class="block text-xs font-bold text-black tracking-tight">Carta Digital Completa</span>
                            <span class="text-[9px] bg-neutral-200 text-neutral-700 font-mono font-bold px-2 py-0.5 rounded-full">${totalDishes} platos</span>
                        </div>
                        <span class="block text-[10px] text-neutral-400 mt-0.5">Entrantes, Carnes, Pescados, Bodega y Postres</span>
                    </div>
                </div>
                <div class="w-7 h-7 rounded-full bg-white border border-neutral-200/60 flex items-center justify-center text-neutral-400 group-hover:text-black transition shrink-0 ml-2">
                    <i data-lucide="chevron-right" class="w-4 h-4"></i>
                </div>
            </button>
        </div>
    `;

    if (typeof lucide !== 'undefined') lucide.createIcons();
};

// =======================================================
// 2. VISTA DEDICADA DE CARTA COMPLETA
// =======================================================
window.openCategorizedMenuPage = function(category = 'Entrantes') {
    const page = document.getElementById('view-restaurant-menu');
    if (!page) return;

    window.restaurantState.activeMenuCategory = category;
    
    const bizTitle = document.getElementById('restaurantMenuBizTitle');
    if (bizTitle && window.appState?.activeBusinessName) {
        bizTitle.innerText = window.appState.activeBusinessName;
    }

    page.classList.remove('hidden');
    page.classList.add('flex');
    
    window.switchMenuCategory(category);
};

window.closeCategorizedMenuPage = function() {
    const page = document.getElementById('view-restaurant-menu');
    if (page) {
        page.classList.add('hidden');
        page.classList.remove('flex');
    }
};

window.switchMenuCategory = function(catId) {
    window.restaurantState.activeMenuCategory = catId;
    
    const tabs = [
        { id: 'Entrantes', btn: 'tab-btn-Entrantes' },
        { id: 'Carnes', btn: 'tab-btn-Carnes' },
        { id: 'Pescados', btn: 'tab-btn-Pescados' },
        { id: 'Bebidas & Vinos', btn: 'tab-btn-Bebidas' },
        { id: 'Postres', btn: 'tab-btn-Postres' }
    ];

    tabs.forEach(t => {
        const el = document.getElementById(t.btn);
        if (el) {
            if (t.id === catId) {
                el.className = "px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition bg-black text-white shadow-sm";
            } else {
                el.className = "px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition bg-neutral-100 text-neutral-600 hover:text-black";
            }
        }
    });

    const container = document.getElementById('fullMenuDishesList');
    if (container) {
        container.innerHTML = window.renderDishesForActiveCategory();
        if (typeof lucide !== 'undefined') lucide.createIcons();
    }
};

window.renderDishesForActiveCategory = function() {
    const activeCat = window.restaurantState.activeMenuCategory;
    const allDishes = window.restaurantState.catalogDishes;

    const filtered = allDishes.filter(d => {
        const dSection = (d.section || '').toLowerCase();
        const active = activeCat.toLowerCase();
        
        if (active.includes('entrante')) return dSection.includes('entrante') || dSection.includes('tapa');
        if (active.includes('carne')) return dSection.includes('carne') || dSection.includes('lechazo') || dSection.includes('ternera');
        if (active.includes('pescado')) return dSection.includes('pescado') || dSection.includes('mar');
        if (active.includes('bebida') || active.includes('vino')) return dSection.includes('bebida') || dSection.includes('vino') || dSection.includes('bodega');
        if (active.includes('postre')) return dSection.includes('postre') || dSection.includes('dulce');
        
        return dSection === active;
    });

    if (filtered.length === 0) {
        return `
            <div class="py-16 text-center space-y-2 bg-neutral-50 rounded-3xl border border-neutral-100">
                <i data-lucide="utensils" class="w-6 h-6 mx-auto text-neutral-300"></i>
                <p class="text-xs font-bold text-neutral-500">No hay platos en ${activeCat}</p>
                <p class="text-[10px] text-neutral-400">Los platos dados de alta en el panel aparecerán aquí.</p>
            </div>
        `;
    }

    return filtered.map(dish => {
        const itemIdStr = String(dish.id);
        const existingInCart = (window.appState?.cartItemsList || []).find(i => String(i.id) === itemIdStr);
        const qty = existingInCart ? existingInCart.qty : 0;
        const price = parseFloat(dish.price) || 0;

        return `
            <div class="p-4 rounded-3xl border border-neutral-200/80 bg-neutral-50 flex items-center justify-between transition hover:border-black/20">
                <div class="space-y-1 max-w-[65%] pr-2">
                    <h4 class="text-xs font-bold text-black truncate">${dish.name}</h4>
                    <p class="text-[10px] text-neutral-400 line-clamp-2">${dish.description || ''}</p>
                    <span class="text-xs font-extrabold text-black font-mono block pt-0.5">${price.toFixed(2)} €</span>
                </div>
                <div id="btn-container-${dish.id}" class="flex items-center space-x-2 shrink-0">
                    ${typeof renderItemButtonHTML === 'function' ? renderItemButtonHTML(dish.id, encodeURIComponent(itemIdStr), encodeURIComponent(dish.name), price, qty) : `
                        <button onclick="window.changeItemQuantity('${dish.id}', '${encodeURIComponent(dish.name)}', ${price}, 1)" class="w-9 h-9 rounded-2xl bg-black text-white font-bold flex items-center justify-center active:scale-90 transition shadow-sm">
                            +
                        </button>
                    `}
                </div>
            </div>
        `;
    }).join('');
};

// =======================================================
// 3. CARGA DE CATÁLOGO Y CONFIGURACIÓN EN SEGUNDO PLANO
// =======================================================
window.loadRestaurantLiveCatalog = async function() {
    const client = (typeof supabaseClient !== 'undefined') ? supabaseClient : window.supabase;
    const bizName = (window.appState?.activeBusinessName || 'Restaurante Dani').trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    if (!client) return;

    try {
        const { data, error } = await client.from('products').select('*');
        if (!error && data) {
            const filtered = data.filter(p => {
                const bId = String(p.business_id || '').trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
                return bId === bizName || bId.includes('restaurante');
            });

            if (filtered.length > 0) {
                window.restaurantState.catalogDishes = filtered;
            }
        }
    } catch (e) {
        console.warn("Aviso consultando carta:", e);
    }
};

window.loadRestaurantSettingsFromDB = async function() {
    const client = (typeof supabaseClient !== 'undefined') ? supabaseClient : window.supabase;
    const bizName = window.appState?.activeBusinessName || 'Restaurante Dani';
    if (!client) return;

    try {
        const { data } = await client
            .from('restaurant_settings')
            .select('*')
            .ilike('business_name', `%${bizName}%`)
            .maybeSingle();

        if (data) {
            window.restaurantState.config = {
                lunch_start: data.lunch_start || '13:00',
                lunch_end: data.lunch_end || '16:00',
                dinner_start: data.dinner_start || '20:30',
                dinner_end: data.dinner_end || '23:30',
                turn_duration_min: data.turn_duration_min || 90,
                tables: data.tables || window.restaurantState.config.tables
            };
            if (data.daily_menu) {
                window.restaurantState.dailyMenu = data.daily_menu;
            }
        }
    } catch (e) {
        console.warn("Aviso cargando configuración de BD:", e);
    }
};

// =======================================================
// 4. SESIÓN DE MESA EN PANTALLA COMPLETA
// =======================================================
window.openTableSessionView = async function(bizName, tableNumber) {
    if (typeof window.closeCustomModal === 'function') window.closeCustomModal();

    window.appState = window.appState || {};
    window.appState.activeBusinessName = bizName;
    window.appState.activeTableNumber = tableNumber;

    let page = document.getElementById('view-table-session');
    if (!page) {
        page = document.createElement('div');
        page.id = 'view-table-session';
        page.className = 'absolute inset-0 bg-white z-40 flex flex-col allow-scroll px-6 pt-20 pb-28 space-y-4';
        document.getElementById('mainContentArea').appendChild(page);
    }

    page.classList.remove('hidden');
    page.classList.add('flex');
    page.scrollTop = 0;

    await window.loadRestaurantLiveCatalog();
    await window.loadRestaurantSettingsFromDB();

    let session = null;
    try {
        const client = (typeof supabaseClient !== 'undefined') ? supabaseClient : window.supabase;
        if (client) {
            const { data } = await client
                .from('table_sessions')
                .select('*')
                .ilike('business_name', `%${bizName}%`)
                .eq('table_number', tableNumber)
                .eq('status', 'open')
                .maybeSingle();

            session = data || null;
        }
    } catch (err) {
        console.warn("Aviso cargando comanda de mesa:", err);
    }

    window.restaurantState.currentTableSession = session;
    window.subscribeToTableSession(bizName, tableNumber);
    window.renderTableSessionUI(bizName, tableNumber);
};

window.closeTableSessionView = function() {
    const page = document.getElementById('view-table-session');
    if (page) {
        page.classList.add('hidden');
        page.classList.remove('flex');
    }
    if (typeof switchTab === 'function') switchTab('home');
};

window.renderTableSessionUI = function(bizName, tableNumber) {
    const container = document.getElementById('view-table-session');
    if (!container) return;

    const session = window.restaurantState.currentTableSession;
    const cart = window.appState?.cartItemsList || [];
    const cartTotal = cart.reduce((acc, i) => acc + (i.price * i.qty), 0);
    const dishes = window.restaurantState.catalogDishes;
    const dailyMenu = window.restaurantState.dailyMenu;
    const menuPrice = dailyMenu?.price || 14.50;

    let sessionHeaderHTML = `
        <div class="flex items-center justify-between border-b border-neutral-100 pb-3 shrink-0">
            <div class="flex items-center space-x-3">
                <button onclick="window.closeTableSessionView()" class="w-10 h-10 rounded-2xl bg-neutral-100 flex items-center justify-center text-black active:scale-95 transition">
                    <i data-lucide="arrow-left" class="w-5 h-5"></i>
                </button>
                <div>
                    <span class="text-[9px] font-mono uppercase tracking-widest text-neutral-400 font-bold block">${bizName.toUpperCase()}</span>
                    <h2 class="text-xl font-black text-black tracking-tight">Mesa ${tableNumber}</h2>
                </div>
            </div>
            <span class="text-[9px] font-mono bg-emerald-50 text-emerald-700 font-bold px-2.5 py-1 rounded-full border border-emerald-200/60">EN VIVO</span>
        </div>
    `;

    if (!session) {
        container.innerHTML = `
            ${sessionHeaderHTML}

            <div class="p-4 bg-neutral-50 rounded-3xl border border-neutral-200/70 space-y-2">
                <div class="flex justify-between items-center">
                    <div class="flex items-center space-x-2">
                        <i data-lucide="chef-hat" class="w-4 h-4 text-amber-500"></i>
                        <span class="text-xs font-bold text-black">Menú del Día</span>
                    </div>
                    <span class="text-xs font-mono font-extrabold text-black">${menuPrice.toFixed(2)} €</span>
                </div>
                <p class="text-[10px] text-neutral-500">Incluye primero, segundo, postre y pan de leña.</p>
                <button onclick="window.openDailyMenuModal()" class="w-full py-2 bg-white border border-neutral-200 rounded-xl text-xs font-bold text-black hover:border-black transition active:scale-95 shadow-2xs">
                    Ver Platos del Menú
                </button>
            </div>

            <div class="space-y-2 flex-1">
                <div class="flex justify-between items-center px-1">
                    <span class="text-[10px] font-mono uppercase tracking-widest text-neutral-400 font-bold">Carta & Raciones</span>
                    <button onclick="window.openCategorizedMenuPage('Entrantes')" class="text-[10px] font-bold text-black underline">Ver por categorías</button>
                </div>

                <div class="space-y-2 max-h-72 overflow-y-auto pr-1 allow-scroll">
                    ${dishes.map(d => {
                        const pPrice = parseFloat(d.price) || 0;
                        return `
                            <div class="flex items-center justify-between p-3.5 bg-neutral-50 rounded-2xl border border-neutral-200/70 text-xs">
                                <div class="pr-2 truncate">
                                    <span class="font-bold text-black block truncate">${d.name}</span>
                                    <span class="font-mono text-[10px] text-neutral-500">${pPrice.toFixed(2)} € • ${d.section || 'Plato'}</span>
                                </div>
                                <button onclick="window.addDishToTableCart('${d.id}', '${encodeURIComponent(d.name)}', ${pPrice}, '${bizName}', ${tableNumber})" class="px-3 py-1.5 bg-black text-white font-bold rounded-xl text-[11px] active:scale-95 transition shrink-0 shadow-sm">
                                    + Añadir
                                </button>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>

            ${cart.length > 0 ? `
                <div class="p-4 bg-black text-white rounded-3xl space-y-3 shadow-xl">
                    <div class="flex justify-between items-center text-xs font-bold border-b border-white/10 pb-2">
                        <span>Tu comanda para la mesa (${cart.length} platos)</span>
                        <span class="font-mono text-sm">${cartTotal.toFixed(2)} €</span>
                    </div>
                    <div class="text-[11px] text-neutral-300 truncate">
                        ${cart.map(i => `${i.qty}x ${i.name}`).join(', ')}
                    </div>
                    <button onclick="window.sendOrderToKitchen('${bizName}', ${tableNumber})" class="w-full py-3 bg-white text-black font-extrabold rounded-2xl text-xs active:scale-95 transition flex items-center justify-center space-x-2 shadow-md">
                        <i data-lucide="send" class="w-4 h-4"></i>
                        <span>Pedir a Cocina (${cartTotal.toFixed(2)} €)</span>
                    </button>
                </div>
            ` : `
                <div class="p-3 bg-neutral-50 rounded-2xl border border-neutral-100 text-center">
                    <p class="text-[11px] text-neutral-400">Selecciona los platos que vais a consumir en la mesa.</p>
                </div>
            `}
        `;
    } else {
        const total = parseFloat(session.total_amount) || 0;
        const paid = parseFloat(session.paid_amount) || 0;
        const remaining = Math.max(0, total - paid);
        const percent = total > 0 ? Math.min(100, Math.round((paid / total) * 100)) : 0;
        const payers = session.payers || [];

        container.innerHTML = `
            ${sessionHeaderHTML}

            <div class="p-5 bg-neutral-50 rounded-[32px] border border-neutral-200/80 space-y-3 shadow-sm">
                <div class="flex justify-between items-center text-xs font-mono">
                    <span class="text-neutral-500">Total cuenta: <strong>${total.toFixed(2)} €</strong></span>
                    <span class="font-black ${remaining === 0 ? 'text-emerald-600' : 'text-black'}">Pendiente: ${remaining.toFixed(2)} €</span>
                </div>
                <div class="w-full h-3.5 bg-neutral-200 rounded-full overflow-hidden">
                    <div class="h-full bg-emerald-500 transition-all duration-500" style="width: ${percent}%"></div>
                </div>
                <span class="text-[10px] text-neutral-400 font-mono block text-center">${percent}% liquidado (${paid.toFixed(2)} € abonados)</span>
            </div>

            <div class="space-y-2 flex-1">
                <span class="text-[10px] font-mono uppercase tracking-widest text-neutral-400 font-bold block">Aportaciones de los comensales</span>
                <div class="space-y-1.5 max-h-40 overflow-y-auto pr-1 allow-scroll">
                    ${payers.length > 0 ? payers.map(p => `
                        <div class="flex justify-between items-center text-xs p-3 bg-neutral-50 rounded-2xl border border-neutral-100">
                            <span class="font-bold text-black truncate max-w-[200px]">${p.name}</span>
                            <span class="font-mono font-black text-emerald-600">+${parseFloat(p.amount).toFixed(2)} €</span>
                        </div>
                    `).join('') : '<p class="text-xs text-neutral-400 text-center py-4">Aún no hay pagos registrados para esta mesa.</p>'}
                </div>
            </div>

            ${remaining > 0 ? `
                <div class="space-y-2 pt-2 border-t border-neutral-100">
                    <label class="text-[10px] font-mono uppercase text-neutral-400 block font-bold">Abonar parte personalizada</label>
                    <div class="flex space-x-2">
                        <input type="number" step="0.50" id="customSplitAmount" value="${(remaining > 10 ? 10 : remaining).toFixed(2)}" max="${remaining}" class="w-1/2 bg-neutral-50 border border-neutral-200 rounded-xl px-3 py-2 text-xs font-mono font-bold focus:border-black outline-none">
                        <button onclick="window.paySplitBill('${session.id}', ${tableNumber}, document.getElementById('customSplitAmount').value)" class="w-1/2 py-2.5 bg-black text-white font-bold rounded-xl text-xs active:scale-95 transition shadow-sm">
                            Pagar Mi Parte
                        </button>
                    </div>
                    <button onclick="window.paySplitBill('${session.id}', ${tableNumber}, ${remaining})" class="w-full py-3.5 bg-neutral-100 hover:bg-neutral-200 text-black font-extrabold rounded-2xl text-xs transition">
                        Pagar Todo lo Restante (${remaining.toFixed(2)} €)
                    </button>
                </div>
            ` : `
                <div class="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-3xl text-center space-y-1">
                    <i data-lucide="check-circle-2" class="w-6 h-6 text-emerald-600 mx-auto"></i>
                    <p class="text-sm font-black text-emerald-700">¡Cuenta totalmente pagada!</p>
                    <p class="text-[10px] text-neutral-500">Recibos digitales enviados a los correos de los comensales.</p>
                </div>
            `}
        `;
    }

    if (typeof lucide !== 'undefined') lucide.createIcons();
};

window.addDishToTableCart = function(id, encName, price, bizName, tableNumber) {
    const name = decodeURIComponent(encName);
    window.appState = window.appState || {};
    window.appState.cartItemsList = window.appState.cartItemsList || [];

    const existing = window.appState.cartItemsList.find(i => String(i.id) === String(id));
    if (existing) {
        existing.qty += 1;
    } else {
        window.appState.cartItemsList.push({ id, name, price: parseFloat(price), qty: 1 });
    }

    window.renderTableSessionUI(bizName, tableNumber);
};

window.sendOrderToKitchen = async function(bizName, tableNumber) {
    const cart = window.appState?.cartItemsList || [];
    if (cart.length === 0) return;

    const total = cart.reduce((acc, i) => acc + (i.price * i.qty), 0);
    const client = (typeof supabaseClient !== 'undefined') ? supabaseClient : window.supabase;
    const customerUser = typeof currentUser !== 'undefined' ? currentUser : null;
    const customerName = customerUser?.user_metadata?.full_name || customerUser?.email || 'Comensal';

    const sessionPayload = {
        business_name: bizName,
        table_number: tableNumber,
        items: cart,
        total_amount: total,
        paid_amount: 0.00,
        remaining_amount: total,
        status: 'open',
        payers: []
    };

    if (client) {
        try {
            const { data, error } = await client.from('table_sessions').insert([sessionPayload]).select().single();
            if (!error && data) {
                window.restaurantState.currentTableSession = data;
            }

            await client.from('orders').insert([{
                business_name: bizName,
                customer: `${customerName} (Mesa ${tableNumber})`,
                items: cart.map(i => `${i.qty}x ${i.name}`).join(', '),
                total: total,
                date: new Date().toISOString().split('T')[0],
                time: new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }),
                status: 'Comanda en Cocina'
            }]);
        } catch (e) {
            console.warn("Aviso registrando comanda:", e);
        }
    }

    if (!window.restaurantState.currentTableSession) {
        window.restaurantState.currentTableSession = { ...sessionPayload, id: 'temp_' + Date.now() };
    }

    if (window.emailService) {
        const bizEmail = window.appState?.activeBusinessEmail || 'contacto@netwish.es';
        window.emailService.sendBusinessAlert(bizEmail, {
            businessName: bizName,
            clientName: `Comensales Mesa ${tableNumber}`,
            date: new Date().toISOString().split('T')[0],
            time: new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }),
            items: cart,
            total: total,
            action: 'comanda'
        });
    }

    window.appState.cartItemsList = [];
    window.renderTableSessionUI(bizName, tableNumber);
    if (typeof window.showToast === 'function') {
        window.showToast(`¡Comanda enviada a cocina!`, "success");
    } else {
        alert(`¡Comanda enviada a cocina!`);
    }
};

window.paySplitBill = async function(sessionId, tableNumber, amountVal) {
    const amount = parseFloat(amountVal);
    if (isNaN(amount) || amount <= 0) {
        alert("Introduce un importe válido.");
        return;
    }

    const session = window.restaurantState.currentTableSession;
    if (!session) return;

    const total = parseFloat(session.total_amount) || 0;
    const currentPaid = parseFloat(session.paid_amount) || 0;
    const newPaid = Math.min(total, currentPaid + amount);
    const newRemaining = Math.max(0, total - newPaid);
    const isFullyPaid = newRemaining === 0;

    const customerUser = typeof currentUser !== 'undefined' ? currentUser : null;
    const payerName = customerUser?.user_metadata?.full_name || customerUser?.email || `Comensal ${session.payers?.length + 1 || 1}`;
    const payerEmail = customerUser?.email || '';

    const newPayers = [...(session.payers || []), {
        name: payerName,
        email: payerEmail,
        amount: amount,
        time: new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
    }];

    const client = (typeof supabaseClient !== 'undefined') ? supabaseClient : window.supabase;
    if (client && !String(sessionId).startsWith('temp_')) {
        try {
            await client.from('table_sessions').update({
                paid_amount: newPaid,
                remaining_amount: newRemaining,
                status: isFullyPaid ? 'paid' : 'open',
                payers: newPayers,
                updated_at: new Date().toISOString()
            }).eq('id', sessionId);
        } catch (e) {
            console.warn("Aviso actualizando pago en mesa:", e);
        }
    }

    session.paid_amount = newPaid;
    session.remaining_amount = newRemaining;
    session.status = isFullyPaid ? 'paid' : 'open';
    session.payers = newPayers;

    if (isFullyPaid && window.emailService) {
        const orderSummary = {
            businessName: session.business_name,
            clientName: `Mesa ${tableNumber} (Cuenta Completa)`,
            date: new Date().toISOString().split('T')[0],
            time: new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }),
            items: session.items,
            total: total,
            action: 'paid_table'
        };

        newPayers.forEach(p => {
            if (p.email) window.emailService.sendClientReceipt(p.email, orderSummary);
        });

        const bizEmail = window.appState?.activeBusinessEmail || 'contacto@netwish.es';
        window.emailService.sendBusinessAlert(bizEmail, {
            ...orderSummary,
            action: 'table_settled'
        });
    }

    window.renderTableSessionUI(session.business_name, tableNumber);
};

window.subscribeToTableSession = function(bizName, tableNumber) {
    const client = (typeof supabaseClient !== 'undefined') ? supabaseClient : window.supabase;
    if (!client || typeof client.channel !== 'function') return;

    if (window.restaurantState.sessionRealtimeSub) {
        window.restaurantState.sessionRealtimeSub.unsubscribe();
    }

    window.restaurantState.sessionRealtimeSub = client
        .channel(`table_session:${tableNumber}`)
        .on('postgres_changes', { 
            event: '*', 
            schema: 'public', 
            table: 'table_sessions',
            filter: `table_number=eq.${tableNumber}` 
        }, payload => {
            if (payload.new) {
                window.restaurantState.currentTableSession = payload.new;
                window.renderTableSessionUI(bizName, tableNumber);
            }
        })
        .subscribe();
};

// =======================================================
// 5. RESERVAS CON BOTÓN DE MANTENER PULSADO Y ESTADO DIFERIDO
// =======================================================
window.openModernReservationModal = async function() {
    const today = new Date().toISOString().split('T')[0];
    if (!window.restaurantState.selectedDate) window.restaurantState.selectedDate = today;

    await window.loadRestaurantSettingsFromDB();

    window.openModalCustom(`
        <div class="space-y-4 text-left">
            <div class="flex items-center justify-between border-b border-neutral-100 pb-3">
                <div>
                    <span class="text-[9px] font-mono uppercase tracking-widest text-neutral-400">NETWISH HOSTELERÍA</span>
                    <h3 class="text-sm font-bold text-black">Reserva de Mesa</h3>
                </div>
                <button onclick="window.closeCustomModal()" class="w-7 h-7 rounded-full bg-neutral-100 flex items-center justify-center text-neutral-500 hover:text-black">
                    <i data-lucide="x" class="w-4 h-4"></i>
                </button>
            </div>

            <div class="space-y-3">
                <div>
                    <label class="text-[9px] font-mono uppercase text-neutral-400 block mb-1">Nº Comensales Exacto</label>
                    <div class="flex items-center justify-between p-2 rounded-2xl bg-neutral-50 border border-neutral-200/80">
                        <button onclick="window.stepGuests(-1)" class="w-9 h-9 rounded-xl bg-white border border-neutral-200 text-black font-extrabold text-base flex items-center justify-center active:scale-90 transition shadow-sm">-</button>
                        <div class="flex items-center space-x-1.5">
                            <span id="guestsExactCount" class="text-base font-extrabold font-mono text-black">${window.restaurantState.selectedGuests}</span>
                            <span class="text-xs font-medium text-neutral-400">personas</span>
                        </div>
                        <button onclick="window.stepGuests(1)" class="w-9 h-9 rounded-xl bg-black text-white font-extrabold text-base flex items-center justify-center active:scale-90 transition shadow-md">+</button>
                    </div>
                </div>

                <div class="grid grid-cols-2 gap-2">
                    <div>
                        <label class="text-[9px] font-mono uppercase text-neutral-400 block mb-1">Fecha</label>
                        <input type="date" id="resvDateInput" value="${window.restaurantState.selectedDate}" min="${today}" onchange="window.updateReservationDate(this.value)" class="w-full bg-white border border-neutral-200 rounded-xl px-2.5 py-2 text-xs text-black font-medium focus:border-black outline-none">
                    </div>
                    <div>
                        <label class="text-[9px] font-mono uppercase text-neutral-400 block mb-1">Zona</label>
                        <select id="resvZoneInput" onchange="window.updateReservationZone(this.value)" class="w-full bg-white border border-neutral-200 rounded-xl px-2 py-2 text-xs text-black font-medium focus:border-black outline-none">
                            <option value="Sala Principal" ${window.restaurantState.selectedZone === 'Sala Principal' ? 'selected' : ''}>Sala Principal</option>
                            <option value="Terraza" ${window.restaurantState.selectedZone === 'Terraza' ? 'selected' : ''}>Terraza</option>
                        </select>
                    </div>
                </div>

                <div>
                    <div class="flex justify-between items-center mb-1.5">
                        <label class="text-[9px] font-mono uppercase text-neutral-400 block">Horas Disponibles</label>
                        <span class="text-[9px] font-mono text-neutral-400" id="durationHint">Estancia: ${window.restaurantState.config.turn_duration_min} min</span>
                    </div>
                    <div class="grid grid-cols-3 gap-2" id="timeSlotsGrid">
                        <div class="col-span-3 py-4 text-center text-xs text-neutral-400">
                            <i data-lucide="loader-2" class="w-4 h-4 mx-auto animate-spin mb-1"></i>
                            Calculando disponibilidad...
                        </div>
                    </div>
                </div>
            </div>

            <!-- BOTÓN DE MANTENER PULSADO PARA CONFIRMAR RESERVA -->
            <div id="holdReservationContainer" class="relative w-full h-14 bg-black rounded-2xl overflow-hidden shadow-lg cursor-pointer flex items-center justify-center select-none" style="touch-action: none;">
                <div id="reservationProgressBar" class="absolute top-0 left-0 bottom-0 w-0 bg-emerald-500 pointer-events-none transition-[width] duration-75"></div>
                <span class="relative z-10 text-white font-bold text-xs tracking-widest uppercase pointer-events-none" id="holdResvText">MANTENER PARA RESERVAR</span>
            </div>
        </div>
    `);

    await window.recalculateSlotsAvailability();
    window.initHoldReservationButton();
};

window.generateSlotsFromSettings = function() {
    const cfg = window.restaurantState.config;
    const slots = [];

    const addRange = (startStr, endStr) => {
        let current = window.timeToMinutes(startStr);
        const end = window.timeToMinutes(endStr);
        while (current + cfg.turn_duration_min <= end + 30) {
            slots.push(window.minutesToTime(current));
            current += 30;
        }
    };

    if (cfg.lunch_start && cfg.lunch_end) addRange(cfg.lunch_start, cfg.lunch_end);
    if (cfg.dinner_start && cfg.dinner_end) addRange(cfg.dinner_start, cfg.dinner_end);

    return slots;
};

window.recalculateSlotsAvailability = async function() {
    const slotsGrid = document.getElementById('timeSlotsGrid');
    if (!slotsGrid) return;

    const date = window.restaurantState.selectedDate;
    const guests = window.restaurantState.selectedGuests;
    const zone = window.restaurantState.selectedZone;
    const duration = window.restaurantState.config.turn_duration_min;
    
    const client = (typeof supabaseClient !== 'undefined') ? supabaseClient : window.supabase;
    const bizName = window.appState?.activeBusinessName || 'Restaurante Dani';
    let existingReservations = [];

    if (client) {
        try {
            const { data } = await client
                .from('orders')
                .select('items, time, date')
                .ilike('business_name', `%${bizName}%`)
                .eq('date', date);

            if (data) {
                existingReservations = data.map(row => {
                    const timeMatch = (row.time || '').match(/(\d{2}:\d{2})\s*-\s*(\d{2}:\d{2})/);
                    const tableMatch = (row.items || '').match(/Mesa\s+(\d+)/i);
                    return {
                        startTime: timeMatch ? timeMatch[1] : (row.time?.substring(0, 5) || '13:00'),
                        endTime: timeMatch ? timeMatch[2] : null,
                        tableNumber: tableMatch ? parseInt(tableMatch[1], 10) : null
                    };
                });
            }
        } catch (e) {
            console.warn("Aviso consultando reservas previas:", e);
        }
    }

    const availableSlots = window.generateSlotsFromSettings();
    let validSlotsHTML = '';
    let isCurrentTimeValid = false;

    availableSlots.forEach(timeSlot => {
        const slotStartMin = window.timeToMinutes(timeSlot);
        const slotEndMin = slotStartMin + duration;

        const candidateTables = window.restaurantState.config.tables
            .filter(t => t.zone.toLowerCase() === zone.toLowerCase() && t.capacity >= guests)
            .sort((a, b) => a.capacity - b.capacity);

        let assignedTable = null;

        for (let table of candidateTables) {
            const hasOverlap = existingReservations.some(res => {
                if (res.tableNumber !== table.table_number) return false;
                const resStartMin = window.timeToMinutes(res.startTime);
                const resEndMin = res.endTime ? window.timeToMinutes(res.endTime) : (resStartMin + duration);
                return (slotStartMin < resEndMin && slotEndMin > resStartMin);
            });

            if (!hasOverlap) {
                assignedTable = table;
                break;
            }
        }

        const isAvailable = assignedTable !== null;
        if (window.restaurantState.selectedTime === timeSlot && isAvailable) {
            isCurrentTimeValid = true;
            window.restaurantState.allocatedTable = assignedTable;
        }

        if (isAvailable) {
            const isSelected = window.restaurantState.selectedTime === timeSlot;
            validSlotsHTML += `
                <button onclick="window.selectReservationTime('${timeSlot}', ${assignedTable.table_number})" id="slot-btn-${timeSlot.replace(':', '')}" class="py-2.5 px-1 rounded-xl border text-xs font-mono font-bold transition ${isSelected ? 'bg-black text-white border-black shadow-sm' : 'bg-white text-black border-neutral-200 hover:border-black'}">
                    ${timeSlot}
                </button>
            `;
        } else {
            validSlotsHTML += `
                <div class="py-2.5 px-1 rounded-xl border border-neutral-200/50 bg-neutral-100/60 text-center opacity-40 cursor-not-allowed">
                    <span class="text-xs font-mono text-neutral-400 line-through">${timeSlot}</span>
                </div>
            `;
        }
    });

    slotsGrid.innerHTML = validSlotsHTML;

    if (!isCurrentTimeValid) {
        const firstBtn = slotsGrid.querySelector('button');
        if (firstBtn) {
            firstBtn.click();
        } else {
            window.restaurantState.allocatedTable = null;
        }
    }
};

window.stepGuests = function(delta) {
    let current = window.restaurantState.selectedGuests + delta;
    if (current < 1) current = 1;
    if (current > 16) current = 16;
    window.restaurantState.selectedGuests = current;
    const el = document.getElementById('guestsExactCount');
    if (el) el.innerText = current;
    window.recalculateSlotsAvailability();
};

window.updateReservationDate = function(val) {
    window.restaurantState.selectedDate = val;
    window.recalculateSlotsAvailability();
};

window.updateReservationZone = function(val) {
    window.restaurantState.selectedZone = val;
    window.recalculateSlotsAvailability();
};

window.selectReservationTime = function(timeStr, tableNum) {
    window.restaurantState.selectedTime = timeStr;
    window.restaurantState.allocatedTable = window.restaurantState.config.tables.find(t => t.table_number === tableNum);

    document.querySelectorAll('#timeSlotsGrid button').forEach(btn => {
        btn.className = "py-2.5 px-1 rounded-xl border text-xs font-mono font-bold transition bg-white text-black border-neutral-200 hover:border-black";
    });

    const activeBtn = document.getElementById(`slot-btn-${timeStr.replace(':', '')}`);
    if (activeBtn) {
        activeBtn.className = "py-2.5 px-1 rounded-xl border text-xs font-mono font-bold transition bg-black text-white border-black shadow-sm";
    }
};

window.initHoldReservationButton = function() {
    const btnContainer = document.getElementById('holdReservationContainer');
    if (!btnContainer) return;

    let holdTimer = null;
    let holdProgress = 0;
    let isHolding = false;

    const startHold = (e) => {
        if (e.cancelable) e.preventDefault();
        isHolding = true;
        holdProgress = 0;
        const progressBar = document.getElementById('reservationProgressBar');

        clearInterval(holdTimer);
        holdTimer = setInterval(() => {
            if (!isHolding) return;
            holdProgress += 4;
            if (progressBar) progressBar.style.width = holdProgress + '%';

            if (holdProgress >= 100) {
                clearInterval(holdTimer);
                isHolding = false;
                if (progressBar) progressBar.style.width = '0%';
                window.processSmartReservation();
            }
        }, 30);
    };

    const stopHold = () => {
        if (!isHolding) return;
        isHolding = false;
        clearInterval(holdTimer);
        holdProgress = 0;
        const progressBar = document.getElementById('reservationProgressBar');
        if (progressBar) progressBar.style.width = '0%';
    };

    btnContainer.addEventListener('touchstart', startHold, { passive: false });
    btnContainer.addEventListener('touchend', stopHold);
    btnContainer.addEventListener('touchcancel', stopHold);
    btnContainer.addEventListener('mousedown', startHold);
    window.addEventListener('mouseup', stopHold);
    btnContainer.addEventListener('mouseleave', stopHold);
};

window.processSmartReservation = async function() {
    const table = window.restaurantState.allocatedTable;
    const date = window.restaurantState.selectedDate;
    const startTime = window.restaurantState.selectedTime;
    const guests = window.restaurantState.selectedGuests;
    const zone = window.restaurantState.selectedZone;
    const duration = window.restaurantState.config.turn_duration_min;
    const endTime = window.minutesToTime(window.timeToMinutes(startTime) + duration);
    const bizName = window.appState?.activeBusinessName || 'Restaurante Dani';
    
    if (!table) {
        alert("Por favor, selecciona un horario disponible.");
        return;
    }

    const client = (typeof supabaseClient !== 'undefined') ? supabaseClient : window.supabase;
    const customerUser = typeof currentUser !== 'undefined' ? currentUser : null;

    const record = {
        business_name: bizName,
        customer: customerUser?.user_metadata?.full_name || customerUser?.email || 'Cliente NetWish',
        customer_email: customerUser?.email || '',
        items: `Reserva ${guests} pax — Mesa ${table.table_number} (${zone})`,
        total: 0.00,
        date: date,
        time: `${startTime} - ${endTime}`,
        status: 'Pendiente de Aprobación'
    };

    if (client) {
        try {
            await client.from('orders').insert([record]);
        } catch (e) {
            console.warn("Aviso insertando reserva:", e);
        }
    }

    // ÚNICO envío inicial: Informa al cliente que su reserva está pendiente de ser aprobada
    if (window.emailService) {
        const orderSummary = {
            businessName: bizName,
            clientName: record.customer,
            date: date,
            time: `${startTime} h (Estancia hasta ${endTime} h)`,
            items: [{ name: `Solicitud de reserva para ${guests} comensales en ${zone} (Mesa ${table.table_number})`, qty: 1, price: 0 }],
            total: 0,
            action: 'solicitud_reserva'
        };

        if (customerUser?.email) {
            window.emailService.sendClientReceipt(customerUser.email, orderSummary);
        }

        const bizEmail = window.appState?.activeBusinessEmail || 'contacto@netwish.es';
        window.emailService.sendBusinessAlert(bizEmail, orderSummary);
    }

    window.closeCustomModal();
    if (typeof window.showToast === 'function') {
        window.showToast("¡Solicitud enviada! Pendiente de aprobación del local.", "success");
    } else {
        alert(`¡Solicitud enviada con éxito!\n\nFecha: ${date}\nHora: ${startTime} h\nMesa: Mesa ${table.table_number} (${zone})\n\nEl restaurante te confirmará en breve.`);
    }
};

window.openDailyMenuModal = function() {
    const menu = window.restaurantState.dailyMenu;
    const price = menu?.price || 14.50;

    window.openModalCustom(`
        <div class="space-y-4 text-left">
            <div class="flex items-center justify-between border-b border-neutral-100 pb-3">
                <div>
                    <span class="text-[9px] font-mono uppercase tracking-widest text-neutral-400 font-bold">MENÚ DEL DÍA</span>
                    <h3 class="text-sm font-bold text-black font-mono">${price.toFixed(2)} € / Persona</h3>
                </div>
                <button onclick="window.closeCustomModal()" class="w-7 h-7 rounded-full bg-neutral-100 flex items-center justify-center text-neutral-500 hover:text-black">
                    <i data-lucide="x" class="w-4 h-4"></i>
                </button>
            </div>

            <div class="space-y-3 max-h-64 overflow-y-auto pr-1 allow-scroll text-xs">
                <div>
                    <h5 class="font-mono text-[9px] uppercase tracking-wider text-neutral-400 mb-1.5 font-bold">Primeros Platos (A elegir)</h5>
                    <div class="space-y-1 text-neutral-700">
                        ${(menu?.first_courses || []).map(fc => `<p class="p-2 rounded-xl bg-neutral-50 border border-neutral-100/80 font-medium">• ${fc}</p>`).join('')}
                    </div>
                </div>
                <div>
                    <h5 class="font-mono text-[9px] uppercase tracking-wider text-neutral-400 mb-1.5 font-bold">Segundos Platos (A elegir)</h5>
                    <div class="space-y-1 text-neutral-700">
                        ${(menu?.second_courses || []).map(sc => `<p class="p-2 rounded-xl bg-neutral-50 border border-neutral-100/80 font-medium">• ${sc}</p>`).join('')}
                    </div>
                </div>
                <div>
                    <h5 class="font-mono text-[9px] uppercase tracking-wider text-neutral-400 mb-1 font-bold">Incluye</h5>
                    <p class="text-[10px] text-neutral-500">${menu?.includes || 'Pan, bebida y postre incluido.'}</p>
                </div>
            </div>

            <button onclick="window.changeItemQuantity('menu_dia', 'Menú del Día', ${price}, 1); window.closeCustomModal();" class="w-full py-3.5 bg-black text-white rounded-2xl text-xs font-bold active:scale-95 transition shadow-md flex items-center justify-center space-x-2">
                <i data-lucide="plus" class="w-4 h-4"></i>
                <span>Añadir Menú a Mi Pedido (${price.toFixed(2)} €)</span>
            </button>
        </div>
    `);
};

window.timeToMinutes = (str) => { const [h, m] = str.split(':').map(Number); return h * 60 + m; };
window.minutesToTime = (min) => { const h = Math.floor(min / 60).toString().padStart(2, '0'); const m = (min % 60).toString().padStart(2, '0'); return `${h}:${m}`; };