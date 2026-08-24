window.rawAmountString = window.rawAmountString || "000";

// --- CONTROL DEL TECLADO NUMÉRICO ---
function appendNum(num) {
    if (window.rawAmountString.length >= 8) return;
    if (window.rawAmountString === "000" || window.rawAmountString === "0") {
        window.rawAmountString = num;
    } else {
        window.rawAmountString += num;
    }
    window.updateAmountDisplay();
}

function clearNum() {
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

// --- BOTÓN MANTENER PARA CONFIRMAR ---
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
            alert("Añade un importe o artículos a la cesta para continuar.");
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

// --- EJECUCIÓN DEL PAGO Y NOTIFICACIONES ---
window.executeFullPayment = async function(isReservation = false) {
    try {
        const modal = document.getElementById('customModal');
        const modalContent = document.getElementById('modalContent');
        const modalBody = document.getElementById('modalBody');

        let isCart = window.appState && window.appState.isCartCheckout;
        let cTotal = window.appState ? window.appState.cartTotalValue : 0;
        let cItems = window.appState ? window.appState.cartItemsList : [];
        let pDetails = window.appState ? window.appState.pendingOrderDetails : null;
        let tBusiness = window.activePayee || (window.appState && window.appState.activeBusinessName) || 'Comercio Local';

        let totalVal = isCart ? cTotal : (parseInt(window.rawAmountString || "0", 10) / 100);
            
        let itemsDesc = isCart && cItems.length > 0
            ? cItems.map(i => `${i.qty}x ${i.name}`).join(', ') 
            : 'Pago Directo Terminal';

        // 1. OBTENER EMAIL DEL CLIENTE
        let customerName = 'Cliente';
        let customerEmail = null;

        if (typeof currentUser !== 'undefined' && currentUser && currentUser.email) {
            customerName = currentUser.user_metadata?.full_name || currentUser.user_metadata?.name || currentUser.email.split('@')[0];
            customerEmail = currentUser.email;
        } else if (typeof supabaseClient !== 'undefined') {
            const { data: authData } = await supabaseClient.auth.getUser();
            if (authData && authData.user) {
                customerEmail = authData.user.email;
                customerName = authData.user.user_metadata?.full_name || customerEmail.split('@')[0];
            }
        }

        // Email de respaldo durante fase de pruebas si no está logueado
        if (!customerEmail) {
            customerEmail = 'daniretuerto@gmail.com';
        }

        // 2. OBTENER EMAIL DEL NEGOCIO DESDE SUPABASE
        let businessEmail = 'daniretuerto@gmail.com';
        try {
            if (typeof supabaseClient !== 'undefined') {
                const cleanName = tBusiness.trim().toLowerCase();
                const { data: bData } = await supabaseClient
                    .from('businesses')
                    .select('notification_email, name')
                    .ilike('name', `%${cleanName}%`)
                    .maybeSingle();

                if (bData && bData.notification_email) {
                    businessEmail = bData.notification_email.trim();
                }
            }
        } catch (bErr) {
            console.warn("Aviso consultando email del negocio:", bErr);
        }

        let orderDate = pDetails?.date || new Date().toISOString().split('T')[0];
        let orderTime = pDetails?.time || "Inmediato";
        let statusText = isReservation ? 'Pendiente (Pago en local)' : 'Pagado Online';

        const orderPayload = {
            business_name: tBusiness,
            customer: customerName,
            customer_email: customerEmail,
            business_email: businessEmail,
            items: itemsDesc,
            total: totalVal,
            date: orderDate,
            time: orderTime,
            status: statusText
        };

        console.group("🚀 [NetWish] Enviando Pedido y Emails");
        console.log("Datos de la orden:", orderPayload);
        console.groupEnd();

        // 3. Guardar en Supabase
        try {
            if (typeof supabaseClient !== 'undefined') {
                await supabaseClient.from('orders').insert([orderPayload]);
            }
        } catch (err) {
            console.warn("Aviso guardando orden en BD:", err);
        }

        // 4. Invocación HTTP directa a la Edge Function
        try {
            const funcUrl = `${SUPABASE_URL}/functions/v1/send-order-email`;
            fetch(funcUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'apikey': SUPABASE_ANON_KEY,
                    'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
                },
                body: JSON.stringify({ record: orderPayload })
            })
            .then(res => res.json())
            .then(data => {
                console.log("📬 Resultado envío de emails:", data);
            })
            .catch(err => console.warn("❌ Error invocando Edge Function:", err));
        } catch (mailErr) {
            console.warn("Fallo en la llamada de correo:", mailErr);
        }

        // 5. Renderizar modal minimalista
        if (modalBody) {
            modalBody.innerHTML = `
                <div class="text-center space-y-4 py-3">
                    <div class="w-16 h-16 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto shadow-inner">
                        <i data-lucide="check" class="w-8 h-8"></i>
                    </div>
                    <div>
                        <h3 class="text-lg font-bold text-black">${isReservation ? 'Reserva Confirmada' : 'Pago Completado'}</h3>
                        <p class="text-xs text-neutral-500 mt-1">Registrado con éxito en ${tBusiness}.</p>
                        <p class="text-[10px] text-neutral-400 mt-1 font-mono">Recibo digital enviado.</p>
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
            `;
            if (typeof lucide !== 'undefined') lucide.createIcons();
        }

        if (modal) {
            modal.classList.remove('hidden');
            setTimeout(() => {
                modal.classList.remove('opacity-0');
                if (modalContent) modalContent.classList.remove('scale-95');
            }, 10);
        }

    } catch (criticalError) {
        console.error("Fallo crítico en la confirmación:", criticalError);
        alert("Ocurrió un error. Comprueba tu conexión.");
    }
};

// --- FINALIZACIÓN Y RESETEO TRAS EL PAGO ---
window.finishPaymentFlow = function() {
    const modal = document.getElementById('customModal');
    const modalContent = document.getElementById('modalContent');
    
    if (modal) {
        modal.classList.add('opacity-0');
        if (modalContent) modalContent.classList.add('scale-95');
        setTimeout(() => modal.classList.add('hidden'), 300);
    }

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