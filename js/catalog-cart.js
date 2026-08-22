// Variables globales ancladas a 'window' para que ningún archivo las pierda
window.activeBusinessName = "";
window.activeBusinessCategory = "";
window.isScheduleEnabled = true;
window.currentPublicCatalogItems = [];
window.currentlyPlayingAudio = null;
window.currentPlayingBtnId = null;

window.cartItemsList = [];
window.cartTotalValue = 0;
window.cartItemCount = 0;
window.isCartCheckout = false;
window.pendingOrderDetails = null;

function openPublicBusiness(safeName, safeType) {
    window.activeBusinessName = decodeURIComponent(safeName || '');
    window.activeBusinessCategory = decodeURIComponent(safeType || '').toLowerCase();
    window.activePayee = window.activeBusinessName;
    
    stopCurrentAudio();

    document.getElementById('publicBizName').innerText = window.activeBusinessName;
    const imgEl = document.getElementById('publicBizImage');

    if (window.activeBusinessCategory.includes('disco') || window.activeBusinessCategory.includes('music') || window.activeBusinessCategory.includes('produ')) {
        imgEl.src = "https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?auto=format&fit=crop&w=800&q=80";
        document.getElementById('publicBizTag').innerText = "RECORD LABEL";
    } else if (window.activeBusinessCategory.includes('pan') || window.activeBusinessCategory.includes('comercio')) {
        imgEl.src = "https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=800&q=80";
        document.getElementById('publicBizTag').innerText = "Comercio Local";
    } else if (window.activeBusinessCategory.includes('pel')) {
        imgEl.src = "https://images.unsplash.com/photo-1562322140-8baeececf3df?auto=format&fit=crop&w=800&q=80";
        document.getElementById('publicBizTag').innerText = "Peluquería";
    } else {
        imgEl.src = "https://images.unsplash.com/photo-1556740738-b6a63e27c4df?auto=format&fit=crop&w=800&q=80";
        document.getElementById('publicBizTag').innerText = "Comercio";
    }

    window.cartTotalValue = 0; 
    window.cartItemCount = 0; 
    window.cartItemsList = []; 
    window.isCartCheckout = false;
    
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
        const { data, error } = await supabaseClient.from('products').select('*');
        if (error) throw error;
        
        const cleanActiveName = window.activeBusinessName.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        const activeTokens = cleanActiveName.split(/\s+/).filter(t => t.length > 2);

        items = (data || []).filter(item => {
            const bId = String(item.business_id || '').trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
            if (bId === cleanActiveName || bId === 'biz_db') return true;
            return activeTokens.some(token => bId.includes(token));
        });

    } catch (err) {
        console.error("Error consultando Supabase:", err);
    }

    window.currentPublicCatalogItems = items;

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
        const existingInCart = window.cartItemsList.find(i => String(i.id) === itemIdStr);
        const qty = existingInCart ? existingInCart.qty : 0;
        const isMusic = window.activeBusinessCategory.includes('disco') || window.activeBusinessCategory.includes('music') || window.activeBusinessCategory.includes('produ');
        const hasAudio = Boolean(item.audio_url);

        const safeItemId = encodeURIComponent(itemIdStr);
        const safeItemName = encodeURIComponent(item.name || 'Producto');
        const safeAudioUrl = encodeURIComponent(item.audio_url || '');

        html += `
            <div class="p-4 rounded-3xl bg-white border border-neutral-200/80 shadow-sm flex flex-col space-y-3 transition">
                <div class="flex justify-between items-start">
                    <div class="flex-1 pr-3">
                        <div class="flex items-center space-x-1.5">
                            ${isMusic ? '<i data-lucide="disc" class="w-3.5 h-3.5 text-amber-500 shrink-0"></i>' : ''}
                            <h4 class="text-sm font-bold text-black">${item.name}</h4>
                        </div>
                        <p class="text-[10px] text-neutral-500 mt-0.5">${item.description || ''}</p>
                        <p class="text-xs font-extrabold text-black mt-2">${price.toLocaleString('es-ES', {minimumFractionDigits:2})} €</p>
                    </div>
                    
                    <div id="btn-container-${item.id}" class="flex items-center space-x-2 shrink-0">
                        ${renderItemButtonHTML(item.id, safeItemId, safeItemName, price, qty)}
                    </div>
                </div>

                ${hasAudio ? `
                    <div class="flex items-center space-x-2.5 p-2 bg-neutral-50 rounded-2xl border border-neutral-200/60">
                        <button onclick="togglePlayPreview('${safeAudioUrl}', 'play-icon-${item.id}')" class="w-8 h-8 rounded-xl bg-black text-white flex items-center justify-center shrink-0 active:scale-95 transition shadow-sm">
                            <i id="play-icon-${item.id}" data-lucide="play" class="w-3.5 h-3.5 ml-0.5"></i>
                        </button>
                        <div class="flex-1 overflow-hidden">
                            <span class="text-[10px] font-mono uppercase tracking-wider text-neutral-600 block font-bold truncate">Escuchar Preview Oficial</span>
                            <span class="text-[9px] text-neutral-400 font-mono block truncate">Audio WAV/MP3 • Calidad HQ</span>
                        </div>
                    </div>
                ` : ''}
            </div>
        `;
    });

    catalogEl.innerHTML = html;
    lucide.createIcons();
}

