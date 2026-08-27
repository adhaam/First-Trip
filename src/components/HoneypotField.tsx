// Anti-bot honeypot input. Real users never see or fill this field (it's
// visually hidden with the same clip technique Tailwind's `sr-only` uses —
// not `display:none`, which naive bots specifically check for). Any submit
// with this field non-empty is treated as spam. Field name intentionally
// looks like a normal, tempting-to-autofill field for bots.
export function HoneypotField({
  name = 'website',
  value,
  onChange,
}: {
  name?: string
  value?: string
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void
}) {
  return (
    <input
      type="text"
      name={name}
      tabIndex={-1}
      autoComplete="off"
      aria-hidden="true"
      className="sr-only"
      value={value}
      onChange={onChange}
      defaultValue={value === undefined ? '' : undefined}
    />
  )
}
