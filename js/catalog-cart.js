window.appState = window.appState || {};
window.appState.activeBusinessName = "";
window.appState.activeBusinessCategory = "";
window.appState.isScheduleEnabled = true;
window.appState.cartItemsList = [];
window.appState.cartTotalValue = 0;
window.appState.cartItemCount = 0;
window.appState.isCartCheckout = false;
window.appState.pendingOrderDetails = null;
window.appState.cartsByBusiness = window.appState.cartsByBusiness || {};
window.currentlyPlayingAudio = null;
window.currentPlayingBtnId = null;

window.currentLoadedBeatsList = [];
window.lastVisitedBeatsView = false;

function openPublicBusiness(safeName, safeType) {
    window.appState.activeBusinessName = decodeURIComponent(safeName || '');
    window.appState.activeBusinessCategory = decodeURIComponent(safeType || '').toLowerCase();
    window.activePayee = window.appState.activeBusinessName;
    window.lastVisitedBeatsView = false;
    
    stopCurrentAudio();

    const nameEl = document.getElementById('publicBizName');
    if (nameEl) nameEl.innerText = window.appState.activeBusinessName;

    const imgEl = document.getElementById('publicBizImage');
    const isJuanStudio = window.appState.activeBusinessName.toUpperCase().includes('JUUANCP') || 
                         window.appState.activeBusinessCategory.includes('disco') || 
                         window.appState.activeBusinessCategory.includes('music') || 
                         window.appState.activeBusinessCategory.includes('produ') || 
                         window.appState.activeBusinessCategory.includes('estudio');

    if (imgEl) {
        if (isJuanStudio) {
            imgEl.src = "https://gamjjnyomhnyswbxlhgq.supabase.co/storage/v1/object/public/public-images/juancp-cover.jpg";
        } else if (window.appState.activeBusinessCategory.includes('pan') || window.appState.activeBusinessCategory.includes('comercio')) {
            imgEl.src = "https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=800&q=80";
        } else if (window.appState.activeBusinessCategory.includes('pel')) {
            imgEl.src = "https://images.unsplash.com/photo-1562322140-8baeececf3df?auto=format&fit=crop&w=800&q=80";
        } else {
            imgEl.src = "https://images.unsplash.com/photo-1556740738-b6a63e27c4df?auto=format&fit=crop&w=800&q=80";
        }
    }

    const savedCart = window.appState.cartsByBusiness[window.appState.activeBusinessName] || [];
    window.appState.cartItemsList = savedCart;
    window.appState.cartTotalValue = savedCart.reduce((acc, curr) => acc + (curr.price * curr.qty), 0);
    window.appState.cartItemCount = savedCart.reduce((acc, curr) => acc + curr.qty, 0);
    window.appState.isCartCheckout = false;
    
    updateCartDisplay();
    renderPublicCatalogItems();
    
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
    if (typeof lucide !== 'undefined') lucide.createIcons();

    let items = [];
    try {
        const { data, error } = await supabaseClient.from('products').select('*');
        if (error) throw error;
        
        const cleanActiveName = window.appState.activeBusinessName.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
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
        if (typeof lucide !== 'undefined') lucide.createIcons();
        return;
    }

    const isMusic = window.appState.activeBusinessCategory.includes('disco') || window.appState.activeBusinessCategory.includes('music') || window.appState.activeBusinessCategory.includes('produ') || window.appState.activeBusinessCategory.includes('estudio');

    if (isMusic) {
        const finishedBeats = items.filter(i => i.is_finished_beat === true || Boolean(i.audio_url) || (i.name || '').toLowerCase().includes('prueba1'));
        const customServices = items.filter(i => !finishedBeats.includes(i));
        
        window.currentLoadedBeatsList = finishedBeats;

        let html = '';

        html += `
            <button onclick="openBeatsCatalogView()" class="w-full p-4 rounded-3xl bg-neutral-50 hover:bg-neutral-100 border border-neutral-200/80 flex items-center justify-between shadow-sm active:scale-98 transition group">
                <div class="flex items-center space-x-3.5 overflow-hidden">
                    <div class="w-10 h-10 rounded-2xl bg-black text-white flex items-center justify-center shadow-md shrink-0">
                        <i data-lucide="disc" class="w-5 h-5 text-amber-400"></i>
                    </div>
                    <div class="text-left overflow-hidden">
                        <div class="flex items-center space-x-2">
                            <span class="block text-xs font-bold text-black tracking-tight truncate">Catálogo de Beats</span>
                            <span class="text-[9px] bg-amber-500/10 text-amber-600 font-bold px-2 py-0.5 rounded-full border border-amber-500/20">${finishedBeats.length} disponibles</span>
                        </div>
                        <span class="block text-[10px] text-neutral-400 mt-0.5 truncate">Explora y escucha instrumentales listas para compra inmediata</span>
                    </div>
                </div>
                <div class="w-7 h-7 rounded-full bg-white border border-neutral-200/60 flex items-center justify-center text-neutral-400 group-hover:text-black transition shrink-0 ml-2">
                    <i data-lucide="chevron-right" class="w-4 h-4"></i>
                </div>
            </button>
        `;

        if (customServices.length > 0) {
            html += `
                <div class="space-y-3 pt-2">
                    <div class="flex items-center space-x-2 px-1">
                        <i data-lucide="sliders" class="w-3.5 h-3.5 text-neutral-400"></i>
                        <h4 class="text-[10px] font-mono font-bold text-neutral-400 uppercase tracking-widest">Servicios & Producción</h4>
                    </div>
                    <div class="space-y-3">
                        ${customServices.map(item => renderSingleProductCard(item, false)).join('')}
                    </div>
                </div>
            `;
        }

        catalogEl.innerHTML = html;
    } else {
        catalogEl.innerHTML = items.map(item => renderSingleProductCard(item, false)).join('');
    }

    if (typeof lucide !== 'undefined') lucide.createIcons();
}

