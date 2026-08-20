let lastMainTab = 'home';
let isProgrammaticScroll = false;
let scrollTimeout = null;

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

    if (tabId === 'profile' || tabId === 'business-profile') {
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
    const userTabs = ['home', 'explore', 'scan', 'profile'];
    const bizTabs = ['business-dashboard', 'business-scan', 'business-profile'];
    const userWrapper = document.getElementById('userScrollWrapper');
    const bizWrapper = document.getElementById('bizScrollWrapper');

    if (currentBusiness) {
        if (userWrapper) userWrapper.classList.add('hidden');
        if (bizWrapper) bizWrapper.classList.remove('hidden');

        if (bizTabs.includes(tabId) && bizWrapper) {
            isProgrammaticScroll = true;
            if (scrollTimeout) clearTimeout(scrollTimeout);
            scrollTimeout = setTimeout(() => { isProgrammaticScroll = false; }, 400);

            const index = bizTabs.indexOf(tabId);
            bizWrapper.scrollTo({
                left: index * bizWrapper.clientWidth,
                behavior: 'smooth'
            });
            lastMainTab = tabId;
        }
    } else {
        if (bizWrapper) bizWrapper.classList.add('hidden');
        if (userWrapper) userWrapper.classList.remove('hidden');

        if (userTabs.includes(tabId) && userWrapper) {
            isProgrammaticScroll = true;
            if (scrollTimeout) clearTimeout(scrollTimeout);
            scrollTimeout = setTimeout(() => { isProgrammaticScroll = false; }, 400);

            const index = userTabs.indexOf(tabId);
            userWrapper.scrollTo({
                left: index * userWrapper.clientWidth,
                behavior: 'smooth'
            });
            lastMainTab = tabId;
        }
    }

    const secondaryViews = ['payment', 'public-business', 'cart', 'category'];
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

    if (tabId === 'explore') {
        if (typeof renderBusinessDirectory === 'function' && typeof allPublicBusinesses !== 'undefined') {
            renderBusinessDirectory(allPublicBusinesses);
        }
    }
    
    // CORRECCIÓN: Renderizar SIEMPRE el perfil si entramos a él
    if (tabId === 'profile' || tabId === 'business-profile') {
        if (typeof renderProfileView === 'function') renderProfileView();
    }
    
    if (tabId === 'business-dashboard') {
        if (typeof renderBusinessOrders === 'function') renderBusinessOrders();
    }

    if (tabId === 'payment') { 
        holdProgress = 0; 
        const pb = document.getElementById('progressBar'); 
        if (pb) pb.style.width = '0%'; 
    }

    applyHeaderState(tabId);

    const pNav = document.getElementById('personal-nav');
    const bNav = document.getElementById('business-nav');

    if (secondaryViews.includes(tabId)) {
        if (pNav) pNav.classList.add('hidden');
        if (bNav) bNav.classList.add('hidden');
    } else {
        if (currentBusiness) {
            if (pNav) pNav.classList.add('hidden');
            if (bNav) bNav.classList.remove('hidden');
        } else {
            if (pNav) pNav.classList.remove('hidden');
            if (bNav) bNav.classList.add('hidden');
        }
    }

    updateNavHighlight(tabId);
}

document.addEventListener('DOMContentLoaded', () => {
    const userWrapper = document.getElementById('userScrollWrapper');
    const bizWrapper = document.getElementById('bizScrollWrapper');

    if (userWrapper) {
        userWrapper.addEventListener('scroll', () => {
            if (isProgrammaticScroll || currentBusiness) return;
            const scrollLeft = userWrapper.scrollLeft;
            const width = userWrapper.clientWidth;
            const index = Math.round(scrollLeft / width);
            const userTabs = ['home', 'explore', 'scan', 'profile'];
            if (userTabs[index]) {
                const activeTab = userTabs[index];
                lastMainTab = activeTab;
                updateNavHighlight(activeTab);
                applyHeaderState(activeTab);
                
                // Aseguramos render al deslizar
                if (activeTab === 'profile') if(typeof renderProfileView === 'function') renderProfileView();
            }
        }, { passive: true });
    }

    if (bizWrapper) {
        bizWrapper.addEventListener('scroll', () => {
            if (isProgrammaticScroll || !currentBusiness) return;
            const scrollLeft = bizWrapper.scrollLeft;
            const width = bizWrapper.clientWidth;
            const index = Math.round(scrollLeft / width);
            const bizTabs = ['business-dashboard', 'business-scan', 'business-profile'];
            if (bizTabs[index]) {
                const activeTab = bizTabs[index];
                lastMainTab = activeTab;
                updateNavHighlight(activeTab);
                applyHeaderState(activeTab);
                
                // Aseguramos render al deslizar
                if (activeTab === 'business-profile') if(typeof renderProfileView === 'function') renderProfileView();
                if (activeTab === 'business-dashboard') if(typeof renderBusinessOrders === 'function') renderBusinessOrders();
            }
        }, { passive: true });
    }
});

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

    const isCategory = !document.getElementById('view-category').classList.contains('hidden');
    const isPublicBusiness = !document.getElementById('view-public-business').classList.contains('hidden');
    const isCart = !document.getElementById('view-cart').classList.contains('hidden');
    const isPayment = !document.getElementById('view-payment').classList.contains('hidden');

    if (xDiff < -50) {
        if (isCategory) {
            switchTab('home');
        } else if (isCart) {
            switchTab('public-business');
        } else if (isPublicBusiness || isPayment) {
            goBackFromBusiness();
        }
    }
}

function updateNavHighlight(activeTabId) {
    const tabs = ['home', 'explore', 'scan', 'profile'];
    const bizTabs = ['business-dashboard', 'business-scan', 'business-profile'];
    
    tabs.forEach(tab => {
        const btn = document.getElementById('nav-btn-' + tab);
        if (!btn) return;
        const icon = btn.querySelector('i');
        
        if (tab === activeTabId || (activeTabId === 'public-business' && tab === lastMainTab) || (activeTabId === 'cart' && tab === lastMainTab) || (activeTabId === 'category' && tab === lastMainTab)) {
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
        if (!btn) return;
        const icon = btn.querySelector('i');
        const isCurrentBizTab = (tab === 'business-dashboard' && activeTabId === 'business-dashboard') ||
                               (tab === 'business-scan' && activeTabId === 'business-scan') ||
                               (tab === 'business-profile' && activeTabId === 'business-profile');

        if (isCurrentBizTab) {
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

function goBackFromBusiness() {
    switchTab(lastMainTab || (currentBusiness ? 'business-dashboard' : 'home'));
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
    switchTab(currentBusiness ? 'business-profile' : 'profile');
}