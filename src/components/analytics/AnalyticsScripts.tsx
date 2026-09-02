'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import Script from 'next/script'
import { FB_PIXEL_ID, GTM_ID } from '@/lib/analytics'
import { captureAttribution } from '@/lib/conversion'

/**
 * Google Tag Manager + Meta (Facebook) Pixel.
 *
 * Both vendors ship a copy/paste <script> snippet written for classic
 * multi-page sites. This is a single-page app, so two things are adapted:
 *
 *  1. The tags load through next/script with the `afterInteractive` strategy —
 *     Next's recommended strategy for tag managers and analytics. They still
 *     land in <head>, just without blocking first paint.
 *  2. The pixel's `PageView` is fired from an effect on every pathname change
 *     instead of once at load, otherwise client-side navigations between pages
 *     (Home → a package → checkout) would never be counted. The vendor
 *     snippet's own `fbq('track', 'PageView')` is deliberately omitted so the
 *     first page view is not double-counted.
 *
 * GTM tracks SPA navigation on its side via a History Change trigger, which is
 * configured inside the GTM container, not here.
 */
export function AnalyticsScripts() {
  const pathname = usePathname()

  // Record utm_*, referrer origin and landing path for the first page of the
  // session so a conversion three pages later still carries its campaign.
  // Reads only; sends nothing. See captureAttribution() for what is stored.
  useEffect(() => {
    captureAttribution()
  }, [])

  useEffect(() => {
    if (!FB_PIXEL_ID) return
    let cancelled = false

    const send = () => {
      if (cancelled) return
      if (!window.fbq) {
        // The pixel script is injected after hydration, so on the very first
        // page fbq may not exist yet. It stubs itself synchronously once the
        // inline snippet runs, so poll briefly rather than drop the view.
        window.setTimeout(send, 300)
        return
      }
      window.fbq('track', 'PageView')
    }

    send()
    return () => {
      cancelled = true
    }
  }, [pathname])

  return (
    <>
      {GTM_ID ? (
        <Script id="gtm-base" strategy="afterInteractive">
          {`(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','${GTM_ID}');`}
        </Script>
      ) : null}

      {FB_PIXEL_ID ? (
        <Script id="meta-pixel-base" strategy="afterInteractive">
          {`!function(f,b,e,v,n,t,s)
{if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};
if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];
s.parentNode.insertBefore(t,s)}(window, document,'script',
'https://connect.facebook.net/en_US/fbevents.js');
fbq('init', '${FB_PIXEL_ID}');`}
        </Script>
      ) : null}
    </>
  )
}
