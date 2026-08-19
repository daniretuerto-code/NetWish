// Control de Pestañas
function switchTab(tabId) {
    document.getElementById('view-home').classList.add('hidden');
    document.getElementById('view-explore').classList.add('hidden');
    document.getElementById('view-scan').classList.add('hidden');
    document.getElementById('view-profile').classList.add('hidden');
    document.getElementById('view-payment').classList.add('hidden');
    document.getElementById('view-business-dashboard').classList.add('hidden');
    document.getElementById('view-public-business').classList.add('hidden');
    
    const cartView = document.getElementById('view-cart');
    if (cartView) cartView.classList.add('hidden');

    document.getElementById('view-' + tabId).classList.remove('hidden');

    if (tabId === 'profile') renderProfileView();
    if (tabId === 'business-dashboard') renderBusinessOrders();
    if (tabId === 'payment') { 
        holdProgress = 0; 
        const pb = document.getElementById('progressBar'); 
        if (pb) pb.style.width = '0%'; 
    }

    const pNav = document.getElementById('personal-nav');
    const bNav = document.getElementById('business-nav');
    const mainHeader = document.getElementById('mainAppHeader');
    
    // Ocultar header en vistas inmersivas
    if (tabId === 'public-business' || tabId === 'cart') {
        mainHeader.classList.add('hidden');
    } else {
        mainHeader.classList.remove('hidden');
    }

    // Lógica de menús inferiores
    if (tabId === 'payment' || tabId === 'public-business' || tabId === 'cart') {
        pNav.classList.add('hidden');
        bNav.classList.add('hidden');
    } else {
        if (currentBusiness) {
            pNav.classList.add('hidden');
            bNav.classList.remove('hidden');
        } else {
            pNav.classList.remove('hidden');
            bNav.classList.add('hidden');
        }
    }
}

// Resetea el filtro y va al directorio completo
function resetAndExplore() {
    const searchInput = document.getElementById('directorySearch');
    if (searchInput) searchInput.value = '';
    
    const filterBar = document.getElementById('directoryFilters');
    if (filterBar) filterBar.classList.remove('hidden');

    if (typeof filterCategory === 'function') filterCategory('todos');
    switchTab('explore');
}

// Avatar Superior
function updateHeaderAvatar() {
    const avatarBtn = document.getElementById('headerAvatar');
    if (currentBusiness) {
        avatarBtn.innerText = "BIZ";
        avatarBtn.className = "w-9 h-9 rounded-2xl bg-amber-500 text-white border border-amber-600 flex items-center justify-center text-[10px] font-bold shadow-md transition hover:scale-105 active:scale-95";
    } else if (currentUser) {
        const meta = currentUser.user_metadata || {};
        avatarBtn.innerText = meta.initials || "NW";
        avatarBtn.className = "w-9 h-9 rounded-2xl bg-black text-white border border-neutral-800 flex items-center justify-center text-xs font-bold shadow-md transition hover:scale-105 active:scale-95";
    } else {
        avatarBtn.innerText = "IN";
        avatarBtn.className = "w-9 h-9 rounded-2xl bg-neutral-100 border border-neutral-200/60 flex items-center justify-center text-xs font-bold text-black shadow-inner transition hover:scale-105 active:scale-95";
    }
}

function handleHeaderProfileClick() {
    switchTab('profile');
}


// ==========================================
// --- MOTOR DE NAVEGACIÓN POR DESLIZAMIENTO ---
// ==========================================
let touchstartX = 0;
let touchendX = 0;
let touchstartY = 0;
let touchendY = 0;

document.addEventListener('touchstart', e => {
    touchstartX = e.changedTouches[0].screenX;
    touchstartY = e.changedTouches[0].screenY;
}, { passive: true });

document.addEventListener('touchend', e => {
    touchendX = e.changedTouches[0].screenX;
    touchendY = e.changedTouches[0].screenY;
    handleSwipeGesture();
}, { passive: true });

function handleSwipeGesture() {
    const xDiff = touchstartX - touchendX;
    const yDiff = touchstartY - touchendY;
    
    // Si desliza hacia arriba o abajo (scroll normal), no hacemos nada
    if (Math.abs(yDiff) > Math.abs(xDiff)) return;

    // Distancia mínima para considerarlo un "swipe" intencionado y no un roce
    if (Math.abs(xDiff) < 60) return;

    // Orden de las pestañas principales
    const tabs = ['home', 'explore', 'scan', 'profile'];
    let activeTabIndex = -1;
    
    for (let i = 0; i < tabs.length; i++) {
        if (!document.getElementById('view-' + tabs[i]).classList.contains('hidden')) {
            activeTabIndex = i;
            break;
        }
    }

    const isPublicBusiness = !document.getElementById('view-public-business').classList.contains('hidden');
    const isCart = !document.getElementById('view-cart').classList.contains('hidden');

    if (xDiff > 0) {
        // Deslizar IZQUIERDA (Avanzar pestaña ->)
        if (activeTabIndex >= 0 && activeTabIndex < tabs.length - 1) {
            switchTab(tabs[activeTabIndex + 1]);
        }
    } else {
        // Deslizar DERECHA (Retroceder pestaña <- o Volver atrás)
        if (activeTabIndex > 0) {
            switchTab(tabs[activeTabIndex - 1]);
        } else if (isCart) {
            // Si estás en la cesta, volver a la tienda
            switchTab('public-business'); 
        } else if (isPublicBusiness) {
            // Si estás en la tienda, volver al directorio general
            goToDirectory('todos'); 
        }
    }
}