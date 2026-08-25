// js/email-service.js

window.emailService = {
    apiUrl: '/api/send-email',

    // Correo 1: Recibo oficial para el Cliente
    sendClientReceipt: async function(clientEmail, orderData) {
        if (!clientEmail) {
            console.warn("No hay email de cliente para enviar recibo");
            return;
        }

        const itemsList = (orderData.items || []).map(i => `
            <div style="display:flex; justify-content:space-between; font-size:13px; padding:8px 0; border-bottom:1px solid #fafafa;">
                <span style="color:#171717;">${i.qty}x ${i.name}</span>
                <span style="font-family:monospace; font-weight:700;">${(Number(i.price) * Number(i.qty)).toFixed(2)} €</span>
            </div>
        `).join('');

        const payload = {
            to: clientEmail,
            subject: `Justificante de pedido — ${orderData.businessName || 'NetWish'}`,
            html: `
                <div style="font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width:460px; margin:0 auto; padding:32px 24px; color:#0a0a0a; background:#ffffff; border:1px solid #f0f0f0; border-radius:24px;">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:24px;">
                        <h1 style="font-size:24px; font-weight:800; letter-spacing:-0.05em; font-style:italic; margin:0;">NetWish</h1>
                        <span style="font-size:9px; font-family:monospace; text-transform:uppercase; letter-spacing:0.15em; background:#f5f5f5; padding:4px 8px; border-radius:9999px;">PALENCIA</span>
                    </div>
                    
                    <div style="border-bottom:1px solid #f0f0f0; padding-bottom:16px; margin-bottom:20px;">
                        <span style="font-size:9px; font-family:monospace; text-transform:uppercase; letter-spacing:0.15em; color:#737373;">JUSTIFICANTE DE COMPRA</span>
                        <h2 style="font-size:18px; font-weight:700; margin:6px 0 2px 0;">${orderData.businessName}</h2>
                        <p style="font-size:12px; color:#737373; margin:0;">Fecha: ${orderData.date} • ${orderData.time}</p>
                    </div>

                    <div style="margin-bottom:20px;">
                        ${itemsList}
                    </div>

                    <div style="display:flex; justify-content:space-between; align-items:center; padding:16px 0; border-top:2px solid #0a0a0a; font-size:15px; font-weight:800;">
                        <span>Total Pagado</span>
                        <span style="font-family:monospace;">${Number(orderData.total).toFixed(2)} €</span>
                    </div>

                    <div style="margin-top:28px; padding:14px; background:#f9f9f9; border-radius:16px; text-align:center;">
                        <p style="font-size:11px; color:#737373; margin:0;">Muestra este justificante digital al acudir al establecimiento.</p>
                    </div>
                </div>
            `
        };

        return this.triggerSend(payload);
    },

    // Correo 2: Alerta inmediata de venta para el Negocio
    sendBusinessAlert: async function(bizEmail, orderData) {
        if (!bizEmail) {
            console.warn("No hay email de negocio definido, usando contacto general");
            bizEmail = 'contacto@netwish.es';
        }

        const itemsList = (orderData.items || []).map(i => `
            <p style="font-size:12px; margin:4px 0; color:#333;">• ${i.qty} uds — ${i.name} (${(Number(i.price) * Number(i.qty)).toFixed(2)} €)</p>
        `).join('');

        const payload = {
            to: bizEmail,
            subject: `⚡ Nuevo Pedido Recibido — ${orderData.clientName || 'Cliente'}`,
            html: `
                <div style="font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width:460px; margin:0 auto; padding:32px 24px; color:#0a0a0a; background:#ffffff; border:1px solid #f0f0f0; border-radius:24px;">
                    <div style="background:#0a0a0a; color:#ffffff; padding:18px; border-radius:18px; margin-bottom:20px;">
                        <span style="font-size:9px; font-family:monospace; text-transform:uppercase; letter-spacing:0.15em; color:#a3a3a3;">NUEVO PEDIDO CONFIRMADO</span>
                        <h2 style="font-size:18px; font-weight:700; margin:4px 0 0 0;">${orderData.clientName || 'Cliente'}</h2>
                    </div>

                    <p style="font-size:12px; margin:0 0 6px 0;"><strong>Fecha y Hora:</strong> ${orderData.date} • ${orderData.time}</p>
                    <p style="font-size:12px; margin:0 0 16px 0;"><strong>Estado de Pago:</strong> ${orderData.action === 'pay' ? 'Pagado vía NetWish' : 'Pendiente de pago en local'}</p>

                    <div style="border-top:1px solid #f0f0f0; border-bottom:1px solid #f0f0f0; padding:12px 0; margin-bottom:16px;">
                        ${itemsList}
                    </div>

                    <div style="display:flex; justify-content:space-between; align-items:center; font-size:15px; font-weight:800;">
                        <span>Total Pedido:</span>
                        <span style="font-family:monospace;">${Number(orderData.total).toFixed(2)} €</span>
                    </div>
                </div>
            `
        };

        return this.triggerSend(payload);
    },

    triggerSend: async function(payload) {
        try {
            const res = await fetch(this.apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const data = await res.json();
            return data;
        } catch (err) {
            console.error("Error disparando petición de email:", err);
            return { error: err.message };
        }
    }
};