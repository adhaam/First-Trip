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
  /** Sum of item totals before any discount. */
  subtotal: number
  discountAmount?: number
  discountLabel?: string
  deliveryFee?: number
  /** Final amount owed for the whole booking, after discount + delivery fee. */
  totalAmount: number
  /** What the customer has actually paid so far (0 if nothing paid yet). */
  amountPaid?: number
  paymentChannel?: string
  paymentReceivedBy?: string
  /** Free-text "how to pay / confirm" box, pulled from site_settings. */
  paymentInstructions?: string
  notes?: string
  locale: 'ar' | 'en'
  settings: SiteSettings | null
}

const PAYMENT_CHANNEL_LABELS: Record<string, { ar: string; en: string }> = {
  instapay: { ar: 'إنستاباي', en: 'InstaPay' },
  vodafonecash: { ar: 'فودافون كاش', en: 'Vodafone Cash' },
  cash: { ar: 'كاش', en: 'Cash' },
  bank_transfer: { ar: 'تحويل بنكي', en: 'Bank transfer' },
  other: { ar: 'أخرى', en: 'Other' },
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

  const paymentInstructions = data.paymentInstructions
    || (isAr ? data.settings?.payment_instructions_ar : data.settings?.payment_instructions_en)
    || ''

  // ─── Payment math — computed once, single source of truth ───
  const amountPaid = data.amountPaid || 0
  const balanceDue = Math.max(0, data.totalAmount - amountPaid)
  const isFullyPaid = amountPaid > 0 && balanceDue <= 0.01
  const isPendingPayment = data.type === 'request' && amountPaid <= 0

  const paymentChannelLabel = data.paymentChannel
    ? (PAYMENT_CHANNEL_LABELS[data.paymentChannel]?.[isAr ? 'ar' : 'en'] || data.paymentChannel)
    : ''

  // ─── Status badge (top of invoice) ───
  const statusBadge = data.type === 'request'
    ? { bg: '#fef3c7', fg: '#92400e', text: isAr ? '⏳ في انتظار الدفع' : '⏳ Pending Payment' }
    : isFullyPaid
      ? { bg: '#dcfce7', fg: '#166534', text: isAr ? '✅ مدفوع بالكامل' : '✅ Paid in Full' }
      : amountPaid > 0
        ? { bg: '#dbeafe', fg: '#1e40af', text: isAr ? '🔵 مدفوع جزئياً' : '🔵 Partially Paid' }
        : { bg: '#fee2e2', fg: '#991b1b', text: isAr ? '🔴 غير مدفوع' : '🔴 Unpaid' }

  const html = `
<!DOCTYPE html>
<html lang="${isAr ? 'ar' : 'en'}" dir="${dir}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${invoiceTypeLabel} · WEEMAP SINAI</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: ${isAr ? "'Segoe UI', Tahoma, Arial, sans-serif" : "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"};
      color: #1f2430;
      line-height: 1.6;
      background: #eef1f5;
      padding: 32px 16px;
    }
    .container {
      max-width: 880px;
      margin: 0 auto;
      background: #ffffff;
      border-radius: 18px;
      overflow: hidden;
      box-shadow: 0 8px 40px rgba(15, 30, 60, 0.12);
    }
    .brand-bar {
      background: linear-gradient(135deg, #0b1f3a 0%, #14335e 55%, #0b1f3a 100%);
      padding: 36px 44px;
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      flex-wrap: wrap;
      gap: 20px;
      position: relative;
    }
    .brand-bar::after {
      content: '';
      position: absolute;
      bottom: 0; left: 0; right: 0;
      height: 4px;
      background: linear-gradient(90deg, #f0a000, #ffcf6b, #f0a000);
    }
    .brand-name {
      color: #ffffff;
      font-size: 26px;
      font-weight: 800;
      letter-spacing: 2px;
    }
    .brand-tagline {
      color: rgba(255,255,255,0.65);
      font-size: 13px;
      margin-top: 6px;
      letter-spacing: 0.5px;
    }
    .invoice-meta {
      text-align: ${textAlign === 'right' ? 'left' : 'right'};
      color: #fff;
    }
    .invoice-meta .type-label {
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 1.5px;
      color: rgba(255,255,255,0.6);
      margin-bottom: 4px;
    }
    .invoice-meta .number {
      font-size: 18px;
      font-weight: 700;
      direction: ltr;
      display: inline-block;
    }
    .invoice-meta .date {
      font-size: 13px;
      color: rgba(255,255,255,0.65);
      margin-top: 4px;
    }
    .status-strip {
      padding: 16px 44px;
      display: flex;
      justify-content: ${textAlign === 'right' ? 'flex-end' : 'flex-start'};
      background: #f8f9fb;
      border-bottom: 1px solid #eef0f3;
    }
    .status-badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 8px 18px;
      border-radius: 999px;
      font-weight: 700;
      font-size: 13px;
      background: ${statusBadge.bg};
      color: ${statusBadge.fg};
    }
    .body-pad { padding: 36px 44px 44px; }
    .stage-info {
      background: ${data.type === 'request' ? '#fff8ec' : '#f0fdf6'};
      border: 1px solid ${data.type === 'request' ? '#fde3b0' : '#bff0d6'};
      padding: 16px 20px;
      border-radius: 10px;
      margin-bottom: 32px;
      font-size: 13.5px;
      color: ${data.type === 'request' ? '#7c5a12' : '#166534'};
    }
    .stage-info strong { display: block; margin-bottom: 6px; font-size: 14px; }
    .customer-section {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 32px;
      margin-bottom: 36px;
    }
    .card {
      background: #f8f9fb;
      border: 1px solid #eef0f3;
      border-radius: 12px;
      padding: 18px 20px;
    }
    .card h3 {
      font-size: 11px;
      text-transform: uppercase;
      color: #9aa1ae;
      margin-bottom: 12px;
      letter-spacing: 1.2px;
      font-weight: 700;
    }
    .card p { font-size: 14px; margin-bottom: 6px; color: #333; }
    .card .label { color: #9aa1ae; font-size: 11.5px; margin-top: 8px; }
    .card .label:first-of-type { margin-top: 0; }
    table { width: 100%; margin-bottom: 28px; border-collapse: collapse; }
    thead { background: #0b1f3a; }
    th {
      padding: 12px 16px;
      text-align: ${textAlign};
      font-weight: 700;
      color: #fff;
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    th:first-child { border-radius: 8px 0 0 0; }
    th:last-child { border-radius: 0 8px 0 0; }
    td {
      padding: 13px 16px;
      text-align: ${textAlign};
      border-bottom: 1px solid #eef0f3;
      font-size: 14px;
    }
    tbody tr:nth-child(even) { background: #fafbfc; }
    .qty { text-align: center; }
    .price { text-align: right; direction: ltr; }
    .summary { margin-left: auto; width: 320px; text-align: ${textAlign}; }
    .summary-row {
      display: flex; justify-content: space-between;
      padding: 9px 0; font-size: 14px; color: #444;
      border-bottom: 1px solid #eef0f3;
    }
    .summary-row .amt { direction: ltr; }
    .summary-row.discount .amt { color: #dc2626; font-weight: 600; }
    .summary-row.total {
      border-top: 2px solid #0b1f3a;
      border-bottom: none;
      padding: 14px 0 4px;
      font-size: 19px;
      font-weight: 800;
      color: #0b1f3a;
    }
    .summary-row.due {
      background: #fff8ec;
      border-radius: 8px;
      padding: 12px 14px;
      margin-top: 10px;
      font-size: 17px;
      font-weight: 800;
      color: #92400e;
      border-bottom: none;
    }
    .summary-row.paid-full {
      background: #f0fdf6;
      color: #166534;
    }
    .notes-section {
      background: #fef9f3;
      border-${textAlign === 'right' ? 'right' : 'left'}: 4px solid #f0a000;
      padding: 16px 18px;
      margin-bottom: 24px;
      border-radius: 8px;
    }
    .notes-section.payment-box {
      background: #eff6ff;
      border-${textAlign === 'right' ? 'right' : 'left'}-color: #2563eb;
    }
    .notes-section h4 {
      font-size: 12px;
      text-transform: uppercase;
      color: #9aa1ae;
      margin-bottom: 8px;
      letter-spacing: 1px;
      font-weight: 700;
    }
    .notes-section p { font-size: 13.5px; color: #444; line-height: 1.7; white-space: pre-wrap; }
    .policies-section {
      background: #f8f9fb;
      padding: 20px;
      border-radius: 10px;
      margin-bottom: 8px;
      border: 1px solid #eef0f3;
    }
    .policies-section h4 {
      font-size: 12px;
      text-transform: uppercase;
      color: #9aa1ae;
      margin-bottom: 10px;
      letter-spacing: 1px;
      font-weight: 700;
    }
    .policies-section p { font-size: 12px; color: #666; line-height: 1.8; white-space: pre-wrap; }
    .footer {
      border-top: 2px solid #f0a000;
      padding: 24px 44px;
      text-align: center;
      font-size: 12px;
      color: #9aa1ae;
      background: #f8f9fb;
    }
    .footer p { margin: 4px 0; }
    .footer .brand { color: #0b1f3a; font-weight: 700; letter-spacing: 1px; }
    @media (max-width: 600px) {
      .brand-bar, .status-strip, .body-pad, .footer { padding-left: 22px; padding-right: 22px; }
      .customer-section { grid-template-columns: 1fr; gap: 16px; }
      .summary { width: 100%; margin-left: 0; }
      table { font-size: 12px; }
      th, td { padding: 9px; }
    }
    @media print {
      body { background: white; padding: 0; }
      .container { box-shadow: none; max-width: 100%; border-radius: 0; }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="brand-bar">
      <div>
        <div class="brand-name">WEEMAP SINAI</div>
        <div class="brand-tagline">${isAr ? 'حجوزات الرحلات والإقامة في دهب' : 'Trip & Accommodation Bookings — Dahab'}</div>
      </div>
      <div class="invoice-meta">
        <div class="type-label">${invoiceTypeLabel}</div>
        <div class="number">#${data.invoiceNumber}</div>
        <div class="date">${isAr ? 'التاريخ' : 'Date'}: ${data.orderDate}</div>
      </div>
    </div>

    <div class="status-strip">
      <span class="status-badge">${statusBadge.text}</span>
    </div>

    <div class="body-pad">
      <div class="stage-info">
        <strong>${data.type === 'request'
          ? (isAr ? '📋 هذه فاتورة الطلب الأولية' : '📋 This is the initial request invoice')
          : (isAr ? '✅ هذه فاتورة التأكيد النهائية' : '✅ This is the final confirmation invoice')
        }</strong>
        ${data.type === 'request'
          ? (isAr ? 'تحتوي هذه الفاتورة على تفاصيل طلبك وهي في انتظار الدفع. يرجى مراجعتها والتأكيد عبر WhatsApp. بعد تأكيد الدفع، ستتلقى فاتورة التأكيد النهائية.'
              : 'This invoice contains your request details and is pending payment. Please review and confirm via WhatsApp. After payment is confirmed, you\'ll receive the final confirmation invoice.')
          : (isAr ? 'تم تأكيد حجزك. هذه الفاتورة تشمل تفاصيل الحجز والمبلغ المدفوع والمتبقي وشروط الدفع.'
              : 'Your booking is confirmed. This invoice includes booking details, amount paid, balance due, and applicable policies.')
        }
      </div>

      <div class="customer-section">
        <div class="card">
          <h3>${isAr ? 'بيانات العميل' : 'Customer Information'}</h3>
          <p class="label">${isAr ? 'الاسم' : 'Name'}</p>
          <p>${data.customerName}</p>
          <p class="label">${isAr ? 'الهاتف' : 'Phone'}</p>
          <p dir="ltr">${data.customerPhone}</p>
          ${data.customerEmail ? `
          <p class="label">${isAr ? 'البريد الإلكتروني' : 'Email'}</p>
          <p dir="ltr">${data.customerEmail}</p>
          ` : ''}
        </div>
        <div class="card">
          <h3>${isAr ? 'تفاصيل الفاتورة' : 'Invoice Details'}</h3>
          <p class="label">${isAr ? 'نوع الفاتورة' : 'Invoice Type'}</p>
          <p>${invoiceTypeLabel}</p>
          <p class="label">${isAr ? 'رقم الفاتورة' : 'Invoice Number'}</p>
          <p dir="ltr">#${data.invoiceNumber}</p>
          ${paymentChannelLabel ? `
          <p class="label">${isAr ? 'طريقة الدفع' : 'Payment Method'}</p>
          <p>${paymentChannelLabel}${data.paymentReceivedBy ? ` — ${data.paymentReceivedBy}` : ''}</p>
          ` : ''}
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
        <div class="summary-row">
          <span>${isAr ? 'الإجمالي الفرعي' : 'Subtotal'}:</span>
          <span class="amt">${data.subtotal.toFixed(2)} EGP</span>
        </div>
        ${data.discountAmount ? `
        <div class="summary-row discount">
          <span>${isAr ? 'خصم' : 'Discount'}${data.discountLabel ? ` (${data.discountLabel})` : ''}:</span>
          <span class="amt">-${data.discountAmount.toFixed(2)} EGP</span>
        </div>
        ` : ''}
        ${data.deliveryFee ? `
        <div class="summary-row">
          <span>${isAr ? 'رسوم التوصيل' : 'Delivery Fee'}:</span>
          <span class="amt">${data.deliveryFee.toFixed(2)} EGP</span>
        </div>
        ` : ''}
        <div class="summary-row total">
          <span>${isAr ? 'الإجمالي الكلي' : 'Total'}:</span>
          <span class="amt">${data.totalAmount.toFixed(2)} EGP</span>
        </div>
        ${amountPaid > 0 ? `
        <div class="summary-row">
          <span>${isAr ? 'المبلغ المدفوع' : 'Amount Paid'}:</span>
          <span class="amt">${amountPaid.toFixed(2)} EGP</span>
        </div>
        ` : ''}
        <div class="summary-row due ${isFullyPaid ? 'paid-full' : ''}">
          <span>${isFullyPaid ? (isAr ? 'تم السداد بالكامل' : 'Paid in Full') : (isAr ? 'المبلغ المتبقي' : 'Balance Due')}:</span>
          <span class="amt">${isFullyPaid ? '0.00 EGP' : balanceDue.toFixed(2) + ' EGP'}</span>
        </div>
      </div>

      ${paymentInstructions ? `
      <div class="notes-section payment-box">
        <h4>${isAr ? 'كيفية الدفع وتأكيد الحجز' : 'How to Pay & Confirm Your Booking'}</h4>
        <p>${paymentInstructions}</p>
      </div>
      ` : ''}

      ${data.notes ? `
      <div class="notes-section">
        <h4>${isAr ? 'ملاحظات إضافية' : 'Additional Notes'}</h4>
        <p>${data.notes}</p>
      </div>
      ` : ''}

      <div class="policies-section">
        <h4>${isAr ? 'الشروط والسياسات' : 'Terms & Policies'}</h4>
        <p>${policyText}</p>
        <p style="margin-top: 14px; padding-top: 14px; border-top: 1px solid #e5e7eb;">
          ${isAr ? 'للمزيد من المعلومات أو الاستفسارات، يرجى التواصل معنا عبر WhatsApp أو البريد الإلكتروني.'
            : 'For more information or inquiries, please contact us via WhatsApp or email.'}
        </p>
      </div>
    </div>

    <div class="footer">
      <p class="brand">WEEMAP SINAI</p>
      <p>${isAr ? 'شكراً لاختيارك خدماتنا' : 'Thank you for choosing our services'}</p>
      ${isAr ? '<p>البريد: info@weemapsinai.com | الهاتف: +201005744083</p>'
        : '<p>Email: info@weemapsinai.com | Phone: +201005744083</p>'}
    </div>
  </div>
</body>
</html>
  `.trim()

  return html
}