window.openBeatsCatalogView = function() {
    stopCurrentAudio();
    window.lastVisitedBeatsView = true;
    const beatsView = document.getElementById('view-beats-catalog');
    if (!beatsView) return;

    renderBeatsCatalogList(window.currentLoadedBeatsList);

    const pubBizView = document.getElementById('view-public-business');
    if (pubBizView) pubBizView.classList.add('hidden');

    beatsView.classList.remove('hidden');
    beatsView.classList.add('flex');
    beatsView.scrollTop = 0;
    
    updateCartDisplay();
    if (typeof lucide !== 'undefined') lucide.createIcons();
};

window.closeBeatsCatalogView = function() {
    stopCurrentAudio();
    window.lastVisitedBeatsView = false;
    const beatsView = document.getElementById('view-beats-catalog');
    if (beatsView) {
        beatsView.classList.add('hidden');
        beatsView.classList.remove('flex');
    }

    const pubBizView = document.getElementById('view-public-business');
    if (pubBizView) {
        pubBizView.classList.remove('hidden');
    }

    updateCartDisplay();
};

function renderBeatsCatalogList(list) {
    const container = document.getElementById('dynamicBeatsCatalogList');
    if (!container) return;

    if (!list || list.length === 0) {
        container.innerHTML = `
            <div class="p-8 rounded-3xl bg-neutral-50 border border-neutral-200/60 text-center space-y-2">
                <i data-lucide="disc" class="w-6 h-6 mx-auto text-neutral-300"></i>
                <p class="text-xs font-bold text-black">No hay beats disponibles</p>
                <p class="text-[10px] text-neutral-400">El estudio aún no ha subido instrumentales terminadas a la venta.</p>
            </div>
        `;
        if (typeof lucide !== 'undefined') lucide.createIcons();
        return;
    }

    container.innerHTML = list.map(item => renderSingleProductCard(item, true)).join('');
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

window.filterBeatsCatalogView = function() {
    const q = (document.getElementById('beatsCatalogSearch')?.value || '').toLowerCase();
    const filtered = (window.currentLoadedBeatsList || []).filter(item => {
        const name = (item.name || '').toLowerCase();
        const desc = (item.description || '').toLowerCase();
        return name.includes(q) || desc.includes(q);
    });
    renderBeatsCatalogList(filtered);
};

function renderSingleProductCard(item, isMusicBeat) {
    const price = parseFloat(item.price) || 0;
    const itemIdStr = String(item.id);
    const existingInCart = window.appState.cartItemsList.find(i => String(i.id) === itemIdStr);
    const qty = existingInCart ? existingInCart.qty : 0;
    const hasAudio = Boolean(item.audio_url);

    const safeItemId = encodeURIComponent(itemIdStr);
    const safeItemName = encodeURIComponent(item.name || 'Producto');
    const safeAudioUrl = encodeURIComponent(item.audio_url || '');

    return `
        <div class="p-4 rounded-3xl bg-white border border-neutral-200/80 shadow-sm flex flex-col space-y-3 transition">
            <div class="flex justify-between items-start">
                <div class="flex-1 pr-3">
                    <div class="flex items-center space-x-1.5">
                        <span class="w-2 h-2 rounded-full ${isMusicBeat ? 'bg-amber-500' : 'bg-black'} shrink-0"></span>
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
            if (typeof lucide !== 'undefined') lucide.createIcons();
        }
        return;
    }

    stopCurrentAudio();

    window.currentlyPlayingAudio = new Audio(url);
    window.currentPlayingBtnId = iconId;

    if (iconEl) {
        iconEl.setAttribute('data-lucide', 'pause');
        iconEl.classList.remove('ml-0.5');
        if (typeof lucide !== 'undefined') lucide.createIcons();
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
            if (typeof lucide !== 'undefined') lucide.createIcons();
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
    const existingIndex = window.appState.cartItemsList.findIndex(i => String(i.id) === String(id));
    let newQty = 0;

    if (existingIndex >= 0) {
        window.appState.cartItemsList[existingIndex].qty += delta;
        newQty = window.appState.cartItemsList[existingIndex].qty;
        if (window.appState.cartItemsList[existingIndex].qty <= 0) {
            window.appState.cartItemsList.splice(existingIndex, 1);
            newQty = 0;
        }
    } else if (delta > 0) {
        window.appState.cartItemsList.push({ id: id, name: name, price: price, qty: 1 });
        newQty = 1;
    }

    window.appState.cartTotalValue = window.appState.cartItemsList.reduce((acc, curr) => acc + (curr.price * curr.qty), 0);
    window.appState.cartItemCount = window.appState.cartItemsList.reduce((acc, curr) => acc + curr.qty, 0);

    if (window.appState.activeBusinessName) {
        window.appState.cartsByBusiness[window.appState.activeBusinessName] = [...window.appState.cartItemsList];
    }

    updateCartDisplay();

    const btnContainers = document.querySelectorAll(`[id="btn-container-${id}"]`);
    btnContainers.forEach(container => {
        container.innerHTML = renderItemButtonHTML(id, encodedId, encodedName, price, newQty);
    });

    if (typeof lucide !== 'undefined') lucide.createIcons();
}

function updateCartDisplay() {
    const cartBar = document.getElementById('publicBusinessCartBar');
    if (!cartBar) return;
    
    const pubBizView = document.getElementById('view-public-business');
    const beatsView = document.getElementById('view-beats-catalog');
    const isInsideBusiness = (pubBizView && !pubBizView.classList.contains('hidden')) || 
                             (beatsView && !beatsView.classList.contains('hidden'));

    const cartView = document.getElementById('view-cart');
    const isCartOpen = cartView && !cartView.classList.contains('hidden');

    if (window.appState.cartItemCount > 0 && isInsideBusiness && !isCartOpen) {
        cartBar.classList.remove('translate-y-64', 'opacity-0', 'pointer-events-none');
        cartBar.classList.add('translate-y-0', 'opacity-100', 'pointer-events-auto');
        document.getElementById('cartTotalDisplay').innerText = window.appState.cartTotalValue.toLocaleString('es-ES', { minimumFractionDigits: 2 }) + ' €';
        document.getElementById('cartCountDisplay').innerText = window.appState.cartItemCount;
    } else {
        cartBar.classList.remove('translate-y-0', 'opacity-100', 'pointer-events-auto');
        cartBar.classList.add('translate-y-64', 'opacity-0', 'pointer-events-none');
    }
}

function toggleScheduleSection() {
    window.appState.isScheduleEnabled = !window.appState.isScheduleEnabled;
    const toggleBtn = document.getElementById('scheduleToggleBtn');
    const toggleKnob = document.getElementById('scheduleToggleKnob');
    const container = document.getElementById('scheduleInputsContainer');

    if (!toggleBtn || !toggleKnob || !container) return;

    if (window.appState.isScheduleEnabled) {
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
    if (window.appState.cartItemCount === 0) return;
    
    stopCurrentAudio();

    let html = '';
    window.appState.cartItemsList.forEach(item => {
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
    document.getElementById('cartSummaryTotal').innerText = window.appState.cartTotalValue.toLocaleString('es-ES', {minimumFractionDigits:2}) + ' €';
    
    const today = new Date().toISOString().split('T')[0];
    const dateInput = document.getElementById('orderDate');
    if (dateInput) {
        dateInput.value = today;
        dateInput.min = today;
    }
    
    window.appState.isScheduleEnabled = true;
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

    const beatsView = document.getElementById('view-beats-catalog');
    if (beatsView) {
        beatsView.classList.add('hidden');
        beatsView.classList.remove('flex');
    }

    const cartBar = document.getElementById('publicBusinessCartBar');
    if (cartBar) {
        cartBar.classList.remove('translate-y-0', 'opacity-100', 'pointer-events-auto');
        cartBar.classList.add('translate-y-64', 'opacity-0', 'pointer-events-none');
    }

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

    if (window.lastVisitedBeatsView) {
        const beatsView = document.getElementById('view-beats-catalog');
        if (beatsView) {
            beatsView.classList.remove('hidden');
            beatsView.classList.add('flex');
        }
    } else {
        const pubBizView = document.getElementById('view-public-business');
        if (pubBizView) pubBizView.classList.remove('hidden');
    }

    updateCartDisplay();
}

function processCartChoice(action) {
    let date = "Inmediato / Sin Cita";
    let time = "--:--";

    if (window.appState.isScheduleEnabled) {
        const d = document.getElementById('orderDate')?.value;
        const t = document.getElementById('orderTime')?.value;
        if (!d || !t) { 
            alert("Por favor, elige un día y hora de recogida/cita o desactiva la casilla."); 
            return; 
        }
        date = d;
        time = t;
    }

    window.appState.pendingOrderDetails = { date, time, action };
    window.appState.isCartCheckout = true;
    
    const cartView = document.getElementById('view-cart');
    if (cartView) cartView.classList.add('hidden');

    if (action === 'pay') {
        window.rawAmountString = Math.round(window.appState.cartTotalValue * 100).toString(); 
        if (typeof window.updateAmountDisplay === 'function') {
            window.updateAmountDisplay();
        }
        
        let targetName = window.activePayee || window.appState.activeBusinessName || "Negocio Local";
        const payeeNameEl = document.getElementById('payeeNameDisplay');
        if (payeeNameEl) payeeNameEl.innerText = targetName;
        
        const bubbleEl = document.getElementById('payeeInitialsBubble');
        if (bubbleEl) bubbleEl.innerText = targetName.substring(0, 2).toUpperCase();
        
        switchTab('payment');
    } else {
        if (typeof window.executeFullPayment === 'function') window.executeFullPayment(true);
    }
}