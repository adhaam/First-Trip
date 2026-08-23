import type { SiteSettings } from '@/lib/types'

export interface InvoiceData {
  type: 'request' | 'confirmation'
  invoiceNumber: string
  customerName: string
  customerPhone: string
  customerEmail?: string
  orderDate: string
  items: Array<{
    description_ar: string
    description_en: string
    quantity: number
    unitPrice: number
  }>
  subtotal: number
  deliveryFee?: number
  depositAmount?: number
  totalAmount: number
  notes?: string
  locale: 'ar' | 'en'
  settings: SiteSettings | null
}

export function generateInvoiceHTML(data: InvoiceData): string {
  const isAr = data.locale === 'ar'
  const dir = isAr ? 'rtl' : 'ltr'
  const textAlign = isAr ? 'right' : 'left'

  const invoiceTypeLabel = data.type === 'request'
    ? (isAr ? 'فاتورة طلب' : 'Request Invoice')
    : (isAr ? 'فاتورة تأكيد' : 'Confirmation Invoice')

  const policyText = isAr
    ? `${data.settings?.terms_ar || 'شروط وأحكام الاستخدام'}`
    : `${data.settings?.terms_en || 'Terms and Conditions'}`

  const html = `
<!DOCTYPE html>
<html lang="${isAr ? 'ar' : 'en'}" dir="${dir}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${invoiceTypeLabel}</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      color: #1a1a1a;
      line-height: 1.6;
      background: #f5f5f5;
      padding: 20px;
    }
    .container {
      max-width: 900px;
      margin: 0 auto;
      background: white;
      padding: 40px;
      border-radius: 12px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 40px;
      border-bottom: 2px solid #f0a000;
      padding-bottom: 20px;
    }
    .logo-section h1 {
      font-size: 28px;
      color: #f0a000;
      margin-bottom: 8px;
      letter-spacing: 1px;
    }
    .logo-section p {
      color: #666;
      font-size: 14px;
    }
    .invoice-info {
      text-align: ${textAlign};
    }
    .invoice-type {
      display: inline-block;
      background: ${data.type === 'request' ? '#fee2e2' : '#dcfce7'};
      color: ${data.type === 'request' ? '#991b1b' : '#166534'};
      padding: 8px 16px;
      border-radius: 6px;
      font-weight: 600;
      margin-bottom: 12px;
    }
    .invoice-details {
      font-size: 14px;
      color: #666;
    }
    .invoice-details div {
      margin: 4px 0;
    }
    .invoice-number {
      font-weight: 600;
      color: #1a1a1a;
    }
    .customer-section {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 40px;
      margin-bottom: 40px;
    }
    .customer-section h3 {
      font-size: 12px;
      text-transform: uppercase;
      color: #999;
      margin-bottom: 12px;
      letter-spacing: 1px;
    }
    .customer-section p {
      font-size: 14px;
      margin-bottom: 6px;
      color: #333;
    }
    .customer-section .label {
      color: #999;
      font-size: 12px;
    }
    table {
      width: 100%;
      margin-bottom: 30px;
      border-collapse: collapse;
    }
    thead {
      background: #f9f9f9;
      border-top: 2px solid #f0a000;
      border-bottom: 2px solid #f0a000;
    }
    th {
      padding: 12px 16px;
      text-align: ${textAlign};
      font-weight: 600;
      color: #333;
      font-size: 13px;
      text-transform: uppercase;
    }
    td {
      padding: 12px 16px;
      text-align: ${textAlign};
      border-bottom: 1px solid #eee;
      font-size: 14px;
    }
    tbody tr:last-child td {
      border-bottom: 2px solid #f0a000;
    }
    .qty {
      text-align: center;
    }
    .price {
      text-align: right;
    }
    ${isAr ? '.price { direction: ltr; }' : ''}
    .summary {
      margin-left: auto;
      width: 300px;
      text-align: ${textAlign};
    }
    .summary-row {
      display: flex;
      justify-content: space-between;
      padding: 8px 0;
      font-size: 14px;
      border-bottom: 1px solid #eee;
    }
    .summary-row.total {
      border-bottom: 2px solid #f0a000;
      border-top: 2px solid #f0a000;
      padding: 12px 0;
      font-size: 18px;
      font-weight: 700;
      color: #1a1a1a;
    }
    .summary-row.subtotal label,
    .summary-row.delivery label,
    .summary-row.deposit label {
      color: #666;
    }
    .notes-section {
      background: #fef9f3;
      border-left: 4px solid #f0a000;
      padding: 16px;
      margin-bottom: 30px;
      border-radius: 4px;
    }
    .notes-section h4 {
      font-size: 13px;
      text-transform: uppercase;
      color: #999;
      margin-bottom: 8px;
      letter-spacing: 1px;
    }
    .notes-section p {
      font-size: 13px;
      color: #666;
      line-height: 1.6;
      white-space: pre-wrap;
    }
    .policies-section {
      background: #f9f9f9;
      padding: 20px;
      border-radius: 8px;
      margin-bottom: 30px;
      border: 1px solid #eee;
    }
    .policies-section h4 {
      font-size: 13px;
      text-transform: uppercase;
      color: #999;
      margin-bottom: 12px;
      letter-spacing: 1px;
    }
    .policies-section p {
      font-size: 12px;
      color: #666;
      line-height: 1.8;
      white-space: pre-wrap;
    }
    .stage-info {
      background: ${data.type === 'request' ? '#fef2f2' : '#f0fdf4'};
      border: 1px solid ${data.type === 'request' ? '#fecaca' : '#bbf7d0'};
      padding: 16px;
      border-radius: 8px;
      margin-bottom: 20px;
      font-size: 13px;
      color: ${data.type === 'request' ? '#7c2d2d' : '#166534'};
    }
    .stage-info strong {
      display: block;
      margin-bottom: 8px;
    }
    .footer {
      border-top: 2px solid #f0a000;
      padding-top: 20px;
      text-align: center;
      font-size: 12px;
      color: #999;
      margin-top: 40px;
    }
    .footer p {
      margin: 6px 0;
    }
    @media (max-width: 600px) {
      .container {
        padding: 20px;
      }
      .header {
        flex-direction: column;
      }
      .customer-section {
        grid-template-columns: 1fr;
        gap: 20px;
      }
      .summary {
        width: 100%;
        margin-left: 0;
      }
      table {
        font-size: 12px;
      }
      th, td {
        padding: 8px;
      }
    }
    @media print {
      body {
        background: white;
        padding: 0;
      }
      .container {
        box-shadow: none;
        max-width: 100%;
        padding: 0;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo-section">
        <h1>WEEMAP SINAI</h1>
        <p>${isAr ? 'حجوزات الرحلات والإقامة' : 'Trip & Accommodation Bookings'}</p>
      </div>
      <div class="invoice-info">
        <div class="invoice-type">${invoiceTypeLabel}</div>
        <div class="invoice-details">
          <div class="invoice-number">#${data.invoiceNumber}</div>
          <div>${isAr ? 'التاريخ' : 'Date'}: ${data.orderDate}</div>
        </div>
      </div>
    </div>

    <div class="stage-info">
      <strong>${data.type === 'request'
        ? (isAr ? '📋 هذه فاتورة الطلب الأولية' : '📋 This is the initial request invoice')
        : (isAr ? '✅ هذه فاتورة التأكيد النهائية' : '✅ This is the final confirmation invoice')
      }</strong>
      ${data.type === 'request'
        ? (isAr ? 'تحتوي هذه الفاتورة على تفاصيل طلبك. يرجى مراجعتها والتأكيد عبر WhatsApp. بعد التأكيد، ستتلقى فاتورة التأكيد النهائية.'
            : 'This invoice contains your request details. Please review and confirm via WhatsApp. After confirmation, you\'ll receive the final confirmation invoice.')
        : (isAr ? 'تم تأكيد حجزك. هذه الفاتورة تشمل تفاصيل الحجز وشروط الدفع والسياسات المعمول بها.'
            : 'Your booking is confirmed. This invoice includes booking details, payment terms, and applicable policies.')
      }
    </div>

    <div class="customer-section">
      <div>
        <h3>${isAr ? 'بيانات العميل' : 'Customer Information'}</h3>
        <p class="label">${isAr ? 'الاسم' : 'Name'}:</p>
        <p>${data.customerName}</p>
        <p class="label">${isAr ? 'الهاتف' : 'Phone'}:</p>
        <p dir="ltr">${data.customerPhone}</p>
        ${data.customerEmail ? `
        <p class="label">${isAr ? 'البريد الإلكتروني' : 'Email'}:</p>
        <p dir="ltr">${data.customerEmail}</p>
        ` : ''}
      </div>
      <div>
        <h3>${isAr ? 'تفاصيل الفاتورة' : 'Invoice Details'}</h3>
        <p class="label">${isAr ? 'نوع الفاتورة' : 'Invoice Type'}:</p>
        <p>${invoiceTypeLabel}</p>
        <p class="label">${isAr ? 'رقم الفاتورة' : 'Invoice Number'}:</p>
        <p dir="ltr">#${data.invoiceNumber}</p>
        <p class="label">${isAr ? 'التاريخ' : 'Date'}:</p>
        <p>${data.orderDate}</p>
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th>${isAr ? 'الوصف' : 'Description'}</th>
          <th class="qty">${isAr ? 'الكمية' : 'Qty'}</th>
          <th class="price">${isAr ? 'السعر' : 'Price'}</th>
          <th class="price">${isAr ? 'الإجمالي' : 'Total'}</th>
        </tr>
      </thead>
      <tbody>
        ${data.items.map(item => `
        <tr>
          <td>${isAr ? item.description_ar : item.description_en}</td>
          <td class="qty">${item.quantity}</td>
          <td class="price">${item.unitPrice.toFixed(2)} EGP</td>
          <td class="price"><strong>${(item.quantity * item.unitPrice).toFixed(2)} EGP</strong></td>
        </tr>
        `).join('')}
      </tbody>
    </table>

    <div class="summary">
      <div class="summary-row subtotal">
        <span>${isAr ? 'الإجمالي الفرعي' : 'Subtotal'}:</span>
        <span>${data.subtotal.toFixed(2)} EGP</span>
      </div>
      ${data.deliveryFee ? `
      <div class="summary-row delivery">
        <span>${isAr ? 'رسوم التوصيل' : 'Delivery Fee'}:</span>
        <span>${data.deliveryFee.toFixed(2)} EGP</span>
      </div>
      ` : ''}
      ${data.type === 'confirmation' && data.depositAmount ? `
      <div class="summary-row deposit">
        <span>${isAr ? 'المبلغ المتفق عليه (مقدم)' : 'Agreed Amount (Deposit)'}:</span>
        <span>${data.depositAmount.toFixed(2)} EGP</span>
      </div>
      ` : ''}
      <div class="summary-row total">
        <span>${data.type === 'request' ? (isAr ? 'الإجمالي المتوقع' : 'Expected Total') : (isAr ? 'المبلغ الواجب' : 'Amount Due')}:</span>
        <span>${data.totalAmount.toFixed(2)} EGP</span>
      </div>
    </div>

    ${data.notes ? `
    <div class="notes-section">
      <h4>${isAr ? 'ملاحظات إضافية' : 'Additional Notes'}</h4>
      <p>${data.notes}</p>
    </div>
    ` : ''}

    <div class="policies-section">
      <h4>${isAr ? 'الشروط والسياسات' : 'Terms & Policies'}</h4>
      <p>${policyText}</p>
      <p style="margin-top: 16px; padding-top: 16px; border-top: 1px solid #ddd;">
        ${isAr ? 'للمزيد من المعلومات أو الاستفسارات، يرجى التواصل معنا عبر WhatsApp أو البريد الإلكتروني.'
          : 'For more information or inquiries, please contact us via WhatsApp or email.'}
      </p>
    </div>

    <div class="footer">
      <p>WEEMAP SINAI © 2026</p>
      <p>${isAr ? 'شكراً لاختيارك خدماتنا' : 'Thank you for choosing our services'}</p>
      ${isAr ? '<p>البريد: info@weemapsinai.com | الهاتف: +201005744083</p>'
        : '<p>Email: info@weemapsinai.com | Phone: +201005744083</p>'}
    </div>
  </div>

  <script>
    // Auto-print dialog (optional - user can close without printing)
    // window.addEventListener('load', () => setTimeout(() => window.print(), 500));
  </script>
</body>
</html>
  `.trim()

  return html
}
