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

// Nueva función: Resetea el filtro y va al directorio completo desde el NavBar
function resetAndExplore() {
    const searchInput = document.getElementById('directorySearch');
    if (searchInput) searchInput.value = '';
    
    // Al venir desde explorar, nos aseguramos de que la barra se muestre
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