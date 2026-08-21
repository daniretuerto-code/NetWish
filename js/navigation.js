// --- ÓRDENES Y CONFIGURACIÓN DE PESTAÑAS ---
const userTabOrder = ['home', 'explore', 'scan', 'profile'];
const bizTabOrder = ['business-dashboard', 'business-orders', 'business-scan', 'business-profile'];

// --- CONTROLADOR PRINCIPAL DE ENRUTAMIENTO Y TRANSICIONES ---
function switchTab(tabId) {
    activeTab = tabId;
    
    const userWrapper = document.getElementById('userScrollWrapper');
    const bizWrapper = document.getElementById('bizScrollWrapper');
    const personalNav = document.getElementById('personal-nav');
    const bizNav = document.getElementById('business-nav');

    // 1. Cerrar submenús flotantes si se navega a pestañas principales
    const subViews = ['view-category', 'view-payment', 'view-cart', 'view-public-business'];
    if (userTabOrder.includes(tabId) || bizTabOrder.includes(tabId)) {
        subViews.forEach(vId => {
            const el = document.getElementById(vId);
            if (el) {
                el.classList.add('hidden');
            }
        });
    }

    // 2. Comprobación y alternancia de wrappers según el modo (Comercio o Usuario)
    if (currentBusiness) {
        if (personalNav) personalNav.classList.add('hidden');
        if (bizNav) bizNav.classList.remove('hidden');
        if (userWrapper) userWrapper.classList.add('hidden');
        if (bizWrapper) bizWrapper.classList.remove('hidden');

        if (bizTabOrder.includes(tabId)) {
            const index = bizTabOrder.indexOf(tabId);
            if (bizWrapper) {
                bizWrapper.scrollTo({
                    left: index * bizWrapper.clientWidth,
                    behavior: 'smooth'
                });
            }
            updateActiveBizNavButton(tabId);
        }
    } else {
        if (bizNav) bizNav.classList.add('hidden');
        if (personalNav) personalNav.classList.remove('hidden');
        if (bizWrapper) bizWrapper.classList.add('hidden');
        if (userWrapper) userWrapper.classList.remove('hidden');

        if (userTabOrder.includes(tabId)) {
            const index = userTabOrder.indexOf(tabId);
            if (userWrapper) {
                userWrapper.scrollTo({
                    left: index * userWrapper.clientWidth,
                    behavior: 'smooth'
                });
            }
            updateActiveUserNavButton(tabId);
        }
    }

    // 3. Manejo de vistas modulares y submenús flotantes
    if (tabId === 'category') {
        const catView = document.getElementById('view-category');
        if (catView) {
            catView.classList.remove('hidden');
            catView.scrollTop = 0;
        }
    } else if (tabId === 'payment') {
        const payView = document.getElementById('view-payment');
        if (payView) {
            payView.classList.remove('hidden');
            payView.scrollTop = 0;
        }
    } else if (tabId === 'cart') {
        const cartView = document.getElementById('view-cart');
        if (cartView) {
            cartView.classList.remove('hidden');
            cartView.scrollTop = 0;
        }
    } else if (tabId === 'public-business') {
        const pubBizView = document.getElementById('view-public-business');
        if (pubBizView) {
            pubBizView.classList.remove('hidden');
            pubBizView.scrollTop = 0;
        }
    }

    // 4. Adaptación reactiva de la cabecera (Centrado y visibilidad del avatar)
    updateHeaderLayout(tabId);

    // 5. Refresco dinámico de iconos Lucide
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
}

// --- ACTUALIZACIÓN DINÁMICA DE LA CABECERA SEGÚN LA PESTAÑA ---
function updateHeaderLayout(currentActiveTab) {
    const header = document.getElementById('mainAppHeader');
    const headerLogo = document.getElementById('headerLogo');
    const headerAvatar = document.getElementById('headerAvatar');

    if (!header || !headerLogo || !headerAvatar) return;

    const isProfileTab = currentActiveTab === 'profile' || currentActiveTab === 'business-profile';

    if (isProfileTab) {
        // Modo Perfil: Logo centrado y avatar oculto
        header.classList.remove('justify-between');
        header.classList.add('justify-center');
        headerAvatar.classList.add('hidden', 'opacity-0', 'pointer-events-none');
        headerLogo.classList.add('text-center', 'mx-auto');
    } else {
        // Modo Estándar: Logo a la izquierda y avatar visible a la derecha
        header.classList.remove('justify-center');
        header.classList.add('justify-between');
        headerAvatar.classList.remove('hidden', 'opacity-0', 'pointer-events-none');
        headerLogo.classList.remove('text-center', 'mx-auto');
    }

    updateHeaderAvatar();
}

// --- ACTUALIZACIÓN VISUAL DE BOTONES (MODO USUARIO) ---
function updateActiveUserNavButton(activeId) {
    userTabOrder.forEach(tab => {
        const btn = document.getElementById(`nav-btn-${tab}`);
        if (!btn) return;
        const icon = btn.querySelector('i');
        const text = btn.querySelector('span');

        if (tab === activeId) {
            btn.className = "flex flex-col items-center text-black space-y-1 transition group";
            if (icon) icon.className = "w-5 h-5 transition-transform group-active:scale-90 scale-110";
            if (text) text.className = "text-[9px] font-bold tracking-tight";
        } else {
            btn.className = "flex flex-col items-center text-neutral-400 transition space-y-1 group";
            if (icon) icon.className = "w-5 h-5 transition-transform group-active:scale-90";
            if (text) text.className = "text-[9px] font-medium tracking-tight";
        }
    });
}