function togglePlayPreview(encodedUrl, iconId) {
    const url = decodeURIComponent(encodedUrl);
    if (!url) return;

    const iconEl = document.getElementById(iconId);

    if (window.currentlyPlayingAudio && window.currentlyPlayingAudio.src === url && !window.currentlyPlayingAudio.paused) {
        window.currentlyPlayingAudio.pause();
        if (iconEl) {
            iconEl.setAttribute('data-lucide', 'play');
            iconEl.classList.add('ml-0.5');
            lucide.createIcons();
        }
        return;
    }

    stopCurrentAudio();

    window.currentlyPlayingAudio = new Audio(url);
    window.currentPlayingBtnId = iconId;

    if (iconEl) {
        iconEl.setAttribute('data-lucide', 'pause');
        iconEl.classList.remove('ml-0.5');
        lucide.createIcons();
    }

    window.currentlyPlayingAudio.play().catch(e => {
        console.error("Error reproduciendo audio:", e);
        stopCurrentAudio();
    });

    window.currentlyPlayingAudio.onended = () => {
        stopCurrentAudio();
    };
}

function stopCurrentAudio() {
    if (window.currentlyPlayingAudio) {
        window.currentlyPlayingAudio.pause();
        window.currentlyPlayingAudio = null;
    }
    if (window.currentPlayingBtnId) {
        const iconEl = document.getElementById(window.currentPlayingBtnId);
        if (iconEl) {
            iconEl.setAttribute('data-lucide', 'play');
            iconEl.classList.add('ml-0.5');
            lucide.createIcons();
        }
        window.currentPlayingBtnId = null;
    }
}

function renderItemButtonHTML(rawId, safeItemId, safeItemName, price, qty) {
    if (qty > 0) {
        return `
            <div class="flex items-center bg-neutral-100 rounded-2xl p-1 border border-neutral-200/60 shadow-inner">
                <button onclick="changeItemQuantity('${safeItemId}', '${safeItemName}', ${price}, -1)" class="w-8 h-8 rounded-xl bg-white text-black font-bold flex items-center justify-center shadow-sm active:scale-90 transition">
                    <i data-lucide="minus" class="w-3.5 h-3.5"></i>
                </button>
                <span class="w-8 text-center text-xs font-extrabold text-black">${qty}</span>
                <button onclick="changeItemQuantity('${safeItemId}', '${safeItemName}', ${price}, 1)" class="w-8 h-8 rounded-xl bg-black text-white font-bold flex items-center justify-center shadow-md active:scale-90 transition">
                    <i data-lucide="plus" class="w-3.5 h-3.5"></i>
                </button>
            </div>
        `;
    } else {
        return `
            <button onclick="changeItemQuantity('${safeItemId}', '${safeItemName}', ${price}, 1)" class="w-10 h-10 rounded-2xl bg-black text-white shadow-md flex items-center justify-center active:scale-90 transition font-bold">
                <i data-lucide="plus" class="w-4 h-4"></i>
            </button>
        `;
    }
}

function changeItemQuantity(encodedId, encodedName, price, delta) {
    if (typeof currentUser === 'undefined' || !currentUser) { 
        if (typeof openAuthModal === 'function') openAuthModal('login'); 
        return; 
    }

    const id = decodeURIComponent(encodedId);
    const name = decodeURIComponent(encodedName);
    const existingIndex = window.cartItemsList.findIndex(i => String(i.id) === String(id));
    let newQty = 0;

    if (existingIndex >= 0) {
        window.cartItemsList[existingIndex].qty += delta;
        newQty = window.cartItemsList[existingIndex].qty;
        if (window.cartItemsList[existingIndex].qty <= 0) {
            window.cartItemsList.splice(existingIndex, 1);
            newQty = 0;
        }
    } else if (delta > 0) {
        window.cartItemsList.push({ id: id, name: name, price: price, qty: 1 });
        newQty = 1;
    }

    window.cartTotalValue = window.cartItemsList.reduce((acc, curr) => acc + (curr.price * curr.qty), 0);
    window.cartItemCount = window.cartItemsList.reduce((acc, curr) => acc + curr.qty, 0);

    updateCartDisplay();

    const btnContainer = document.getElementById(`btn-container-${id}`);
    if (btnContainer) {
        btnContainer.innerHTML = renderItemButtonHTML(id, encodedId, encodedName, price, newQty);
        if (typeof lucide !== 'undefined') lucide.createIcons();
    }
}

