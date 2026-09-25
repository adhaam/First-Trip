import { Check } from 'lucide-react'

/** The trip detail page's "what is included" list. */
export function TripDetailIncluded({ items }: { items: string[] }) {
  return (
    <ul className="grid gap-3 sm:grid-cols-2">
      {items.map((item) => (
        <li className="flex gap-2 border-t border-sand-300 pt-3 text-sm text-ink-muted" key={item}>
          <Check className="mt-0.5 h-4 w-4 shrink-0 text-sun-700" />
          {item}
        </li>
      ))}
    </ul>
  )
}
