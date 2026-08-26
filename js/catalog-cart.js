// js/catalog-cart.js

function openPublicBusiness(safeName, safeType, safeEmail) {
    window.appState.activeBusinessName = decodeURIComponent(safeName || '');
    window.appState.activeBusinessCategory = decodeURIComponent(safeType || '').toLowerCase();
    if (safeEmail) {
        window.appState.activeBusinessEmail = decodeURIComponent(safeEmail);
    }
    window.activePayee = window.appState.activeBusinessName;
    window.lastVisitedBeatsView = false;
    
    if (typeof stopCurrentAudio === 'function') stopCurrentAudio();

    const nameEl = document.getElementById('publicBizName');
    if (nameEl) nameEl.innerText = window.appState.activeBusinessName;

    const imgEl = document.getElementById('publicBizImage');
    const isJuanStudio = window.appState.activeBusinessName.toUpperCase().includes('JUUANCP') || 
                         window.appState.activeBusinessCategory.includes('disco') || 
                         window.appState.activeBusinessCategory.includes('music') || 
                         window.appState.activeBusinessCategory.includes('produ') || 
                         window.appState.activeBusinessCategory.includes('estudio');

    updateContactButtonLabel(isJuanStudio);

    const currentBizObj = (window.allPublicBusinesses || allPublicBusinesses || []).find(b => {
        const bName = (b.name || b.Nombre || b.username || '').toLowerCase().trim();
        return bName === window.appState.activeBusinessName.toLowerCase().trim();
    });

    if (imgEl) {
        if (currentBizObj && currentBizObj.cover_url) {
            imgEl.src = currentBizObj.cover_url;
        } else if (isJuanStudio) {
            imgEl.src = "https://gamjjnyomhnyswbxlhgq.supabase.co/storage/v1/object/public/public-images/juancp-cover.jpg";
        } else if (window.appState.activeBusinessCategory.includes('rest') || window.appState.activeBusinessCategory.includes('bar') || window.appState.activeBusinessName.toLowerCase().includes('restaurante')) {
            imgEl.src = "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=800&q=80";
        } else if (window.appState.activeBusinessCategory.includes('pan') || window.appState.activeBusinessCategory.includes('comercio') || window.appState.activeBusinessCategory.includes('bakery')) {
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
    
    if (typeof switchTab === 'function') switchTab('public-business');
}

function updateContactButtonLabel(isMusicStudio) {
    const contactBtn = document.querySelector('#view-public-business button[onclick*="openCustomerChat"]');
    if (!contactBtn) return;

    const titleSpan = contactBtn.querySelector('span.block.text-xs.font-bold');
    const subSpan = contactBtn.querySelector('span.block.text-\\[10px\\]');

    if (isMusicStudio) {
        if (titleSpan) titleSpan.innerText = "Pedidos Personalizados";
        if (subSpan) subSpan.innerText = "Contacta directamente para solicitudes a medida";
    } else {
        if (titleSpan) titleSpan.innerText = "Contacta con nosotros";
        if (subSpan) subSpan.innerText = "Envía un mensaje o consulta al establecimiento";
    }
}

async function renderPublicCatalogItems() {
    const catalogEl = document.getElementById('publicBizCatalog');
    if (!catalogEl) return;

    const isRestaurant = window.appState.activeBusinessCategory.includes('rest') || 
                         window.appState.activeBusinessCategory.includes('bar') || 
                         window.appState.activeBusinessName.toLowerCase().includes('restaurante');

    if (isRestaurant && typeof window.renderRestaurantHub === 'function') {
        window.renderRestaurantHub(catalogEl);
        return;
    }

    catalogEl.innerHTML = `
        <div class="py-8 text-center space-y-2">
            <i data-lucide="loader-2" class="w-5 h-5 mx-auto animate-spin text-neutral-400"></i>
            <p class="text-[11px] text-neutral-400">Sincronizando catálogo...</p>
        </div>
    `;
    if (typeof lucide !== 'undefined') lucide.createIcons();

    let items = [];
    try {
        const client = (typeof supabaseClient !== 'undefined') ? supabaseClient : window.supabase;
        if (client) {
            const { data, error } = await client.from('products').select('*');
            if (error) throw error;
            
            const cleanActiveName = window.appState.activeBusinessName.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

            items = (data || []).filter(item => {
                const bId = String(item.business_id || '').trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
                return bId === cleanActiveName;
            });
        }
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

    const isMusic = window.appState.activeBusinessCategory.includes('disco') || 
                    window.appState.activeBusinessCategory.includes('music') || 
                    window.appState.activeBusinessCategory.includes('produ') || 
                    window.appState.activeBusinessCategory.includes('estudio') ||
                    window.appState.activeBusinessName.toUpperCase().includes('JUUANCP');

    if (isMusic) {
        const finishedBeats = items.filter(i => i.is_finished_beat === true || Boolean(i.audio_url) || (i.name || '').toLowerCase().includes('prueba1'));
        const customServices = items.filter(i => !finishedBeats.includes(i));
        
        window.currentLoadedBeatsList = finishedBeats;

        let html = `
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
                    <p class="text-xs font-extrabold text-black mt-2 font-mono">${price.toLocaleString('es-ES', {minimumFractionDigits:2})} €</p>
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
    
    if (typeof stopCurrentAudio === 'function') stopCurrentAudio();

    let html = '';
    window.appState.cartItemsList.forEach(item => {
        html += `
            <div class="flex justify-between items-center text-xs py-2.5 border-b border-neutral-100 last:border-0 text-black">
                <div>
                    <span class="font-bold">${item.name}</span>
                    <span class="text-[10px] text-neutral-400 block">Cantidad: ${item.qty} uds</span>
                </div>
                <span class="font-bold font-mono"> ${(item.price * item.qty).toLocaleString('es-ES', {minimumFractionDigits:2})} €</span>
            </div>
        `;
    });
    const itemsCont = document.getElementById('cartItemsContainer');
    const sumTotal = document.getElementById('cartSummaryTotal');
    if (itemsCont) itemsCont.innerHTML = html;
    if (sumTotal) sumTotal.innerText = window.appState.cartTotalValue.toLocaleString('es-ES', {minimumFractionDigits:2}) + ' €';
    
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

    const user = (typeof currentUser !== 'undefined') ? currentUser : null;
    const orderSummary = {
        businessName: window.appState.activeBusinessName || 'Comercio NetWish',
        clientName: user?.user_metadata?.full_name || user?.email || 'Cliente NetWish',
        date: date,
        time: time,
        items: [...window.appState.cartItemsList],
        total: window.appState.cartTotalValue,
        action: action
    };

    window.appState.pendingOrderDetails = orderSummary;
    window.appState.isCartCheckout = true;
    
    const cartView = document.getElementById('view-cart');
    if (cartView) cartView.classList.add('hidden');

    if (action !== 'pay' && window.emailService) {
        if (user?.email) {
            window.emailService.sendClientReceipt(user.email, orderSummary);
        }
        const bizEmail = window.appState.activeBusinessEmail || 'contacto@netwish.es';
        window.emailService.sendBusinessAlert(bizEmail, orderSummary);
    }

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
        
        if (typeof switchTab === 'function') switchTab('payment');
    } else {
        if (typeof window.executeFullPayment === 'function') window.executeFullPayment(true);
    }
}