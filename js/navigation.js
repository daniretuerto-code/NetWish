let lastMainTab = 'home';

function switchTab(tabId) {
    if (['home', 'explore', 'scan', 'profile'].includes(tabId)) {
        lastMainTab = tabId;
    }

    const carousel = document.getElementById('iosCarouselContainer');
    const secondaryContainer = document.getElementById('secondaryViewsContainer');
    const publicBizView = document.getElementById('view-public-business');

    // Ocultar vistas secundarias y públicas por defecto
    if (secondaryContainer) secondaryContainer.classList.add('hidden');
    if (publicBizView) publicBizView.classList.add('hidden');

    // Mapeo de pestañas principales del carrusel horizontal tipo iOS
    const tabIndices = { 'home': 0, 'explore': 1, 'scan': 2, 'profile': 3 };

    if (tabIndices[tabId] !== undefined) {
        if (carousel) {
            carousel.style.transform = `translateX(-${tabIndices[tabId] * 25}%)`;
        }
    } else {
        // Si es una vista secundaria (como pasarela de pago, carrito, panel de negocio)
        if (secondaryContainer) {
            secondaryContainer.classList.remove('hidden');
            const secViews = ['view-business-dashboard', 'view-payment', 'view-cart'];
            secViews.forEach(v => {
                const el = document.getElementById(v);
                if (el) el.classList.add('hidden');
            });
            const targetSec = document.getElementById('view-' + tabId);
            if (targetSec) targetSec.classList.remove('hidden');
        } else if (tabId === 'public-business') {
            if (publicBizView) publicBizView.classList.remove('hidden');
        }
    }

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
    
    if (tabId === 'public-business' || tabId === 'cart') {
        if(mainHeader) mainHeader.classList.add('hidden');
    } else {
        if(mainHeader) mainHeader.classList.remove('hidden');
    }

    if (['payment', 'public-business', 'cart'].includes(tabId)) {
        if(pNav) pNav.classList.add('hidden');
        if(bNav) bNav.classList.add('hidden');
    } else {
        if (currentBusiness) {
            if(pNav) pNav.classList.add('hidden');
            if(bNav) bNav.classList.remove('hidden');
        } else {
            if(pNav) pNav.classList.remove('hidden');
            if(bNav) bNav.classList.add('hidden');
        }
    }

    updateNavHighlight(tabId);
}

function updateNavHighlight(activeTabId) {
    const tabs = ['home', 'explore', 'scan', 'profile'];
    const bizTabs = ['dashboard', 'scan', 'profile'];
    
    tabs.forEach(tab => {
        const btn = document.getElementById('nav-btn-' + tab);
        if(!btn) return;
        const icon = btn.querySelector('i');
        
        if (tab === activeTabId || (activeTabId === 'public-business' && tab === lastMainTab) || (activeTabId === 'cart' && tab === lastMainTab) || (activeTabId === 'payment' && tab === lastMainTab)) {
            btn.classList.remove('text-neutral-400');
            btn.classList.add('text-black');
            if (icon) icon.classList.add('scale-110');
        } else {
            btn.classList.remove('text-black');
            btn.classList.add('text-neutral-400');
            if (icon) icon.classList.remove('scale-110');
        }
    });

    bizTabs.forEach(tab => {
        const btn = document.getElementById('biz-nav-btn-' + tab);
        if(!btn) return;
        const icon = btn.querySelector('i');
        if (tab === activeTabId || (activeTabId === 'business-dashboard' && tab === 'dashboard')) {
            btn.classList.remove('text-neutral-400');
            btn.classList.add('text-white');
            if (icon) icon.classList.add('scale-110');
        } else {
            btn.classList.remove('text-white');
            btn.classList.add('text-neutral-400');
            if (icon) icon.classList.remove('scale-110');
        }
    });
}

function resetAndExplore() {
    const searchInput = document.getElementById('directorySearch');
    if (searchInput) searchInput.value = '';
    
    const filterBar = document.getElementById('directoryFilters');
    if (filterBar) filterBar.classList.remove('hidden');

    const titleText = document.getElementById('exploreTitle');
    if (titleText) titleText.innerText = "Directorio Urbano";

    if (typeof filterCategory === 'function') filterCategory('todos');
    switchTab('explore');
}

function goBackFromBusiness() {
    switchTab(lastMainTab || 'home');
}

function updateHeaderAvatar() {
    const avatarBtn = document.getElementById('headerAvatar');
    if (!avatarBtn) return;
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