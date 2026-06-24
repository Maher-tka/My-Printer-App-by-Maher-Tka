import assert from 'node:assert/strict'
import { generateKeyPairSync } from 'node:crypto'
import { createOfflineSerialKey, validateOfflineSerialKey } from './license-serial.js'

const now = new Date('2026-06-18T12:00:00.000Z')
const { privateKey, publicKey } = generateKeyPairSync('ed25519')
const otherKeyPair = generateKeyPairSync('ed25519')

const proKey = createOfflineSerialKey({
  plan: 'pro',
  expiresCode: 'LIFE',
  seatCode: 'ABC123',
  signingPrivateKey: privateKey
})

assert.match(proKey, /^MPTK-PRO-LIFE-ABC123-[A-F0-9]{128}$/)

const proValidation = validateOfflineSerialKey(proKey, now, publicKey)
assert.equal(proValidation.ok, true)

if (proValidation.ok) {
  assert.equal(proValidation.license.plan, 'pro')
  assert.equal(proValidation.license.planLabel, 'Pro')
  assert.equal(proValidation.license.expiresAt, undefined)
  assert.equal(proValidation.license.seatCode, 'ABC123')
  assert.deepEqual(proValidation.license.features, ['paid-tools'])
}

const shopKey = createOfflineSerialKey({
  plan: 'shop',
  expiresCode: '20261231',
  seatCode: 'SHOP01',
  signingPrivateKey: privateKey
})

const shopValidation = validateOfflineSerialKey(shopKey, now, publicKey)
assert.equal(shopValidation.ok, true)

if (shopValidation.ok) {
  assert.equal(shopValidation.license.plan, 'shop')
  assert.equal(shopValidation.license.expiresAt, '2026-12-31T23:59:59.999Z')
  assert.deepEqual(shopValidation.license.features, ['paid-tools', 'batch-exports'])
}

const tamperedKey = proKey.replace('-PRO-', '-SHOP-')
const tamperedValidation = validateOfflineSerialKey(tamperedKey, now, publicKey)
assert.equal(tamperedValidation.ok, false)

const unauthorizedKey = createOfflineSerialKey({
  plan: 'pro',
  expiresCode: 'LIFE',
  seatCode: 'BAD001',
  signingPrivateKey: otherKeyPair.privateKey
})
const unauthorizedValidation = validateOfflineSerialKey(unauthorizedKey, now, publicKey)
assert.equal(unauthorizedValidation.ok, false)
assert.equal(validateOfflineSerialKey(unauthorizedKey, now).ok, false)

const expiredKey = createOfflineSerialKey({
  plan: 'pro',
  expiresCode: '20200101',
  seatCode: 'OLD001',
  signingPrivateKey: privateKey
})
const expiredValidation = validateOfflineSerialKey(expiredKey, now, publicKey)
assert.equal(expiredValidation.ok, false)

if (!expiredValidation.ok) {
  assert.equal(expiredValidation.error, 'This serial key has expired.')
}

console.log('Offline serial license tests passed.')