// --- ACTUALIZACIÓN VISUAL DE BOTONES (MODO COMERCIO) ---
function updateActiveBizNavButton(activeId) {
    const keyMap = {
        'business-dashboard': 'dashboard',
        'business-orders': 'orders',
        'business-scan': 'scan',
        'business-profile': 'profile'
    };
    
    bizTabOrder.forEach(tab => {
        const shortKey = keyMap[tab];
        const btn = document.getElementById(`biz-nav-btn-${shortKey}`);
        if (!btn) return;
        const icon = btn.querySelector('i');
        const text = btn.querySelector('span');

        if (tab === activeId) {
            btn.className = "flex flex-col items-center text-white space-y-1 transition group";
            if (icon) icon.className = "w-5 h-5 transition-transform group-active:scale-90 scale-110";
            if (text) text.className = "text-[9px] font-bold tracking-tight";
        } else {
            btn.className = "flex flex-col items-center text-neutral-400 transition space-y-1 group";
            if (icon) icon.className = "w-5 h-5 transition-transform group-active:scale-90";
            if (text) text.className = "text-[9px] font-medium tracking-tight";
        }
    });
}

// --- ESCUCHADORES DE SCROLL SNAP E INERCIA TÁCTIL ---
document.addEventListener('DOMContentLoaded', () => {
    const userWrapper = document.getElementById('userScrollWrapper');
    const bizWrapper = document.getElementById('bizScrollWrapper');

    // Sincronización del deslizamiento horizontal para usuarios
    if (userWrapper) {
        userWrapper.addEventListener('scroll', () => {
            const index = Math.round(userWrapper.scrollLeft / userWrapper.clientWidth);
            const targetTab = userTabOrder[index];
            if (targetTab && activeTab !== targetTab) {
                updateActiveUserNavButton(targetTab);
                updateHeaderLayout(targetTab);
                activeTab = targetTab;
            }
        }, { passive: true });
    }

    // Sincronización del deslizamiento horizontal para comercios (4 pestañas)
    if (bizWrapper) {
        bizWrapper.addEventListener('scroll', () => {
            const index = Math.round(bizWrapper.scrollLeft / bizWrapper.clientWidth);
            const targetTab = bizTabOrder[index];
            if (targetTab && activeTab !== targetTab) {
                updateActiveBizNavButton(targetTab);
                updateHeaderLayout(targetTab);
                activeTab = targetTab;
            }
        }, { passive: true });
    }

    updateHeaderLayout(activeTab || 'home');
});

// --- CLIC EN EL AVATAR DE LA CABECERA ---
function handleHeaderProfileClick() {
    if (currentBusiness) {
        switchTab('business-profile');
    } else {
        switchTab('profile');
    }
}

// --- RETROCESO DESDE EL COMERCIO PÚBLICO ---
function goBackFromBusiness() {
    const pubBizView = document.getElementById('view-public-business');
    if (pubBizView) {
        pubBizView.classList.add('hidden');
    }
    switchTab('explore');
}

// --- ACTUALIZACIÓN REACTIVA DEL AVATAR DEL HEADER (FOTO GOOGLE / BIZ / TEXTO) ---
function updateHeaderAvatar() {
    const avatarBtn = document.getElementById('headerAvatar');
    if (!avatarBtn) return;

    if (currentBusiness) {
        avatarBtn.innerHTML = "BIZ";
        avatarBtn.className = "w-9 h-9 rounded-2xl bg-black text-white border border-neutral-800 flex items-center justify-center text-xs font-bold shadow-sm transition hover:scale-105 active:scale-95";
    } else if (currentUser) {
        const meta = currentUser.user_metadata || {};
        const avatarUrl = meta.avatar_url || meta.picture;

        if (avatarUrl) {
            avatarBtn.innerHTML = `<img src="${avatarUrl}" class="w-full h-full object-cover" alt="Perfil">`;
            avatarBtn.className = "w-9 h-9 rounded-2xl bg-neutral-100 border border-neutral-200/60 flex items-center justify-center shadow-inner transition hover:scale-105 active:scale-95 overflow-hidden p-0";
        } else {
            avatarBtn.innerHTML = meta.initials || 'NW';
            avatarBtn.className = "w-9 h-9 rounded-2xl bg-neutral-100 border border-neutral-200/60 flex items-center justify-center text-xs font-bold text-black shadow-inner transition hover:scale-105 active:scale-95";
        }
    } else {
        avatarBtn.innerHTML = "IN";
        avatarBtn.className = "w-9 h-9 rounded-2xl bg-neutral-100 border border-neutral-200/60 flex items-center justify-center text-xs font-bold text-black shadow-inner transition hover:scale-105 active:scale-95";
    }
}