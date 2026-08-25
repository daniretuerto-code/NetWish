// js/scanner.js

let currentStream = null;
let scanningInterval = null;

// =======================================================
// 1. GENERACIÓN DE CÓDIGO QR PERSONAL
// =======================================================
async function openPersonalQR() {
    if (!currentUser) { 
        if (typeof openAuthModal === 'function') openAuthModal('login'); 
        return; 
    }

    const modal = document.getElementById('customModal');
    const modalContent = document.getElementById('modalContent');
    const modalBody = document.getElementById('modalBody');
    const meta = currentUser.user_metadata || {};

    modalBody.innerHTML = `
        <div class="space-y-4 text-center">
            <h3 class="text-lg font-bold text-black">Tu Código QR Personal</h3>
            <p class="text-xs text-neutral-500">Muestra este código para recibir pagos de amigos en Palencia.</p>
            <div id="realQRCodeContainer" class="w-52 h-52 bg-white border-2 border-neutral-200 rounded-3xl mx-auto flex items-center justify-center p-3 relative shadow-sm"></div>
            <div class="p-3 bg-neutral-50 rounded-2xl border border-neutral-200/60">
                <span class="block text-xs font-bold text-black">${meta.name || ''} ${meta.surname || ''}</span>
                <span class="block text-[10px] text-neutral-400 font-mono">ID: NW-${meta.initials || 'USER'}-${currentUser.id ? currentUser.id.substring(0,6) : 'PAL'}</span>
            </div>
            <button onclick="closeModal()" class="w-full py-3.5 bg-black text-white font-semibold rounded-2xl text-xs transition active:scale-95 shadow-md">Cerrar</button>
        </div>
    `;
    
    if (typeof lucide !== 'undefined') lucide.createIcons();
    
    modal.classList.remove('hidden');
    setTimeout(() => { 
        modal.classList.remove('opacity-0'); 
        if (modalContent) modalContent.classList.remove('scale-95'); 
    }, 10);

    const qrContainer = document.getElementById('realQRCodeContainer');
    if (qrContainer && typeof QRCode !== 'undefined') {
        qrContainer.innerHTML = "";
        new QRCode(qrContainer, {
            text: `NETWISH_PAY:${meta.name || 'Usuario'}:${currentUser.email}`,
            width: 180, 
            height: 180, 
            colorDark: "#000000", 
            colorLight: "#ffffff", 
            correctLevel: QRCode.CorrectLevel.H
        });
    }
}

// =======================================================
// 2. QR DE NEGOCIO EN MODAL
// =======================================================
function openBusinessQR() {
    if (!currentBusiness) return;
    
    const modal = document.getElementById('customModal');
    const modalContent = document.getElementById('modalContent');
    const modalBody = document.getElementById('modalBody');

    modalBody.innerHTML = `
        <div class="space-y-4 text-center">
            <h3 class="text-lg font-bold text-black">QR de Cobro Comercial</h3>
            <p class="text-xs text-neutral-500">Muestra este código a tus clientes para recibir pagos al instante en <strong class="text-black">${currentBusiness.name}</strong>.</p>
            <div id="businessQRCodeContainer" class="w-52 h-52 bg-white border-2 border-neutral-200 rounded-3xl mx-auto flex items-center justify-center p-3 relative shadow-sm"></div>
            <div class="p-3 bg-neutral-50 rounded-2xl border border-neutral-200/60">
                <span class="block text-xs font-bold text-black">${currentBusiness.name}</span>
                <span class="block text-[10px] text-neutral-400 font-mono uppercase tracking-widest mt-0.5">${currentBusiness.category || 'Negocio'}</span>
            </div>
            <button onclick="closeModal()" class="w-full py-3.5 bg-black text-white font-semibold rounded-2xl text-xs transition active:scale-95 shadow-md">Ocultar QR</button>
        </div>
    `;
    
    if (typeof lucide !== 'undefined') lucide.createIcons();
    
    modal.classList.remove('hidden');
    setTimeout(() => { 
        modal.classList.remove('opacity-0'); 
        if (modalContent) modalContent.classList.remove('scale-95'); 
    }, 10);

    generateBusinessQR(currentBusiness);
}

