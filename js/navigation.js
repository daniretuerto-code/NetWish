let lastMainTab = 'home';
let swipeAnim = 'fade-in';

// --- FUNCIÓN UNIFICADA PARA ACTUALIZAR LA CABECERA (LOGO Y AVATAR) ---
function applyHeaderState(tabId) {
    const mainHeader = document.getElementById('mainAppHeader');
    const avatarBtn = document.getElementById('headerAvatar');
    if (!mainHeader) return;

    if (tabId === 'public-business' || tabId === 'cart') {
        mainHeader.classList.add('hidden');
        return;
    } else {
        mainHeader.classList.remove('hidden');
    }

    if (tabId === 'profile') {
        mainHeader.classList.remove('justify-between');
        mainHeader.classList.add('justify-center');
        if (avatarBtn) avatarBtn.classList.add('hidden');
    } else {
        mainHeader.classList.remove('justify-center');
        mainHeader.classList.add('justify-between');
        if (avatarBtn) avatarBtn.classList.remove('hidden');
    }
}

function switchTab(tabId) {
    if (['home', 'explore', 'scan', 'profile', 'business-dashboard'].includes(tabId)) {
        lastMainTab = tabId;
    }

    const mainTabs = ['home', 'explore', 'scan', 'profile'];
    const scrollWrapper = document.getElementById('swipeScrollWrapper');

    // Si es una pestaña principal del carrusel, hacemos scroll horizontal fluido nativo
    if (mainTabs.includes(tabId) && scrollWrapper) {
        const index = mainTabs.indexOf(tabId);
        scrollWrapper.scrollTo({
            left: index * scrollWrapper.clientWidth,
            behavior: 'smooth'
        });
    }

    // Gestionamos la visibilidad de vistas secundarias / modales por capas
    const secondaryViews = ['payment', 'business-dashboard', 'public-business', 'cart'];
    secondaryViews.forEach(v => {
        const el = document.getElementById('view-' + v);
        if (el) {
            if (v === tabId) {
                el.classList.remove('hidden');
                el.classList.add('flex', 'fade-in');
            } else {
                el.classList.add('hidden');
                el.classList.remove('flex', 'fade-in');
            }
        }
    });

    if (tabId === 'profile') renderProfileView();
    if (tabId === 'business-dashboard') renderBusinessOrders();
    if (tabId === 'payment') { 
        holdProgress = 0; 
        const pb = document.getElementById('progressBar'); 
        if (pb) pb.style.width = '0%'; 
    }

    // Aplicar estado de cabecera
    applyHeaderState(tabId);

    const pNav = document.getElementById('personal-nav');
    const bNav = document.getElementById('business-nav');

    if (['payment', 'public-business', 'cart', 'business-dashboard'].includes(tabId) && secondaryViews.includes(tabId)) {
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

// Sincronizar botones y cabecera en tiempo real al deslizar con el dedo
document.addEventListener('DOMContentLoaded', () => {
    const scrollWrapper = document.getElementById('swipeScrollWrapper');
    if (scrollWrapper) {
        scrollWrapper.addEventListener('scroll', () => {
            const scrollLeft = scrollWrapper.scrollLeft;
            const width = scrollWrapper.clientWidth;
            const index = Math.round(scrollLeft / width);
            const mainTabs = ['home', 'explore', 'scan', 'profile'];
            if (mainTabs[index]) {
                const activeTab = mainTabs[index];
                lastMainTab = activeTab;
                updateNavHighlight(activeTab);
                applyHeaderState(activeTab); // Actualiza la cabecera en vivo al deslizar
            }
        }, { passive: true });
    }
});

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
    switchTab('explore');
}

function goBackFromBusiness() {
    switchTab(lastMainTab || 'home');
}

function updateHeaderAvatar() {
    const avatarBtn = document.getElementById('headerAvatar');
    if (!avatarBtn) return;
    
    if (currentBusiness) {
        avatarBtn.innerHTML = "BIZ";
        avatarBtn.className = "w-9 h-9 rounded-2xl bg-amber-500 text-white border border-amber-600 flex items-center justify-center text-[10px] font-bold shadow-md transition hover:scale-105 active:scale-95 overflow-hidden p-0";
    } else if (currentUser) {
        const meta = currentUser.user_metadata || {};
        const avatarUrl = meta.avatar_url || meta.picture;
        
        avatarBtn.className = "w-9 h-9 rounded-2xl bg-black text-white border border-neutral-800 flex items-center justify-center text-xs font-bold shadow-md transition hover:scale-105 active:scale-95 overflow-hidden p-0";
        
        if (avatarUrl) {
            avatarBtn.innerHTML = `<img src="${avatarUrl}" class="w-full h-full object-cover" alt="Perfil">`;
        } else {
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