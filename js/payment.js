// js/payment.js

window.rawAmountString = window.rawAmountString || "000";

function appendNum(num) {
    // Si estamos pagando un carrito con artículos fijos, no permitimos alterar el importe manualmente con el teclado
    if (window.appState && window.appState.isCartCheckout) return;
    if (window.rawAmountString.length >= 8) return;
    if (window.rawAmountString === "000" || window.rawAmountString === "0") {
        window.rawAmountString = num;
    } else {
        window.rawAmountString += num;
    }
    window.updateAmountDisplay();
}

function clearNum() {
    if (window.appState && window.appState.isCartCheckout) return;
    if (window.rawAmountString.length > 1) {
        window.rawAmountString = window.rawAmountString.slice(0, -1);
    } else {
        window.rawAmountString = "0";
    }
    window.updateAmountDisplay();
}

window.updateAmountDisplay = function() {
    const display = document.getElementById('payAmountDisplay');
    if (!display) return;
    
    let val = parseInt(window.rawAmountString, 10) || 0;
    let formatted = (val / 100).toLocaleString('es-ES', { 
        minimumFractionDigits: 2, 
        maximumFractionDigits: 2 
    });
    
    display.innerText = formatted;
};

function initHoldButton() {
    const btnContainer = document.getElementById('holdButtonContainer');
    if (!btnContainer) return;

    let holdTimer = null;
    let holdProgress = 0;
    let isHolding = false;

    const startHold = (e) => {
        if (e.cancelable) e.preventDefault();
        
        const isCart = window.appState && window.appState.isCartCheckout;
        const val = parseInt(window.rawAmountString, 10) || 0;
        
        if (val <= 0 && !isCart) {
            alert("Añade un importe o productos a la cesta.");
            return;
        }

        isHolding = true;
        holdProgress = 0;
        const progressBar = document.getElementById('progressBar');

        clearInterval(holdTimer);
        holdTimer = setInterval(() => {
            if (!isHolding) return;
            holdProgress += 4;
            if (progressBar) progressBar.style.width = holdProgress + '%';

            if (holdProgress >= 100) {
                clearInterval(holdTimer);
                isHolding = false;
                if (progressBar) progressBar.style.width = '0%';
                window.executeFullPayment(false);
            }
        }, 30);
    };

    const stopHold = () => {
        if (!isHolding) return;
        isHolding = false;
        clearInterval(holdTimer);
        holdProgress = 0;
        const progressBar = document.getElementById('progressBar');
        if (progressBar) progressBar.style.width = '0%';
    };

    btnContainer.addEventListener('touchstart', startHold, { passive: false });
    btnContainer.addEventListener('touchend', stopHold);
    btnContainer.addEventListener('touchcancel', stopHold);
    
    btnContainer.addEventListener('mousedown', startHold);
    window.addEventListener('mouseup', stopHold);
    btnContainer.addEventListener('mouseleave', stopHold);
}

document.addEventListener('DOMContentLoaded', initHoldButton);

