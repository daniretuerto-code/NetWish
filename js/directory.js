let activeBusinessName = "";
let activeBusinessCategory = "";
let currentCategoryFilter = '';
let currentCategoryBusinesses = [];
let ordersRealtimeSubscription = null;
let currentBusinessOrders = []; // Variable global para guardar los pedidos del comercio activo y filtrarlos

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
        const name = biz.name || biz.Nombre || biz.username || 'Comercio';
        const cat = (biz.category || biz.Categoria || '').toLowerCase();
        
        let icon = 'store'; 
        let colorClass = 'text-neutral-600'; 
        let bgClass = 'bg-neutral-500/10 border-neutral-500/20';
        
        if (cat.includes('pan') || cat.includes('comercio') || cat.includes('bakery')) { 
            icon = 'shopping-bag'; colorClass = 'text-amber-600'; bgClass = 'bg-amber-500/10 border-amber-500/20'; 
        } else if (cat.includes('pel')) { 
            icon = 'scissors'; colorClass = 'text-blue-600'; bgClass = 'bg-blue-500/10 border-blue-500/20'; 
        } else if (cat.includes('rest') || cat.includes('bar')) { 
            icon = 'utensils'; colorClass = 'text-rose-600'; bgClass = 'bg-rose-500/10 border-rose-500/20'; 
        } else if (cat.includes('movil') || cat.includes('taxi')) {
            icon = 'car'; colorClass = 'text-emerald-600'; bgClass = 'bg-emerald-500/10 border-emerald-500/20';
        } else if (cat.includes('disco') || cat.includes('music') || cat.includes('produ') || cat.includes('estudio')) {
            icon = 'disc'; colorClass = 'text-yellow-500'; bgClass = 'bg-amber-500/20 border-amber-500/40';
        }

        const safeName = encodeURIComponent(name);
        const safeCat = encodeURIComponent(cat);

        html += `
            <button onclick="openPublicBusiness('${safeName}', '${safeCat}')" class="w-full p-4 rounded-3xl bg-white border border-neutral-200/80 shadow-sm flex items-center space-x-4 active:scale-95 transition-transform text-left">
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

function goToDirectory(filter) {
    const titleText = document.getElementById('categoryViewTitle');
    let titleMap = {
        'pan': 'Panaderías',
        'rest': 'Restaurantes',
        'pel': 'Peluquerías',
        'movil': 'Movilidad Urbana',
        'ocio': 'Ocio y Cultura',
        'comercio': 'Comercios Locales',
        'disco': 'Producción Musical & Beats'
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
        const name = biz.name || biz.Nombre || biz.username || 'Comercio';
        const cat = (biz.category || biz.Categoria || '').toLowerCase();
        
        let icon = 'store'; 
        let colorClass = 'text-neutral-600'; 
        let bgClass = 'bg-neutral-500/10 border-neutral-500/20';
        
        if (cat.includes('pan') || cat.includes('comercio') || cat.includes('bakery')) { 
            icon = 'shopping-bag'; colorClass = 'text-amber-600'; bgClass = 'bg-amber-500/10 border-amber-500/20'; 
        } else if (cat.includes('pel')) { 
            icon = 'scissors'; colorClass = 'text-blue-600'; bgClass = 'bg-blue-500/10 border-blue-500/20'; 
        } else if (cat.includes('rest') || cat.includes('bar')) { 
            icon = 'utensils'; colorClass = 'text-rose-600'; bgClass = 'bg-rose-500/10 border-rose-500/20'; 
        } else if (cat.includes('disco') || cat.includes('music') || cat.includes('produ') || cat.includes('estudio')) {
            icon = 'disc'; colorClass = 'text-yellow-500'; bgClass = 'bg-amber-500/20 border-amber-500/40';
        }

        const safeName = encodeURIComponent(name);
        const safeCat = encodeURIComponent(cat);

        html += `
            <button onclick="openPublicBusiness('${safeName}', '${safeCat}')" class="w-full p-4 rounded-3xl bg-white border border-neutral-200/80 shadow-sm flex items-center space-x-4 active:scale-95 transition-transform text-left">
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

