// js/dashboard.js

let ordersRealtimeSubscription = null;
let currentBusinessOrders = []; 
let activeOrdersTab = 'pending';

// 1. Control de Catálogo / Stock / Beats Master / Carta Digital
async function openStockControlModal() {
    if (!currentBusiness) return;

    const cat = (currentBusiness.category || '').toLowerCase();
    const isMusic = cat.includes('disco') || cat.includes('music') || cat.includes('produ') || cat.includes('estudio');
    const isRestaurant = cat.includes('rest') || cat.includes('bar') || (currentBusiness.name || '').toLowerCase().includes('restaurante');

    let title = "Control de Stock y Catálogo";
    let subtitle = "Añade o elimina productos del catálogo digital.";
    let phName = "Nombre (ej. Barra de Pan Rústica)";
    let phDesc = "Descripción corta (ej. Elaboración artesanal)";
    let btnText = "Publicar Producto";

    if (isMusic) {
        title = "Gestor de Beats & Tracks";
        subtitle = "Publica licencias, beats con preview y archivo master descargable.";
        phName = "Nombre del Beat (ej. Drill Beat Vol.1)";
        phDesc = "Detalles (ej. 140 BPM, Key C Minor)";
        btnText = "Publicar Beat Completo";
    } else if (isRestaurant) {
        title = "Gestor de Carta Digital";
        subtitle = "Añade platos clasificados por sección y raciones.";
        phName = "Nombre del Plato (ej. Lechazo Churro Asado)";
        phDesc = "Ingredientes y alérgenos (ej. Horno tradicional con patatas)";
        btnText = "Añadir a la Carta";
    }

    window.openModalCustom(`
        <div class="space-y-4 text-center py-6">
            <i data-lucide="loader-2" class="w-6 h-6 mx-auto animate-spin text-black mb-2"></i>
            <p class="text-xs text-neutral-500">Consultando catálogo en Supabase...</p>
        </div>
    `);

    let catalog = [];
    try {
        const { data, error } = await supabaseClient.from('products').select('*');
        if (error) throw error;
        
        const cleanBizName = (currentBusiness.name || '').trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        const bizTokens = cleanBizName.split(/\s+/).filter(t => t.length > 2);

        catalog = (data || []).filter(item => {
            const bId = String(item.business_id || '').trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
            if (bId === cleanBizName || bId === 'biz_db') return true;
            return bizTokens.some(token => bId.includes(token));
        });

    } catch (err) {
        console.error("Error al cargar stock:", err);
    }

    let productsHtml = '';
    catalog.forEach(p => {
        const price = parseFloat(p.price) || 0;
        const hasAudio = Boolean(p.audio_url);
        const hasMaster = Boolean(p.full_audio_url);
        const isFinished = p.is_finished_beat === true || (p.name || '').toLowerCase().includes('prueba1');
        const sectionBadge = p.section ? `<span class="text-[8px] bg-neutral-200 text-neutral-700 font-mono font-bold px-1.5 py-0.5 rounded-md">${p.section}</span>` : '';

        productsHtml += `
            <div class="flex justify-between items-center bg-neutral-50 p-3.5 rounded-2xl border border-neutral-200/60 shadow-xs">
                <div class="overflow-hidden pr-2">
                    <div class="flex items-center space-x-1.5">
                        ${hasAudio ? '<i data-lucide="volume-2" class="w-3.5 h-3.5 text-amber-500 shrink-0" title="Preview activo"></i>' : ''}
                        ${hasMaster ? '<i data-lucide="download-cloud" class="w-3.5 h-3.5 text-emerald-600 shrink-0" title="Master descargable listo"></i>' : ''}
                        <span class="text-xs font-bold block text-black truncate">${p.name}</span>
                        ${sectionBadge}
                        ${isFinished ? '<span class="text-[8px] bg-amber-500/10 text-amber-600 font-bold px-1.5 py-0.5 rounded-full border border-amber-500/20">Finalizado</span>' : ''}
                    </div>
                    <span class="text-[10px] text-neutral-500 block truncate mt-0.5">${p.description || ''} • <strong class="text-black font-mono">${price.toFixed(2)} €</strong></span>
                </div>
                <button onclick="deleteStockProduct('${p.id}')" class="w-8 h-8 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center hover:bg-rose-100 active:scale-90 shrink-0 transition shadow-xs">
                    <i data-lucide="trash-2" class="w-4 h-4"></i>
                </button>
            </div>
        `;
    });

    const modalBody = document.getElementById('modalBody');
    if (!modalBody) return;

    modalBody.innerHTML = `
        <div class="space-y-4 text-left">
            <div class="text-center space-y-1">
                <h3 class="text-base font-bold text-black">${title}</h3>
                <p class="text-[11px] text-neutral-500">${subtitle}</p>
            </div>

            <div class="space-y-2.5 pt-1 border-t border-neutral-100">
                <span class="text-[10px] font-mono uppercase tracking-widest text-neutral-400 block">Nuevo Registro</span>
                
                ${isRestaurant ? `
                <div>
                    <label class="text-[9px] font-mono uppercase text-neutral-400 block mb-1">Sección de la Carta</label>
                    <select id="newProdSection" class="w-full bg-neutral-50 border border-neutral-200 rounded-xl py-2.5 px-3 text-xs text-black font-medium focus:outline-none focus:border-black transition">
                        <option value="Entrantes">Entrantes & Raciones</option>
                        <option value="Carnes">Principales: Carnes</option>
                        <option value="Pescados">Principales: Pescados</option>
                        <option value="Bebidas & Vinos">Bebidas & Bodega</option>
                        <option value="Postres">Postres Caseros</option>
                    </select>
                </div>
                ` : ''}

                <input type="text" id="newProdName" placeholder="${phName}" class="w-full bg-neutral-50 border border-neutral-200 rounded-xl py-2.5 px-3 text-xs text-black focus:outline-none focus:border-black transition">
                <input type="text" id="newProdDesc" placeholder="${phDesc}" class="w-full bg-neutral-50 border border-neutral-200 rounded-xl py-2.5 px-3 text-xs text-black focus:outline-none focus:border-black transition">
                <input type="number" step="0.01" id="newProdPrice" placeholder="Precio en € (ej. 14.50)" class="w-full bg-neutral-50 border border-neutral-200 rounded-xl py-2.5 px-3 text-xs text-black focus:outline-none focus:border-black transition font-mono">
                
                ${isMusic ? `
                <div class="space-y-3 p-3 bg-neutral-50 rounded-2xl border border-neutral-200/80">
                    <div class="space-y-1">
                        <label class="text-[10px] font-mono text-neutral-700 font-bold uppercase tracking-wider block">1. Audio Preview (Corto para escuchar)</label>
                        <input type="file" id="newProdAudioFile" accept="audio/mp3,audio/wav,audio/mpeg" class="w-full text-[11px] text-neutral-500 file:mr-2 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-black file:text-white cursor-pointer">
                    </div>

                    <div class="space-y-1 pt-1">
                        <label class="text-[10px] font-mono text-amber-700 font-bold uppercase tracking-wider block">2. Beat Entero / Master (Para descarga tras compra)</label>
                        <input type="file" id="newProdFullAudioFile" accept="audio/mp3,audio/wav,audio/mpeg,.zip,.rar" class="w-full text-[11px] text-neutral-500 file:mr-2 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-amber-500 file:text-black cursor-pointer">
                    </div>
                    
                    <label class="flex items-center space-x-2 pt-1 cursor-pointer select-none">
                        <input type="checkbox" id="newProdIsFinishedBeat" checked class="w-4 h-4 rounded text-black border-neutral-300 focus:ring-0">
                        <span class="text-xs font-bold text-neutral-800">Marcar como Beat en Venta</span>
                    </label>
                </div>
                ` : ''}

                <button id="saveProdBtn" onclick="saveNewStockProduct()" class="w-full py-3 bg-black text-white font-semibold rounded-xl text-xs shadow-md mt-1 flex items-center justify-center space-x-2 active:scale-95 transition">
                    <i data-lucide="cloud-upload" class="w-4 h-4"></i>
                    <span>${btnText}</span>
                </button>
            </div>

            <div class="space-y-2 pt-2 border-t border-neutral-100">
                <span class="text-[10px] font-mono uppercase tracking-widest text-neutral-400 block">Artículos Publicados (${catalog.length})</span>
                <div class="max-h-40 overflow-y-auto space-y-2 pr-1 allow-scroll">
                    ${catalog.length > 0 ? productsHtml : '<p class="text-xs text-neutral-400 text-center py-3">No hay artículos dados de alta en Supabase.</p>'}
                </div>
            </div>

            <button onclick="window.closeCustomModal()" class="w-full py-2 bg-neutral-100 hover:bg-neutral-200 text-black font-bold rounded-xl text-xs transition">
                Cerrar
            </button>
        </div>
    `;
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

async function saveNewStockProduct() {
    if (!currentBusiness) return;
    
    const name = document.getElementById('newProdName').value.trim();
    const desc = document.getElementById('newProdDesc').value.trim();
    const price = parseFloat(document.getElementById('newProdPrice').value);
    const sectionEl = document.getElementById('newProdSection');
    const section = sectionEl ? sectionEl.value : 'Entrantes';
    const audioInput = document.getElementById('newProdAudioFile');
    const fullAudioInput = document.getElementById('newProdFullAudioFile');
    const isFinishedCheckbox = document.getElementById('newProdIsFinishedBeat');
    const saveBtn = document.getElementById('saveProdBtn');

    if (!name || isNaN(price) || price <= 0) {
        alert("Introduce un nombre y un precio válido.");
        return;
    }

    let audioUrl = null;
    let fullAudioUrl = null;
    const isFinished = isFinishedCheckbox ? isFinishedCheckbox.checked : false;
    const safeBiz = currentBusiness.name.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();

    if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.innerHTML = `<i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i><span>Subiendo archivos...</span>`;
        if (typeof lucide !== 'undefined') lucide.createIcons();
    }

    try {
        if (audioInput && audioInput.files.length > 0) {
            const file = audioInput.files[0];
            const fileExt = file.name.split('.').pop().toLowerCase();
            const filePath = `${safeBiz}/${Date.now()}_preview.${fileExt}`;

            const { error: uploadError } = await supabaseClient.storage
                .from('beats')
                .upload(filePath, file, { cacheControl: '3600', upsert: false });

            if (!uploadError) {
                const { data: publicUrlData } = supabaseClient.storage.from('beats').getPublicUrl(filePath);
                audioUrl = publicUrlData.publicUrl;
            }
        }

        if (fullAudioInput && fullAudioInput.files.length > 0) {
            const fileFull = fullAudioInput.files[0];
            const extFull = fileFull.name.split('.').pop().toLowerCase();
            const filePathFull = `${safeBiz}/${Date.now()}_master.${extFull}`;

            const { error: uploadErrorFull } = await supabaseClient.storage
                .from('beats')
                .upload(filePathFull, fileFull, { cacheControl: '3600', upsert: false });

            if (!uploadErrorFull) {
                const { data: publicUrlDataFull } = supabaseClient.storage.from('beats').getPublicUrl(filePathFull);
                fullAudioUrl = publicUrlDataFull.publicUrl;
            }
        }
    } catch (storageErr) {
        alert("Error al subir archivos: " + storageErr.message);
        if (saveBtn) {
            saveBtn.disabled = false;
            saveBtn.innerHTML = `<i data-lucide="cloud-upload" class="w-4 h-4"></i><span>Reintentar</span>`;
        }
        return;
    }

    const insertPayload = { 
        business_id: currentBusiness.name, 
        name: name, 
        description: desc, 
        price: price,
        section: section,
        is_finished_beat: isFinished,
        audio_url: audioUrl,
        full_audio_url: fullAudioUrl
    };

    try {
        let { error } = await supabaseClient.from('products').insert([insertPayload]);
        
        if (error && error.message && error.message.includes('section')) {
            console.warn("Columna 'section' ausente en DB. Guardando sin campo section...");
            delete insertPayload.section;
            const resFallback = await supabaseClient.from('products').insert([insertPayload]);
            error = resFallback.error;
        }

        if (error) throw error;
        openStockControlModal();
    } catch (err) {
        alert("Error en Supabase: " + err.message);
    }
}

