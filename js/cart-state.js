// js/cart-state.js

window.appState = window.appState || {};
window.appState.activeBusinessName = "";
window.appState.activeBusinessCategory = "";
window.appState.activeBusinessEmail = "contacto@netwish.es";
window.appState.isScheduleEnabled = true;
window.appState.cartItemsList = [];
window.appState.cartTotalValue = 0;
window.appState.cartItemCount = 0;
window.appState.isCartCheckout = false;
window.appState.pendingOrderDetails = null;
window.appState.cartsByBusiness = window.appState.cartsByBusiness || {};

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

    const paymentView = document.getElementById('view-payment');
    const isPaymentOpen = paymentView && !paymentView.classList.contains('hidden');

    if (window.appState.cartItemCount > 0 && isInsideBusiness && !isCartOpen && !isPaymentOpen) {
        cartBar.classList.remove('translate-y-64', 'opacity-0', 'pointer-events-none');
        cartBar.classList.add('translate-y-0', 'opacity-100', 'pointer-events-auto');
        const totalEl = document.getElementById('cartTotalDisplay');
        const countEl = document.getElementById('cartCountDisplay');
        if (totalEl) totalEl.innerText = window.appState.cartTotalValue.toLocaleString('es-ES', { minimumFractionDigits: 2 }) + ' €';
        if (countEl) countEl.innerText = window.appState.cartItemCount;
    } else {
        cartBar.classList.remove('translate-y-0', 'opacity-100', 'pointer-events-auto');
        cartBar.classList.add('translate-y-64', 'opacity-0', 'pointer-events-none');
    }
}