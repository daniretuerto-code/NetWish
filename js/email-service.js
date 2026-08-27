// js/email-service.js

window.emailService = {
    apiUrl: '/api/send-email',

    sendClientReceipt: async function(clientEmail, orderData) {
        if (!clientEmail) return;

        const isReservationRequest = orderData.action === 'solicitud_reserva';
        const isReservationConfirmed = orderData.action === 'confirmacion_reserva';
        const isReservation = isReservationRequest || isReservationConfirmed;

        let headerTag = 'JUSTIFICANTE DE COMPRA & DESCARGA';
        let headerTitle = orderData.businessName || 'NetWish';
        let headerDesc = `Fecha: ${orderData.date} • ${orderData.time}`;
        let emailSubject = `Justificante de pedido — ${orderData.businessName || 'NetWish'}`;

        if (isReservationRequest) {
            headerTag = 'SOLICITUD DE RESERVA RECIBIDA';
            headerTitle = `Reserva en ${orderData.businessName}`;
            headerDesc = `Hemos recibido tu solicitud de mesa. El establecimiento la revisará y te confirmaremos en cuanto sea aprobada.`;
            emailSubject = `Solicitud de reserva recibida — ${orderData.businessName}`;
        } else if (isReservationConfirmed) {
            headerTag = '¡RESERVA CONFIRMADA!';
            headerTitle = `Mesa Confirmada — ${orderData.businessName}`;
            headerDesc = `Tu reserva ha sido aprobada por el establecimiento. ¡Te esperan el ${orderData.date} a las ${orderData.time}!`;
            emailSubject = `¡Reserva Confirmada! — ${orderData.businessName}`;
        }

        let downloadSectionHtml = '';
        let itemsContentHtml = '';

        if (isReservation) {
            // Diseño limpio para reservas: sin importes ni 0,00 €
            const detailText = (orderData.items && orderData.items[0]) ? (orderData.items[0].name || orderData.items[0]) : 'Reserva de Mesa';
            itemsContentHtml = `
                <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #fafafa; border-radius: 16px; padding: 16px; border: 1px solid #f0f0f0; margin-bottom: 20px;">
                    <tr>
                        <td style="font-size: 11px; font-family: monospace; text-transform: uppercase; color: #888888; font-weight: bold; padding-bottom: 6px;">Detalle de la Reserva</td>
                    </tr>
                    <tr>
                        <td style="font-size: 14px; font-weight: 800; color: #000000;">${detailText}</td>
                    </tr>
                    <tr>
                        <td style="font-size: 12px; color: #555555; padding-top: 6px;"><strong>Fecha y Hora:</strong> ${orderData.date} a las ${orderData.time}</td>
                    </tr>
                </table>
            `;
        } else {
            // Diseño estándar para compras de catálogo, productos y beats
            const totalFormatted = Number(orderData.total || 0).toLocaleString('es-ES', { 
                minimumFractionDigits: 2, 
                maximumFractionDigits: 2 
            });

            const rows = (orderData.items || []).map(i => {
                const itemTotal = (Number(i.price || 0) * Number(i.qty || 1)).toLocaleString('es-ES', { 
                    minimumFractionDigits: 2, 
                    maximumFractionDigits: 2 
                });

                // Enlace de descarga master prioritario o fallback a audio preview
                const downloadLink = i.full_audio_url || i.download_url || (orderData.businessName && orderData.businessName.toUpperCase().includes('JUUANCP') ? i.audio_url : null);

                if (downloadLink) {
                    const safeFileName = (i.name || 'beat-master').replace(/[^a-zA-Z0-9]/g, '_') + '.mp3';
                    const proxyDownloadUrl = `https://netwish.es/api/download?url=${encodeURIComponent(downloadLink)}&filename=${encodeURIComponent(safeFileName)}`;

                    downloadSectionHtml += `
                        <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-top: 16px; background-color: #000000; border-radius: 16px; padding: 18px; text-align: center;">
                            <tr>
                                <td>
                                    <p style="font-size: 10px; font-family: monospace; text-transform: uppercase; letter-spacing: 0.15em; color: #a3a3a3; margin: 0 0 10px 0;">Archivo Master / Beat Exclusivo</p>
                                    <a href="${proxyDownloadUrl}" target="_blank" style="display: inline-block; background-color: #ffffff; color: #000000; padding: 12px 24px; border-radius: 12px; font-size: 12px; font-weight: 800; text-decoration: none;">Descargar Beat Automáticamente</a>
                                </td>
                            </tr>
                        </table>
                    `;
                }

                return `
                    <tr>
                        <td style="padding: 8px 0; font-size: 13px; color: #111111; border-bottom: 1px solid #f0f0f0;">
                            ${i.qty ? `${i.qty}x ` : ''}${i.name}
                        </td>
                        <td style="padding: 8px 0; font-size: 13px; font-weight: 700; font-family: monospace; text-align: right; color: #111111; border-bottom: 1px solid #f0f0f0;">
                            ${itemTotal} €
                        </td>
                    </tr>
                `;
            }).join('');

            itemsContentHtml = `
                <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-bottom: 24px;">
                    ${rows}
                </table>

                <table width="100%" border="0" cellspacing="0" cellpadding="0" style="border-top: 2px solid #000000; padding-top: 16px; margin-bottom: 20px;">
                    <tr>
                        <td style="font-size: 15px; font-weight: 800; color: #000000;">Total Pagado</td>
                        <td align="right" style="font-size: 18px; font-weight: 900; font-family: monospace; color: #000000;">${totalFormatted} €</td>
                    </tr>
                </table>
            `;
        }

        const payload = {
            to: clientEmail,
            subject: emailSubject,
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
                                            <span style="font-size: 9px; font-family: monospace; text-transform: uppercase; letter-spacing: 0.15em; color: #888888;">${headerTag}</span>
                                            <h2 style="font-size: 18px; font-weight: 800; color: #000000; margin: 6px 0 2px 0;">${headerTitle}</h2>
                                            <p style="font-size: 12px; color: #666666; margin: 0;">${headerDesc}</p>
                                        </div>

                                        ${itemsContentHtml}
                                        ${downloadSectionHtml}

                                        <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #fafafa; border-radius: 16px; padding: 14px; text-align: center; border: 1px solid #eeeeee; margin-top: 20px;">
                                            <tr>
                                                <td style="font-size: 11px; color: #777777;">Guarda este correo para consultar los detalles en cualquier momento.</td>
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

        const isResv = orderData.action === 'nueva_solicitud_reserva' || 
                       orderData.action === 'solicitud_reserva' || 
                       (orderData.items && orderData.items.some && orderData.items.some(i => (i.name || '').toLowerCase().includes('reserva')));
        const isMusic = (orderData.businessName || '').toUpperCase().includes('JUUANCP');

        let subject = `⚡ Nuevo Pedido Recibido — ${orderData.clientName || 'Cliente'}`;
        let tag = 'NUEVO PEDIDO NETWISH';

        if (isResv) {
            subject = `⚡ Nueva Solicitud de Reserva — ${orderData.clientName || 'Cliente'}`;
            tag = 'SOLICITUD DE RESERVA DE MESA';
        } else if (isMusic) {
            subject = `⚡ Nueva Venta de Beat — ${orderData.clientName || 'Cliente'}`;
            tag = 'NUEVA VENTA DE LICENCIA';
        }

        const itemsTable = (orderData.items || []).map(i => {
            const itemTotal = (Number(i.price || 0) * Number(i.qty || 1)).toLocaleString('es-ES', { 
                minimumFractionDigits: 2, 
                maximumFractionDigits: 2 
            });
            return `
                <tr>
                    <td style="padding: 6px 0; font-size: 12px; color: #222222; border-bottom: 1px solid #f2f2f2;">
                        • ${i.qty ? `${i.qty} uds — ` : ''}${i.name}
                    </td>
                    ${!isResv ? `
                        <td style="padding: 6px 0; font-size: 12px; font-weight: 700; font-family: monospace; text-align: right; color: #222222; border-bottom: 1px solid #f2f2f2;">
                            ${itemTotal} €
                        </td>
                    ` : ''}
                </tr>
            `;
        }).join('');

        const totalFormatted = Number(orderData.total || 0).toLocaleString('es-ES', { 
            minimumFractionDigits: 2, 
            maximumFractionDigits: 2 
        });

        const alertHtml = `
            <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f5f5f5; padding: 24px 0;">
                <tr>
                    <td align="center">
                        <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 440px; background-color: #ffffff; border-radius: 24px; padding: 32px 24px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
                            <tr>
                                <td>
                                    <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #000000; border-radius: 18px; padding: 20px; margin-bottom: 24px;">
                                        <tr>
                                            <td>
                                                <span style="font-size: 9px; font-family: monospace; text-transform: uppercase; letter-spacing: 0.15em; color: #a3a3a3;">${tag}</span>
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

                                    ${!isResv ? `
                                        <table width="100%" border="0" cellspacing="0" cellpadding="0" style="border-top: 2px solid #000000; padding-top: 16px;">
                                            <tr>
                                                <td style="font-size: 15px; font-weight: 800; color: #000000;">Total</td>
                                                <td align="right" style="font-size: 18px; font-weight: 900; font-family: monospace; color: #000000;">${totalFormatted} €</td>
                                            </tr>
                                        </table>
                                    ` : ''}
                                </td>
                            </tr>
                        </table>
                    </td>
                </tr>
            </table>
        `;

        const payload = {
            to: bizEmail,
            subject: subject,
            html: alertHtml
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