function updateCartDisplay() {
    const cartBar = document.getElementById('publicBusinessCartBar');
    if (!cartBar) return;
    
    if (window.cartItemCount > 0) {
        cartBar.classList.remove('translate-y-64', 'opacity-0', 'pointer-events-none');
        cartBar.classList.add('translate-y-0', 'opacity-100', 'pointer-events-auto');
        document.getElementById('cartTotalDisplay').innerText = window.cartTotalValue.toLocaleString('es-ES', { minimumFractionDigits: 2 }) + ' €';
        document.getElementById('cartCountDisplay').innerText = window.cartItemCount;
    } else {
        cartBar.classList.remove('translate-y-0', 'opacity-100', 'pointer-events-auto');
        cartBar.classList.add('translate-y-64', 'opacity-0', 'pointer-events-none');
    }
}

function toggleScheduleSection() {
    window.isScheduleEnabled = !window.isScheduleEnabled;
    const toggleBtn = document.getElementById('scheduleToggleBtn');
    const toggleKnob = document.getElementById('scheduleToggleKnob');
    const container = document.getElementById('scheduleInputsContainer');

    if (!toggleBtn || !toggleKnob || !container) return;

    if (window.isScheduleEnabled) {
        toggleBtn.classList.remove('bg-neutral-200');
        toggleBtn.classList.add('bg-black');
        toggleKnob.classList.remove('translate-x-0');
        toggleKnob.classList.add('translate-x-5');
        container.classList.remove('hidden', 'opacity-0');
    } else {
        toggleBtn.classList.remove('bg-black');
        toggleBtn.classList.add('bg-neutral-200');
        toggleKnob.classList.remove('translate-x-5');
        toggleKnob.classList.add('translate-x-0');
        container.classList.add('hidden', 'opacity-0');
    }
}

function openCartSummary() {
    if (window.cartItemCount === 0) return;
    
    stopCurrentAudio();

    let html = '';
    window.cartItemsList.forEach(item => {
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
    document.getElementById('cartSummaryTotal').innerText = window.cartTotalValue.toLocaleString('es-ES', {minimumFractionDigits:2}) + ' €';
    
    const today = new Date().toISOString().split('T')[0];
    const dateInput = document.getElementById('orderDate');
    if (dateInput) {
        dateInput.value = today;
        dateInput.min = today;
    }
    
    window.isScheduleEnabled = true;
    const toggleBtn = document.getElementById('scheduleToggleBtn');
    const toggleKnob = document.getElementById('scheduleToggleKnob');
    const container = document.getElementById('scheduleInputsContainer');
    if (toggleBtn && toggleKnob && container) {
        toggleBtn.classList.remove('bg-neutral-200');
        toggleBtn.classList.add('bg-black');
        toggleKnob.classList.remove('translate-x-0');
        toggleKnob.classList.add('translate-x-5');
        container.classList.remove('hidden', 'opacity-0');
    }

    const pubBizView = document.getElementById('view-public-business');
    if (pubBizView) pubBizView.classList.add('hidden');

    const cartView = document.getElementById('view-cart');
    if (cartView) {
        cartView.classList.remove('hidden');
        cartView.scrollTop = 0;
    }

    if (typeof lucide !== 'undefined') lucide.createIcons();
}

function closeCartSummary() {
    const cartView = document.getElementById('view-cart');
    if (cartView) cartView.classList.add('hidden');

    const pubBizView = document.getElementById('view-public-business');
    if (pubBizView) pubBizView.classList.remove('hidden');

    updateCartDisplay();
}

function processCartChoice(action) {
    let date = "Inmediato / Sin Cita";
    let time = "--:--";

    if (window.isScheduleEnabled) {
        const d = document.getElementById('orderDate')?.value;
        const t = document.getElementById('orderTime')?.value;
        if (!d || !t) { 
            alert("Por favor, elige un día y hora de recogida/cita o desactiva la casilla."); 
            return; 
        }
        date = d;
        time = t;
    }

    window.pendingOrderDetails = { date, time, action };
    window.isCartCheckout = true; // Activa el modo de cesta validado
    
    const cartView = document.getElementById('view-cart');
    if (cartView) cartView.classList.add('hidden');

    if (action === 'pay') {
        // Enviar precio exactamente a la variable blindada del terminal
        window.rawAmountString = Math.round(window.cartTotalValue * 100).toString(); 
        if (typeof window.updateAmountDisplay === 'function') {
            window.updateAmountDisplay(); // Fuerza la actualización de pantalla
        }
        
        let targetName = window.activePayee || window.activeBusinessName || "Negocio Local";
        const payeeNameEl = document.getElementById('payeeNameDisplay');
        if (payeeNameEl) payeeNameEl.innerText = targetName;
        
        const bubbleEl = document.getElementById('payeeInitialsBubble');
        if (bubbleEl) bubbleEl.innerText = targetName.substring(0, 2).toUpperCase();
        
        switchTab('payment');
    } else {
        if (typeof executeFullPayment === 'function') executeFullPayment(true);
    }
}