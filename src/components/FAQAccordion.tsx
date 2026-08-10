'use client'

import { useLocale } from 'next-intl'
import { Card, CardContent } from '@/components/ui/card'
import { motion } from 'framer-motion'
import { useState } from 'react'

const faqsAr = [
  ['الرحلة بتتحرك منين؟ ومتاحة من محافظتي؟', 'التحرك كل أحد وخميس من القاهرة والإسكندرية وكذا محافظة تانية، والهاي إس متاح بشكل يومي من أغلب المحافظات. قولنا إنت منين وإحنا نظبطلك أقرب نقطة تحرك ليك.'],
  ['السعر شامل إيه بالظبط؟', 'السعر شامل الإقامة، الانتقالات ذهاب وعودة، والتور ليدر اللي معاك طول الرحلة. الرحلات الداخلية زي السفاري واليخت والغواصة بتتحسب لوحدها بأسعار مميزة، وبنوضحلك كل تفصيلة قبل ما تأكد.'],
  ['الرحلات الداخلية بكام؟ وليه مش مكتوبة؟', 'سعرها بيختلف حسب البرنامج وعدد الأفراد، وعشان كده بنحب نظبطها معاك على واتساب علشان تطلعلك بأنسب سعر. كلمنا وقولنا عايز تعمل إيه وإحنا نقولك الرقم النهائي على طول.'],
  ['أنا رايح لوحدي — الموضوع هيبقى محرج؟', 'خالص. أغلب اللي بييجي معانا بييجي solo، ومن أول يوم الجروب بيبقى زي صحاب قُدام. التور ليدر بيكسر التلج بسرعة، وإنت حر تشارك في اللي تحبه وترتاح وقت ما تحب.'],
  ['بأحجز إزاي؟ ولازم أدفع كام مقدم؟', 'تكلمنا على واتساب، نظبط معاك الفندق والميعاد، وبتأكد حجزك بعربون 50% بس. الباقي بتدفعه قبل السفر بأسبوع. بنقبل إنستاباي، فودافون كاش، aCash، فيزا، وتحويل بنكي.'],
  ['ممكن أغير الفندق أو الميعاد بعد ما أحجز؟', 'أيوه، حسب التوافر. كلمنا بدري وإحنا بنعدّلهالك من غير أي رسوم زيادة طول ما فيه أماكن. والإلغاء قبل 7 أيام من السفر بيرجعلك العربون كامل أو تأجّل لميعاد تاني.'],
  ['الأكل والفطار داخل في السعر؟', 'بيختلف من فندق لفندق. فيه فنادق بفطار شامل أو بوفيه أو Half Board، وفيه فنادق الفطار فيها اختياري بتكلفة بسيطة. كل ده مكتوب تحت كل فندق.'],
  ['في حمامات سباحة؟ ومستوى الفنادق إيه؟', 'عندنا 4 فئات: Budget (كامبات وفنادق اقتصادية)، Standard (فنادق حديثة وبعضها بحمام سباحة)، Premium (4 و5 نجوم وسي فيو)، وLagoon (ريزورتات بشواطئ رملية). اختار الفئة من فوق وشوف كل فندق.'],
  ['الرحلة مناسبة للعائلات والأطفال؟', 'أكيد. عندنا برامج هادية وفنادق بحمامات سباحة وشقق وشاليهات خاصة مناسبة جداً للعائلات. قولنا إنتوا كام فرد وفيه أطفال ولا لأ، وإحنا نرشحلك أنسب فندق وأنسب برنامج.'],
  ['بتعملوا تعاقدات للشركات والمدارس والجامعات؟', 'أيوه. عندنا تعاقدات وعروض خاصة للهيئات والشركات والمدارس والجامعات والجروبات الكبيرة — بأسعار مميزة وخدمة وتنظيم على مستوى أعلى. كلمنا بعدد الأفراد والميعاد وإحنا نظبطلك عرض مخصص.'],
  ['لو حصل ظرف طارئ وألغيت، الفلوس بترجع؟', 'الإلغاء قبل 7 أيام من السفر بيرجعلك العربون بالكامل، أو تأجّل لميعاد تاني. لو الإلغاء خلال أقل من 7 أيام بنحاول نأجّلك بدل ما تخسر، قدر الإمكان. إحنا بشر وبنفهم إن الظروف بتحصل.'],
]

