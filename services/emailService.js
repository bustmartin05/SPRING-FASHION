/**
 * SERVICIO DE CORREOS ELECTRÓNICOS - SPRING FASHION 2026
 * Envío de comprobantes de compra, vouchers digitales y códigos QR vía Nodemailer
 */

const nodemailer = require('nodemailer');

function getTransporter() {
  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT || '587', 10);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const secure = process.env.SMTP_SECURE === 'true' || port === 465;

  if (!host || !user || !pass) {
    return null;
  }

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass }
  });
}

function buildTicketEmailHtml(data) {
  const {
    buyer_name,
    email,
    ticket_code,
    tier_name,
    quantity,
    total_paid,
    event_currency = 'ARS',
    event_title = 'SPRING FASHION 2026',
    event_date = '21 de Noviembre 2026 • 17:30 HS',
    event_location = 'Bodega Monteviejo, Valle de Uco, Mendoza',
    qr_code
  } = data;

  const qrPayload = qr_code || ticket_code;
  const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(qrPayload)}`;

  return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>¡Tus Entradas para ${event_title}!</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      background-color: #09090b;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      color: #f4f4f5;
    }
    .email-container {
      max-width: 600px;
      margin: 20px auto;
      background: #18181b;
      border: 1px solid #d97706;
      border-radius: 16px;
      overflow: hidden;
      box-shadow: 0 10px 30px rgba(0,0,0,0.5);
    }
    .email-header {
      background: linear-gradient(135deg, #18181b 0%, #27272a 100%);
      padding: 30px 20px;
      text-align: center;
      border-bottom: 2px solid #f59e0b;
    }
    .brand-title {
      font-size: 26px;
      font-weight: 800;
      letter-spacing: 2px;
      color: #f59e0b;
      margin: 0;
      text-transform: uppercase;
    }
    .brand-subtitle {
      font-size: 13px;
      color: #a1a1aa;
      margin-top: 5px;
      letter-spacing: 1px;
    }
    .email-body {
      padding: 30px 25px;
    }
    .welcome-text {
      font-size: 18px;
      margin-bottom: 10px;
      color: #ffffff;
    }
    .info-box {
      background: #27272a;
      border-radius: 12px;
      padding: 20px;
      margin: 20px 0;
      border-left: 4px solid #f59e0b;
    }
    .qr-card {
      background: #ffffff;
      border-radius: 12px;
      padding: 20px;
      text-align: center;
      margin: 25px auto;
      max-width: 280px;
      box-shadow: 0 4px 15px rgba(0,0,0,0.3);
    }
    .qr-card img {
      width: 200px;
      height: 200px;
      display: block;
      margin: 0 auto;
    }
    .ticket-code {
      font-family: 'Courier New', Courier, monospace;
      font-size: 18px;
      font-weight: bold;
      color: #18181b;
      margin-top: 12px;
      letter-spacing: 2px;
    }
    .instructions-card {
      background: #1e1e24;
      border: 1px dashed #3f3f46;
      border-radius: 8px;
      padding: 15px;
      font-size: 13px;
      color: #d4d4d8;
      line-height: 1.5;
      margin-top: 20px;
    }
    .email-footer {
      background: #09090b;
      padding: 20px;
      text-align: center;
      font-size: 12px;
      color: #71717a;
      border-top: 1px solid #27272a;
    }
  </style>
</head>
<body>
  <div class="email-container">
    <div class="email-header">
      <div class="brand-title">SPRING FASHION</div>
      <div class="brand-subtitle">EDICIÓN 2026 • EXPERIENCIA & DESFILE SUNSET</div>
    </div>

    <div class="email-body">
      <div class="welcome-text">¡Hola <strong>${buyer_name}</strong>! 🥂</div>
      <p style="color: #a1a1aa; font-size: 14px; line-height: 1.5; margin: 0 0 15px 0;">
        Tu pago ha sido procesado con éxito. Ya eres parte de la experiencia más exclusiva de moda, vino y música electrónica de la temporada.
      </p>

      <div class="info-box">
        <div style="font-weight: 700; color: #f59e0b; margin-bottom: 10px; font-size: 15px;">
          📍 DETALLES DEL EVENTO
        </div>
        <div style="margin-bottom: 6px; font-size: 14px;"><strong>Fecha:</strong> ${event_date}</div>
        <div style="margin-bottom: 6px; font-size: 14px;"><strong>Locación:</strong> ${event_location}</div>
        <div style="margin-bottom: 6px; font-size: 14px;"><strong>Dress Code:</strong> Sunset Chic & Elegante Vanguardista</div>
      </div>

      <div class="info-box">
        <div style="font-weight: 700; color: #f59e0b; margin-bottom: 10px; font-size: 15px;">
          🎟️ TU PASE
        </div>
        <div style="margin-bottom: 6px; font-size: 14px;"><strong>Tipo de Entrada:</strong> ${tier_name}</div>
        <div style="margin-bottom: 6px; font-size: 14px;"><strong>Cantidad:</strong> ${quantity} entrada(s)</div>
        <div style="margin-bottom: 6px; font-size: 14px;"><strong>Total Abonado:</strong> $${Number(total_paid).toLocaleString('es-AR')} ${event_currency}</div>
        <div style="margin-bottom: 6px; font-size: 14px;"><strong>Titular:</strong> ${buyer_name} (${email})</div>
      </div>

      <div class="qr-card">
        <img src="${qrImageUrl}" alt="Código QR Voucher">
        <div class="ticket-code">${ticket_code}</div>
        <div style="font-size: 11px; color: #71717a; margin-top: 4px;">Código de Acreditación Digital</div>
      </div>

      <div class="instructions-card">
        <strong>📋 Instrucciones de Ingreso:</strong><br>
        1. Presenta este correo electrónico con tu código QR desde tu smartphone en la recepción del evento.<br>
        2. Es requisito indispensable presentar tu DNI / Pasaporte para acreditar la titularidad de las entradas.<br>
        3. Te recomendamos llegar con 30 minutos de antelación para disfrutar de la recepción con copa de bienvenida.
      </div>
    </div>

    <div class="email-footer">
      <p style="margin: 0 0 6px 0;">© 2026 Spring Fashion Experience. Todos los derechos reservados.</p>
      <p style="margin: 0;">Producción Integral, Gastronomía de Bodega & Alta Costura.</p>
    </div>
  </div>
</body>
</html>
`;
}

