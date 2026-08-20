async function loadPublicBusinesses() {
    const listContainer = document.getElementById('dynamicBusinessList');
    if (!listContainer) return;
    try {
        const { data, error } = await supabaseClient.from('businesses').select('*');
        if (error) throw error;
        
        const uniqueBusinesses = [];
        const seenNames = new Set();
        
        (data || []).forEach(biz => {
            let rawName = biz.name || biz.Nombre || biz.username || '';
            let cleanName = rawName.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
            
            if (!seenNames.has(cleanName)) {
                seenNames.add(cleanName);
                uniqueBusinesses.push(biz);
            }
        });
        
        allPublicBusinesses = uniqueBusinesses;
        renderBusinessDirectory(allPublicBusinesses);
    } catch (err) {
        listContainer.innerHTML = `<p class="text-xs text-center text-rose-500 py-4">Error al cargar el directorio urbano.</p>`;
    }
}

function renderBusinessDirectory(businesses) {
    const listContainer = document.getElementById('dynamicBusinessList');
    if (!listContainer) return;
    
    if (!businesses || businesses.length === 0) {
        listContainer.innerHTML = `
            <div class="py-12 text-center space-y-3">
                <div class="w-14 h-14 rounded-2xl bg-neutral-100 flex items-center justify-center mx-auto text-neutral-400 shadow-inner">
                    <i data-lucide="clock" class="w-7 h-7"></i>
                </div>
                <h3 class="text-base font-bold text-black">Próximamente</h3>
                <p class="text-xs text-neutral-500 px-4">Aún no hay locales dados de alta. ¡Estamos trabajando en ello!</p>
            </div>
        `;
        lucide.createIcons();
        return;
    }

    let html = '';
    businesses.forEach(biz => {
        const name = biz.name || biz.Nombre || biz.username;
        const cat = (biz.category || biz.Categoria || '').toLowerCase();
        
        let icon = 'store'; let colorClass = 'text-neutral-600'; let bgClass = 'bg-neutral-500/10 border-neutral-500/20';
        
        if (cat.includes('pan') || cat.includes('comercio') || cat.includes('bakery')) { 
            icon = 'shopping-bag'; colorClass = 'text-amber-600'; bgClass = 'bg-amber-500/10 border-amber-500/20'; 
        } else if (cat.includes('pel')) { 
            icon = 'scissors'; colorClass = 'text-blue-600'; bgClass = 'bg-blue-500/10 border-blue-500/20'; 
        } else if (cat.includes('rest') || cat.includes('bar')) { 
            icon = 'utensils'; colorClass = 'text-rose-600'; bgClass = 'bg-rose-500/10 border-rose-500/20'; 
        } else if (cat.includes('movil') || cat.includes('taxi')) {
            icon = 'car'; colorClass = 'text-emerald-600'; bgClass = 'bg-emerald-500/10 border-emerald-500/20';
        } else if (cat.includes('ocio') || cat.includes('evento')) {
            icon = 'sparkles'; colorClass = 'text-purple-600'; bgClass = 'bg-purple-500/10 border-purple-500/20';
        }

        html += `
            <button onclick="openPublicBusiness('${name}', '${cat}')" class="w-full p-4 rounded-3xl bg-white border border-neutral-200/80 shadow-sm flex items-center space-x-4 active:scale-95 transition-transform text-left">
                <div class="w-12 h-12 rounded-xl ${bgClass} flex items-center justify-center shrink-0">
                    <i data-lucide="${icon}" class="w-5 h-5 ${colorClass}"></i>
                </div>
                <div class="flex-1 overflow-hidden">
                    <h3 class="text-sm font-bold text-black truncate">${name}</h3>
                    <p class="text-[10px] text-neutral-500 truncate mt-0.5">${biz.category || 'Comercio Local'} • Click & Collect</p>
                </div>
                <i data-lucide="chevron-right" class="w-4 h-4 text-neutral-300"></i>
            </button>
        `;
    });
    listContainer.innerHTML = html;
    lucide.createIcons();
}

