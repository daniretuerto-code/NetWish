let lastMainTab = 'home';
let swipeAnim = 'fade-in';

function switchTab(tabId) {
    if (['home', 'explore', 'scan', 'profile', 'business-dashboard'].includes(tabId)) {
        lastMainTab = tabId;
    }

    const views = ['home', 'explore', 'scan', 'profile', 'payment', 'business-dashboard', 'public-business', 'cart'];
    
    views.forEach(v => {
        const el = document.getElementById('view-' + v);
        if (el) {
            el.classList.add('hidden');
            el.classList.remove('slide-in-right', 'slide-in-left', 'fade-in');
        }
    });

    const targetView = document.getElementById('view-' + tabId);
    if (targetView) {
        targetView.classList.remove('hidden');
        targetView.classList.add(swipeAnim);
    }
    swipeAnim = 'fade-in'; 

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
        mainHeader.classList.add('hidden');
    } else {
        mainHeader.classList.remove('hidden');
    }

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

    updateNavHighlight(tabId);
}

function updateNavHighlight(activeTabId) {
    const tabs = ['home', 'explore', 'scan', 'profile'];
    const bizTabs = ['dashboard', 'scan', 'profile'];
    
    tabs.forEach(tab => {
        const btn = document.getElementById('nav-btn-' + tab);
        if(!btn) return;
        const icon = btn.querySelector('i');
        
        if (tab === activeTabId || (activeTabId === 'public-business' && tab === lastMainTab) || (activeTabId === 'cart' && tab === lastMainTab)) {
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
    swipeAnim = 'fade-in';
    switchTab('explore');
}

function goBackFromBusiness() {
    swipeAnim = 'slide-in-left';
    switchTab(lastMainTab || 'home');
}

function updateHeaderAvatar() {
    const avatarBtn = document.getElementById('headerAvatar');
    
    if (currentBusiness) {
        avatarBtn.innerHTML = "BIZ";
        // Añadimos overflow-hidden y p-0 para evitar desbordes
        avatarBtn.className = "w-9 h-9 rounded-2xl bg-amber-500 text-white border border-amber-600 flex items-center justify-center text-[10px] font-bold shadow-md transition hover:scale-105 active:scale-95 overflow-hidden p-0";
    } else if (currentUser) {
        const meta = currentUser.user_metadata || {};
        // Detectamos si Google nos ha pasado una foto de perfil
        const avatarUrl = meta.avatar_url || meta.picture;
        
        avatarBtn.className = "w-9 h-9 rounded-2xl bg-black text-white border border-neutral-800 flex items-center justify-center text-xs font-bold shadow-md transition hover:scale-105 active:scale-95 overflow-hidden p-0";
        
        if (avatarUrl) {
            // Si hay URL, inyectamos la imagen directamente
            avatarBtn.innerHTML = `<img src="${avatarUrl}" class="w-full h-full object-cover" alt="Perfil">`;
        } else {
            // Si no hay foto, mantenemos tu lógica original con las iniciales
            avatarBtn.innerHTML = meta.initials || "NW";
        }
    } else {
        avatarBtn.innerHTML = "IN";
        avatarBtn.className = "w-9 h-9 rounded-2xl bg-neutral-100 border border-neutral-200/60 flex items-center justify-center text-xs font-bold text-black shadow-inner transition hover:scale-105 active:scale-95 overflow-hidden p-0";
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
    
    if (Math.abs(yDiff) > Math.abs(xDiff)) return;
    if (Math.abs(xDiff) < 50) return;

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
        if (activeTabIndex >= 0 && activeTabIndex < tabs.length - 1) {
            swipeAnim = 'slide-in-right';
            switchTab(tabs[activeTabIndex + 1]);
        }
    } else {
        if (activeTabIndex > 0) {
            swipeAnim = 'slide-in-left';
            switchTab(tabs[activeTabIndex - 1]);
        } else if (isCart) {
            swipeAnim = 'slide-in-left';
            switchTab('public-business'); 
        } else if (isPublicBusiness) {
            goBackFromBusiness();
        }
    }
}