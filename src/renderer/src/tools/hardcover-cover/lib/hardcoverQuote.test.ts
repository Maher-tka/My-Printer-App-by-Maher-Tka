import assert from 'node:assert/strict'
import { calculateQuote } from '../hooks/useHardcoverProject'

const direct = calculateQuote({
  materialCost: 100,
  printCost: 50,
  finishingCost: 25,
  designCost: 25,
  quantity: 3,
  discount: 100,
  depositPaid: 80,
  totalPrice: 250
})

assert.equal(direct.finalPrice, 250, 'direct Total overrides the legacy itemized calculation')
assert.equal(direct.subtotal, 250, 'direct Total is also the displayed subtotal')
assert.equal(direct.remaining, 170, 'Remaining is Total minus Deposit')

const legacy = calculateQuote({
  materialCost: 10,
  printCost: 20,
  finishingCost: 5,
  designCost: 5,
  quantity: 2,
  discount: 10,
  depositPaid: 20
})

assert.equal(legacy.finalPrice, 70, 'older projects retain their itemized price calculation')
assert.equal(legacy.remaining, 50, 'older project deposits remain compatible')

console.log('Hardcover quote tests passed.')
