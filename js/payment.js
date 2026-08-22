window.rawAmountString = window.rawAmountString || "000";

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

// --- MOTOR TÁCTIL INDESTRUCTIBLE ---
function initHoldButton() {
    const btnContainer = document.getElementById('holdButtonContainer');
    if (!btnContainer) return;

    let holdTimer = null;
    let holdProgress = 0;
    let isHolding = false;

    const startHold = (e) => {
        if (e.cancelable) e.preventDefault(); // Bloquear scroll en móvil
        
        const isCart = window.appState && window.appState.isCartCheckout;
        const val = parseInt(window.rawAmountString, 10) || 0;
        
        if (val <= 0 && !isCart) {
            alert("Añade un importe o productos a la cesta para continuar.");
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
                window.executeFullPayment(false); // Llamada al pago
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

    // Listeners universales (Móvil y PC)
    btnContainer.addEventListener('touchstart', startHold, { passive: false });
    btnContainer.addEventListener('touchend', stopHold);
    btnContainer.addEventListener('touchcancel', stopHold);
    
    btnContainer.addEventListener('mousedown', startHold);
    window.addEventListener('mouseup', stopHold);
    btnContainer.addEventListener('mouseleave', stopHold);
}

document.addEventListener('DOMContentLoaded', initHoldButton);

// --- EJECUCIÓN DEL PAGO Y REDIRECCIÓN A WHATSAPP ---
window.executeFullPayment = async function(isReservation = false) {
    try {
        const modal = document.getElementById('customModal');
        const modalContent = document.getElementById('modalContent');
        const modalBody = document.getElementById('modalBody');

        // Leer datos del carrito o del teclado
        let isCart = window.appState && window.appState.isCartCheckout;
        let cTotal = window.appState ? window.appState.cartTotalValue : 0;
        let cItems = window.appState ? window.appState.cartItemsList : [];
        let pDetails = window.appState ? window.appState.pendingOrderDetails : null;
        let tBusiness = window.activePayee || (window.appState && window.appState.activeBusinessName) || 'Comercio Local';

        let totalVal = isCart ? cTotal : (parseInt(window.rawAmountString || "0", 10) / 100);
            
        let itemsDesc = isCart && cItems.length > 0
            ? cItems.map(i => `${i.qty}x ${i.name}`).join(', ') 
            : 'Pago Directo Terminal';
            
        let customerName = (typeof currentUser !== 'undefined' && currentUser) 
            ? (currentUser.user_metadata?.full_name || currentUser.user_metadata?.name || currentUser.email || 'Cliente') 
            : 'Cliente Anónimo';

        let orderDate = pDetails?.date || new Date().toISOString().split('T')[0];
        let orderTime = pDetails?.time || "Inmediato";
        let statusText = isReservation ? 'Pendiente (Pago en local)' : 'Pagado Online';

        // 1. Guardar en Supabase
        try {
            if (typeof supabaseClient !== 'undefined') {
                await supabaseClient.from('orders').insert([{
                    business_name: tBusiness,
                    customer: customerName,
                    items: itemsDesc,
                    total: totalVal,
                    date: orderDate,
                    time: orderTime,
                    status: statusText
                }]);
            }
        } catch (err) {
            console.warn("Fallo guardando en BD:", err);
        }

        // 2. Buscar Teléfono del Negocio
        let bizPhone = null;
        try {
            if (typeof supabaseClient !== 'undefined') {
                const { data } = await supabaseClient
                    .from('businesses')
                    .select('phone, telefono')
                    .ilike('name', `%${tBusiness}%`)
                    .maybeSingle();

                if (data) bizPhone = data.phone || data.telefono;
            }
        } catch (e) {
            console.warn("Fallo buscando teléfono:", e);
        }

        // 3. Crear el enlace de WhatsApp
        let waUrl = "";
        if (bizPhone) {
            let cleanPhone = bizPhone.replace(/\D/g, '');
            if (!cleanPhone.startsWith('34') && cleanPhone.length === 9) {
                cleanPhone = '34' + cleanPhone; 
            }

            const msgText = encodeURIComponent(
                `🚀 *Nuevo Pedido NetWish*\n\n` +
                `👤 *Cliente:* ${customerName}\n` +
                `📦 *Pedido:* ${itemsDesc}\n` +
                `💰 *Total:* ${totalVal.toFixed(2)} €\n` +
                `📅 *Cita/Recogida:* ${orderDate} a las ${orderTime}\n` +
                `📌 *Estado:* ${statusText}`
            );

            waUrl = `https://wa.me/${cleanPhone}?text=${msgText}`;
        }

        // 4. Mostrar el Modal
        if (modalBody) {
            modalBody.innerHTML = `
                <div class="text-center space-y-4 py-3">
                    <div class="w-16 h-16 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto shadow-inner">
                        <i data-lucide="check" class="w-8 h-8"></i>
                    </div>
                    <div>
                        <h3 class="text-lg font-bold text-black">${isReservation ? 'Reserva Confirmada' : 'Pago Completado'}</h3>
                        <p class="text-xs text-neutral-500 mt-1">Registrado con éxito en ${tBusiness}.</p>
                    </div>

                    <div class="p-4 bg-neutral-50 rounded-2xl border border-neutral-100 text-left space-y-1">
                        <span class="text-[10px] text-neutral-400 font-mono uppercase block">Detalles</span>
                        <span class="text-xs font-bold text-black block truncate">${itemsDesc}</span>
                        <span class="text-sm font-extrabold text-black block mt-1">${totalVal.toFixed(2)} €</span>
                    </div>

                    ${waUrl ? `
                        <a href="${waUrl}" target="_blank" class="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-2xl text-xs shadow-md flex items-center justify-center space-x-2 active:scale-95 transition">
                            <i data-lucide="message-circle" class="w-4 h-4"></i>
                            <span>Abrir WhatsApp</span>
                        </a>
                    ` : '<p class="text-[10px] text-neutral-400">Este comercio no tiene WhatsApp asociado.</p>'}

                    <button onclick="window.finishPaymentFlow()" class="w-full py-3 bg-black text-white font-semibold rounded-2xl text-xs active:scale-95 transition">
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

        // 5. REDIRECCIÓN AUTOMÁTICA A WHATSAPP
        if (waUrl) {
            setTimeout(() => {
                window.location.href = waUrl;
            }, 1200);
        }

    } catch (criticalError) {
        console.error("Fallo crítico en la confirmación:", criticalError);
        alert("Ocurrió un error. Comprueba tu conexión.");
    }
};

window.finishPaymentFlow = function() {
    const modal = document.getElementById('customModal');
    const modalContent = document.getElementById('modalContent');
    
    if (modal) {
        modal.classList.add('opacity-0');
        if (modalContent) modalContent.classList.add('scale-95');
        setTimeout(() => modal.classList.add('hidden'), 300);
    }

    // Resetear todo al estado de fábrica
    window.rawAmountString = "000";
    if (window.appState) {
        window.appState.cartItemsList = [];
        window.appState.cartTotalValue = 0;
        window.appState.cartItemCount = 0;
        window.appState.isCartCheckout = false;
        window.appState.pendingOrderDetails = null;
    }

    const progressBar = document.getElementById('progressBar');
    if (progressBar) progressBar.style.width = '0%';

    if (typeof updateCartDisplay === 'function') updateCartDisplay();
    window.updateAmountDisplay();

    if (typeof switchTab === 'function') switchTab('home');
};