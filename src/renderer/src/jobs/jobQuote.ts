import type { JobQuote } from './jobTypes'

const nonnegative = (value: number | undefined): number =>
  Number.isFinite(value) ? Math.max(0, value ?? 0) : 0
const money = (value: number): number => Math.round((value + Number.EPSILON) * 100) / 100

export function calculateJobQuote(quote: JobQuote): JobQuote {
  const normalized = {
    ...quote,
    materialCost: nonnegative(quote.materialCost),
    printCost: nonnegative(quote.printCost),
    finishingCost: nonnegative(quote.finishingCost),
    designCost: nonnegative(quote.designCost),
    cuttingCost: nonnegative(quote.cuttingCost),
    bindingCost: nonnegative(quote.bindingCost),
    designFee: nonnegative(quote.designFee),
    quantity: Math.max(1, Math.floor(nonnegative(quote.quantity))),
    discount: nonnegative(quote.discount),
    depositPaid: money(nonnegative(quote.depositPaid))
  }
  const unitCost =
    normalized.materialCost +
    normalized.printCost +
    normalized.finishingCost +
    normalized.designCost +
    normalized.cuttingCost +
    normalized.bindingCost +
    normalized.designFee
  const finalPrice = money(Math.max(0, unitCost * normalized.quantity - normalized.discount))
  return {
    ...normalized,
    finalPrice,
    remainingAmount: money(Math.max(0, finalPrice - normalized.depositPaid))
  }
}
