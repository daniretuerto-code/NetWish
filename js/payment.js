var rawAmountString = "000";
var holdProgress = 0;
var holdInterval = null;

function appendNum(num) {
    if (rawAmountString === "000" || rawAmountString === "0") {
        rawAmountString = num === "00" ? "0" : num;
    } else if (rawAmountString.length < 7) {
        rawAmountString += num;
    }
    updateAmountDisplay();
}

function clearNum() {
    if (rawAmountString.length > 1) {
        rawAmountString = rawAmountString.slice(0, -1);
    } else {
        rawAmountString = "0";
    }
    updateAmountDisplay();
}

function updateAmountDisplay() {
    const amountVal = (parseInt(rawAmountString || "0", 10) / 100).toFixed(2);
    const displayEl = document.getElementById('payAmountDisplay');
    if (displayEl) {
        displayEl.innerText = amountVal.replace('.', ',');
    }
}

function initHoldButtonListeners() {
    const btn = document.getElementById('holdButtonContainer');
    if (!btn) return;

    const startHold = (e) => {
        e.preventDefault();
        const numVal = parseInt(rawAmountString || "0", 10);
        if (numVal <= 0 && (!typeof isCartCheckout || !isCartCheckout)) {
            alert("Introduce un importe válido mayor a 0,00 €");
            return;
        }
        if (!currentUser) {
            if (typeof openAuthModal === 'function') openAuthModal('login');
            return;
        }
        clearInterval(holdInterval);
        holdProgress = 0;
        holdInterval = setInterval(() => {
            holdProgress += 4;
            const pb = document.getElementById('progressBar');
            if (pb) pb.style.width = holdProgress + '%';

            if (holdProgress >= 100) {
                clearInterval(holdInterval);
                executeFullPayment(false);
            }
        }, 30);
    };

    const endHold = () => {
        clearInterval(holdInterval);
        if (holdProgress < 100) {
            holdProgress = 0;
            const pb = document.getElementById('progressBar');
            if (pb) pb.style.width = '0%';
        }
    };

    btn.addEventListener('mousedown', startHold);
    btn.addEventListener('touchstart', startHold, { passive: false });
    window.addEventListener('mouseup', endHold);
    window.addEventListener('touchend', endHold);
}

async function executeFullPayment(isReservationOnly = false) {
    const amount = isReservationOnly ? cartTotalValue : (parseInt(rawAmountString || "0", 10) / 100);
    const meta = currentUser?.user_metadata || {};
    const customerName = `${meta.name || ''} ${meta.surname || ''}`.trim() || currentUser?.email || 'Usuario';
    const bName = activeBusinessUsername || activeBusinessName || activePayee || 'Comercio';

    const itemsString = isCartCheckout ? cartItemsList.map(i => `${i.qty}x ${i.name}`).join(', ') : 'Pago Directo QR';
    const orderDate = pendingOrderDetails?.date || new Date().toISOString().split('T')[0];
    const orderTime = pendingOrderDetails?.time || new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });

    const orderPayload = {
        business_name: bName,
        customer: customerName,
        items: itemsString,
        total: amount,
        date: orderDate,
        time: orderTime,
        status: isReservationOnly ? 'Pendiente Pago Local' : 'Pagado Online'
    };

    try {
        const { error } = await supabaseClient
            .from('orders')
            .insert([orderPayload]);
        if (error) throw error;
    } catch (err) {
        console.error("Error al registrar el pedido en Supabase:", err);
    }

    const modal = document.getElementById('customModal');
    const modalContent = document.getElementById('customModalContent') || document.getElementById('modalContent');
    const modalBody = document.getElementById('modalBody');

    if (modal && modalBody) {
        modalBody.innerHTML = `
            <div class="space-y-4 text-center py-6">
                <div class="w-16 h-16 rounded-full ${isReservationOnly ? 'bg-amber-50 text-amber-600 border-amber-200' : 'bg-emerald-50 text-emerald-600 border-emerald-200'} border flex items-center justify-center mx-auto shadow-inner">
                    <i data-lucide="${isReservationOnly ? 'calendar-check' : 'check'}" class="w-8 h-8"></i>
                </div>
                <div class="space-y-1">
                    <h3 class="text-lg font-bold text-black">${isReservationOnly ? '¡Reserva Confirmada!' : '¡Pago Completado!'}</h3>
                    <p class="text-xs text-neutral-500">Operación registrada en la red urbana.</p>
                </div>
                <div class="bg-neutral-50 p-4 rounded-2xl border border-neutral-200/60 text-left text-xs space-y-1.5">
                    <div class="flex justify-between"><span class="text-neutral-400">Establecimiento:</span><strong class="text-black">${activeBusinessName || bName}</strong></div>
                    <div class="flex justify-between"><span class="text-neutral-400">Importe:</span><strong class="text-black">${amount.toFixed(2)} €</strong></div>
                    <div class="flex justify-between"><span class="text-neutral-400">Estado:</span><strong class="${isReservationOnly ? 'text-amber-600' : 'text-emerald-600'}">${orderPayload.status}</strong></div>
                </div>
                <button onclick="if(typeof closeModal === 'function') closeModal(); if(typeof switchTab === 'function') switchTab('home');" class="w-full py-3.5 bg-black text-white font-semibold rounded-2xl text-xs">Aceptar</button>
            </div>
        `;
        if (typeof lucide !== 'undefined') lucide.createIcons();
        modal.classList.remove('hidden');
        setTimeout(() => {
            modal.classList.remove('opacity-0');
            if (modalContent) modalContent.classList.remove('scale-95');
        }, 10);
    }

    if (typeof cartTotalValue !== 'undefined') {
        cartTotalValue = 0;
        cartItemCount = 0;
        cartItemsList = [];
        isCartCheckout = false;
        pendingOrderDetails = null;
        if (typeof updateCartDisplay === 'function') updateCartDisplay();
    }
    
    rawAmountString = "000";
    const pb = document.getElementById('progressBar');
    if (pb) pb.style.width = '0%';
}