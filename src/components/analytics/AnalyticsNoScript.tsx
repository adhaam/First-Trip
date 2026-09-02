import { FB_PIXEL_ID, GTM_ID } from '@/lib/analytics'

/**
 * The <noscript> halves of the GTM and Meta Pixel snippets, for visitors with
 * JavaScript disabled. GTM asks for its iframe immediately after the opening
 * <body> tag, so this renders as the first child of <body>.
 */
export function AnalyticsNoScript() {
  return (
    <>
      {GTM_ID ? (
        <noscript>
          <iframe
            src={`https://www.googletagmanager.com/ns.html?id=${GTM_ID}`}
            height="0"
            width="0"
            style={{ display: 'none', visibility: 'hidden' }}
          />
        </noscript>
      ) : null}

      {FB_PIXEL_ID ? (
        <noscript>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            height="1"
            width="1"
            style={{ display: 'none' }}
            alt=""
            src={`https://www.facebook.com/tr?id=${FB_PIXEL_ID}&ev=PageView&noscript=1`}
          />
        </noscript>
      ) : null}
    </>
  )
}