function openPublicBusiness(safeName, safeType) {
    activeBusinessName = decodeURIComponent(safeName || '');
    activeBusinessCategory = decodeURIComponent(safeType || '').toLowerCase();
    activePayee = activeBusinessName;
    
    document.getElementById('publicBizName').innerText = activeBusinessName;
    const imgEl = document.getElementById('publicBizImage');

    if (activeBusinessCategory.includes('disco') || activeBusinessCategory.includes('music') || activeBusinessCategory.includes('produ') || activeBusinessCategory.includes('estudio')) {
        imgEl.src = "https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?auto=format&fit=crop&w=800&q=80";
        document.getElementById('publicBizTag').innerText = "RECORD LABEL";
    } else if (activeBusinessCategory.includes('pan') || activeBusinessCategory.includes('comercio')) {
        imgEl.src = "https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=800&q=80";
        document.getElementById('publicBizTag').innerText = "Comercio Local";
    } else if (activeBusinessCategory.includes('pel')) {
        imgEl.src = "https://images.unsplash.com/photo-1562322140-8baeececf3df?auto=format&fit=crop&w=800&q=80";
        document.getElementById('publicBizTag').innerText = "Peluquería";
    } else {
        imgEl.src = "https://images.unsplash.com/photo-1556740738-b6a63e27c4df?auto=format&fit=crop&w=800&q=80";
        document.getElementById('publicBizTag').innerText = "Comercio";
    }

    cartTotalValue = 0; 
    cartItemCount = 0; 
    cartItemsList = []; 
    isCartCheckout = false;
    
    updateCartDisplay();
    renderPublicCatalogItems();
    
    if (typeof swipeAnim !== 'undefined') swipeAnim = 'slide-in-right';
    switchTab('public-business');
}