async function deleteStockProduct(productId) {
    try {
        const { error } = await supabaseClient.from('products').delete().eq('id', productId);
        if (error) throw error;
        openStockControlModal();
    } catch (err) {
        alert("Error al eliminar: " + err.message);
    }
}

// CONFIRMAR PEDIDO O RESERVA (Al hacer click el restaurante, se confirma y se envía el correo al cliente)
async function completeBusinessOrder(orderId) {
    try {
        const orderToConfirm = currentBusinessOrders.find(o => String(o.id) === String(orderId));
        const isResv = orderToConfirm && ((orderToConfirm.items || '').toLowerCase().includes('reserva') || (orderToConfirm.status || '').toLowerCase().includes('aprobación') || (orderToConfirm.status || '').toLowerCase().includes('confirmación') || (orderToConfirm.status || '').toLowerCase().includes('pendiente'));
        const newStatus = isResv ? 'Mesa Confirmada' : 'Completado';

        const { error } = await supabaseClient
            .from('orders')
            .update({ status: newStatus })
            .eq('id', orderId);
            
        if (error) throw error;

        const orderIndex = currentBusinessOrders.findIndex(o => String(o.id) === String(orderId));
        if (orderIndex >= 0) {
            currentBusinessOrders[orderIndex].status = newStatus;
        }

        if (isResv && orderToConfirm && orderToConfirm.customer_email && window.emailService) {
            window.emailService.sendClientReceipt(orderToConfirm.customer_email, {
                businessName: currentBusiness.name,
                clientName: orderToConfirm.customer,
                date: orderToConfirm.date,
                time: orderToConfirm.time,
                items: [{ name: orderToConfirm.items, qty: 1, price: orderToConfirm.total }],
                total: orderToConfirm.total,
                action: 'confirmacion_reserva'
            });
        }

        renderBusinessOrders();
        if (typeof window.showToast === 'function') {
            window.showToast(isResv ? "¡Reserva aprobada y correo de confirmación enviado!" : "Pedido marcado como completado.", "success");
        }
    } catch (err) {
        alert("No se pudo actualizar el registro: " + err.message);
    }
}