function filterDirectory() {
    const query = document.getElementById('directorySearch').value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const filtered = allPublicBusinesses.filter(biz => {
        const name = (biz.name || biz.Nombre || biz.username || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        const cat = (biz.category || biz.Categoria || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        return name.includes(query) || cat.includes(query);
    });
    renderBusinessDirectory(filtered);
}

// --- VARIABLES Y LÓGICA PARA LA NUEVA VENTANA DE CATEGORÍA ---
let currentCategoryFilter = '';
let currentCategoryBusinesses = [];

function goToDirectory(filter) {
    const titleText = document.getElementById('categoryViewTitle');
    
    let titleMap = {
        'pan': 'Panaderías',
        'rest': 'Restaurantes',
        'pel': 'Peluquerías',
        'movil': 'Movilidad Urbana',
        'ocio': 'Ocio y Cultura',
        'comercio': 'Comercios Locales'
    };

    if (titleText) titleText.innerText = titleMap[filter] || 'Categoría';
    currentCategoryFilter = filter;

    // Filtramos los negocios que pertenecen a esta categoría
    currentCategoryBusinesses = allPublicBusinesses.filter(biz => {
        const cat = (biz.category || biz.Categoria || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        return cat.includes(filter);
    });

    renderCategoryDirectory(currentCategoryBusinesses);
    
    const searchInput = document.getElementById('categorySearch');
    if (searchInput) searchInput.value = '';

    switchTab('category');
}

function renderCategoryDirectory(businesses) {
    const listContainer = document.getElementById('dynamicCategoryList');
    if (!listContainer) return;
    
    if (!businesses || businesses.length === 0) {
        listContainer.innerHTML = `
            <div class="py-12 text-center space-y-3">
                <div class="w-14 h-14 rounded-2xl bg-neutral-100 flex items-center justify-center mx-auto text-neutral-400 shadow-inner">
                    <i data-lucide="clock" class="w-7 h-7"></i>
                </div>
                <h3 class="text-base font-bold text-black">Próximamente</h3>
                <p class="text-xs text-neutral-500 px-4">Aún no hay locales de esta categoría dados de alta. ¡Estamos trabajando en ello!</p>
            </div>
        `;
        lucide.createIcons();
        return;
    }

    let html = '';
    businesses.forEach(biz => {
        const name = biz.name || biz.Nombre || biz.username;
        const cat = (biz.category || biz.Categoria || '').toLowerCase();
        
        let icon = 'store'; let colorClass = 'text-neutral-600'; let bgClass = 'bg-neutral-500/10 border-neutral-500/20';
        
        if (cat.includes('pan') || cat.includes('comercio') || cat.includes('bakery')) { 
            icon = 'shopping-bag'; colorClass = 'text-amber-600'; bgClass = 'bg-amber-500/10 border-amber-500/20'; 
        } else if (cat.includes('pel')) { 
            icon = 'scissors'; colorClass = 'text-blue-600'; bgClass = 'bg-blue-500/10 border-blue-500/20'; 
        } else if (cat.includes('rest') || cat.includes('bar')) { 
            icon = 'utensils'; colorClass = 'text-rose-600'; bgClass = 'bg-rose-500/10 border-rose-500/20'; 
        } else if (cat.includes('movil') || cat.includes('taxi')) {
            icon = 'car'; colorClass = 'text-emerald-600'; bgClass = 'bg-emerald-500/10 border-emerald-500/20';
        } else if (cat.includes('ocio') || cat.includes('evento')) {
            icon = 'sparkles'; colorClass = 'text-purple-600'; bgClass = 'bg-purple-500/10 border-purple-500/20';
        }

        html += `
            <button onclick="openPublicBusiness('${name}', '${cat}')" class="w-full p-4 rounded-3xl bg-white border border-neutral-200/80 shadow-sm flex items-center space-x-4 active:scale-95 transition-transform text-left">
                <div class="w-12 h-12 rounded-xl ${bgClass} flex items-center justify-center shrink-0">
                    <i data-lucide="${icon}" class="w-5 h-5 ${colorClass}"></i>
                </div>
                <div class="flex-1 overflow-hidden">
                    <h3 class="text-sm font-bold text-black truncate">${name}</h3>
                    <p class="text-[10px] text-neutral-500 truncate mt-0.5">${biz.category || 'Comercio Local'} • Click & Collect</p>
                </div>
                <i data-lucide="chevron-right" class="w-4 h-4 text-neutral-300"></i>
            </button>
        `;
    });
    listContainer.innerHTML = html;
    lucide.createIcons();
}

function filterCategoryView() {
    const query = document.getElementById('categorySearch').value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const filtered = currentCategoryBusinesses.filter(biz => {
        const name = (biz.name || biz.Nombre || biz.username || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        const cat = (biz.category || biz.Categoria || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        return name.includes(query) || cat.includes(query);
    });
    renderCategoryDirectory(filtered);
}

function openPublicBusiness(name, type) {
    cartTotalValue = 0; cartItemCount = 0; cartItemsList = []; isCartCheckout = false;
    updateCartDisplay();
    
    activePayee = name; 
    document.getElementById('publicBizName').innerText = name;
    
    const imgEl = document.getElementById('publicBizImage');
    const catalogEl = document.getElementById('publicBizCatalog');
    type = type || '';

    if (type.includes('pan') || type.includes('comercio')) {
        imgEl.src = "https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=800&q=80";
        document.getElementById('publicBizTag').innerText = "Comercio";
        catalogEl.innerHTML = `
            <div class="p-4 rounded-3xl bg-neutral-50/80 border border-neutral-200/60 flex justify-between items-center shadow-sm">
                <div class="flex-1 pr-4"><h4 class="text-sm font-bold text-black">Barra Rústica</h4><p class="text-[10px] text-neutral-500 mt-0.5">Recién horneada a leña.</p><p class="text-xs font-extrabold text-black mt-2">1,20 €</p></div>
                <button onclick="addToCart(1.20, 'Barra Rústica')" class="w-10 h-10 rounded-2xl bg-white border border-neutral-200 shadow-sm flex items-center justify-center text-black active:scale-90"><i data-lucide="plus" class="w-4 h-4"></i></button>
            </div>
            <div class="p-4 rounded-3xl bg-neutral-50/80 border border-neutral-200/60 flex justify-between items-center shadow-sm">
                <div class="flex-1 pr-4"><h4 class="text-sm font-bold text-black">Hogaza de Pueblo</h4><p class="text-[10px] text-neutral-500 mt-0.5">500g de masa madre pura.</p><p class="text-xs font-extrabold text-black mt-2">2,50 €</p></div>
                <button onclick="addToCart(2.50, 'Hogaza de Pueblo')" class="w-10 h-10 rounded-2xl bg-white border border-neutral-200 shadow-sm flex items-center justify-center text-black active:scale-90"><i data-lucide="plus" class="w-4 h-4"></i></button>
            </div>
        `;
    } else if (type.includes('pel')) {
        imgEl.src = "https://images.unsplash.com/photo-1562322140-8baeececf3df?auto=format&fit=crop&w=800&q=80";
        document.getElementById('publicBizTag').innerText = "Peluquería";
        catalogEl.innerHTML = `
            <div class="p-4 rounded-3xl bg-neutral-50/80 border border-neutral-200/60 flex justify-between items-center shadow-sm">
                <div class="flex-1 pr-4"><h4 class="text-sm font-bold text-black">Corte Caballero</h4><p class="text-[10px] text-neutral-500 mt-0.5">Incluye lavado y peinado.</p><p class="text-xs font-extrabold text-black mt-2">12,00 €</p></div>
                <button onclick="addToCart(12.00, 'Corte Caballero')" class="w-10 h-10 rounded-2xl bg-white border border-neutral-200 shadow-sm flex items-center justify-center text-black active:scale-90"><i data-lucide="calendar-plus" class="w-4 h-4"></i></button>
            </div>
        `;
    } else {
        imgEl.src = "https://images.unsplash.com/photo-1556740738-b6a63e27c4df?auto=format&fit=crop&w=800&q=80";
        document.getElementById('publicBizTag').innerText = "Local Comercial";
        catalogEl.innerHTML = `
            <div class="p-4 rounded-3xl bg-neutral-50/80 border border-neutral-200/60 flex justify-between items-center shadow-sm">
                <div class="flex-1 pr-4"><h4 class="text-sm font-bold text-black">Servicio Estándar</h4><p class="text-[10px] text-neutral-500 mt-0.5">Reserva de producto.</p><p class="text-xs font-extrabold text-black mt-2">10,00 €</p></div>
                <button onclick="addToCart(10.00, 'Servicio Estándar')" class="w-10 h-10 rounded-2xl bg-white border border-neutral-200 shadow-sm flex items-center justify-center text-black active:scale-90"><i data-lucide="plus" class="w-4 h-4"></i></button>
            </div>
        `;
    }
    lucide.createIcons();
    
    if (typeof swipeAnim !== 'undefined') swipeAnim = 'slide-in-right';
    switchTab('public-business');
}

function addToCart(price, itemName) {
    if(!currentUser) { openAuthModal('login'); return; }
    cartTotalValue += price;
    cartItemCount += 1;
    cartItemsList.push({ name: itemName, price: price });
    updateCartDisplay();
}

function updateCartDisplay() {
    const cartBar = document.getElementById('publicBusinessCartBar');
    if (cartItemCount > 0) {
        cartBar.classList.remove('translate-y-32');
        document.getElementById('cartTotalDisplay').innerText = cartTotalValue.toLocaleString('es-ES', { minimumFractionDigits: 2 }) + ' €';
        document.getElementById('cartCountDisplay').innerText = cartItemCount;
    } else {
        cartBar.classList.add('translate-y-32');
    }
}

function openCartSummary() {
    if (cartItemCount === 0) return;
    
    let html = '';
    cartItemsList.forEach(item => {
        html += `
            <div class="flex justify-between items-center text-xs py-2.5 border-b border-neutral-100 last:border-0 text-black">
                <span>${item.name}</span>
                <span class="font-bold">${item.price.toLocaleString('es-ES', {minimumFractionDigits:2})} €</span>
            </div>
        `;
    });
    document.getElementById('cartItemsContainer').innerHTML = html;
    document.getElementById('cartSummaryTotal').innerText = cartTotalValue.toLocaleString('es-ES', {minimumFractionDigits:2}) + ' €';
    
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('orderDate').value = today;
    document.getElementById('orderDate').min = today;
    
    document.getElementById('publicBusinessCartBar').classList.add('translate-y-32');
    
    if (typeof swipeAnim !== 'undefined') swipeAnim = 'slide-in-right';
    switchTab('cart');
}

function processCartChoice(action) {
    const date = document.getElementById('orderDate').value;
    const time = document.getElementById('orderTime').value;
    if(!date || !time) { alert("Por favor, elige un día y hora de recogida/cita."); return; }

    pendingOrderDetails = { date, time, action };
    isCartCheckout = true;
    
    if (action === 'pay') {
        rawAmountString = Math.round(cartTotalValue * 100).toString(); 
        updateAmountDisplay();
        document.getElementById('payeeNameDisplay').innerText = activePayee;
        document.getElementById('payeeInitialsBubble').innerText = activePayee.substring(0, 2).toUpperCase();
        
        if (typeof swipeAnim !== 'undefined') swipeAnim = 'slide-in-right';
        switchTab('payment');
    } else {
        executeFullPayment(true);
    }
}

// ==========================================
// --- CONSTRUCCIÓN DEL PANEL DE NEGOCIO ---
// ==========================================
function renderBusinessOrders() {
    if (!currentBusiness) return;
    
    const container = document.getElementById('dynamicDashboardContent');
    if (!container) return;
    
    const cat = (currentBusiness.category || '').toLowerCase();
    
    const orders = JSON.parse(localStorage.getItem('netwish_global_orders') || '[]');
    const myOrders = orders.filter(o => {
        const bName = (currentBusiness.name || '').toLowerCase();
        const oName = (o.businessName || '').toLowerCase();
        return oName.includes(bName.split(' ')[0]) || bName.includes(oName.split(' ')[0]);
    });
    
    let totalMoney = 0;
    let pendingOrdersCount = 0;
    myOrders.forEach(o => {
        if (o.status === 'Pagado Online') totalMoney += o.total;
        if (o.status.includes('Pendiente') || o.status === 'Pagado Online') pendingOrdersCount++;
    });

    let html = `
        <div class="glass-dark p-6 rounded-[32px] text-white flex flex-col items-center space-y-4 relative overflow-hidden shadow-xl">
            <div class="absolute -right-10 -top-10 w-36 h-36 bg-gradient-to-br from-neutral-500/30 to-transparent rounded-full blur-2xl pointer-events-none"></div>
            <div class="text-center relative z-10 w-full"><span class="text-[9px] text-neutral-400 font-mono tracking-widest uppercase bg-white/10 px-3 py-1 rounded-full border border-white/5">Tu QR de Cobro</span></div>
            <div id="businessQRCodeContainer" class="w-36 h-36 bg-white rounded-2xl flex items-center justify-center p-2.5 shadow-inner relative z-10"></div>
            <p class="text-[10px] text-neutral-400 text-center relative z-10 w-4/5">Muestra este QR en el mostrador para recibir pagos directos al instante.</p>
        </div>
    `;

    if (cat.includes('pel')) {
        html += `
            <div class="grid grid-cols-2 gap-3">
                <div class="p-4 rounded-3xl bg-neutral-50 border border-neutral-200/70">
                    <span class="text-[10px] text-neutral-400 font-mono uppercase">Citas Pendientes</span>
                    <h3 class="text-xl font-extrabold text-black mt-1">${pendingOrdersCount}</h3>
                </div>
                <div class="p-4 rounded-3xl bg-neutral-50 border border-neutral-200/70">
                    <span class="text-[10px] text-neutral-400 font-mono uppercase">Caja Acumulada</span>
                    <h3 class="text-xl font-extrabold text-black mt-1">${totalMoney.toLocaleString('es-ES', { minimumFractionDigits: 2 })} €</h3>
                </div>
            </div>
            <button onclick="openModal('Agenda de Citas')" class="w-full py-4 bg-black text-white font-bold rounded-2xl shadow-md active:scale-95 transition flex justify-center items-center space-x-2">
                <i data-lucide="calendar" class="w-4 h-4"></i><span>Ver Agenda y Horarios</span>
            </button>
        `;
    } else if (cat.includes('rest') || cat.includes('bar')) {
        html += `
            <div class="grid grid-cols-3 gap-3">
                <div class="p-4 rounded-3xl bg-neutral-50 border border-neutral-200/70 flex flex-col justify-between">
                    <span class="text-[9px] text-neutral-400 font-mono uppercase tracking-wider mb-1">Mesas</span>
                    <h3 class="text-lg font-extrabold text-black">4</h3>
                </div>
                <div class="p-4 rounded-3xl bg-neutral-50 border border-neutral-200/70 flex flex-col justify-between">
                    <span class="text-[9px] text-neutral-400 font-mono uppercase tracking-wider mb-1">Cocina</span>
                    <h3 class="text-lg font-extrabold text-black">${pendingOrdersCount}</h3>
                </div>
                <div class="p-4 rounded-3xl bg-neutral-50 border border-neutral-200/70 flex flex-col justify-between">
                    <span class="text-[9px] text-neutral-400 font-mono uppercase tracking-wider mb-1">Caja</span>
                    <h3 class="text-lg font-extrabold text-black">${totalMoney.toLocaleString('es-ES', { minimumFractionDigits: 2 })}€</h3>
                </div>
            </div>
            <div class="flex space-x-3">
                <button onclick="openModal('Carta Digital')" class="flex-1 py-3 bg-white border border-neutral-200 text-black font-bold rounded-2xl shadow-sm active:scale-95 transition flex justify-center items-center space-x-2">
                    <i data-lucide="book-open" class="w-4 h-4"></i><span>Editar Carta</span>
                </button>
                <button onclick="switchTab('scan')" class="flex-1 py-3 bg-black text-white font-bold rounded-2xl shadow-md active:scale-95 transition flex justify-center items-center space-x-2">
                    <i data-lucide="scan-line" class="w-4 h-4"></i><span>Escanear Mesa</span>
                </button>
            </div>
        `;
    } else {
        html += `
            <div class="grid grid-cols-2 gap-3">
                <div class="p-4 rounded-3xl bg-neutral-50 border border-neutral-200/70">
                    <span class="text-[10px] text-neutral-400 font-mono uppercase">Pedidos Click&Collect</span>
                    <h3 class="text-xl font-extrabold text-black mt-1">${pendingOrdersCount}</h3>
                </div>
                <div class="p-4 rounded-3xl bg-neutral-50 border border-neutral-200/70">
                    <span class="text-[10px] text-neutral-400 font-mono uppercase">Caja Acumulada</span>
                    <h3 class="text-xl font-extrabold text-black mt-1">${totalMoney.toLocaleString('es-ES', { minimumFractionDigits: 2 })} €</h3>
                </div>
            </div>
            <button onclick="openModal('Control de Stock')" class="w-full py-4 bg-white border border-neutral-200 text-black font-bold rounded-2xl shadow-sm active:scale-95 transition flex justify-center items-center space-x-2">
                <i data-lucide="package" class="w-4 h-4"></i><span>Actualizar Stock Rápido</span>
            </button>
        `;
    }

    html += `
        <div class="space-y-2 pt-2">
            <div class="flex justify-between items-center px-1">
                <h3 class="text-[10px] font-mono uppercase tracking-widest text-neutral-400">Próximos / Recientes</h3>
                <button onclick="openModal('Historial')" class="text-[10px] font-bold text-black hover:underline">Ver historial</button>
            </div>
            <div class="space-y-2">
    `;

    if (myOrders.length === 0) {
        html += '<p class="text-xs text-neutral-400 text-center py-4">No hay actividad reciente registrada.</p>';
    } else {
        myOrders.reverse().forEach(o => {
            const isPaid = o.status === 'Pagado Online';
            const iconBg = isPaid ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600';
            const iconName = cat.includes('pel') ? 'calendar' : (isPaid ? 'shopping-bag' : 'clock');
            
            html += `
                <div class="p-4 rounded-2xl bg-white border border-neutral-200/80 shadow-sm flex justify-between items-center">
                    <div class="flex items-center space-x-3">
                        <div class="w-8 h-8 rounded-full ${iconBg} flex items-center justify-center shrink-0"><i data-lucide="${iconName}" class="w-4 h-4"></i></div>
                        <div>
                            <span class="text-xs font-bold block text-black">${o.items}</span>
                            <span class="text-[9px] text-neutral-500 font-mono">Día: ${o.date} • ${o.time}</span>
                            <span class="text-[9px] text-neutral-400 block mt-0.5">Cliente: ${o.customer}</span>
                        </div>
                    </div>
                    <div class="text-right">
                        <span class="block text-sm font-bold text-black">${o.total.toFixed(2)} €</span>
                        <span class="block text-[9px] ${isPaid ? 'text-emerald-600' : 'text-amber-600'} font-bold">${o.status}</span>
                    </div>
                </div>
            `;
        });
    }
    
    html += `</div></div>`;
    
    container.innerHTML = html;
    lucide.createIcons();

    if (typeof generateBusinessQR === 'function') generateBusinessQR(currentBusiness);
}