async function renderPublicCatalogItems() {
    const catalogEl = document.getElementById('publicBizCatalog');
    if (!catalogEl) return;

    catalogEl.innerHTML = `
        <div class="py-8 text-center space-y-2">
            <i data-lucide="loader-2" class="w-5 h-5 mx-auto animate-spin text-neutral-400"></i>
            <p class="text-[11px] text-neutral-400">Sincronizando catálogo...</p>
        </div>
    `;
    lucide.createIcons();

    let items = [];
    try {
        const { data, error } = await supabaseClient
            .from('products')
            .select('*');
            
        if (error) throw error;
        
        const cleanActiveName = activeBusinessName.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        const activeTokens = cleanActiveName.split(/\s+/).filter(t => t.length > 2);

        items = (data || []).filter(item => {
            const bId = String(item.business_id || '').trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
            if (bId === cleanActiveName || bId === 'biz_db') return true;
            return activeTokens.some(token => bId.includes(token));
        });

    } catch (err) {
        console.error("Error consultando Supabase:", err);
    }

    if (items.length === 0) {
        catalogEl.innerHTML = `
            <div class="p-6 rounded-3xl bg-neutral-50 border border-neutral-200/60 text-center space-y-2">
                <i data-lucide="package-open" class="w-6 h-6 mx-auto text-neutral-300"></i>
                <p class="text-xs font-bold text-black">Sin artículos disponibles</p>
                <p class="text-[10px] text-neutral-400">Este establecimiento aún no ha publicado artículos en su catálogo.</p>
            </div>
        `;
        lucide.createIcons();
        return;
    }

    let html = '';
    items.forEach(item => {
        const price = parseFloat(item.price) || 0;
        const itemIdStr = String(item.id);
        const existingInCart = cartItemsList.find(i => String(i.id) === itemIdStr);
        const qty = existingInCart ? existingInCart.qty : 0;
        const isMusic = activeBusinessCategory.includes('disco') || activeBusinessCategory.includes('music') || activeBusinessCategory.includes('produ');

        const safeItemId = encodeURIComponent(itemIdStr);
        const safeItemName = encodeURIComponent(item.name || 'Producto');

        html += `
            <div class="p-4 rounded-3xl bg-white border border-neutral-200/80 shadow-sm flex justify-between items-center transition">
                <div class="flex-1 pr-4">
                    <div class="flex items-center space-x-1.5">
                        ${isMusic ? '<i data-lucide="disc" class="w-3.5 h-3.5 text-amber-500 shrink-0"></i>' : ''}
                        <h4 class="text-sm font-bold text-black">${item.name}</h4>
                    </div>
                    <p class="text-[10px] text-neutral-500 mt-0.5">${item.description || ''}</p>
                    <p class="text-xs font-extrabold text-black mt-2">${price.toLocaleString('es-ES', {minimumFractionDigits:2})} €</p>
                </div>
                
                <div class="flex items-center space-x-2 shrink-0">
                    ${qty > 0 ? `
                        <div class="flex items-center bg-neutral-100 rounded-2xl p-1 border border-neutral-200/60 shadow-inner">
                            <button onclick="changeItemQuantity('${safeItemId}', '${safeItemName}', ${price}, -1)" class="w-8 h-8 rounded-xl bg-white text-black font-bold flex items-center justify-center shadow-sm active:scale-90 transition">
                                <i data-lucide="minus" class="w-3.5 h-3.5"></i>
                            </button>
                            <span class="w-8 text-center text-xs font-extrabold text-black">${qty}</span>
                            <button onclick="changeItemQuantity('${safeItemId}', '${safeItemName}', ${price}, 1)" class="w-8 h-8 rounded-xl bg-black text-white font-bold flex items-center justify-center shadow-md active:scale-90 transition">
                                <i data-lucide="plus" class="w-3.5 h-3.5"></i>
                            </button>
                        </div>
                    ` : `
                        <button onclick="changeItemQuantity('${safeItemId}', '${safeItemName}', ${price}, 1)" class="w-10 h-10 rounded-2xl bg-black text-white shadow-md flex items-center justify-center active:scale-90 transition font-bold">
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

function changeItemQuantity(encodedId, encodedName, price, delta) {
    if (!currentUser) { 
        if (typeof openAuthModal === 'function') openAuthModal('login'); 
        return; 
    }

    const id = decodeURIComponent(encodedId);
    const name = decodeURIComponent(encodedName);
    const existingIndex = cartItemsList.findIndex(i => String(i.id) === String(id));

    if (existingIndex >= 0) {
        cartItemsList[existingIndex].qty += delta;
        if (cartItemsList[existingIndex].qty <= 0) {
            cartItemsList.splice(existingIndex, 1);
        }
    } else if (delta > 0) {
        cartItemsList.push({ id: id, name: name, price: price, qty: 1 });
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
    if (!date || !time) { 
        alert("Por favor, elige un día y hora de recogida/cita."); 
        return; 
    }

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
        if (typeof executeFullPayment === 'function') executeFullPayment(true);
    }
}

async function openStockControlModal() {
    if (!currentBusiness) return;
    const modal = document.getElementById('customModal');
    const modalContent = document.getElementById('modalContent');
    const modalBody = document.getElementById('modalBody');

    const cat = (currentBusiness.category || '').toLowerCase();
    const isMusic = cat.includes('disco') || cat.includes('music') || cat.includes('produ') || cat.includes('estudio');

    const title = isMusic ? "Gestor de Beats & Tracks" : "Control de Stock y Catálogo";
    const subtitle = isMusic ? "Publica licencias, beats y servicios de estudio." : "Añade o elimina productos del catálogo digital.";
    const phName = isMusic ? "Nombre (ej. Drill Beat Vol.1)" : "Nombre (ej. Barra de Pan Rústica)";
    const phDesc = isMusic ? "Descripción (ej. WAV + Stems, Sin tags)" : "Descripción corta (ej. Elaboración artesanal)";
    const btnText = isMusic ? "Publicar Beat en NetWish" : "Publicar Producto";

    modalBody.innerHTML = `
        <div class="space-y-4 text-center py-6">
            <i data-lucide="loader-2" class="w-6 h-6 mx-auto animate-spin text-black mb-2"></i>
            <p class="text-xs text-neutral-500">Consultando Supabase...</p>
        </div>
    `;
    lucide.createIcons();
    modal.classList.remove('hidden');
    setTimeout(() => { modal.classList.remove('opacity-0'); modalContent.classList.remove('scale-95'); }, 10);

    let catalog = [];
    try {
        const { data, error } = await supabaseClient
            .from('products')
            .select('*');
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
        productsHtml += `
            <div class="flex justify-between items-center bg-neutral-50 p-3 rounded-2xl border border-neutral-200/60">
                <div class="overflow-hidden pr-2">
                    <span class="text-xs font-bold block text-black truncate">${p.name}</span>
                    <span class="text-[10px] text-neutral-500 block truncate">${p.description || ''} • <strong class="text-black">${price.toFixed(2)} €</strong></span>
                </div>
                <button onclick="deleteStockProduct('${p.id}')" class="w-8 h-8 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center hover:bg-rose-100 shrink-0 transition">
                    <i data-lucide="trash-2" class="w-4 h-4"></i>
                </button>
            </div>
        `;
    });

    modalBody.innerHTML = `
        <div class="space-y-4 text-left">
            <div class="text-center space-y-1">
                <h3 class="text-base font-bold text-black">${title}</h3>
                <p class="text-[11px] text-neutral-500">${subtitle}</p>
            </div>

            <div class="space-y-2.5 pt-1 border-t border-neutral-100">
                <span class="text-[10px] font-mono uppercase tracking-widest text-neutral-400 block">Nuevo Registro</span>
                <input type="text" id="newProdName" placeholder="${phName}" class="w-full bg-neutral-50 border border-neutral-200 rounded-xl py-2.5 px-3 text-xs text-black focus:outline-none focus:border-black">
                <input type="text" id="newProdDesc" placeholder="${phDesc}" class="w-full bg-neutral-50 border border-neutral-200 rounded-xl py-2.5 px-3 text-xs text-black focus:outline-none focus:border-black">
                <input type="number" step="0.01" id="newProdPrice" placeholder="Precio en € (ej. 29.99)" class="w-full bg-neutral-50 border border-neutral-200 rounded-xl py-2.5 px-3 text-xs text-black focus:outline-none focus:border-black">
                <button onclick="saveNewStockProduct()" class="w-full py-3 bg-black text-white font-semibold rounded-xl text-xs shadow-md mt-1 flex items-center justify-center space-x-2 active:scale-95 transition">
                    <i data-lucide="cloud-upload" class="w-4 h-4"></i>
                    <span>${btnText}</span>
                </button>
            </div>

            <div class="space-y-2 pt-2 border-t border-neutral-100">
                <span class="text-[10px] font-mono uppercase tracking-widest text-neutral-400 block">Artículos Publicados (${catalog.length})</span>
                <div class="max-h-40 overflow-y-auto space-y-2 pr-1">
                    ${catalog.length > 0 ? productsHtml : '<p class="text-xs text-neutral-400 text-center py-3">No hay artículos dados de alta en Supabase.</p>'}
                </div>
            </div>

            <button onclick="if(typeof closeModal === 'function') closeModal()" class="w-full py-2 bg-neutral-100 hover:bg-neutral-200 text-black font-bold rounded-xl text-xs transition">
                Cerrar
            </button>
        </div>
    `;
    lucide.createIcons();
}

async function saveNewStockProduct() {
    if (!currentBusiness) return;
    
    const name = document.getElementById('newProdName').value.trim();
    const desc = document.getElementById('newProdDesc').value.trim();
    const price = parseFloat(document.getElementById('newProdPrice').value);

    if (!name || isNaN(price) || price <= 0) {
        alert("Introduce un nombre y un precio válido.");
        return;
    }

    try {
        const { error } = await supabaseClient
            .from('products')
            .insert([{ 
                business_id: currentBusiness.name, 
                name: name, 
                description: desc, 
                price: price 
            }]);
            
        if (error) throw error;
        openStockControlModal();
    } catch (err) {
        alert("Error en Supabase: " + err.message);
    }
}

async function deleteStockProduct(productId) {
    try {
        const { error } = await supabaseClient
            .from('products')
            .delete()
            .eq('id', productId);
            
        if (error) throw error;
        openStockControlModal();
    } catch (err) {
        alert("Error al eliminar: " + err.message);
    }
}

// --- MODAL DE HISTORIAL FILTRABLE ---
function openHistoryModal(dateFilter = '') {
    if (!currentBusiness) return;
    const modal = document.getElementById('customModal');
    const modalContent = document.getElementById('modalContent');
    const modalBody = document.getElementById('modalBody');

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
            const isPaid = o.status === 'Pagado Online';
            const iconBg = isPaid ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600';
            const iconName = cat.includes('pel') ? 'calendar' : (isPaid ? 'shopping-bag' : 'clock');
            const totalVal = parseFloat(o.total) || 0;
            
            ordersHtml += `
                <div class="p-4 rounded-2xl bg-neutral-50 border border-neutral-200/60 shadow-sm flex justify-between items-center">
                    <div class="flex items-center space-x-3 overflow-hidden">
                        <div class="w-8 h-8 rounded-full ${iconBg} flex items-center justify-center shrink-0"><i data-lucide="${iconName}" class="w-4 h-4"></i></div>
                        <div class="overflow-hidden">
                            <span class="text-xs font-bold block text-black truncate">${o.items}</span>
                            <span class="text-[9px] text-neutral-500 font-mono">Día: ${o.date} • ${o.time}</span>
                            <span class="text-[9px] text-neutral-400 block mt-0.5 truncate">Cliente: ${o.customer}</span>
                        </div>
                    </div>
                    <div class="text-right shrink-0 ml-2">
                        <span class="block text-sm font-bold text-black">${totalVal.toFixed(2)} €</span>
                        <span class="block text-[9px] ${isPaid ? 'text-emerald-600' : 'text-amber-600'} font-bold">${o.status}</span>
                    </div>
                </div>
            `;
        });
    }

    modalBody.innerHTML = `
        <div class="space-y-4 text-left">
            <div class="text-center space-y-1">
                <h3 class="text-base font-bold text-black">Historial Completo</h3>
                <p class="text-[11px] text-neutral-500">Revisa y filtra los pedidos recibidos.</p>
            </div>

            <div class="pt-2 border-t border-neutral-100">
                <label class="text-[9px] font-mono uppercase text-neutral-400 block mb-1">Filtrar por Día</label>
                <input type="date" id="historyDateFilter" value="${dateFilter}" onchange="openHistoryModal(this.value)" class="w-full bg-neutral-50 border border-neutral-200 rounded-xl py-2.5 px-3 text-xs text-black focus:outline-none focus:border-black">
            </div>

            <div class="space-y-2 max-h-72 overflow-y-auto pr-1 allow-scroll">
                ${ordersHtml}
            </div>

            <div class="grid grid-cols-2 gap-3 pt-2">
                <button onclick="openHistoryModal('')" class="w-full py-3 bg-neutral-100 text-black font-semibold rounded-xl text-xs hover:bg-neutral-200 transition">
                    Ver Todos
                </button>
                <button onclick="if(typeof closeModal === 'function') closeModal()" class="w-full py-3 bg-black text-white font-semibold rounded-xl text-xs shadow-md active:scale-95 transition">
                    Cerrar
                </button>
            </div>
        </div>
    `;
    lucide.createIcons();
    
    modal.classList.remove('hidden');
    setTimeout(() => { modal.classList.remove('opacity-0'); modalContent.classList.remove('scale-95'); }, 10);
}