const faqsEn = [
  ['Where do trips depart from? And is it available from my governorate?', 'Trips depart every Sunday and Thursday from Cairo, Alexandria, and several other governorates. Hi-ACE transfers are available daily from most governorates. Tell us where you are and we\'ll arrange the closest pickup point.'],
  ['What exactly is included in the price?', 'The price includes accommodation, round-trip transfers, and a tour leader with you throughout the trip. Internal trips like safari, yacht, and submarine are priced separately at special rates — we clarify every detail before you confirm.'],
  ['How much are the internal trips? Why aren\'t prices listed?', 'Prices vary by program and number of people, so we prefer to arrange with you on WhatsApp to get you the best rate. Contact us, tell us what you want to do, and we\'ll give you the final number right away.'],
  ['I\'m going solo — will it be awkward?', 'Not at all. Most people who come with us come solo, and from day one the group feels like old friends. The tour leader breaks the ice quickly, and you\'re free to join what you like and rest whenever you want.'],
  ['How do I book? And how much do I pay upfront?', 'Contact us on WhatsApp, we\'ll arrange the hotel and dates with you, and you confirm your spot with just a 50% deposit. The rest is paid one week before travel. We accept InstaPay, Vodafone Cash, aCash, Visa, and bank transfer.'],
  ['Can I change the hotel or date after booking?', 'Yes, depending on availability. Contact us early and we\'ll adjust it for you with no extra fees as long as there are spots. Cancellation 7+ days before travel gets your full deposit refunded or rescheduled to another date.'],
  ['Is food and breakfast included in the price?', 'It varies from hotel to hotel. Some hotels include breakfast, buffet, or Half Board. Some hotels (like Mojito) have optional breakfast at a small extra cost. All details are listed under each hotel.'],
  ['Are there swimming pools? What are the hotel levels?', 'We have 4 tiers: Budget (camps & economy hotels), Standard (modern hotels, some with pools), Premium (4-5 star, sea view), and Lagoon (resorts with sandy beaches). Choose your tier above and browse each hotel.'],
  ['Is the trip suitable for families and children?', 'Absolutely. We have relaxed programs and hotels with pools and private apartments/chalets perfect for families. Tell us how many you are and if there are kids, and we\'ll recommend the best hotel and program.'],
  ['Do you do contracts for companies, schools, and universities?', 'Yes. We have contracts and special offers for organizations, companies, schools, universities, and large groups — with special rates and higher-level service and organization. Contact us with the number of people and dates and we\'ll prepare a custom offer.'],
  ['If an emergency happens and I cancel, do I get my money back?', 'Cancellation 7+ days before travel gets your full deposit refunded, or you can reschedule. If cancellation is within less than 7 days, we try our best to reschedule you rather than lose out. We\'re human and understand that things happen.'],
]

export function FAQAccordion() {
  const locale = useLocale()
  const [openIdx, setOpenIdx] = useState<number | null>(null)
  const faqs = locale === 'ar' ? faqsAr : faqsEn

  return (
    <section className="section-padding bg-white">
      <div className="container-main max-w-3xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-10"
        >
          <h2 className="text-2xl md:text-3xl font-bold text-gray-900">
            {locale === 'ar' ? 'أسئلة بتتسألنا كتير' : 'Frequently Asked Questions'}
          </h2>
          <p className="text-gray-500 mt-2">
            {locale === 'ar' ? 'لو سؤالك مش هنا، كلمنا على واتساب' : 'If your question isn\'t here, message us on WhatsApp'}
          </p>
        </motion.div>
        <div className="space-y-3">
          {faqs.map((faq, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.05 }}
            >
              <Card className="overflow-hidden border-gray-200 hover:border-brand-blue/30 transition-colors">
                <button
                  onClick={() => setOpenIdx(openIdx === i ? null : i)}
                  className="w-full flex items-center justify-between gap-4 p-5 text-left font-semibold text-gray-900"
                >
                  <span className="text-sm md:text-base">{faq[0]}</span>
                  <span className="flex-none w-7 h-7 rounded-full border border-gray-300 flex items-center justify-center text-brand-orange transition-transform" style={{ transform: openIdx === i ? 'rotate(45deg)' : 'rotate(0deg)' }}>
                    ＋
                  </span>
                </button>
                {openIdx === i && (
                  <CardContent className="px-5 pb-5 pt-0">
                    <p className="text-sm text-gray-600 leading-relaxed">{faq[1]}</p>
                  </CardContent>
                )}
              </Card>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}