window.executeFullPayment = async function(isReservation = false) {
    try {
        let isCart = window.appState && window.appState.isCartCheckout;
        let cTotal = window.appState ? window.appState.cartTotalValue : 0;
        let cItems = window.appState ? window.appState.cartItemsList : [];
        let pDetails = window.appState ? window.appState.pendingOrderDetails : null;
        let tBusiness = window.activePayee || (window.appState && window.appState.activeBusinessName) || 'Comercio Local';

        let totalVal = isCart ? cTotal : (parseInt(window.rawAmountString || "0", 10) / 100);
            
        let itemsDesc = isCart && cItems.length > 0
            ? cItems.map(i => `${i.qty}x ${i.name}`).join(', ') 
            : 'Pago Directo Terminal';

        let customerUser = (typeof currentUser !== 'undefined' && currentUser) ? currentUser : null;

        let customerName = customerUser
            ? (customerUser.user_metadata?.full_name || customerUser.user_metadata?.name || customerUser.email?.split('@')[0] || 'Cliente')
            : 'Cliente';

        let customerEmail = (customerUser && customerUser.email) ? customerUser.email : '';

        let orderDate = pDetails?.date || new Date().toISOString().split('T')[0];
        let orderTime = pDetails?.time || "Inmediato";
        let statusText = isReservation ? 'Pendiente (Pago en local)' : 'Pagado Online';

        const client = (typeof supabaseClient !== 'undefined') ? supabaseClient : window.supabase;

        let targetBizEmail = (window.appState && window.appState.activeBusinessEmail) || '';
        
        if (client) {
            try {
                const cleanName = tBusiness.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
                const { data: bizList } = await client
                    .from('businesses')
                    .select('name, notification_email');

                if (bizList && bizList.length > 0) {
                    const match = bizList.find(b => {
                        const bName = (b.name || '').trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
                        return bName.includes(cleanName) || cleanName.includes(bName);
                    });

                    if (match && match.notification_email) {
                        targetBizEmail = match.notification_email;
                    }
                }
            } catch (errBiz) {
                console.warn("Aviso obteniendo notification_email:", errBiz);
            }
        }

        const orderPayload = {
            business_name: tBusiness,
            business_email: targetBizEmail || null,
            customer: customerName,
            customer_email: customerEmail,
            items: itemsDesc,
            total: totalVal,
            date: orderDate,
            time: orderTime,
            status: statusText
        };

        if (client) {
            try {
                await client.from('orders').insert([orderPayload]);
            } catch (err) {
                console.warn("Aviso guardando orden en BD:", err);
            }
        }

        if (window.emailService) {
            const structuredOrder = {
                businessName: tBusiness,
                clientName: customerName,
                date: orderDate,
                time: orderTime,
                items: (isCart && cItems.length > 0) ? cItems : [{ name: 'Pago Directo Terminal', qty: 1, price: totalVal }],
                total: totalVal,
                action: isReservation ? 'reserve' : 'pay'
            };

            if (customerEmail) {
                window.emailService.sendClientReceipt(customerEmail, structuredOrder);
            }

            if (targetBizEmail) {
                window.emailService.sendBusinessAlert(targetBizEmail, structuredOrder);
            }
        }

        window.openModalCustom(`
            <div class="text-center space-y-4 py-3">
                <div class="w-16 h-16 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto shadow-inner">
                    <i data-lucide="check" class="w-8 h-8"></i>
                </div>
                <div>
                    <h3 class="text-lg font-bold text-black">${isReservation ? 'Reserva Confirmada' : 'Pago Completado'}</h3>
                    <p class="text-xs text-neutral-500 mt-1">Registrado con éxito en ${tBusiness}.</p>
                    <p class="text-[10px] text-neutral-400 mt-1 font-mono">Recibo digital emitido a tu correo.</p>
                </div>

                <div class="p-4 bg-neutral-50 rounded-2xl border border-neutral-100 text-left space-y-1">
                    <span class="text-[10px] text-neutral-400 font-mono uppercase block">Detalles</span>
                    <span class="text-xs font-bold text-black block truncate">${itemsDesc}</span>
                    <span class="text-sm font-extrabold text-black block mt-1">${totalVal.toFixed(2)} €</span>
                </div>

                <button onclick="window.finishPaymentFlow()" class="w-full py-3.5 bg-black text-white font-semibold rounded-2xl text-xs active:scale-95 transition shadow-sm">
                    Volver al Inicio
                </button>
            </div>
        `);

    } catch (criticalError) {
        console.error("Fallo crítico en el proceso de pago:", criticalError);
        alert("Ocurrió un error al procesar la operación.");
    }
};

window.finishPaymentFlow = function() {
    window.closeCustomModal();

    window.rawAmountString = "000";
    if (window.appState) {
        window.appState.cartItemsList = [];
        window.appState.cartTotalValue = 0;
        window.appState.cartItemCount = 0;
        window.appState.isCartCheckout = false;
        window.appState.pendingOrderDetails = null;
        if (window.appState.activeBusinessName) {
            delete window.appState.cartsByBusiness[window.appState.activeBusinessName];
        }
    }

    const progressBar = document.getElementById('progressBar');
    if (progressBar) progressBar.style.width = '0%';

    if (typeof updateCartDisplay === 'function') updateCartDisplay();
    window.updateAmountDisplay();

    if (typeof switchTab === 'function') switchTab('home');
};

window.closePaymentView = function() {
    window.rawAmountString = "000";
    window.updateAmountDisplay();
    if (typeof switchTab === 'function') {
        if (window.appState && window.appState.activeBusinessName) {
            switchTab('public-business');
        } else {
            switchTab('home');
        }
    }
};