import type { SiteSettings } from '@/lib/types'
import { escapeHtml as esc, escapeHtmlMultiline as escLines } from '@/lib/safe-html'

/**
 * One "what did I book" fact, shown above the charges table. Bilingual pairs
 * rather than keys, because a value can be a translated label (a room type,
 * a transfer direction) as easily as a raw number.
 */
export interface InvoiceDetail {
  label_ar: string
  label_en: string
  value_ar: string
  value_en: string
}

export interface InvoiceAdjustment {
  label_ar: string
  label_en: string
  /** Signed: negative = deducted, positive = added. */
  amount: number
}

/** A money amount as rendered — Number() first so a stray string can't inject. */
function money(value: unknown): string {
  const n = Number(value)
  return `${(Number.isFinite(n) ? n : 0).toFixed(2)} EGP`
}

/**
 * Every value interpolated below that is not a literal of this template is
 * escaped: customer name/phone/email/notes come straight from the public
 * booking form, names and labels from the database, terms from
 * site_settings. The rendered HTML is shown in the admin dashboard, so an
 * unescaped `<img onerror>` in a booking name would run with admin rights.
 */
export interface InvoiceData {
  type: 'request' | 'confirmation'
  invoiceNumber: string
  customerName: string
  customerPhone: string
  customerEmail?: string
  orderDate: string
  /**
   * The booking's own facts — party size, dates, transfer type and
   * direction, room and nights, meal plan. Without these an invoice shows a
   * price with nothing to justify it, which is exactly how a 5-person
   * transfer-only booking ended up reading as "Accommodation, qty 2".
   */
  details?: InvoiceDetail[]
  items: Array<{
    description_ar: string
    description_en: string
    quantity: number
    unitPrice: number
    /** How the amount was reached, e.g. "5 people x 950 EGP x 2 legs". */
    meta_ar?: string
    meta_en?: string
  }>
  subtotal: number
  deliveryFee?: number
  /** Shown as its own deducted row when a discount applied to this booking. */
  discount?: { label_ar: string; label_en: string; amount: number }
  /**
   * Signed summary rows between the subtotal and the total — a negative
   * amount is a deduction (a discount), a positive one a surcharge (an agreed
   * price above the itemised one). Built by lib/invoice-items so that
   * subtotal + Σ adjustments === totalAmount, always.
   */
  adjustments?: InvoiceAdjustment[]
  depositAmount?: number
  totalAmount: number
  /** Actually received so far — drives the paid / balance-due rows. */
  amountPaid?: number
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

