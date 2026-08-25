// js/email-service.js

window.emailService = {
    apiUrl: '/api/send-email',

    // 1. Justificante digital para el cliente
    sendClientReceipt: async function(clientEmail, orderData) {
        if (!clientEmail) return;

        const payload = {
            to: clientEmail,
            subject: `Justificante de pedido — ${orderData.businessName || 'Comercio Palencia'}`,
            html: `
                <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 460px; margin: 0 auto; padding: 32px 24px; color: #0a0a0a; background: #ffffff; border: 1px solid #f0f0f0; border-radius: 24px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px;">
                        <h1 style="font-size: 24px; font-weight: 800; letter-spacing: -0.05em; font-style: italic; margin: 0;">NetWish</h1>
                        <span style="font-size: 9px; font-family: monospace; text-transform: uppercase; letter-spacing: 0.15em; background: #f5f5f5; padding: 4px 8px; border-radius: 9999px;">PALENCIA</span>
                    </div>
                    
                    <div style="border-bottom: 1px solid #f0f0f0; padding-bottom: 16px; margin-bottom: 20px;">
                        <span style="font-size: 9px; font-family: monospace; text-transform: uppercase; letter-spacing: 0.15em; color: #737373;">DETALLES DEL PEDIDO</span>
                        <h2 style="font-size: 18px; font-weight: 700; margin: 6px 0 2px 0;">${orderData.businessName}</h2>
                        <p style="font-size: 12px; color: #737373; margin: 0;">Fecha: ${orderData.date} • ${orderData.time}</p>
                    </div>

                    <div style="margin-bottom: 20px;">
                        ${(orderData.items || []).map(i => `
                            <div style="display: flex; justify-content: space-between; font-size: 13px; padding: 8px 0; border-bottom: 1px solid #fafafa;">
                                <span style="color: #171717;">${i.qty}x ${i.name}</span>
                                <span style="font-family: monospace; font-weight: 700;">${(i.price * i.qty).toFixed(2)} €</span>
                            </div>
                        `).join('')}
                    </div>

                    <div style="display: flex; justify-content: space-between; align-items: center; padding: 16px 0; border-top: 2px solid #0a0a0a; font-size: 15px; font-weight: 800;">
                        <span>Total</span>
                        <span style="font-family: monospace;">${Number(orderData.total).toFixed(2)} €</span>
                    </div>

                    <div style="margin-top: 28px; padding: 14px; background: #f9f9f9; border-radius: 16px; text-align: center;">
                        <p style="font-size: 11px; color: #737373; margin: 0;">Muestra este justificante al recoger o acudir al local.</p>
                    </div>
                </div>
            `
        };

        return this.triggerSend(payload);
    },

    // 2. Alerta para el comercio
    sendBusinessAlert: async function(bizEmail, orderData) {
        if (!bizEmail) return;

        const payload = {
            to: bizEmail,
            subject: `⚡ Nuevo Pedido Recibido — ${orderData.clientName || 'Cliente NetWish'}`,
            html: `
                <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 460px; margin: 0 auto; padding: 32px 24px; color: #0a0a0a; background: #ffffff; border: 1px solid #f0f0f0; border-radius: 24px;">
                    <div style="background: #0a0a0a; color: #ffffff; padding: 18px; border-radius: 18px; margin-bottom: 20px;">
                        <span style="font-size: 9px; font-family: monospace; text-transform: uppercase; letter-spacing: 0.15em; color: #a3a3a3;">NUEVO PEDIDO / CITA</span>
                        <h2 style="font-size: 18px; font-weight: 700; margin: 4px 0 0 0;">${orderData.clientName || 'Cliente'}</h2>
                    </div>

                    <p style="font-size: 12px; margin: 0 0 6px 0;"><strong>Fecha y Hora:</strong> ${orderData.date} • ${orderData.time}</p>
                    <p style="font-size: 12px; margin: 0 0 16px 0;"><strong>Modalidad:</strong> ${orderData.action === 'pay' ? 'Pagado vía NetWish' : 'Pago en Local'}</p>

                    <div style="border-top: 1px solid #f0f0f0; border-bottom: 1px solid #f0f0f0; padding: 12px 0; margin-bottom: 16px;">
                        ${(orderData.items || []).map(i => `
                            <p style="font-size: 12px; margin: 4px 0; color: #333;">• ${i.qty} uds — ${i.name} (${(i.price * i.qty).toFixed(2)} €)</p>
                        `).join('')}
                    </div>

                    <div style="display: flex; justify-content: space-between; align-items: center; font-size: 15px; font-weight: 800;">
                        <span>Total Pedido:</span>
                        <span style="font-family: monospace;">${Number(orderData.total).toFixed(2)} €</span>
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
            return await res.json();
        } catch (err) {
            console.error("Error al disparar email:", err);
            return { error: err.message };
        }
    }
};