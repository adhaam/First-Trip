'use client'

import { WHATSAPP_NUMBER } from '@/lib/constants'
import { MessageCircle } from 'lucide-react'
import { useLocale } from 'next-intl'
import { motion } from 'framer-motion'

export function WhatsAppFloat() {
  const locale = useLocale()

  return (
    <motion.a
      href={`https://wa.me/${WHATSAPP_NUMBER.replace('+', '')}`}
      target="_blank"
      rel="noopener noreferrer"
      className="fixed bottom-6 z-50 bg-green-500 hover:bg-green-600 text-white rounded-full shadow-lg hover:shadow-xl transition-all duration-300 flex items-center gap-2 px-4 py-3"
      style={
        locale === 'ar'
          ? { left: '1.5rem' }
          : { right: '1.5rem' }
      }
      initial={{ y: 20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ delay: 0.5 }}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
    >
      <MessageCircle className="h-5 w-5" />
      <span className="text-sm font-medium hidden sm:inline">
        {locale === 'ar' ? 'واتساب' : 'WhatsApp'}
      </span>
    </motion.a>
  )
}