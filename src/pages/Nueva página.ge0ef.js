import { enviarTemplateGenerico } from 'backend/whatsappLogic.web';
$w.onReady(function () {
  $w('#button1').onClick(async () => {
    const r = await enviarTemplateGenerico({
      telefono: '685505854',
      nombreCliente: 'Prueba',
      templateName: 'voucher_purchase_es',
      parameters: ['Jesus', 'BN-TEST-0001', 'Corte', '5', '03/09/2026', 'Corte'],
      eventType: 'prueba_wa',
      language: 'en'
    });
    console.log('WA:', r);
  });
});