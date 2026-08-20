// --- BARRERA DE SEGURIDAD BIOMÉTRICA ---
async function openPersonalQR() {
    if (!currentUser) { openAuthModal('login'); return; }

    if (window.PublicKeyCredential) {
        try {
            const challenge = new Uint8Array(16);
            window.crypto.getRandomValues(challenge);
            const userId = new Uint8Array(16);
            window.crypto.getRandomValues(userId);

            await navigator.credentials.create({
                publicKey: {
                    challenge: challenge,
                    rp: { name: "NetWish Seguridad" },
                    user: { id: userId, name: currentUser?.email || "usuario", displayName: "Usuario NetWish" },
                    pubKeyCredParams: [{ type: "public-key", alg: -7 }],
                    authenticatorSelection: { userVerification: "required" },
                    timeout: 60000
                }
            });
        } catch (err) {
            console.warn("Verificación biométrica cancelada o fallida", err);
            const fallback = confirm("La validación biométrica ha fallado o fue cancelada. Como estamos en fase de pruebas, ¿quieres saltar la seguridad y ver el código?");
            if(!fallback) return; 
        }
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
                <span class="block text-[10px] text-neutral-400 font-mono">ID: NW-${meta.initials || 'USER'}-${currentUser.id.substring(0,6)}</span>
            </div>
            <button onclick="closeModal()" class="w-full py-3.5 bg-black text-white font-semibold rounded-2xl text-xs">Cerrar</button>
        </div>
    `;
    lucide.createIcons();
    modal.classList.remove('hidden');
    setTimeout(() => { modal.classList.remove('opacity-0'); modalContent.classList.remove('scale-95'); }, 10);

    const qrContainer = document.getElementById('realQRCodeContainer');
    qrContainer.innerHTML = "";
    new QRCode(qrContainer, {
        text: `NETWISH_PAY:${meta.name || 'Usuario'}:${currentUser.email}`,
        width: 180, height: 180, colorDark: "#000000", colorLight: "#ffffff", correctLevel: QRCode.CorrectLevel.H
    });
}

// --- NUEVA FUNCIÓN: QR DE NEGOCIO EN MODAL ---
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
            <button onclick="closeModal()" class="w-full py-3.5 bg-black text-white font-semibold rounded-2xl text-xs shadow-md">Ocultar QR</button>
        </div>
    `;
    lucide.createIcons();
    modal.classList.remove('hidden');
    setTimeout(() => { modal.classList.remove('opacity-0'); modalContent.classList.remove('scale-95'); }, 10);

    generateBusinessQR(currentBusiness);
}

function generateBusinessQR(biz) {
    const container = document.getElementById('businessQRCodeContainer');
    if (!container) return;
    container.innerHTML = "";
    try {
        const safeName = biz.name ? biz.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "") : "Comercio";
        new QRCode(container, {
            text: `NETWISH_BUSINESS:${safeName}:${biz.id}`,
            width: 180, height: 180, colorDark: "#000000", colorLight: "#ffffff", correctLevel: QRCode.CorrectLevel.H
        });
    } catch (qrErr) {
        console.error("Error técnico al generar el código QR visual:", qrErr);
    }
}

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
            <button onclick="closeModal()" class="w-full py-3.5 bg-black text-white font-semibold rounded-2xl text-xs">Entendido</button>
        </div>
    `;
    lucide.createIcons();
    modal.classList.remove('hidden');
    setTimeout(() => { modal.classList.remove('opacity-0'); modalContent.classList.remove('scale-95'); }, 10);
}

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
            <p class="text-xs text-neutral-400">Apunta al QR personal o QR de Comercio.</p>
            <button onclick="closeModal()" class="w-full py-3.5 bg-neutral-100 text-black font-semibold rounded-2xl text-xs">Cerrar Cámara</button>
        </div>
    `;
    lucide.createIcons();
    modal.classList.remove('hidden');
    setTimeout(() => { modal.classList.remove('opacity-0'); modalContent.classList.remove('scale-95'); }, 10);

    try {
        currentStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        const videoElement = document.getElementById('cameraPreview');
        if (videoElement) { 
            videoElement.srcObject = currentStream; 
            videoElement.play(); 
            startUniversalScanningLoop(); 
        }
    } catch (error) {
        alert("No se pudo acceder a la cámara.");
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

function processScannedQRData(qrText) {
    if (qrText.startsWith('NETWISH_PAY:') || qrText.startsWith('NETWISH_BUSINESS:')) {
        const parts = qrText.split(':');
        activePayee = parts[1] || 'Establecimiento NetWish';
        rawAmountString = "000";
        updateAmountDisplay();
        document.getElementById('payeeNameDisplay').innerText = activePayee;
        document.getElementById('payeeInitialsBubble').innerText = activePayee.substring(0, 2).toUpperCase();
        switchTab('payment');
    } else {
        alert("Código QR no reconocido en NetWish.");
    }
}

function stopCamera() {
    if (scanningInterval) { clearInterval(scanningInterval); scanningInterval = null; }
    if (currentStream) { currentStream.getTracks().forEach(track => track.stop()); currentStream = null; }
}

function closeModal() {
    stopCamera();
    const modal = document.getElementById('customModal');
    const modalContent = document.getElementById('modalContent');
    modal.classList.add('opacity-0');
    modalContent.classList.add('scale-95');
    setTimeout(() => { modal.classList.add('hidden'); }, 300);
}