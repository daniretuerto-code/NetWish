let activeBusinessName = "";
let activeBusinessCategory = "";

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