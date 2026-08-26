// js/email-service.js

window.emailService = {
    apiUrl: '/api/send-email',

    sendClientReceipt: async function(clientEmail, orderData) {
        if (!clientEmail) return;

        const totalFormatted = Number(orderData.total || 0).toLocaleString('es-ES', { 
            minimumFractionDigits: 2, 
            maximumFractionDigits: 2 
        });

        let downloadSectionHtml = '';

        const itemsTable = (orderData.items || []).map(i => {
            const itemTotal = (Number(i.price || 0) * Number(i.qty || 1)).toLocaleString('es-ES', { 
                minimumFractionDigits: 2, 
                maximumFractionDigits: 2 
            });

            // Enlace de descarga master prioritario o fallback al audio preview si es de música
            const downloadLink = i.full_audio_url || i.download_url || (orderData.businessName && orderData.businessName.toUpperCase().includes('JUUANCP') ? i.audio_url : null);

            if (downloadLink) {
                downloadSectionHtml += `
                    <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-top: 16px; background-color: #000000; border-radius: 16px; padding: 18px; text-align: center;">
                        <tr>
                            <td>
                                <p style="font-size: 10px; font-family: monospace; text-transform: uppercase; letter-spacing: 0.15em; color: #a3a3a3; margin: 0 0 10px 0;">Archivo Master / Beat Exclusivo</p>
                                <a href="${downloadLink}" target="_blank" onclick="event.preventDefault(); const a = document.createElement('a'); a.href='${downloadLink}'; a.download='${i.name || 'beat-master'}.mp3'; document.body.appendChild(a); a.click(); document.body.removeChild(a);" style="display: inline-block; background-color: #ffffff; color: #000000; padding: 12px 24px; border-radius: 12px; font-size: 12px; font-weight: 800; text-decoration: none; cursor: pointer;">Descargar Beat en Alta Calidad</a>
                            </td>
                        </tr>
                    </table>
                `;
            }

            return `
                <tr>
                    <td style="padding: 8px 0; font-size: 13px; color: #111111; border-bottom: 1px solid #f0f0f0;">
                        ${i.qty}x ${i.name}
                    </td>
                    <td style="padding: 8px 0; font-size: 13px; font-weight: 700; font-family: monospace; text-align: right; color: #111111; border-bottom: 1px solid #f0f0f0;">
                        ${itemTotal} €
                    </td>
                </tr>
            `;
        }).join('');

        const payload = {
            to: clientEmail,
            subject: `Justificante de pedido y descarga — ${orderData.businessName || 'NetWish'}`,
            html: `
                <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f5f5f5; padding: 24px 0;">
                    <tr>
                        <td align="center">
                            <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 440px; background-color: #ffffff; border-radius: 24px; padding: 32px 24px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
                                <tr>
                                    <td>
                                        <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-bottom: 24px;">
                                            <tr>
                                                <td style="font-size: 22px; font-weight: 900; font-style: italic; letter-spacing: -0.05em; color: #000000;">NetWish</td>
                                                <td align="right">
                                                    <span style="font-size: 9px; font-family: monospace; text-transform: uppercase; letter-spacing: 0.15em; background: #000000; color: #ffffff; padding: 4px 10px; border-radius: 9999px;">PALENCIA</span>
                                                </td>
                                            </tr>
                                        </table>

                                        <div style="border-bottom: 1px solid #eeeeee; padding-bottom: 16px; margin-bottom: 20px;">
                                            <span style="font-size: 9px; font-family: monospace; text-transform: uppercase; letter-spacing: 0.15em; color: #888888;">JUSTIFICANTE DE COMPRA & DESCARGA</span>
                                            <h2 style="font-size: 18px; font-weight: 800; color: #000000; margin: 6px 0 2px 0;">${orderData.businessName}</h2>
                                            <p style="font-size: 12px; color: #666666; margin: 0;">Fecha: ${orderData.date} • ${orderData.time}</p>
                                        </div>

                                        <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-bottom: 24px;">
                                            ${itemsTable}
                                        </table>

                                        <table width="100%" border="0" cellspacing="0" cellpadding="0" style="border-top: 2px solid #000000; padding-top: 16px; margin-bottom: 20px;">
                                            <tr>
                                                <td style="font-size: 15px; font-weight: 800; color: #000000;">Total Pagado</td>
                                                <td align="right" style="font-size: 18px; font-weight: 900; font-family: monospace; color: #000000;">${totalFormatted} €</td>
                                            </tr>
                                        </table>

                                        ${downloadSectionHtml}

                                        <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #fafafa; border-radius: 16px; padding: 14px; text-align: center; border: 1px solid #eeeeee; margin-top: 20px;">
                                            <tr>
                                                <td style="font-size: 11px; color: #777777;">Guarda este correo para acceder a tus archivos en cualquier momento.</td>
                                            </tr>
                                        </table>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                </table>
            `
        };

        return this.triggerSend(payload);
    },

    sendBusinessAlert: async function(bizEmail, orderData) {
        if (!bizEmail) return;

        const totalFormatted = Number(orderData.total || 0).toLocaleString('es-ES', { 
            minimumFractionDigits: 2, 
            maximumFractionDigits: 2 
        });

        const itemsTable = (orderData.items || []).map(i => {
            const itemTotal = (Number(i.price || 0) * Number(i.qty || 1)).toLocaleString('es-ES', { 
                minimumFractionDigits: 2, 
                maximumFractionDigits: 2 
            });
            return `
                <tr>
                    <td style="padding: 6px 0; font-size: 12px; color: #222222; border-bottom: 1px solid #f2f2f2;">
                        • ${i.qty} uds — ${i.name}
                    </td>
                    <td style="padding: 6px 0; font-size: 12px; font-weight: 700; font-family: monospace; text-align: right; color: #222222; border-bottom: 1px solid #f2f2f2;">
                        ${itemTotal} €
                    </td>
                </tr>
            `;
        }).join('');

        const payload = {
            to: bizEmail,
            subject: `⚡ Nueva Licencia Vendida — ${orderData.clientName || 'Cliente'}`,
            html: `
                <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f5f5f5; padding: 24px 0;">
                    <tr>
                        <td align="center">
                            <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 440px; background-color: #ffffff; border-radius: 24px; padding: 32px 24px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
                                <tr>
                                    <td>
                                        <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #000000; border-radius: 18px; padding: 20px; margin-bottom: 24px;">
                                            <tr>
                                                <td>
                                                    <span style="font-size: 9px; font-family: monospace; text-transform: uppercase; letter-spacing: 0.15em; color: #a3a3a3;">NUEVA VENTA DE BEAT</span>
                                                    <h2 style="font-size: 18px; font-weight: 800; color: #ffffff; margin: 4px 0 0 0;">${orderData.clientName || 'Cliente'}</h2>
                                                </td>
                                            </tr>
                                        </table>

                                        <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-bottom: 18px;">
                                            <tr>
                                                <td style="font-size: 12px; color: #666666; padding-bottom: 6px;">
                                                    <strong style="color: #111111;">Fecha y Hora:</strong> ${orderData.date} • ${orderData.time}
                                                </td>
                                            </tr>
                                        </table>

                                        <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-bottom: 24px; border-top: 1px solid #eeeeee;">
                                            ${itemsTable}
                                        </table>

                                        <table width="100%" border="0" cellspacing="0" cellpadding="0" style="border-top: 2px solid #000000; padding-top: 16px;">
                                            <tr>
                                                <td style="font-size: 15px; font-weight: 800; color: #000000;">Total Venta</td>
                                                <td align="right" style="font-size: 18px; font-weight: 900; font-family: monospace; color: #000000;">${totalFormatted} €</td>
                                            </tr>
                                        </table>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                </table>
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
            console.error("Error disparando petición de email:", err);
            return { error: err.message };
        }
    }
};