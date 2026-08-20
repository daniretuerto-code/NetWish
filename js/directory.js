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

let activeBusinessName = "";

function openPublicBusiness(name, type) {
    activeBusinessName = name;
    activePayee = name; 
    document.getElementById('publicBizName').innerText = name;
    
    const imgEl = document.getElementById('publicBizImage');
    type = type || '';

    if (type.includes('pan') || type.includes('comercio')) {
        imgEl.src = "https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=800&q=80";
        document.getElementById('publicBizTag').innerText = "Panadería / Comercio";
    } else if (type.includes('pel')) {
        imgEl.src = "https://images.unsplash.com/photo-1562322140-8baeececf3df?auto=format&fit=crop&w=800&q=80";
        document.getElementById('publicBizTag').innerText = "Peluquería";
    } else {
        imgEl.src = "https://images.unsplash.com/photo-1556740738-b6a63e27c4df?auto=format&fit=crop&w=800&q=80";
        document.getElementById('publicBizTag').innerText = "Local Comercial";
    }

    renderPublicCatalogItems();
    updateCartDisplay();
    
    if (typeof swipeAnim !== 'undefined') swipeAnim = 'slide-in-right';
    switchTab('public-business');
}

function getBusinessCatalog(bizName) {
    const storageKey = 'netwish_catalog_' + bizName;
    const saved = localStorage.getItem(storageKey);
    if (saved) {
        try { return JSON.parse(saved); } catch(e) {}
    }
    return [
        { name: "Barra Rústica", desc: "Recién horneada a leña.", price: 1.20 },
        { name: "Hogaza de Pueblo", desc: "500g de masa madre pura.", price: 2.50 }
    ];
}

function renderPublicCatalogItems() {
    const catalogEl = document.getElementById('publicBizCatalog');
    if (!catalogEl) return;

    const items = getBusinessCatalog(activeBusinessName);
    let html = '';

    items.forEach(item => {
        const existingInCart = cartItemsList.find(i => i.name === item.name);
        const qty = existingInCart ? existingInCart.qty : 0;

        html += `
            <div class="p-4 rounded-3xl bg-white border border-neutral-200/80 shadow-sm flex justify-between items-center transition">
                <div class="flex-1 pr-4">
                    <h4 class="text-sm font-bold text-black">${item.name}</h4>
                    <p class="text-[10px] text-neutral-500 mt-0.5">${item.desc || 'Especialidad de la casa'}</p>
                    <p class="text-xs font-extrabold text-black mt-2">${item.price.toLocaleString('es-ES', {minimumFractionDigits:2})} €</p>
                </div>
                
                <div class="flex items-center space-x-2">
                    ${qty > 0 ? `
                        <div class="flex items-center bg-neutral-100 rounded-2xl p-1 border border-neutral-200/60 shadow-inner">
                            <button onclick="changeItemQuantity('${item.name}', ${item.price}, -1)" class="w-8 h-8 rounded-xl bg-white text-black font-bold flex items-center justify-center shadow-sm active:scale-90 transition">
                                <i data-lucide="minus" class="w-3.5 h-3.5"></i>
                            </button>
                            <span class="w-8 text-center text-xs font-extrabold text-black">${qty}</span>
                            <button onclick="changeItemQuantity('${item.name}', ${item.price}, 1)" class="w-8 h-8 rounded-xl bg-black text-white font-bold flex items-center justify-center shadow-md active:scale-90 transition">
                                <i data-lucide="plus" class="w-3.5 h-3.5"></i>
                            </button>
                        </div>
                    ` : `
                        <button onclick="changeItemQuantity('${item.name}', ${item.price}, 1)" class="w-10 h-10 rounded-2xl bg-neutral-900 text-white shadow-md flex items-center justify-center active:scale-90 transition">
                            <i data-lucide="plus" class="w-4 h-4"></i>
                        </button>
                    `}
                </div>
            </div>
        `;
    });

    catalogEl.innerHTML = html;
    lucide.createIcons();
}

function changeItemQuantity(name, price, delta) {
    if(!currentUser) { openAuthModal('login'); return; }

    const existingIndex = cartItemsList.findIndex(i => i.name === name);

    if (existingIndex >= 0) {
        cartItemsList[existingIndex].qty += delta;
        if (cartItemsList[existingIndex].qty <= 0) {
            cartItemsList.splice(existingIndex, 1);
        }
    } else if (delta > 0) {
        cartItemsList.push({ name: name, price: price, qty: 1 });
    }

    cartTotalValue = cartItemsList.reduce((acc, curr) => acc + (curr.price * curr.qty), 0);
    cartItemCount = cartItemsList.reduce((acc, curr) => acc + curr.qty, 0);

    updateCartDisplay();
    renderPublicCatalogItems();
}

