// js/restaurant.js

window.restaurantState = {
    selectedDate: '',
    selectedTime: '13:30',
    selectedGuests: 2,
    selectedZone: 'Sala Principal',
    allocatedTable: null,
    
    // Inventario físico de mesas del local
    tablesInventory: [
        { id: 1, table_number: 1, capacity: 2, zone: 'Sala Principal' },
        { id: 2, table_number: 2, capacity: 2, zone: 'Sala Principal' },
        { id: 3, table_number: 3, capacity: 4, zone: 'Sala Principal' },
        { id: 4, table_number: 4, capacity: 4, zone: 'Terraza' },
        { id: 5, table_number: 5, capacity: 6, zone: 'Sala Principal' },
        { id: 6, table_number: 6, capacity: 8, zone: 'Sala Principal' }
    ],

    // Horarios disponibles (Comidas y Cenas)
    availableTimeSlots: [
        '13:00', '13:30', '14:00', '14:30', '15:15', '15:30',
        '20:30', '21:00', '21:30', '22:00', '22:45', '23:00'
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

            <!-- Acceso: Motor de Reservas Inteligente -->
            <button onclick="window.openModernReservationModal()" class="w-full p-4 rounded-3xl bg-neutral-50 hover:bg-neutral-100 border border-neutral-200/80 flex items-center justify-between shadow-sm active:scale-[0.98] transition group">
                <div class="flex items-center space-x-3.5">
                    <div class="w-10 h-10 rounded-2xl bg-black text-white flex items-center justify-center shadow-md shrink-0">
                        <i data-lucide="calendar-check" class="w-5 h-5 text-white"></i>
                    </div>
                    <div class="text-left">
                        <div class="flex items-center space-x-2">
                            <span class="block text-xs font-bold text-black tracking-tight">Reservar Mesa</span>
                            <span class="text-[9px] bg-black text-white font-mono px-2 py-0.5 rounded-full">En Tiempo Real</span>
                        </div>
                        <span class="block text-[10px] text-neutral-400 mt-0.5">Asignación automática y confirmación directa</span>
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

// 3. MOTOR DE RESERVAS MODERNO
window.openModernReservationModal = async function() {
    const modal = document.getElementById('customModal');
    const modalBody = document.getElementById('modalBody');
    if (!modal || !modalBody) return;

    const today = new Date().toISOString().split('T')[0];
    if (!window.restaurantState.selectedDate) window.restaurantState.selectedDate = today;

    modalBody.innerHTML = `
        <div class="space-y-4 text-left">
            <div class="flex items-center justify-between border-b border-neutral-100 pb-3">
                <div>
                    <span class="text-[9px] font-mono uppercase tracking-widest text-neutral-400">SISTEMA DE RESERVAS</span>
                    <h3 class="text-sm font-bold text-black">Selecciona Día y Hora</h3>
                </div>
                <button onclick="window.closeCustomModal()" class="w-7 h-7 rounded-full bg-neutral-100 flex items-center justify-center text-neutral-500 hover:text-black">
                    <i data-lucide="x" class="w-4 h-4"></i>
                </button>
            </div>

            <!-- Paso 1: Comensales, Fecha y Zona -->
            <div class="space-y-3">
                <div>
                    <label class="text-[9px] font-mono uppercase text-neutral-400 block mb-1">Nº Comensales</label>
                    <div class="grid grid-cols-5 gap-1.5" id="guestsBtnGrid">
                        ${[2, 3, 4, 6, 8].map(num => `
                            <button onclick="window.selectReservationGuests(${num})" id="guest-opt-${num}" class="py-2.5 rounded-xl border text-xs font-bold transition ${window.restaurantState.selectedGuests === num ? 'bg-black text-white border-black shadow-sm' : 'bg-white text-black border-neutral-200/80 hover:bg-neutral-50'}">
                                ${num} pax
                            </button>
                        `).join('')}
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

                <!-- Paso 2: Franjas Horarias Dinámicas -->
                <div>
                    <div class="flex justify-between items-center mb-1.5">
                        <label class="text-[9px] font-mono uppercase text-neutral-400 block">Horas Disponibles</label>
                        <span class="text-[9px] font-mono text-neutral-400" id="durationHint">Estancia: 90 min</span>
                    </div>
                    <div class="grid grid-cols-3 gap-2" id="timeSlotsGrid">
                        <div class="col-span-3 py-4 text-center text-xs text-neutral-400">
                            <i data-lucide="loader-2" class="w-4 h-4 mx-auto animate-spin mb-1"></i>
                            Calculando disponibilidad...
                        </div>
                    </div>
                </div>
            </div>

            <!-- Paso 3: Confirmación de Reserva -->
            <button onclick="window.processSmartReservation()" id="btnConfirmReservation" class="w-full py-4 bg-black text-white rounded-2xl text-xs font-bold tracking-wide active:scale-95 transition shadow-lg flex items-center justify-center space-x-2">
                <i data-lucide="check" class="w-4 h-4"></i>
                <span id="btnConfirmReservationText">Confirmar Reserva a las ${window.restaurantState.selectedTime}</span>
            </button>
        </div>
    `;

    modal.classList.remove('hidden', 'opacity-0');
    modal.classList.add('opacity-100');
    if (typeof lucide !== 'undefined') lucide.createIcons();

    await window.recalculateSlotsAvailability();
};

// 4. ALGORITMO DE ASIGNACIÓN ÓPTIMA Y CÁLCULO DE SOLAPAMIENTO
window.recalculateSlotsAvailability = async function() {
    const slotsGrid = document.getElementById('timeSlotsGrid');
    if (!slotsGrid) return;

    const date = window.restaurantState.selectedDate;
    const guests = window.restaurantState.selectedGuests;
    const zone = window.restaurantState.selectedZone;
    const durationMinutes = window.getEstimatedTurnDuration(guests);
    
    const durationHint = document.getElementById('durationHint');
    if (durationHint) durationHint.innerText = `Estancia: ${durationMinutes} min`;

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
                        startTime: timeMatch ? timeMatch[1] : (row.time?.substring(0, 5) || '13:30'),
                        endTime: timeMatch ? timeMatch[2] : null,
                        tableNumber: tableMatch ? parseInt(tableMatch[1], 10) : null
                    };
                });
            }
        } catch (e) {
            console.warn("Aviso consultando reservas previas:", e);
        }
    }

    // Comprobamos disponibilidad para cada hora
    let validSlotsHTML = '';
    let isCurrentTimeStillAvailable = false;

    window.restaurantState.availableTimeSlots.forEach(timeSlot => {
        const slotStartMin = window.timeToMinutes(timeSlot);
        const slotEndMin = slotStartMin + durationMinutes;

        // Buscar una mesa que cumpla: zona + capacidad + sin solapamiento
        const candidateTables = window.restaurantState.tablesInventory
            .filter(t => t.zone === zone && t.capacity >= guests)
            .sort((a, b) => a.capacity - b.capacity); // Best-fit (menor capacidad suficiente)

        let assignedTable = null;

        for (let table of candidateTables) {
            const hasOverlap = existingReservations.some(res => {
                if (res.tableNumber !== table.table_number) return false;
                
                const resStartMin = window.timeToMinutes(res.startTime);
                const resEndMin = res.endTime ? window.timeToMinutes(res.endTime) : (resStartMin + 90);

                // Condición de solapamiento de intervalos: (StartA < EndB) y (EndA > StartB)
                return (slotStartMin < resEndMin && slotEndMin > resStartMin);
            });

            if (!hasOverlap) {
                assignedTable = table;
                break;
            }
        }

        const isAvailable = assignedTable !== null;
        const isSelected = window.restaurantState.selectedTime === timeSlot;

        if (isSelected && isAvailable) {
            isCurrentTimeStillAvailable = true;
            window.restaurantState.allocatedTable = assignedTable;
        }

        if (isAvailable) {
            validSlotsHTML += `
                <button onclick="window.selectReservationTime('${timeSlot}', ${assignedTable.table_number})" id="slot-btn-${timeSlot.replace(':', '')}" class="py-2 px-1 rounded-xl border text-xs font-mono font-bold transition ${isSelected ? 'bg-black text-white border-black shadow-sm' : 'bg-white text-black border-neutral-200 hover:border-black'}">
                    ${timeSlot}
                </button>
            `;
        } else {
            validSlotsHTML += `
                <div class="py-2 px-1 rounded-xl border border-neutral-200/50 bg-neutral-100/60 text-center opacity-40 cursor-not-allowed">
                    <span class="text-xs font-mono text-neutral-400 line-through">${timeSlot}</span>
                </div>
            `;
        }
    });

    slotsGrid.innerHTML = validSlotsHTML;

    const confirmBtn = document.getElementById('btnConfirmReservation');
    const confirmText = document.getElementById('btnConfirmReservationText');

    if (!isCurrentTimeStillAvailable) {
        const firstAvailableBtn = slotsGrid.querySelector('button');
        if (firstAvailableBtn) {
            firstAvailableBtn.click();
        } else {
            window.restaurantState.allocatedTable = null;
            if (confirmBtn) {
                confirmBtn.disabled = true;
                confirmBtn.classList.add('opacity-50', 'pointer-events-none');
            }
            if (confirmText) confirmText.innerText = 'No hay mesas disponibles en esta fecha';
        }
    } else {
        if (confirmBtn) {
            confirmBtn.disabled = false;
            confirmBtn.classList.remove('opacity-50', 'pointer-events-none');
        }
        if (confirmText) confirmText.innerText = `Confirmar Reserva a las ${window.restaurantState.selectedTime}`;
    }

    if (typeof lucide !== 'undefined') lucide.createIcons();
};