function generateBusinessQR(biz) {
    const container = document.getElementById('businessQRCodeContainer');
    if (!container) return;
    container.innerHTML = "";
    try {
        const safeName = biz.name ? biz.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "") : "Comercio";
        new QRCode(container, {
            text: `NETWISH_BUSINESS:${safeName}:${biz.id || biz.name}`,
            width: 180, 
            height: 180, 
            colorDark: "#000000", 
            colorLight: "#ffffff", 
            correctLevel: QRCode.CorrectLevel.H
        });
    } catch (qrErr) {
        console.error("Error al generar el código QR visual:", qrErr);
    }
}

// =======================================================
// 3. MODAL GENÉRICO / PLACEHOLDER
// =======================================================
function openModal(sectionName) {
    stopCamera();
    const modal = document.getElementById('customModal');
    const modalContent = document.getElementById('modalContent');
    const modalBody = document.getElementById('modalBody');

    modalBody.innerHTML = `
        <div class="space-y-4 text-center py-6">
            <div class="w-14 h-14 rounded-2xl bg-neutral-100 flex items-center justify-center mx-auto text-black">
                <i data-lucide="clock" class="w-7 h-7"></i>
            </div>
            <div class="space-y-1">
                <h3 class="text-lg font-bold text-black">${sectionName} — Próximamente</h3>
                <p class="text-xs text-neutral-500">Este módulo avanzado de NetWish estará disponible muy pronto.</p>
            </div>
            <button onclick="closeModal()" class="w-full py-3.5 bg-black text-white font-semibold rounded-2xl text-xs transition active:scale-95 shadow-md">Entendido</button>
        </div>
    `;
    
    if (typeof lucide !== 'undefined') lucide.createIcons();
    
    modal.classList.remove('hidden');
    setTimeout(() => { 
        modal.classList.remove('opacity-0'); 
        if (modalContent) modalContent.classList.remove('scale-95'); 
    }, 10);
}

// =======================================================
// 4. LECTOR DE CÁMARA QR
// =======================================================
async function startCameraModal() {
    const modal = document.getElementById('customModal');
    const modalContent = document.getElementById('modalContent');
    const modalBody = document.getElementById('modalBody');

    modalBody.innerHTML = `
        <div class="space-y-4 text-center">
            <h3 class="text-lg font-bold text-black">Escaneando Código QR</h3>
            <div class="w-full h-72 bg-black rounded-3xl overflow-hidden relative flex items-center justify-center shadow-inner">
                <video id="cameraPreview" autoplay playsinline muted class="w-full h-full object-cover"></video>
                <canvas id="qrCanvas" class="hidden"></canvas>
                <div class="absolute inset-0 border-2 border-white/30 m-5 rounded-2xl pointer-events-none flex items-center justify-center">
                    <div class="w-32 h-32 border-2 border-white rounded-2xl animate-pulse"></div>
                </div>
            </div>
            <p class="text-xs text-neutral-400">Apunta al QR personal, QR de comercio o QR de mesa.</p>
            <button onclick="closeModal()" class="w-full py-3.5 bg-neutral-100 text-black font-semibold rounded-2xl text-xs transition active:scale-95">Cerrar Cámara</button>
        </div>
    `;
    
    if (typeof lucide !== 'undefined') lucide.createIcons();
    
    modal.classList.remove('hidden');
    setTimeout(() => { 
        modal.classList.remove('opacity-0'); 
        if (modalContent) modalContent.classList.remove('scale-95'); 
    }, 10);

    try {
        currentStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        const videoElement = document.getElementById('cameraPreview');
        if (videoElement) { 
            videoElement.srcObject = currentStream; 
            videoElement.play(); 
            startUniversalScanningLoop(); 
        }
    } catch (error) {
        alert("No se pudo acceder a la cámara o permisos denegados.");
        closeModal();
    }
}