// --- PANEL DE ÓRDENES CON SINCRONIZACIÓN EN TIEMPO REAL ---
async function renderBusinessOrders() {
    if (!currentBusiness) return;
    
    const container = document.getElementById('dynamicDashboardContent');
    if (!container) return;
    
    const cat = (currentBusiness.category || '').toLowerCase();
    const isMusic = cat.includes('disco') || cat.includes('music') || cat.includes('produ') || cat.includes('estudio');
    
    // Activar suscripción Realtime en Supabase si no está activa
    if (!ordersRealtimeSubscription && typeof supabaseClient.channel === 'function') {
        ordersRealtimeSubscription = supabaseClient
            .channel('public:orders')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
                renderBusinessOrders();
            })
            .subscribe();
    }

    // Consulta directa a Supabase
    let orders = [];
    try {
        const { data, error } = await supabaseClient
            .from('orders')
            .select('*')
            .order('id', { ascending: false });
        if (!error && data) {
            orders = data;
        }
    } catch (e) {
        console.warn("Lectura de orders Supabase:", e);
    }

    // Normalizador de nombres tolerante a variaciones
    const cleanCurrentBiz = (currentBusiness.name || '').trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const bizKeywords = cleanCurrentBiz.split(/\s+/).filter(w => w.length > 2);

    let myOrders = orders.filter(o => {
        const rawName = o.business_name || o.businessName || '';
        const oName = rawName.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        if (oName === cleanCurrentBiz || oName.includes(cleanCurrentBiz) || cleanCurrentBiz.includes(oName)) return true;
        return bizKeywords.some(keyword => oName.includes(keyword));
    });

    // Ordenar explícitamente del más nuevo al más antiguo (garantía de ordenamiento)
    myOrders.sort((a, b) => b.id - a.id);
    currentBusinessOrders = myOrders; // Guardamos en memoria global para el Modal
    
    let totalMoney = 0;
    let pendingOrdersCount = 0;
    myOrders.forEach(o => {
        const orderVal = parseFloat(o.total) || 0;
        if (o.status === 'Pagado Online') totalMoney += orderVal;
        if (o.status && (o.status.includes('Pendiente') || o.status === 'Pagado Online')) pendingOrdersCount++;
    });

    let html = '';

    if (isMusic) {
        html = `
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

                <button onclick="if(typeof openBusinessQR === 'function') openBusinessQR()" class="w-full mt-2 py-3 bg-gradient-to-r from-amber-400 via-yellow-500 to-amber-600 text-black font-extrabold rounded-2xl text-xs tracking-wide shadow-lg flex items-center justify-center space-x-2 active:scale-95 transition">
                    <i data-lucide="qr-code" class="w-4 h-4"></i>
                    <span>Mostrar QR de Cobro VIP</span>
                </button>
            </div>

            <div class="grid grid-cols-2 gap-3">
                <div class="p-4 rounded-3xl bg-neutral-900 border border-amber-500/20 text-left shadow-lg">
                    <span class="text-[9px] text-neutral-400 font-mono uppercase tracking-widest">Licencias Vendidas</span>
                    <h3 class="text-2xl font-black text-white mt-1">${pendingOrdersCount}</h3>
                </div>
                <div class="p-4 rounded-3xl bg-neutral-900 border border-amber-500/20 text-left shadow-lg">
                    <span class="text-[9px] text-amber-400/80 font-mono uppercase tracking-widest">Royalties Acumulados</span>
                    <h3 class="text-2xl font-black text-amber-400 mt-1">${totalMoney.toLocaleString('es-ES', { minimumFractionDigits: 2 })} €</h3>
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
    } else if (cat.includes('pel')) {
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
            <div class="flex space-x-3">
                <button onclick="openStockControlModal()" class="flex-1 py-4 bg-white border border-neutral-200 text-black font-bold rounded-2xl shadow-sm active:scale-95 transition flex justify-center items-center space-x-2">
                    <i data-lucide="scissors" class="w-4 h-4"></i><span>Servicios</span>
                </button>
                <button onclick="if(typeof openModal === 'function') openModal('Agenda de Citas')" class="flex-1 py-4 bg-black text-white font-bold rounded-2xl shadow-md active:scale-95 transition flex justify-center items-center space-x-2">
                    <i data-lucide="calendar" class="w-4 h-4"></i><span>Agenda</span>
                </button>
            </div>
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
                <button onclick="openStockControlModal()" class="flex-1 py-3 bg-white border border-neutral-200 text-black font-bold rounded-2xl shadow-sm active:scale-95 transition flex justify-center items-center space-x-2">
                    <i data-lucide="book-open" class="w-4 h-4"></i><span>Carta</span>
                </button>
                <button onclick="if(typeof switchTab === 'function') switchTab('business-scan')" class="flex-1 py-3 bg-black text-white font-bold rounded-2xl shadow-md active:scale-95 transition flex justify-center items-center space-x-2">
                    <i data-lucide="scan-line" class="w-4 h-4"></i><span>Escanear Mesa</span>
                </button>
            </div>
        `;
    } else {
        html += `
            <section class="glass-dark p-6 rounded-[32px] text-white flex flex-col justify-between space-y-5 relative overflow-hidden shadow-xl">
                <div class="flex justify-between items-start relative z-10">
                    <div>
                        <span class="text-[9px] text-neutral-400 font-mono tracking-widest uppercase bg-white/10 px-2.5 py-1 rounded-full">TERMINAL VIRTUAL</span>
                        <h2 class="text-lg font-medium tracking-tight mt-2 text-white">Cobro Rápido</h2>
                    </div>
                    <i data-lucide="qr-code" class="w-5 h-5 text-white"></i>
                </div>
                <button onclick="if(typeof openBusinessQR === 'function') openBusinessQR()" class="w-full py-3.5 bg-white text-black font-semibold rounded-2xl text-xs tracking-wide transition shadow-lg flex items-center justify-center space-x-2">
                    <i data-lucide="qr-code" class="w-4 h-4"></i>
                    <span>Mostrar QR de Negocio</span>
                </button>
            </section>

            <div class="grid grid-cols-2 gap-3">
                <div class="p-4 rounded-3xl bg-neutral-50 border border-neutral-200/70">
                    <span class="text-[10px] text-neutral-400 font-mono uppercase">Pedidos</span>
                    <h3 class="text-xl font-extrabold text-black mt-1">${pendingOrdersCount}</h3>
                </div>
                <div class="p-4 rounded-3xl bg-neutral-50 border border-neutral-200/70">
                    <span class="text-[10px] text-neutral-400 font-mono uppercase">Caja</span>
                    <h3 class="text-xl font-extrabold text-black mt-1">${totalMoney.toLocaleString('es-ES', { minimumFractionDigits: 2 })} €</h3>
                </div>
            </div>

            <button onclick="openStockControlModal()" class="w-full py-4 bg-white border border-neutral-200 text-black font-bold rounded-2xl shadow-sm active:scale-95 transition flex justify-center items-center space-x-2">
                <i data-lucide="package" class="w-4 h-4"></i>
                <span>Control de Stock y Catálogo</span>
            </button>
        `;
    }

    html += `
        <div class="space-y-2 pt-2">
            <div class="flex justify-between items-center px-1">
                <h3 class="text-[10px] font-mono uppercase tracking-widest text-neutral-400">Último Pedido</h3>
                <button onclick="openHistoryModal()" class="text-[10px] font-bold text-black hover:underline">Ver historial</button>
            </div>
            <div class="space-y-2">
    `;

    if (myOrders.length === 0) {
        html += '<p class="text-xs text-neutral-400 text-center py-4">No hay actividad reciente registrada.</p>';
    } else {
        const o = myOrders[0]; // Solo sacamos el último pedido
        const isPaid = o.status === 'Pagado Online';
        const iconBg = isPaid ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600';
        const iconName = cat.includes('pel') ? 'calendar' : (isPaid ? 'shopping-bag' : 'clock');
        const totalVal = parseFloat(o.total) || 0;
        
        html += `
            <div class="p-4 rounded-2xl bg-white border border-neutral-200/80 shadow-sm flex justify-between items-center">
                <div class="flex items-center space-x-3 overflow-hidden">
                    <div class="w-8 h-8 rounded-full ${iconBg} flex items-center justify-center shrink-0"><i data-lucide="${iconName}" class="w-4 h-4"></i></div>
                    <div class="overflow-hidden">
                        <span class="text-xs font-bold block text-black truncate">${o.items}</span>
                        <span class="text-[9px] text-neutral-500 font-mono">Día: ${o.date} • ${o.time}</span>
                        <span class="text-[9px] text-neutral-400 block mt-0.5 truncate">Cliente: ${o.customer}</span>
                    </div>
                </div>
                <div class="text-right shrink-0 ml-2">
                    <span class="block text-sm font-bold text-black">${totalVal.toFixed(2)} €</span>
                    <span class="block text-[9px] ${isPaid ? 'text-emerald-600' : 'text-amber-600'} font-bold">${o.status}</span>
                </div>
            </div>
        `;
    }
    
    html += `</div></div>`;
    container.innerHTML = html;
    lucide.createIcons();
}