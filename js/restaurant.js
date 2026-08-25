// js/restaurant.js

window.restaurantState = {
    selectedDate: '',
    selectedTime: '',
    selectedGuests: 2,
    selectedZone: 'Sala Principal',
    allocatedTable: null,
    
    // Configuración inicial reactiva (se sincroniza con restaurant_settings)
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

            <!-- Acceso: Motor de Reservas Inteligente -->
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
                        <span class="block text-[10px] text-neutral-400 mt-0.5">Gestión de aforo y confirmación directa</span>
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
        return `
            <div class="p-4 rounded-3xl border border-neutral-200/80 bg-white shadow-sm flex items-center justify-between transition">
                <div class="space-y-1 max-w-[65%]">
                    <span class="inline-block px-2 py-0.5 rounded-md bg-neutral-100 text-neutral-600 text-[8px] font-mono uppercase tracking-wider">${dish.tag}</span>
                    <h4 class="text-xs font-bold text-black truncate">${dish.name}</h4>
                    <p class="text-[10px] text-neutral-400 line-clamp-2">${dish.desc}</p>
                    <span class="text-xs font-extrabold text-black font-mono block pt-1">${dish.price.toFixed(2)} €</span>
                </div>
                <div id="btn-container-${dish.id}" class="flex items-center space-x-2 shrink-0">
                    ${typeof renderItemButtonHTML === 'function' ? renderItemButtonHTML(dish.id, encodeURIComponent(itemIdStr), encodeURIComponent(dish.name), dish.price, qty) : ''}
                </div>
            </div>
        `;
    }).join('');
};

// 2. MODAL DE RESERVA DINÁMICA
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

            <!-- Selector de Comensales, Fecha y Zona -->
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

                <!-- Horas Calculadas -->
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

// 3. GENERADOR DE HORAS Y COMPROBACIÓN DE SOLAPAMIENTO
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

        // Mesas válidas por Best-Fit
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

// 4. CONTROLADORES
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

// 5. REGISTRAR RESERVA
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

// 6. CARGAR AJUSTES DESDE SUPABASE
window.loadRestaurantSettingsFromDB = async function() {
    const client = window.supabaseClient || window.supabase;
    const bizName = window.appState?.activeBusinessName || 'Restaurante Dani';
    if (!client) return;

    try {
        const { data } = await client.from('restaurant_settings').select('*').ilike('business_name', `%${bizName}%`).maybeSingle();
        if (data) {
            window.restaurantState.config = {
                lunch_start: data.lunch_start || '13:00',
                lunch_end: data.lunch_end || '16:00',
                dinner_start: data.dinner_start || '20:30',
                dinner_end: data.dinner_end || '23:30',
                turn_duration_min: data.turn_duration_min || 90,
                tables: data.tables || window.restaurantState.config.tables
            };
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
                <button onclick="window.closeCustomModal()" class="w-7 h-7 rounded-full bg-neutral-100 flex items-center justify-center text-neutral-500 hover:text-black"><i data-lucide="x" class="w-4 h-4"></i></button>
            </div>
            <div class="space-y-3 max-h-64 overflow-y-auto pr-1 text-xs">
                <div>
                    <h5 class="font-mono text-[9px] uppercase tracking-wider text-neutral-400 mb-1">Primeros</h5>
                    <div class="space-y-1 text-neutral-700">
                        <p class="p-2 rounded-xl bg-neutral-50 border border-neutral-100">• Alubias Blancas de Saldaña con Matanza</p>
                        <p class="p-2 rounded-xl bg-neutral-50 border border-neutral-100">• Sopa Castellana Tradicional</p>
                    </div>
                </div>
                <div>
                    <h5 class="font-mono text-[9px] uppercase tracking-wider text-neutral-400 mb-1">Segundos</h5>
                    <div class="space-y-1 text-neutral-700">
                        <p class="p-2 rounded-xl bg-neutral-50 border border-neutral-100">• Carrillera Ibérica al Vino Tinto</p>
                        <p class="p-2 rounded-xl bg-neutral-50 border border-neutral-100">• Bacalao con Pimientos Asados</p>
                    </div>
                </div>
            </div>
            <button onclick="window.changeItemQuantity('menu_dia', 'Menú del Día', 14.50, 1); window.closeCustomModal();" class="w-full py-3.5 bg-black text-white rounded-2xl text-xs font-bold active:scale-95 transition shadow-md">Añadir Menú a Mi Pedido (14,50 €)</button>
        </div>
    `;
    modal.classList.remove('hidden', 'opacity-0');
    modal.classList.add('opacity-100');
    if (typeof lucide !== 'undefined') lucide.createIcons();
};