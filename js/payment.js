let rawAmountString = "000";
let activePayee = "";
let holdProgress = 0;
let holdInterval = null;
let isCartCheckout = false;
let pendingOrderDetails = null;
let cartTotalValue = 0;
let cartItemCount = 0;
let cartItemsList = [];

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
        if (numVal <= 0) {
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
    const bName = activePayee || 'Comercio';

    const orderPayload = {
        business_name: bName,
        customer: customerName,
        items: isCartCheckout ? cartItemsList.map(i => `${i.qty}x ${i.name}`).join(', ') : 'Pago Directo QR',
        total: amount,
        date: pendingOrderDetails?.date || new Date().toISOString().split('T')[0],
        time: pendingOrderDetails?.time || new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }),
        status: isReservationOnly ? 'Pendiente Pago Local' : 'Pagado Online'
    };

    // Inserción directa en Supabase
    try {
        const { error } = await supabaseClient
            .from('orders')
            .insert([orderPayload]);
        if (error) throw error;
    } catch (err) {
        console.error("Error guardando pedido en Supabase:", err);
    }

    // Modal de confirmación
    const modal = document.getElementById('customModal');
    const modalContent = document.getElementById('modalContent');
    const modalBody = document.getElementById('modalBody');

    if (modal && modalBody) {
        modalBody.innerHTML = `
            <div class="space-y-4 text-center py-6">
                <div class="w-16 h-16 rounded-full ${isReservationOnly ? 'bg-amber-50 text-amber-600 border-amber-200' : 'bg-emerald-50 text-emerald-600 border-emerald-200'} border flex items-center justify-center mx-auto shadow-inner">
                    <i data-lucide="${isReservationOnly ? 'calendar-check' : 'check'}" class="w-8 h-8"></i>
                </div>
                <div class="space-y-1">
                    <h3 class="text-lg font-bold text-black">${isReservationOnly ? '¡Reserva Confirmada!' : '¡Pago Completado!'}</h3>
                    <p class="text-xs text-neutral-500">Operación registrada en la red urbana de Palencia.</p>
                </div>
                <div class="bg-neutral-50 p-4 rounded-2xl border border-neutral-200/60 text-left text-xs space-y-1.5">
                    <div class="flex justify-between"><span class="text-neutral-400">Establecimiento:</span><strong class="text-black">${bName}</strong></div>
                    <div class="flex justify-between"><span class="text-neutral-400">Importe:</span><strong class="text-black">${amount.toFixed(2)} €</strong></div>
                    <div class="flex justify-between"><span class="text-neutral-400">Estado:</span><strong class="${isReservationOnly ? 'text-amber-600' : 'text-emerald-600'}">${orderPayload.status}</strong></div>
                </div>
                <button onclick="closeModal(); switchTab('home');" class="w-full py-3.5 bg-black text-white font-semibold rounded-2xl text-xs">Aceptar</button>
            </div>
        `;
        if (typeof lucide !== 'undefined') lucide.createIcons();
        modal.classList.remove('hidden');
        setTimeout(() => {
            modal.classList.remove('opacity-0');
            if (modalContent) modalContent.classList.remove('scale-95');
        }, 10);
    }

    // Resetear cesta y campos
    cartTotalValue = 0;
    cartItemCount = 0;
    cartItemsList = [];
    rawAmountString = "000";
    isCartCheckout = false;
    pendingOrderDetails = null;

    if (typeof updateCartDisplay === 'function') updateCartDisplay();
    const pb = document.getElementById('progressBar');
    if (pb) pb.style.width = '0%';
}