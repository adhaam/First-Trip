import type { EditionProgramItem } from '@/lib/editions'

type Props = {
  program: EditionProgramItem[]
  locale: 'en' | 'ar'
}

/** The program list, in stored (array-index) order — renders only when program has entries. */
export function EditionProgram({ program, locale }: Props) {
  if (program.length === 0) return null
  const ar = locale === 'ar'

  return (
    <ol className="space-y-5">
      {program.map((item, index) => {
        const label = ar ? item.label_ar : item.label_en
        const title = ar ? item.title_ar : item.title_en
        const description = ar ? item.description_ar : item.description_en
        return (
          <li key={index} className="flex gap-4">
            <span
              className={[
                'mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full',
                'bg-sea-100 text-xs font-semibold text-sea-900',
              ].join(' ')}
            >
              {label || index + 1}
            </span>
            <div>
              <p className="font-semibold text-sea-900">{title}</p>
              {description && <p className="mt-1 text-sm leading-relaxed text-ink-muted">{description}</p>}
            </div>
          </li>
        )
      })}
    </ol>
  )
}