// 5. CONTROLADORES REACTIVOS DE INTERFAZ
window.selectReservationGuests = function(num) {
    window.restaurantState.selectedGuests = num;
    [2, 3, 4, 6, 8].forEach(n => {
        const btn = document.getElementById(`guest-opt-${n}`);
        if (!btn) return;
        if (n === num) {
            btn.className = "py-2.5 rounded-xl border text-xs font-bold transition bg-black text-white border-black shadow-sm";
        } else {
            btn.className = "py-2.5 rounded-xl border text-xs font-bold transition bg-white text-black border-neutral-200/80 hover:bg-neutral-50";
        }
    });
    window.recalculateSlotsAvailability();
};

window.updateReservationDate = function(dateVal) {
    window.restaurantState.selectedDate = dateVal;
    window.recalculateSlotsAvailability();
};

window.updateReservationZone = function(zoneVal) {
    window.restaurantState.selectedZone = zoneVal;
    window.recalculateSlotsAvailability();
};

window.selectReservationTime = function(timeStr, tableNumber) {
    window.restaurantState.selectedTime = timeStr;
    window.restaurantState.allocatedTable = window.restaurantState.tablesInventory.find(t => t.table_number === tableNumber);

    const buttons = document.querySelectorAll('#timeSlotsGrid button');
    buttons.forEach(btn => {
        btn.className = "py-2 px-1 rounded-xl border text-xs font-mono font-bold transition bg-white text-black border-neutral-200 hover:border-black";
    });

    const activeBtn = document.getElementById(`slot-btn-${timeStr.replace(':', '')}`);
    if (activeBtn) {
        activeBtn.className = "py-2 px-1 rounded-xl border text-xs font-mono font-bold transition bg-black text-white border-black shadow-sm";
    }

    const confirmText = document.getElementById('btnConfirmReservationText');
    if (confirmText) confirmText.innerText = `Confirmar Reserva a las ${timeStr}`;
};

