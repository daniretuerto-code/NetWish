window.rawAmountString = "000";
let holdTimer = null;
let holdProgress = 0;
let isHolding = false;

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

// --- GESTOR TÁCTIL UNIVERSAL A PRUEBA DE FALLOS ---
function initHoldButton() {
    const btnContainer = document.getElementById('holdButtonContainer');
    if (!btnContainer) return;

    const startHold = (e) => {
        // No evitamos por defecto agresivamente para no bloquear scroll si el usuario falla el toque
        const val = parseInt(window.rawAmountString, 10) || 0;
        if (val <= 0) {
            alert("Introduce un importe o añade productos al carrito para continuar.");
            return;
        }

        isHolding = true;
        holdProgress = 0;
        const progressBar = document.getElementById('progressBar');

        clearInterval(holdTimer);
        holdTimer = setInterval(() => {
            if (!isHolding) return;
            holdProgress += 4; // Velocidad de llenado
            if (progressBar) progressBar.style.width = holdProgress + '%';

            if (holdProgress >= 100) {
                clearInterval(holdTimer);
                isHolding = false;
                if (progressBar) progressBar.style.width = '0%';
                executeFullPayment(false);
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

    // Combinación letal táctil + ratón
    btnContainer.addEventListener('touchstart', startHold, { passive: true });
    btnContainer.addEventListener('touchend', stopHold, { passive: true });
    btnContainer.addEventListener('touchcancel', stopHold, { passive: true });
    
    btnContainer.addEventListener('mousedown', startHold);
    window.addEventListener('mouseup', stopHold);
}

document.addEventListener('DOMContentLoaded', initHoldButton);

// --- EJECUCIÓN DEL PAGO Y ENVÍO DE WHATSAPP AL COMERCIO ---
async function executeFullPayment(isReservation = false) {
    const modal = document.getElementById('customModal');
    const modalContent = document.getElementById('modalContent');
    const modalBody = document.getElementById('modalBody');

    // Recuperar variables globales blindadas
    let totalVal = window.isCartCheckout ? window.cartTotalValue : (parseInt(window.rawAmountString, 10) / 100);
    
    let itemsDesc = window.isCartCheckout && window.cartItemsList.length > 0
        ? window.cartItemsList.map(i => `${i.qty}x ${i.name}`).join(', ') 
        : 'Pago Directo Terminal / Sin Detalle';
        
    let customerName = currentUser 
        ? (currentUser.user_metadata?.full_name || currentUser.user_metadata?.name || currentUser.email || 'Cliente') 
        : 'Cliente Anónimo';

    let orderDate = window.pendingOrderDetails?.date || new Date().toISOString().split('T')[0];
    let orderTime = window.pendingOrderDetails?.time || "Inmediato";
    let statusText = isReservation ? 'Pendiente (Pago en local)' : 'Pagado Online';
    let targetBusiness = window.activePayee || window.activeBusinessName || 'Comercio Desconocido';

    // 1. Guardar en Supabase
    try {
        const { error } = await supabaseClient
            .from('orders')
            .insert([{
                business_name: targetBusiness,
                customer: customerName,
                items: itemsDesc,
                total: totalVal,
                date: orderDate,
                time: orderTime,
                status: statusText
            }]);

        if (error) console.warn("Aviso al guardar en Supabase Orders:", error);
    } catch (err) {
        console.warn("Fallo inserción orden:", err);
    }

    // 2. Buscar el teléfono del negocio en la BD
    let bizPhone = null;
    try {
        const { data } = await supabaseClient
            .from('businesses')
            .select('phone, telefono')
            .ilike('name', `%${targetBusiness}%`)
            .maybeSingle();

        if (data) {
            bizPhone = data.phone || data.telefono;
        }
    } catch (e) {
        console.warn("Consulta teléfono comercio falló:", e);
    }

    // 3. Crear el Link de WhatsApp
    let waUrl = "";
    if (bizPhone) {
        let cleanPhone = bizPhone.replace(/\D/g, '');
        if (!cleanPhone.startsWith('34') && cleanPhone.length === 9) {
            cleanPhone = '34' + cleanPhone; // Forzar prefijo de España
        }

        const msgText = encodeURIComponent(
            `🚀 *Nuevo Pedido NetWish*\n\n` +
            `👤 *Cliente:* ${customerName}\n` +
            `📦 *Pedido:* ${itemsDesc}\n` +
            `💰 *Total:* ${totalVal.toFixed(2)} €\n` +
            `📅 *Recogida/Cita:* ${orderDate} a las ${orderTime}\n` +
            `📌 *Estado:* ${statusText}`
        );

        waUrl = `https://wa.me/${cleanPhone}?text=${msgText}`;
    }

    // 4. Mostrar confirmación en pantalla
    if (modalBody) {
        modalBody.innerHTML = `
            <div class="text-center space-y-4 py-3">
                <div class="w-16 h-16 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto shadow-inner">
                    <i data-lucide="check" class="w-8 h-8"></i>
                </div>
                <div>
                    <h3 class="text-lg font-bold text-black">${isReservation ? 'Reserva Confirmada' : 'Pago Completado'}</h3>
                    <p class="text-xs text-neutral-500 mt-1">Pedido registrado correctamente en ${targetBusiness}.</p>
                </div>

                <div class="p-4 bg-neutral-50 rounded-2xl border border-neutral-100 text-left space-y-1">
                    <span class="text-[10px] text-neutral-400 font-mono uppercase block">Detalle del Pedido</span>
                    <span class="text-xs font-bold text-black block truncate">${itemsDesc}</span>
                    <span class="text-sm font-extrabold text-black block mt-1">${totalVal.toFixed(2)} €</span>
                </div>

                ${waUrl ? `
                    <a href="${waUrl}" target="_blank" class="w-full py-3.5 bg-emerald-600 text-white font-bold rounded-2xl text-xs shadow-md flex items-center justify-center space-x-2 active:scale-95 transition">
                        <i data-lucide="message-circle" class="w-4 h-4"></i>
                        <span>Avisar por WhatsApp</span>
                    </a>
                ` : ''}

                <button onclick="finishPaymentFlow()" class="w-full py-3 bg-black text-white font-semibold rounded-2xl text-xs active:scale-95 transition">
                    Volver al Inicio
                </button>
            </div>
        `;
        lucide.createIcons();
    }

    if (modal) {
        modal.classList.remove('hidden');
        setTimeout(() => {
            modal.classList.remove('opacity-0');
            modalContent?.classList.remove('scale-95');
        }, 10);
    }
}

function finishPaymentFlow() {
    const modal = document.getElementById('customModal');
    const modalContent = document.getElementById('modalContent');
    
    if (modal) {
        modal.classList.add('opacity-0');
        modalContent?.classList.add('scale-95');
        setTimeout(() => modal.classList.add('hidden'), 300);
    }

    // Resetear todas las variables a su estado original
    window.rawAmountString = "000";
    window.cartItemsList = [];
    window.cartTotalValue = 0;
    window.cartItemCount = 0;
    window.isCartCheckout = false;
    window.pendingOrderDetails = null;

    const progressBar = document.getElementById('progressBar');
    if (progressBar) progressBar.style.width = '0%';

    switchTab('home');
}