// js/restaurant.js

window.restaurantState = {
    selectedDate: '',
    selectedTime: '',
    selectedGuests: 2,
    selectedZone: 'Sala Principal',
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

    catalogDishes: [],

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

// 1. HUB PRINCIPAL DEL RESTAURANTE
window.renderRestaurantHub = async function(container) {
    if (!container) return;

    await window.loadRestaurantLiveCatalog();
    await window.loadRestaurantSettingsFromDB();

    const isMenuActive = window.restaurantState.dailyMenu?.active;
    const menuPrice = window.restaurantState.dailyMenu?.price || 14.50;

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

            <!-- Acceso: Reserva de Mesa -->
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

            <!-- Carta Digital Dinámica -->
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

// 2. CARGA DE LA CARTA
window.loadRestaurantLiveCatalog = async function() {
    const client = window.supabaseClient || window.supabase;
    const bizName = window.appState?.activeBusinessName || 'Restaurante Dani';
    if (!client) return;

    try {
        const { data, error } = await client.from('products').select('*');
        if (!error && data) {
            const cleanName = bizName.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
            const filtered = data.filter(p => {
                const bId = String(p.business_id || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
                return bId === cleanName || bId.includes('restaurante') || cleanName.includes(bId);
            });

            if (filtered.length > 0) {
                window.restaurantState.catalogDishes = filtered;
            }
        }
    } catch (e) {
        console.warn("Aviso consultando carta:", e);
    }
};

window.renderRestaurantMenuCards = function() {
    const dishes = window.restaurantState.catalogDishes.length > 0 ? window.restaurantState.catalogDishes : [
        { id: 'rest_1', name: 'Tabla de Quesos de Cerrato', description: 'Selección de quesos curados palentinos con mermelada artesana', price: 14.00 },
        { id: 'rest_2', name: 'Lechazo Asado de Palencia', description: 'Cuarto de lechazo churro asado en horno tradicional', price: 26.50 },
        { id: 'rest_3', name: 'Croquetas de Jamón Ibérico (6 uds)', description: 'Rebozado crujiente y bechamel melosa', price: 9.50 },
        { id: 'rest_4', name: 'Brazo de San Antolín', description: 'Postre tradicional hojaldrado con crema pastelera', price: 5.50 }
    ];

    return dishes.map(dish => {
        const itemIdStr = String(dish.id);
        const existingInCart = (window.appState?.cartItemsList || []).find(i => String(i.id) === itemIdStr);
        const qty = existingInCart ? existingInCart.qty : 0;
        const price = parseFloat(dish.price) || 0;

        return `
            <div class="p-4 rounded-3xl border border-neutral-200/80 bg-white shadow-sm flex items-center justify-between transition">
                <div class="space-y-1 max-w-[65%]">
                    <h4 class="text-xs font-bold text-black truncate">${dish.name}</h4>
                    <p class="text-[10px] text-neutral-400 line-clamp-2">${dish.description || ''}</p>
                    <span class="text-xs font-extrabold text-black font-mono block pt-1">${price.toFixed(2)} €</span>
                </div>
                <div id="btn-container-${dish.id}" class="flex items-center space-x-2 shrink-0">
                    ${typeof renderItemButtonHTML === 'function' ? renderItemButtonHTML(dish.id, encodeURIComponent(itemIdStr), encodeURIComponent(dish.name), price, qty) : ''}
                </div>
            </div>
        `;
    }).join('');
};

// ==========================================
// 3. COMANDA Y CUENTA COLABORATIVA EN MESA (SIMULACIÓN DIRECTA)
// ==========================================
window.openTableSessionView = async function(bizName, tableNumber) {
    const modal = document.getElementById('customModal');
    const modalContent = document.getElementById('modalContent');
    const modalBody = document.getElementById('modalBody');
    if (!modal || !modalBody) return;

    modalBody.innerHTML = `
        <div class="space-y-4 text-center py-6">
            <i data-lucide="loader-2" class="w-6 h-6 mx-auto animate-spin text-black mb-2"></i>
            <p class="text-xs text-neutral-500">Conectando con Mesa ${tableNumber}...</p>
        </div>
    `;
    if (typeof lucide !== 'undefined') lucide.createIcons();
    modal.classList.remove('hidden');
    setTimeout(() => { 
        modal.classList.remove('opacity-0'); 
        modalContent?.classList.remove('scale-95'); 
    }, 10);

    window.subscribeToTableSession(bizName, tableNumber);
    await window.fetchTableSessionData(bizName, tableNumber);
};

window.fetchTableSessionData = async function(bizName, tableNumber) {
    const client = window.supabaseClient || window.supabase;
    let session = null;

    if (client) {
        try {
            const { data } = await client
                .from('table_sessions')
                .select('*')
                .ilike('business_name', `%${bizName}%`)
                .eq('table_number', tableNumber)
                .eq('status', 'open')
                .maybeSingle();

            session = data;
        } catch (e) {
            console.warn("Aviso consultando sesión de mesa:", e);
        }
    }

    window.restaurantState.currentTableSession = session;
    window.renderTableSessionUI(bizName, tableNumber);
};

window.renderTableSessionUI = function(bizName, tableNumber) {
    const modalBody = document.getElementById('modalBody');
    if (!modalBody) return;

    const session = window.restaurantState.currentTableSession;
    const cart = window.appState?.cartItemsList || [];
    const cartTotal = cart.reduce((acc, i) => acc + (i.price * i.qty), 0);

    // Caso A: Mesa abierta sin comanda enviada a cocina todavía
    if (!session) {
        modalBody.innerHTML = `
            <div class="space-y-4 text-left">
                <div class="flex items-center justify-between border-b border-neutral-100 pb-3">
                    <div>
                        <span class="text-[9px] font-mono uppercase tracking-widest text-neutral-400 font-bold">${bizName.toUpperCase()}</span>
                        <h3 class="text-sm font-bold text-black">Mesa ${tableNumber} — Comanda</h3>
                    </div>
                    <button onclick="window.closeCustomModal()" class="w-7 h-7 rounded-full bg-neutral-100 flex items-center justify-center text-neutral-500 hover:text-black">
                        <i data-lucide="x" class="w-4 h-4"></i>
                    </button>
                </div>

                <div class="p-4 bg-neutral-50 rounded-2xl border border-neutral-200/70 text-center space-y-2">
                    <i data-lucide="utensils-crossed" class="w-6 h-6 mx-auto text-neutral-400"></i>
                    <p class="text-xs font-bold text-black">Mesa lista para pedir</p>
                    <p class="text-[10px] text-neutral-400">Selecciona platos de la carta y envía la comanda a cocina.</p>
                </div>

                ${cart.length > 0 ? `
                    <div class="space-y-2">
                        <span class="text-[10px] font-mono uppercase text-neutral-400 block">Tu Pedido Actual (${cart.length})</span>
                        <div class="max-h-32 overflow-y-auto space-y-1 pr-1 allow-scroll">
                            ${cart.map(i => `
                                <div class="flex justify-between items-center text-xs p-2 bg-neutral-50 rounded-xl">
                                    <span>${i.qty}x ${i.name}</span>
                                    <span class="font-mono font-bold">${(i.price * i.qty).toFixed(2)} €</span>
                                </div>
                            `).join('')}
                        </div>
                    </div>

                    <button onclick="window.sendOrderToKitchen('${bizName}', ${tableNumber})" class="w-full py-3.5 bg-black text-white font-bold rounded-2xl text-xs shadow-md active:scale-95 transition flex items-center justify-center space-x-2">
                        <i data-lucide="send" class="w-4 h-4"></i>
                        <span>Enviar Comanda a Cocina (${cartTotal.toFixed(2)} €)</span>
                    </button>
                ` : `
                    <button onclick="window.closeCustomModal()" class="w-full py-3.5 bg-black text-white font-bold rounded-2xl text-xs shadow-md active:scale-95 transition">
                        Ver Carta y Añadir Platos
                    </button>
                `}
            </div>
        `;
    } else {
        // Caso B: Comanda activa con cuenta abierta para pagar
        const total = parseFloat(session.total_amount) || 0;
        const paid = parseFloat(session.paid_amount) || 0;
        const remaining = Math.max(0, total - paid);
        const percent = total > 0 ? Math.min(100, Math.round((paid / total) * 100)) : 0;
        const payers = session.payers || [];

        modalBody.innerHTML = `
            <div class="space-y-4 text-left">
                <div class="flex items-center justify-between border-b border-neutral-100 pb-3">
                    <div>
                        <span class="text-[9px] font-mono uppercase tracking-widest text-emerald-600 font-bold">CUENTA EN MESA ABIERTA</span>
                        <h3 class="text-sm font-bold text-black">Mesa ${tableNumber} — Total: ${total.toFixed(2)} €</h3>
                    </div>
                    <button onclick="window.closeCustomModal()" class="w-7 h-7 rounded-full bg-neutral-100 flex items-center justify-center text-neutral-500 hover:text-black">
                        <i data-lucide="x" class="w-4 h-4"></i>
                    </button>
                </div>

                <!-- Barra de Progreso en Tiempo Real -->
                <div class="p-4 bg-neutral-50 rounded-2xl border border-neutral-200/70 space-y-2">
                    <div class="flex justify-between items-center text-xs font-mono">
                        <span class="text-neutral-500">Pagado: <strong>${paid.toFixed(2)} €</strong></span>
                        <span class="font-extrabold ${remaining === 0 ? 'text-emerald-600' : 'text-black'}">Falta: ${remaining.toFixed(2)} €</span>
                    </div>
                    <div class="w-full h-3 bg-neutral-200 rounded-full overflow-hidden">
                        <div class="h-full bg-emerald-500 transition-all duration-500" style="width: ${percent}%"></div>
                    </div>
                    <span class="text-[9px] text-neutral-400 font-mono block text-center">${percent}% liquidado</span>
                </div>

                <!-- Historial de Aportaciones de la Mesa -->
                <div class="space-y-1.5">
                    <span class="text-[10px] font-mono uppercase text-neutral-400 block">Aportaciones de la mesa</span>
                    <div class="max-h-24 overflow-y-auto space-y-1 pr-1 allow-scroll">
                        ${payers.length > 0 ? payers.map(p => `
                            <div class="flex justify-between items-center text-[11px] p-2 bg-neutral-50 rounded-xl border border-neutral-100">
                                <span class="font-medium text-black truncate max-w-[180px]">${p.name}</span>
                                <span class="font-mono font-bold text-emerald-600">+${parseFloat(p.amount).toFixed(2)} €</span>
                            </div>
                        `).join('') : '<p class="text-[10px] text-neutral-400 text-center py-2">Sé el primero en abonar tu parte.</p>'}
                    </div>
                </div>

                <!-- Aportación Directa (Sin cobro real de saldo) -->
                ${remaining > 0 ? `
                    <div class="space-y-2 pt-1 border-t border-neutral-100">
                        <label class="text-[9px] font-mono uppercase text-neutral-400 block">Importe a abonar por tu parte</label>
                        <div class="flex space-x-2">
                            <input type="number" step="0.50" id="customSplitAmount" value="${(remaining > 10 ? 10 : remaining).toFixed(2)}" max="${remaining}" class="w-1/2 bg-neutral-50 border border-neutral-200 rounded-xl px-3 py-2 text-xs font-mono font-bold focus:border-black outline-none">
                            <button onclick="window.paySplitBill('${session.id}', ${tableNumber}, document.getElementById('customSplitAmount').value)" class="w-1/2 py-2.5 bg-black text-white font-bold rounded-xl text-xs active:scale-95 transition shadow-sm">
                                Aportar Pago
                            </button>
                        </div>
                        <button onclick="window.paySplitBill('${session.id}', ${tableNumber}, ${remaining})" class="w-full py-3 bg-neutral-100 hover:bg-neutral-200 text-black font-bold rounded-xl text-xs transition">
                            Abonar Restante (${remaining.toFixed(2)} €)
                        </button>
                    </div>
                ` : `
                    <div class="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl text-center space-y-1">
                        <i data-lucide="check-circle-2" class="w-5 h-5 text-emerald-600 mx-auto"></i>
                        <p class="text-xs font-bold text-emerald-700">¡Cuenta totalmente liquidada!</p>
                        <p class="text-[9px] text-neutral-500">Comprobante digital emitido.</p>
                    </div>
                `}
            </div>
        `;
    }

    if (typeof lucide !== 'undefined') lucide.createIcons();
};

// 4. ENVÍO DE COMANDA A COCINA
window.sendOrderToKitchen = async function(bizName, tableNumber) {
    const cart = window.appState?.cartItemsList || [];
    if (cart.length === 0) return;

    const total = cart.reduce((acc, i) => acc + (i.price * i.qty), 0);
    const client = window.supabaseClient || window.supabase;
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
    if (typeof updateCartCountUI === 'function') updateCartCountUI();

    window.renderTableSessionUI(bizName, tableNumber);
    alert(`¡Comanda enviada a cocina para la Mesa ${tableNumber}! La cuenta queda abierta para que cada comensal aporte su parte.`);
};

// 5. REGISTRO DIRECTO DEL PAGO FRACCIONADO
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

    const client = window.supabaseClient || window.supabase;
    if (client) {
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

    // Disparo de confirmaciones y alertas al liquidar el 100% de la mesa
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

// 6. SUSCRIPCIÓN EN TIEMPO REAL A LA MESA
window.subscribeToTableSession = function(bizName, tableNumber) {
    const client = window.supabaseClient || window.supabase;
    if (!client) return;

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

// 7. MODAL DE RESERVAS POR TURNO Y AFORO
window.openModernReservationModal = async function() {
    const modal = document.getElementById('customModal');
    const modalBody = document.getElementById('modalBody');
    if (!modal || !modalBody) return;

    const today = new Date().toISOString().split('T')[0];
    if (!window.restaurantState.selectedDate) window.restaurantState.selectedDate = today;

    await window.loadRestaurantSettingsFromDB();

    modalBody.innerHTML = `
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

            <button onclick="window.processSmartReservation()" id="btnConfirmReservation" class="w-full py-4 bg-black text-white rounded-2xl text-xs font-bold tracking-wide active:scale-95 transition shadow-lg flex items-center justify-center space-x-2">
                <i data-lucide="check" class="w-4 h-4"></i>
                <span id="btnConfirmReservationText">Confirmar Reserva</span>
            </button>
        </div>
    `;

    modal.classList.remove('hidden', 'opacity-0');
    modal.classList.add('opacity-100');
    if (typeof lucide !== 'undefined') lucide.createIcons();

    await window.recalculateSlotsAvailability();
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
    
    const client = window.supabaseClient || window.supabase;
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

    const confirmBtn = document.getElementById('btnConfirmReservation');
    const confirmText = document.getElementById('btnConfirmReservationText');

    if (!isCurrentTimeValid) {
        const firstBtn = slotsGrid.querySelector('button');
        if (firstBtn) {
            firstBtn.click();
        } else {
            window.restaurantState.allocatedTable = null;
            if (confirmBtn) {
                confirmBtn.disabled = true;
                confirmBtn.classList.add('opacity-50', 'pointer-events-none');
            }
            if (confirmText) confirmText.innerText = `Aforo completo en ${zone}`;
        }
    } else {
        if (confirmBtn) {
            confirmBtn.disabled = false;
            confirmBtn.classList.remove('opacity-50', 'pointer-events-none');
        }
        if (confirmText) confirmText.innerText = `Confirmar Reserva a las ${window.restaurantState.selectedTime}`;
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

    const confirmText = document.getElementById('btnConfirmReservationText');
    if (confirmText) confirmText.innerText = `Confirmar Reserva a las ${timeStr}`;
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
    
    if (!table) return;

    const client = window.supabaseClient || window.supabase;
    const customerUser = typeof currentUser !== 'undefined' ? currentUser : null;

    const record = {
        business_name: bizName,
        customer: customerUser?.user_metadata?.full_name || customerUser?.email || 'Cliente NetWish',
        customer_email: customerUser?.email || '',
        items: `Reserva ${guests} pax — Mesa ${table.table_number} (${zone})`,
        total: 0.00,
        date: date,
        time: `${startTime} - ${endTime}`,
        status: 'Mesa Confirmada'
    };

    if (client) {
        try {
            await client.from('orders').insert([record]);
        } catch (e) {
            console.warn("Aviso insertando reserva:", e);
        }
    }

    if (window.emailService) {
        const orderSummary = {
            businessName: bizName,
            clientName: record.customer,
            date: date,
            time: `${startTime} h (Estancia hasta ${endTime} h)`,
            items: [{ name: `Reserva para ${guests} comensales en ${zone} (Mesa ${table.table_number})`, qty: 1, price: 0 }],
            total: 0,
            action: 'reserve'
        };

        if (customerUser?.email) {
            window.emailService.sendClientReceipt(customerUser.email, orderSummary);
        }
        const bizEmail = window.appState?.activeBusinessEmail || 'contacto@netwish.es';
        window.emailService.sendBusinessAlert(bizEmail, orderSummary);
    }

    window.closeCustomModal();
    alert(`¡Reserva confirmada con éxito!\n\nFecha: ${date}\nHora: ${startTime} h\nComensales: ${guests} personas\nMesa: Mesa ${table.table_number} (${zone})\n\nComprobante digital enviado a tu correo.`);
};

// 8. MODAL DEL MENÚ DEL DÍA
window.openDailyMenuModal = function() {
    const modal = document.getElementById('customModal');
    const modalBody = document.getElementById('modalBody');
    if (!modal || !modalBody) return;

    const menu = window.restaurantState.dailyMenu;
    const price = menu?.price || 14.50;

    modalBody.innerHTML = `
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
                        ${(menu?.first_courses || []).map(fc => `
                            <p class="p-2 rounded-xl bg-neutral-50 border border-neutral-100/80 font-medium">• ${fc}</p>
                        `).join('')}
                    </div>
                </div>

                <div>
                    <h5 class="font-mono text-[9px] uppercase tracking-wider text-neutral-400 mb-1.5 font-bold">Segundos Platos (A elegir)</h5>
                    <div class="space-y-1 text-neutral-700">
                        ${(menu?.second_courses || []).map(sc => `
                            <p class="p-2 rounded-xl bg-neutral-50 border border-neutral-100/80 font-medium">• ${sc}</p>
                        `).join('')}
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
    `;

    modal.classList.remove('hidden', 'opacity-0');
    modal.classList.add('opacity-100');
    if (typeof lucide !== 'undefined') lucide.createIcons();
};

window.loadRestaurantSettingsFromDB = async function() {
    const client = window.supabaseClient || window.supabase;
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

window.timeToMinutes = (str) => {
    const [h, m] = str.split(':').map(Number);
    return h * 60 + m;
};

window.minutesToTime = (min) => {
    const h = Math.floor(min / 60).toString().padStart(2, '0');
    const m = (min % 60).toString().padStart(2, '0');
    return `${h}:${m}`;
};

window.closeCustomModal = function() {
    const modal = document.getElementById('customModal');
    if (modal) {
        modal.classList.add('opacity-0');
        setTimeout(() => modal.classList.add('hidden'), 200);
    }
};