async function sendTicketEmail(saleData) {
  try {
    const transporter = getTransporter();
    const fromAddress = process.env.EMAIL_FROM || '"Spring Fashion 2026" <entradas@springfashion.com>';
    const subject = `🎟️ ¡Tus Entradas para Spring Fashion 2026! [Código: ${saleData.ticket_code}]`;
    const html = buildTicketEmailHtml(saleData);

    if (!transporter) {
      console.log(`\n======================================================`);
      console.log(`📧 [EMAIL SERVICE - MODO SIMULADO / SMTP PENDIENTE]`);
      console.log(`Destinatario: ${saleData.buyer_name} <${saleData.email}>`);
      console.log(`Asunto: ${subject}`);
      console.log(`Ticket: ${saleData.ticket_code} | Pase: ${saleData.tier_name} (${saleData.quantity} entradas)`);
      console.log(`QR Link: https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(saleData.qr_code || saleData.ticket_code)}`);
      console.log(`💡 Para enviar correos reales, configura SMTP_HOST, SMTP_USER, SMTP_PASS en el archivo .env`);
      console.log(`======================================================\n`);
      return { success: true, simulated: true, message: 'Correo simulado (configura SMTP en .env para envíos reales).' };
    }

    const info = await transporter.sendMail({
      from: fromAddress,
      to: saleData.email,
      subject: subject,
      html: html
    });

    console.log(`✅ [Email Enviado con Éxito] Destinatario: ${saleData.email} | MessageID: ${info.messageId}`);
    return { success: true, messageId: info.messageId };
  } catch (err) {
    console.error('❌ [Error al enviar correo de ticket]:', err.message);
    return { success: false, error: err.message };
  }
}

module.exports = {
  sendTicketEmail,
  buildTicketEmailHtml
};