// 6. PROCESAR RESERVA, GUARDAR Y DISPARAR EMAIL
window.processSmartReservation = async function() {
    const table = window.restaurantState.allocatedTable;
    const date = window.restaurantState.selectedDate;
    const startTime = window.restaurantState.selectedTime;
    const guests = window.restaurantState.selectedGuests;
    const zone = window.restaurantState.selectedZone;
    const duration = window.getEstimatedTurnDuration(guests);
    const endTime = window.minutesToTime(window.timeToMinutes(startTime) + duration);
    const bizName = window.appState?.activeBusinessName || 'Restaurante Dani';
    
    if (!table) {
        alert("Selecciona una hora disponible para completar la reserva.");
        return;
    }

    const client = (typeof supabaseClient !== 'undefined') ? supabaseClient : window.supabase;
    const customerUser = (typeof currentUser !== 'undefined') ? currentUser : null;

    const reservationRecord = {
        business_name: bizName,
        customer: customerUser?.user_metadata?.full_name || customerUser?.email || 'Cliente NetWish',
        customer_email: customerUser?.email || '',
        items: `Reserva ${guests} pax — Mesa ${table.table_number} (${zone})`,
        total: 0.00,
        date: date,
        time: `${startTime} - ${endTime}`,
        status: 'Mesa Confirmada'
    };

    // 1. Guardar en Supabase
    if (client) {
        try {
            await client.from('orders').insert([reservationRecord]);
        } catch (err) {
            console.warn("Aviso registrando reserva en BD:", err);
        }
    }

    // 2. Disparo de correo con justificación y detalles
    if (window.emailService) {
        const orderSummary = {
            businessName: bizName,
            clientName: reservationRecord.customer,
            date: date,
            time: `${startTime} h (Acceso hasta ${endTime} h)`,
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
    alert(`¡Reserva confirmada con éxito!\n\nFecha: ${date}\nHora: ${startTime} h\nComensales: ${guests} personas\nMesa asignada: Mesa ${table.table_number} (${zone})\n\nTe hemos enviado el justificante digital a tu correo.`);
};

// 7. FUNCIONES AUXILIARES DE TIEMPO
window.getEstimatedTurnDuration = function(guests) {
    if (guests <= 2) return 90;   // 1h 30m
    if (guests <= 4) return 105;  // 1h 45m
    return 120;                  // 2h
};

window.timeToMinutes = function(timeStr) {
    const [h, m] = timeStr.split(':').map(Number);
    return h * 60 + m;
};

window.minutesToTime = function(minutes) {
    const h = Math.floor(minutes / 60).toString().padStart(2, '0');
    const m = (minutes % 60).toString().padStart(2, '0');
    return `${h}:${m}`;
};

// 8. MODAL DEL MENÚ DEL DÍA
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
                <button onclick="window.closeCustomModal()" class="w-7 h-7 rounded-full bg-neutral-100 flex items-center justify-center text-neutral-500 hover:text-black">
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