function startUniversalScanningLoop() {
    const video = document.getElementById('cameraPreview');
    const canvas = document.getElementById('qrCanvas');
    if (!video || !canvas) return;
    const context = canvas.getContext('2d');

    scanningInterval = setInterval(() => {
        if (video.readyState === video.HAVE_ENOUGH_DATA) {
            canvas.height = video.videoHeight;
            canvas.width = video.videoWidth;
            context.drawImage(video, 0, 0, canvas.width, canvas.height);
            const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
            const code = jsQR(imageData.data, imageData.width, imageData.height, { inversionAttempts: "dontInvert" });

            if (code) {
                clearInterval(scanningInterval);
                stopCamera();
                closeModal();
                processScannedQRData(code.data);
            }
        }
    }, 250);
}

// =======================================================
// 5. PROCESAMIENTO INTELIGENTE DEL CÓDIGO QR
// =======================================================
function processScannedQRData(qrText) {
    // Caso 1: QR de Mesa mediante URL (ej: https://netwish.es/?biz=Restaurante%20Dani&table=3)
    if (qrText.includes('biz=') && qrText.includes('table=')) {
        try {
            const url = new URL(qrText.startsWith('http') ? qrText : `https://${qrText}`);
            const bizName = decodeURIComponent(url.searchParams.get('biz') || '');
            const tableNum = parseInt(url.searchParams.get('table') || '1', 10);

            if (bizName && tableNum) {
                window.appState = window.appState || {};
                window.appState.activeBusinessName = bizName;
                window.appState.activeTableNumber = tableNum;

                if (typeof window.openTableSessionView === 'function') {
                    window.openTableSessionView(bizName, tableNum);
                }
                return;
            }
        } catch (e) {
            console.warn("Error analizando URL de mesa:", e);
        }
    }

    // Caso 2: Formato de protocolo directo para mesas (NETWISH_TABLE:Restaurante Dani:3)
    if (qrText.startsWith('NETWISH_TABLE:')) {
        const parts = qrText.split(':');
        const bizName = parts[1] || 'Restaurante';
        const tableNum = parseInt(parts[2] || '1', 10);

        window.appState = window.appState || {};
        window.appState.activeBusinessName = bizName;
        window.appState.activeTableNumber = tableNum;

        if (typeof window.openTableSessionView === 'function') {
            window.openTableSessionView(bizName, tableNum);
        }
        return;
    }

    // Caso 3: QR de Pago Personal o Comercial
    if (qrText.startsWith('NETWISH_PAY:') || qrText.startsWith('NETWISH_BUSINESS:')) {
        const parts = qrText.split(':');
        activePayee = parts[1] || 'Establecimiento NetWish';
        rawAmountString = "000";
        if (typeof updateAmountDisplay === 'function') updateAmountDisplay();
        
        const payeeNameEl = document.getElementById('payeeNameDisplay');
        if (payeeNameEl) payeeNameEl.innerText = activePayee;
        
        const bubbleEl = document.getElementById('payeeInitialsBubble');
        if (bubbleEl) bubbleEl.innerText = activePayee.substring(0, 2).toUpperCase();
        
        if (typeof switchTab === 'function') switchTab('payment');
        return;
    }

    alert("Código QR no reconocido en NetWish.");
}

// =======================================================
// 6. DETENCIÓN DE CÁMARA Y CIERRE DE MODAL
// =======================================================
function stopCamera() {
    if (scanningInterval) { 
        clearInterval(scanningInterval); 
        scanningInterval = null; 
    }
    if (currentStream) { 
        currentStream.getTracks().forEach(track => track.stop()); 
        currentStream = null; 
    }
}

function closeModal() {
    stopCamera();
    const modal = document.getElementById('customModal');
    const modalContent = document.getElementById('modalContent');
    if (!modal) return;
    modal.classList.add('opacity-0');
    if (modalContent) modalContent.classList.add('scale-95');
    setTimeout(() => { modal.classList.add('hidden'); }, 300);
}