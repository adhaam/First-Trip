import { worksheet } from '@/lib/editions'

type Props = {
  min_group_size: number | null | undefined
  price_per_person_egp: number | null | undefined
  cost_variable_per_guest_egp: number | null | undefined
  cost_fixed_egp: number | null | undefined
  contingency_pct: number | null | undefined
}

/**
 * Decision-support display ONLY — never an input for price. Shows nothing
 * but a hint when the internal inputs aren't complete enough to compute.
 */
export function EditionWorksheetPanel(props: Props) {
  const result = worksheet({
    min_group_size: props.min_group_size ?? null,
    price_per_person_egp: props.price_per_person_egp ?? null,
    cost_variable_per_guest_egp: props.cost_variable_per_guest_egp ?? null,
    cost_fixed_egp: props.cost_fixed_egp ?? null,
    contingency_pct: props.contingency_pct ?? null,
  })

  if (!result) {
    return (
      <p className="text-sm text-muted-foreground">
        Set min. group size, price, and both cost fields to see cost/margin guidance.
      </p>
    )
  }

  return (
    <dl className="grid grid-cols-3 gap-4 text-sm">
      <div>
        <dt className="text-muted-foreground">Cost at min. group</dt>
        <dd className="font-semibold">{Math.round(result.costAtMin)} EGP</dd>
      </div>
      <div>
        <dt className="text-muted-foreground">Contribution at min.</dt>
        <dd className="font-semibold">{Math.round(result.contributionAtMin)} EGP</dd>
      </div>
      <div>
        <dt className="text-muted-foreground">Margin</dt>
        <dd className="font-semibold">{result.marginPct.toFixed(1)}%</dd>
      </div>
    </dl>
  )
}