function setOrdersTab(tab) {
    activeOrdersTab = tab;
    renderBusinessOrders();
}

function openHistoryModal(dateFilter = '') {
    if (!currentBusiness) return;

    let filteredOrders = currentBusinessOrders;
    if (dateFilter) {
        filteredOrders = currentBusinessOrders.filter(o => o.date === dateFilter);
    }

    const cat = (currentBusiness.category || '').toLowerCase();
    let ordersHtml = '';

    if (filteredOrders.length === 0) {
        ordersHtml = '<p class="text-xs text-neutral-400 text-center py-6">No hay actividad para esta fecha.</p>';
    } else {
        filteredOrders.forEach(o => {
            const isCompleted = o.status === 'Completado' || o.status === 'Mesa Confirmada';
            const isPaid = o.status === 'Pagado Online';
            const iconBg = isCompleted ? 'bg-neutral-100 text-neutral-500' : (isPaid ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600');
            const iconName = (cat.includes('rest') || cat.includes('pel')) ? 'calendar' : (isPaid ? 'shopping-bag' : 'clock');
            const totalVal = parseFloat(o.total) || 0;
            
            ordersHtml += `
                <div class="p-4 rounded-2xl bg-neutral-50 border border-neutral-200/60 shadow-xs flex justify-between items-center">
                    <div class="flex items-center space-x-3 overflow-hidden">
                        <div class="w-8 h-8 rounded-full ${iconBg} flex items-center justify-center shrink-0">
                            <i data-lucide="${iconName}" class="w-4 h-4"></i>
                        </div>
                        <div class="overflow-hidden">
                            <span class="text-xs font-bold block text-black truncate">${o.items}</span>
                            <span class="text-[9px] text-neutral-500 font-mono">Día: ${o.date} • ${o.time}</span>
                            <span class="text-[9px] text-neutral-400 block mt-0.5 truncate">Cliente: ${o.customer}</span>
                        </div>
                    </div>
                    <div class="text-right shrink-0 ml-2">
                        ${!o.items.toLowerCase().includes('reserva') ? `<span class="block text-sm font-bold text-black font-mono">${totalVal.toFixed(2)} €</span>` : ''}
                        <span class="block text-[9px] ${isCompleted ? 'text-neutral-500' : (isPaid ? 'text-emerald-600' : 'text-amber-600')} font-bold">${o.status}</span>
                    </div>
                </div>
            `;
        });
    }

    window.openModalCustom(`
        <div class="space-y-4 text-left">
            <div class="text-center space-y-1">
                <h3 class="text-base font-bold text-black">Historial Completo</h3>
                <p class="text-[11px] text-neutral-500">Revisa y filtra los registros recibidos.</p>
            </div>

            <div class="pt-2 border-t border-neutral-100">
                <label class="text-[9px] font-mono uppercase text-neutral-400 block mb-1">Filtrar por Día</label>
                <input type="date" id="historyDateFilter" value="${dateFilter}" onchange="openHistoryModal(this.value)" class="w-full bg-neutral-50 border border-neutral-200 rounded-xl py-2.5 px-3 text-xs text-black focus:outline-none focus:border-black transition">
            </div>

            <div class="space-y-2 max-h-72 overflow-y-auto pr-1 allow-scroll">
                ${ordersHtml}
            </div>

            <div class="grid grid-cols-2 gap-3 pt-2">
                <button onclick="openHistoryModal('')" class="w-full py-3 bg-neutral-100 text-black font-semibold rounded-xl text-xs hover:bg-neutral-200 transition">
                    Ver Todos
                </button>
                <button onclick="window.closeCustomModal()" class="w-full py-3 bg-black text-white font-semibold rounded-xl text-xs shadow-md active:scale-95 transition">
                    Cerrar
                </button>
            </div>
        </div>
    `);
}

async function renderBusinessOrders() {
    if (!currentBusiness) return;
    
    const dashboardContainer = document.getElementById('dynamicDashboardContent');
    const ordersContainer = document.getElementById('dynamicOrdersTabContent');
    if (!dashboardContainer) return;
    
    const cat = (currentBusiness.category || '').toLowerCase();
    const isMusic = cat.includes('disco') || cat.includes('music') || cat.includes('produ') || cat.includes('estudio');
    const isRestaurant = cat.includes('rest') || cat.includes('bar') || cat.includes('hostel') || (currentBusiness.name || '').toLowerCase().includes('restaurante');
    
    const ordersTitleEl = document.getElementById('bizOrdersTitle');
    const ordersTagEl = document.getElementById('bizOrdersTag');
    const navOrdersTextEl = document.getElementById('bizNavOrdersText');
    if (isRestaurant) {
        if (ordersTitleEl) ordersTitleEl.innerText = "Gestión de Reservas";
        if (ordersTagEl) ordersTagEl.innerText = "HOSTELERÍA";
        if (navOrdersTextEl) navOrdersTextEl.innerText = "Reservas";
    } else {
        if (ordersTitleEl) ordersTitleEl.innerText = "Pedidos & Reservas";
        if (ordersTagEl) ordersTagEl.innerText = "GESTIÓN ACTIVA";
        if (navOrdersTextEl) navOrdersTextEl.innerText = "Pedidos";
    }

    if (!ordersRealtimeSubscription && typeof supabaseClient.channel === 'function') {
        ordersRealtimeSubscription = supabaseClient
            .channel('public:orders')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
                renderBusinessOrders();
            })
            .subscribe();
    }

    let orders = [];
    try {
        const { data, error } = await supabaseClient
            .from('orders')
            .select('*')
            .order('created_at', { ascending: false, nullsFirst: false });
            
        if (!error && data) {
            orders = data;
        }
    } catch (e) {
        console.warn("Lectura de orders Supabase:", e);
    }

    const cleanCurrentBiz = (currentBusiness.name || '').trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const bizKeywords = cleanCurrentBiz.split(/\s+/).filter(w => w.length > 2);

    let myOrders = orders.filter(o => {
        const rawName = o.business_name || o.businessName || '';
        const oName = rawName.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        if (oName === cleanCurrentBiz || oName.includes(cleanCurrentBiz) || cleanCurrentBiz.includes(oName)) return true;
        if (isRestaurant && (oName.includes('restaurante') || oName.includes('dani'))) return true;
        return bizKeywords.some(keyword => oName.includes(keyword));
    });

    if (isRestaurant) {
        myOrders = myOrders.filter(o => {
            const itemsStr = (o.items || '').toLowerCase();
            const statusStr = (o.status || '').toLowerCase();
            return itemsStr.includes('reserva') || itemsStr.includes('pax') || statusStr.includes('mesa') || statusStr.includes('aprobación') || statusStr.includes('confirmación') || statusStr.includes('pendiente');
        });
    }

    myOrders.sort((a, b) => {
        const timeA = a.created_at ? new Date(a.created_at).getTime() : (parseInt(a.id, 10) || 0);
        const timeB = b.created_at ? new Date(b.created_at).getTime() : (parseInt(b.id, 10) || 0);
        return timeB - timeA;
    });

    currentBusinessOrders = myOrders; 
    
    let totalMoney = 0;
    let pendingOrders = [];
    let completedOrders = [];

    myOrders.forEach(o => {
        const orderVal = parseFloat(o.total) || 0;
        if (o.status !== 'Cancelado') totalMoney += orderVal;
        
        if (o.status === 'Completado' || o.status === 'Mesa Confirmada' || o.status === 'Pagado Online') {
            completedOrders.push(o);
        } else {
            pendingOrders.push(o);
        }
    });

    let dashHtml = '';

    if (isMusic) {
        dashHtml = `
            <div class="bg-gradient-to-br from-neutral-950 via-neutral-900 to-black p-6 rounded-[36px] text-white border border-amber-500/30 shadow-2xl relative overflow-hidden">
                <div class="flex justify-between items-center relative z-10 mb-4">
                    <span class="text-[9px] font-mono uppercase tracking-widest text-amber-400 bg-amber-500/10 px-3 py-1 rounded-full border border-amber-500/30">GOLD RECORD CERTIFIED</span>
                    <i data-lucide="disc" class="w-6 h-6 text-amber-400 animate-pulse"></i>
                </div>

                <div class="flex items-center space-x-4 my-3 relative z-10">
                    <div class="w-16 h-16 rounded-full bg-gradient-to-tr from-yellow-700 via-amber-300 to-yellow-500 p-0.5 shadow-xl flex items-center justify-center shrink-0 animate-[spin_8s_linear_infinite]">
                        <div class="w-full h-full rounded-full bg-neutral-950 flex items-center justify-center border border-amber-400/50">
                            <div class="w-6 h-6 rounded-full bg-amber-400 border-2 border-black flex items-center justify-center text-[8px] font-black text-black">GOLD</div>
                        </div>
                    </div>
                    <div>
                        <h2 class="text-base font-extrabold text-white tracking-tight">${currentBusiness.name}</h2>
                        <p class="text-[10px] text-amber-300/80 font-mono mt-0.5">Estudio de Grabación & Label</p>
                    </div>
                </div>

                <div class="grid grid-cols-2 gap-2 mt-2">
                    <button onclick="if(typeof openBusinessQR === 'function') openBusinessQR()" class="py-3 bg-gradient-to-r from-amber-400 via-yellow-500 to-amber-600 text-black font-extrabold rounded-2xl text-xs shadow-lg flex items-center justify-center space-x-1.5 active:scale-95 transition">
                        <i data-lucide="qr-code" class="w-4 h-4"></i>
                        <span>QR VIP</span>
                    </button>
                    <button onclick="startCameraModal()" class="py-3 bg-neutral-900 border border-amber-500/30 text-white font-bold rounded-2xl text-xs shadow-lg flex items-center justify-center space-x-1.5 active:scale-95 transition">
                        <i data-lucide="scan" class="w-4 h-4 text-amber-400"></i>
                        <span>Cobrar QR</span>
                    </button>
                </div>
            </div>

            <div class="grid grid-cols-2 gap-3">
                <div class="p-4 rounded-3xl bg-neutral-900 border border-amber-500/20 text-left shadow-lg">
                    <span class="text-[9px] text-neutral-400 font-mono uppercase tracking-widest">Licencias Vendidas</span>
                    <h3 class="text-2xl font-black text-white mt-1">${myOrders.length}</h3>
                </div>
                <div class="p-4 rounded-3xl bg-neutral-900 border border-amber-500/20 text-left shadow-lg">
                    <span class="text-[9px] text-amber-400/80 font-mono uppercase tracking-widest">Royalties Acumulados</span>
                    <h3 class="text-2xl font-black text-amber-400 mt-1 font-mono">${totalMoney.toLocaleString('es-ES', { minimumFractionDigits: 2 })} €</h3>
                </div>
            </div>

            <div class="grid grid-cols-2 gap-3">
                <button onclick="openStockControlModal()" class="py-4 bg-gradient-to-r from-amber-400 to-yellow-500 text-black font-black rounded-2xl shadow-xl active:scale-95 transition flex justify-center items-center space-x-2 text-xs">
                    <i data-lucide="music" class="w-4 h-4"></i>
                    <span>Gestor de Beats</span>
                </button>
                <button onclick="if(typeof openModal === 'function') openModal('Agenda de Grabación')" class="py-4 bg-neutral-900 text-white border border-neutral-800 font-bold rounded-2xl shadow-sm active:scale-95 transition flex justify-center items-center space-x-2 text-xs">
                    <i data-lucide="mic" class="w-4 h-4 text-amber-400"></i>
                    <span>Horas de Estudio</span>
                </button>
            </div>
        `;
    } else if (isRestaurant) {
        dashHtml += `
            <div class="grid grid-cols-3 gap-3">
                <div class="p-4 rounded-3xl bg-neutral-50 border border-neutral-200/70 flex flex-col justify-between">
                    <span class="text-[9px] text-neutral-400 font-mono uppercase tracking-wider mb-1">Pendientes</span>
                    <h3 class="text-lg font-extrabold text-black font-mono">${pendingOrders.length}</h3>
                </div>
                <div class="p-4 rounded-3xl bg-neutral-50 border border-neutral-200/70 flex flex-col justify-between">
                    <span class="text-[9px] text-neutral-400 font-mono uppercase tracking-wider mb-1">Confirmadas</span>
                    <h3 class="text-lg font-extrabold text-black font-mono">${completedOrders.length}</h3>
                </div>
                <div class="p-4 rounded-3xl bg-neutral-50 border border-neutral-200/70 flex flex-col justify-between">
                    <span class="text-[9px] text-neutral-400 font-mono uppercase tracking-wider mb-1">Caja Total</span>
                    <h3 class="text-lg font-extrabold text-black font-mono">${totalMoney.toLocaleString('es-ES', { minimumFractionDigits: 2 })}€</h3>
                </div>
            </div>
            
            <div class="grid grid-cols-2 gap-2">
                <button onclick="if(typeof window.openKitchenOrdersModal === 'function') window.openKitchenOrdersModal()" class="py-3.5 bg-black text-white font-bold rounded-2xl shadow-md active:scale-95 transition flex items-center justify-center space-x-2 text-xs col-span-2 border border-black">
                    <i data-lucide="utensils" class="w-4 h-4 text-emerald-400 animate-pulse"></i>
                    <span>Pantalla de Cocina en Directo</span>
                </button>
                <button onclick="openDailyMenuConfigModal()" class="py-3 bg-neutral-50 border border-neutral-200 text-black font-bold rounded-2xl active:scale-95 transition flex items-center justify-center space-x-2 text-xs">
                    <i data-lucide="chef-hat" class="w-4 h-4 text-amber-500"></i>
                    <span>Menú del Día</span>
                </button>
                <button onclick="openStockControlModal()" class="py-3 bg-neutral-50 border border-neutral-200 text-black font-bold rounded-2xl active:scale-95 transition flex items-center justify-center space-x-2 text-xs">
                    <i data-lucide="book-open" class="w-4 h-4"></i>
                    <span>Carta Digital</span>
                </button>
                <button onclick="openRestaurantConfigModal()" class="py-3 bg-neutral-50 border border-neutral-200 text-black font-bold rounded-2xl active:scale-95 transition flex items-center justify-center space-x-2 text-xs">
                    <i data-lucide="sliders" class="w-4 h-4"></i>
                    <span>Horarios & Mesas</span>
                </button>
                <button onclick="openTablesQRManagerModal()" class="py-3 bg-neutral-50 border border-neutral-200 text-black font-bold rounded-2xl active:scale-95 transition flex items-center justify-center space-x-2 text-xs">
                    <i data-lucide="qr-code" class="w-4 h-4"></i>
                    <span>QRs Mesas</span>
                </button>
            </div>
        `;
    } else if (cat.includes('pel')) {
        dashHtml += `
            <div class="grid grid-cols-2 gap-3">
                <div class="p-4 rounded-3xl bg-neutral-50 border border-neutral-200/70">
                    <span class="text-[10px] text-neutral-400 font-mono uppercase">Citas Activas</span>
                    <h3 class="text-xl font-extrabold text-black mt-1">${pendingOrders.length}</h3>
                </div>
                <div class="p-4 rounded-3xl bg-neutral-50 border border-neutral-200/70">
                    <span class="text-[10px] text-neutral-400 font-mono uppercase">Caja Acumulada</span>
                    <h3 class="text-xl font-extrabold text-black mt-1 font-mono">${totalMoney.toLocaleString('es-ES', { minimumFractionDigits: 2 })} €</h3>
                </div>
            </div>
            <div class="flex space-x-3">
                <button onclick="openStockControlModal()" class="flex-1 py-4 bg-white border border-neutral-200 text-black font-bold rounded-2xl shadow-sm active:scale-95 transition flex justify-center items-center space-x-2">
                    <i data-lucide="scissors" class="w-4 h-4"></i><span>Servicios</span>
                </button>
                <button onclick="if(typeof openModal === 'function') openModal('Agenda de Citas')" class="flex-1 py-4 bg-black text-white font-bold rounded-2xl shadow-md active:scale-95 transition flex justify-center items-center space-x-2">
                    <i data-lucide="calendar" class="w-4 h-4"></i><span>Agenda</span>
                </button>
            </div>
        `;
    } else {
        dashHtml += `
            <section class="glass-dark p-6 rounded-[32px] text-white flex flex-col justify-between space-y-4 relative overflow-hidden shadow-xl">
                <div class="flex justify-between items-start relative z-10">
                    <div>
                        <span class="text-[9px] text-neutral-400 font-mono tracking-widest uppercase bg-white/10 px-2.5 py-1 rounded-full">TERMINAL DE NEGOCIO</span>
                        <h2 class="text-lg font-medium tracking-tight mt-2 text-white">Cobro & Escáner</h2>
                    </div>
                    <i data-lucide="qr-code" class="w-5 h-5 text-white"></i>
                </div>
                <div class="grid grid-cols-2 gap-2 relative z-10">
                    <button onclick="if(typeof openBusinessQR === 'function') openBusinessQR()" class="py-3.5 bg-white text-black font-semibold rounded-2xl text-xs tracking-wide transition shadow-lg flex items-center justify-center space-x-1.5 active:scale-95">
                        <i data-lucide="qr-code" class="w-4 h-4"></i>
                        <span>Mi QR</span>
                    </button>
                    <button onclick="startCameraModal()" class="py-3.5 bg-white/15 border border-white/20 text-white font-semibold rounded-2xl text-xs tracking-wide transition shadow-lg flex items-center justify-center space-x-1.5 active:scale-95">
                        <i data-lucide="scan" class="w-4 h-4"></i>
                        <span>Cobrar QR</span>
                    </button>
                </div>
            </section>

            <div class="grid grid-cols-2 gap-3">
                <div class="p-4 rounded-3xl bg-neutral-50 border border-neutral-200/70">
                    <span class="text-[10px] text-neutral-400 font-mono uppercase">Pendientes</span>
                    <h3 class="text-xl font-extrabold text-black mt-1">${pendingOrders.length}</h3>
                </div>
                <div class="p-4 rounded-3xl bg-neutral-50 border border-neutral-200/70">
                    <span class="text-[10px] text-neutral-400 font-mono uppercase">Caja</span>
                    <h3 class="text-xl font-extrabold text-black mt-1 font-mono">${totalMoney.toLocaleString('es-ES', { minimumFractionDigits: 2 })} €</h3>
                </div>
            </div>

            <button onclick="openStockControlModal()" class="w-full py-4 bg-white border border-neutral-200 text-black font-bold rounded-2xl shadow-sm active:scale-95 transition flex justify-center items-center space-x-2">
                <i data-lucide="package" class="w-4 h-4"></i>
                <span>Control de Stock y Catálogo</span>
            </button>
        `;
    }

    dashHtml += `
        <div class="space-y-2 pt-2">
            <div class="flex justify-between items-center px-1">
                <h3 class="text-[10px] font-mono uppercase tracking-widest text-neutral-400">Último Registro</h3>
                <button onclick="switchTab('business-orders')" class="text-[10px] font-bold text-black hover:underline">Ver todos</button>
            </div>
            <div>
    `;

    if (myOrders.length === 0) {
        dashHtml += '<p class="text-xs text-neutral-400 text-center py-4 bg-neutral-50 rounded-3xl border border-neutral-100">No hay actividad reciente registrada.</p>';
    } else {
        const o = myOrders[0]; 
        const isCompleted = o.status === 'Completado' || o.status === 'Mesa Confirmada';
        const isPaid = o.status === 'Pagado Online';
        const iconBg = isCompleted ? 'bg-neutral-100 text-neutral-500' : (isPaid ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600');
        const iconName = (isRestaurant || cat.includes('pel')) ? 'calendar' : (isPaid ? 'shopping-bag' : 'clock');
        const totalVal = parseFloat(o.total) || 0;
        
        dashHtml += `
            <div class="p-4 rounded-3xl bg-white border border-neutral-200/80 shadow-sm flex justify-between items-center">
                <div class="flex items-center space-x-3 overflow-hidden flex-1 mr-2">
                    <div class="w-9 h-9 rounded-2xl ${iconBg} flex items-center justify-center shrink-0"><i data-lucide="${iconName}" class="w-4 h-4"></i></div>
                    <div class="overflow-hidden">
                        <span class="text-xs font-bold block text-black truncate">${o.items}</span>
                        <span class="text-[9px] text-neutral-500 font-mono block">Día: ${o.date} • ${o.time}</span>
                        <span class="text-[9px] text-neutral-400 block truncate">Cliente: ${o.customer}</span>
                    </div>
                </div>
                <div class="text-right shrink-0">
                    ${!o.items.toLowerCase().includes('reserva') ? `<span class="block text-sm font-bold text-black font-mono">${totalVal.toFixed(2)} €</span>` : ''}
                    <span class="block text-[9px] ${isCompleted ? 'text-neutral-400' : (isPaid ? 'text-emerald-600' : 'text-amber-600')} font-bold">${o.status}</span>
                </div>
            </div>
        `;
    }
    dashHtml += `</div></div>`;
    dashboardContainer.innerHTML = dashHtml;

    if (ordersContainer) {
        const isPendingTab = activeOrdersTab === 'pending';
        const displayList = isPendingTab ? pendingOrders : completedOrders;
        const pendingLabel = isRestaurant ? "Pendientes Aprobación" : "Pendientes";
        const completedLabel = isRestaurant ? "Confirmadas" : "Completados";

        let ordersHtml = `
            <div class="flex justify-between items-center px-1">
                <div class="flex items-center space-x-1.5 bg-neutral-100 p-1 rounded-2xl border border-neutral-200/60 shadow-inner">
                    <button onclick="setOrdersTab('pending')" class="px-3 py-1.5 rounded-xl text-xs font-bold transition ${isPendingTab ? 'bg-white text-black shadow-sm' : 'text-neutral-400 hover:text-black'} flex items-center space-x-1.5">
                        <span>${pendingLabel}</span>
                        <span class="w-4 h-4 rounded-full ${isPendingTab ? 'bg-black text-white' : 'bg-neutral-200 text-neutral-600'} text-[9px] flex items-center justify-center font-mono">${pendingOrders.length}</span>
                    </button>
                    <button onclick="setOrdersTab('completed')" class="px-3 py-1.5 rounded-xl text-xs font-bold transition ${!isPendingTab ? 'bg-white text-black shadow-sm' : 'text-neutral-400 hover:text-black'} flex items-center space-x-1.5">
                        <span>${completedLabel}</span>
                        <span class="w-4 h-4 rounded-full ${!isPendingTab ? 'bg-black text-white' : 'bg-neutral-200 text-neutral-600'} text-[9px] flex items-center justify-center font-mono">${completedOrders.length}</span>
                    </button>
                </div>
                <span class="text-[10px] font-mono uppercase tracking-widest text-neutral-400">${displayList.length} total</span>
            </div>

            <div class="space-y-2 pt-1">
        `;

        if (displayList.length === 0) {
            const emptyMsg = isPendingTab 
                ? (isRestaurant ? "No hay reservas pendientes de aprobación." : "No tienes pedidos ni reservas pendientes.") 
                : (isRestaurant ? "Aún no hay reservas confirmadas." : "Aún no hay registros completados.");
            ordersHtml += `<p class="text-xs text-neutral-400 text-center py-8 bg-neutral-50/60 rounded-3xl border border-neutral-100">${emptyMsg}</p>`;
        } else {
            displayList.forEach(o => {
                const isCompleted = o.status === 'Completado' || o.status === 'Mesa Confirmada';
                const isPaid = o.status === 'Pagado Online';
                const iconBg = isCompleted ? 'bg-neutral-100 text-neutral-400' : (isPaid ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600');
                const iconName = (isRestaurant || cat.includes('pel')) ? 'calendar' : (isPaid ? 'shopping-bag' : 'clock');
                const totalVal = parseFloat(o.total) || 0;
                
                ordersHtml += `
                    <div class="p-4 rounded-3xl bg-white border border-neutral-200/80 shadow-sm flex justify-between items-center transition hover:border-black/20">
                        <div class="flex items-center space-x-3 overflow-hidden flex-1 mr-2">
                            <div class="w-9 h-9 rounded-2xl ${iconBg} flex items-center justify-center shrink-0">
                                <i data-lucide="${iconName}" class="w-4 h-4"></i>
                            </div>
                            <div class="overflow-hidden">
                                <span class="text-xs font-bold block text-black truncate">${o.items}</span>
                                <span class="text-[9px] text-neutral-500 font-mono block">Día: ${o.date} • ${o.time}</span>
                                <span class="text-[9px] text-neutral-400 block truncate">Cliente: ${o.customer}</span>
                            </div>
                        </div>

                        <div class="flex items-center space-x-2.5 shrink-0">
                            <div class="text-right">
                                ${!o.items.toLowerCase().includes('reserva') ? `<span class="block text-sm font-bold text-black font-mono">${totalVal.toFixed(2)} €</span>` : ''}
                                <span class="block text-[9px] ${isCompleted ? 'text-emerald-700' : (isPaid ? 'text-emerald-600' : 'text-amber-600')} font-bold">${o.status}</span>
                            </div>

                            ${!isCompleted ? `
                                <button onclick="completeBusinessOrder('${o.id}')" title="Aprobar y Confirmar Reserva" class="w-9 h-9 rounded-2xl bg-black text-white hover:bg-neutral-800 flex items-center justify-center active:scale-90 transition shadow-md shrink-0">
                                    <i data-lucide="check" class="w-4 h-4"></i>
                                </button>
                            ` : `
                                <div class="w-9 h-9 rounded-2xl bg-neutral-100 text-neutral-400 flex items-center justify-center shrink-0">
                                    <i data-lucide="check-check" class="w-4 h-4"></i>
                                </div>
                            `}
                        </div>
                    </div>
                `;
            });
        }

        ordersHtml += `</div>`;
        ordersContainer.innerHTML = ordersHtml;
    }

    if (typeof lucide !== 'undefined') lucide.createIcons();
}