  const policyText = escLines(isAr
    ? (data.settings?.terms_ar || 'شروط وأحكام الاستخدام')
    : (data.settings?.terms_en || 'Terms and Conditions'))

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
    .booking-details {
      border: 1px solid #eee;
      border-radius: 8px;
      padding: 20px;
      margin-bottom: 30px;
      background: #fcfcfc;
    }
    .booking-details h4 {
      font-size: 12px;
      text-transform: uppercase;
      color: #999;
      margin-bottom: 14px;
      letter-spacing: 1px;
    }
    .detail-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 14px 24px;
    }
    .detail-item .detail-label {
      font-size: 11px;
      color: #999;
      margin-bottom: 2px;
    }
    .detail-item .detail-value {
      font-size: 14px;
      color: #1a1a1a;
      font-weight: 600;
    }
    .item-meta {
      display: block;
      margin-top: 3px;
      font-size: 11px;
      color: #888;
      font-weight: 400;
    }
    .summary-row.discount span:last-child {
      color: #15803d;
    }
    .summary-row.balance {
      font-weight: 700;
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
      .detail-grid {
        grid-template-columns: 1fr 1fr;
        gap: 12px 16px;
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
          <div class="invoice-number">#${esc(data.invoiceNumber)}</div>
          <div>${isAr ? 'التاريخ' : 'Date'}: ${esc(data.orderDate)}</div>
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
        <p>${esc(data.customerName)}</p>
        <p class="label">${isAr ? 'الهاتف' : 'Phone'}:</p>
        <p dir="ltr">${esc(data.customerPhone)}</p>
        ${data.customerEmail ? `
        <p class="label">${isAr ? 'البريد الإلكتروني' : 'Email'}:</p>
        <p dir="ltr">${esc(data.customerEmail)}</p>
        ` : ''}
      </div>
      <div>
        <h3>${isAr ? 'تفاصيل الفاتورة' : 'Invoice Details'}</h3>
        <p class="label">${isAr ? 'نوع الفاتورة' : 'Invoice Type'}:</p>
        <p>${invoiceTypeLabel}</p>
        <p class="label">${isAr ? 'رقم الفاتورة' : 'Invoice Number'}:</p>
        <p dir="ltr">#${esc(data.invoiceNumber)}</p>
        <p class="label">${isAr ? 'التاريخ' : 'Date'}:</p>
        <p>${esc(data.orderDate)}</p>
      </div>
    </div>

    ${data.details && data.details.length > 0 ? `
    <div class="booking-details">
      <h4>${isAr ? 'تفاصيل الحجز' : 'Booking Details'}</h4>
      <div class="detail-grid">
        ${data.details.map(d => `
        <div class="detail-item">
          <div class="detail-label">${esc(isAr ? d.label_ar : d.label_en)}</div>
          <div class="detail-value">${esc(isAr ? d.value_ar : d.value_en)}</div>
        </div>
        `).join('')}
      </div>
    </div>
    ` : ''}

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
          <td>
            ${esc(isAr ? item.description_ar : item.description_en)}
            ${(isAr ? item.meta_ar : item.meta_en)
              ? `<span class="item-meta">${esc(isAr ? item.meta_ar : item.meta_en)}</span>`
              : ''}
          </td>
          <td class="qty">${esc(item.quantity)}</td>
          <td class="price">${money(item.unitPrice)}</td>
          <td class="price"><strong>${money(Number(item.quantity) * Number(item.unitPrice))}</strong></td>
        </tr>
        `).join('')}
      </tbody>
    </table>

    <div class="summary">
      <div class="summary-row subtotal">
        <span>${isAr ? 'الإجمالي الفرعي' : 'Subtotal'}:</span>
        <span>${money(data.subtotal)}</span>
      </div>
      ${data.deliveryFee ? `
      <div class="summary-row delivery">
        <span>${isAr ? 'رسوم التوصيل' : 'Delivery Fee'}:</span>
        <span>${money(data.deliveryFee)}</span>
      </div>
      ` : ''}
      ${data.discount && data.discount.amount > 0 && !(data.adjustments?.length) ? `
      <div class="summary-row discount">
        <span>${esc(isAr ? data.discount.label_ar : data.discount.label_en)}:</span>
        <span>− ${money(data.discount.amount)}</span>
      </div>
      ` : ''}
      ${(data.adjustments ?? []).filter(a => Math.abs(Number(a.amount)) >= 0.005).map(a => `
      <div class="summary-row ${Number(a.amount) < 0 ? 'discount' : 'adjustment'}">
        <span>${esc(isAr ? a.label_ar : a.label_en)}:</span>
        <span>${Number(a.amount) < 0 ? '−' : '+'} ${money(Math.abs(Number(a.amount)))}</span>
      </div>
      `).join('')}
      ${data.type === 'confirmation' && data.depositAmount ? `
      <div class="summary-row deposit">
        <span>${isAr ? 'المبلغ المتفق عليه (مقدم)' : 'Agreed Amount (Deposit)'}:</span>
        <span>${money(data.depositAmount)}</span>
      </div>
      ` : ''}
      <div class="summary-row total">
        <span>${data.type === 'request' ? (isAr ? 'الإجمالي المتوقع' : 'Expected Total') : (isAr ? 'المبلغ الواجب' : 'Amount Due')}:</span>
        <span>${money(data.totalAmount)}</span>
      </div>
      ${data.amountPaid && data.amountPaid > 0 ? `
      <div class="summary-row deposit">
        <span>${isAr ? 'المدفوع' : 'Paid'}:</span>
        <span>${money(data.amountPaid)}</span>
      </div>
      <div class="summary-row balance">
        <span>${isAr ? 'المتبقي' : 'Balance Due'}:</span>
        <span>${money(Math.max(0, data.totalAmount - data.amountPaid))}</span>
      </div>
      ` : ''}
    </div>

    ${data.notes ? `
    <div class="notes-section">
      <h4>${isAr ? 'ملاحظات إضافية' : 'Additional Notes'}</h4>
      <p>${escLines(data.notes)}</p>
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
</body>
</html>
  `.trim()

  return html
}