function updateCartDisplay() {
    const cartBar = document.getElementById('publicBusinessCartBar');
    if (!cartBar) return;
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
                <div>
                    <span class="font-bold">${item.name}</span>
                    <span class="text-[10px] text-neutral-400 block">Cantidad: ${item.qty} uds</span>
                </div>
                <span class="font-bold"> ${(item.price * item.qty).toLocaleString('es-ES', {minimumFractionDigits:2})} €</span>
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

function openStockControlModal() {
    if (!currentBusiness) return;
    const modal = document.getElementById('customModal');
    const modalContent = document.getElementById('modalContent');
    const modalBody = document.getElementById('modalBody');

    const catalog = getBusinessCatalog(currentBusiness.name);

    let productsHtml = '';
    catalog.forEach((p, idx) => {
        productsHtml += `
            <div class="flex justify-between items-center bg-neutral-50 p-3 rounded-2xl border border-neutral-200/60">
                <div>
                    <span class="text-xs font-bold block text-black">${p.name}</span>
                    <span class="text-[10px] text-neutral-500">${p.desc || ''} • <strong class="text-black">${p.price.toFixed(2)} €</strong></span>
                </div>
                <button onclick="deleteStockProduct(${idx})" class="w-8 h-8 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center hover:bg-rose-100 transition">
                    <i data-lucide="trash-2" class="w-4 h-4"></i>
                </button>
            </div>
        `;
    });

    modalBody.innerHTML = `
        <div class="space-y-4 text-left">
            <div class="text-center space-y-1">
                <h3 class="text-base font-bold text-black">Control de Stock y Catálogo</h3>
                <p class="text-[11px] text-neutral-500">Añade o elimina productos de tu escaparate digital en NetWish.</p>
            </div>

            <div class="space-y-2.5 pt-1 border-t border-neutral-100">
                <span class="text-[10px] font-mono uppercase tracking-widest text-neutral-400 block">Añadir Nuevo Artículo</span>
                <input type="text" id="newProdName" placeholder="Nombre (ej. Croissant de Mantequilla)" class="w-full bg-neutral-50 border border-neutral-200 rounded-xl py-2.5 px-3 text-xs text-black focus:outline-none focus:border-black">
                <input type="text" id="newProdDesc" placeholder="Descripción corta (ej. Elaborado cada mañana)" class="w-full bg-neutral-50 border border-neutral-200 rounded-xl py-2.5 px-3 text-xs text-black focus:outline-none focus:border-black">
                <input type="number" step="0.01" id="newProdPrice" placeholder="Precio en € (ej. 1.50)" class="w-full bg-neutral-50 border border-neutral-200 rounded-xl py-2.5 px-3 text-xs text-black focus:outline-none focus:border-black">
                <button onclick="saveNewStockProduct()" class="w-full py-3 bg-black text-white font-semibold rounded-xl text-xs shadow-md mt-1">
                    Guardar y Publicar Artículo
                </button>
            </div>

            <div class="space-y-2 pt-2 border-t border-neutral-100">
                <span class="text-[10px] font-mono uppercase tracking-widest text-neutral-400 block">Artículos en Stock (${catalog.length})</span>
                <div class="max-h-40 overflow-y-auto space-y-2 pr-1">
                    ${catalog.length > 0 ? productsHtml : '<p class="text-xs text-neutral-400 text-center py-3">No hay artículos dados de alta.</p>'}
                </div>
            </div>

            <button onclick="closeModal()" class="w-full py-2 bg-neutral-100 hover:bg-neutral-200 text-black font-bold rounded-xl text-xs transition">
                Cerrar Panel
            </button>
        </div>
    `;
    lucide.createIcons();
    modal.classList.remove('hidden');
    setTimeout(() => { modal.classList.remove('opacity-0'); modalContent.classList.remove('scale-95'); }, 10);
}

function saveNewStockProduct() {
    const name = document.getElementById('newProdName').value.trim();
    const desc = document.getElementById('newProdDesc').value.trim();
    const price = parseFloat(document.getElementById('newProdPrice').value);

    if (!name || isNaN(price) || price <= 0) {
        alert("Introduce un nombre y un precio válido.");
        return;
    }

    const catalog = getBusinessCatalog(currentBusiness.name);
    catalog.push({ name, desc, price });
    localStorage.setItem('netwish_catalog_' + currentBusiness.name, JSON.stringify(catalog));

    openStockControlModal();
}

function deleteStockProduct(index) {
    const catalog = getBusinessCatalog(currentBusiness.name);
    catalog.splice(index, 1);
    localStorage.setItem('netwish_catalog_' + currentBusiness.name, JSON.stringify(catalog));

    openStockControlModal();
}

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
            <button onclick="openStockControlModal()" class="w-full py-4 bg-white border border-neutral-200 text-black font-bold rounded-2xl shadow-sm active:scale-95 transition flex justify-center items-center space-x-2">
                <i data-lucide="package" class="w-4 h-4"></i><span>Control de Stock y Catálogo</span>
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