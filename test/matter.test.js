import { test } from 'node:test'
import assert from 'node:assert/strict'
import * as pw from '../src/matter.js'

const client = { role: 'client', name: 'Mai' }
const pro = { role: 'professional', name: 'Jordan' }
const other = { role: 'professional', name: 'Alex' }

function engaged() {
  let m = pw.createMatter({ id: 'm1', title: 'Shop lease renewal', client: 'Mai' })
  m = pw.inviteProfessional(m, client, 'Jordan')
  return pw.respondToInvite(m, 'Jordan', true)
}

function agreed(amount = 1200) {
  let m = pw.submitDecision(engaged(), pro, { type: 'proposal', title: 'Review and negotiate lease', amountAud: amount })
  return pw.decide(m, client, m.decisions.at(-1).id, true)
}

const code = (c) => (e) => e.code === c

test('inviting and accepting moves the matter to engaged; only the owner invites', () => {
  let m = pw.createMatter({ id: 'm1', client: 'Mai' })
  assert.throws(() => pw.inviteProfessional(m, { role: 'client', name: 'Someone' }, 'Jordan'), code('NOT_OWNER'))
  m = pw.inviteProfessional(m, client, 'Jordan')
  assert.equal(m.stage, 'finding_help')
  assert.throws(() => pw.inviteProfessional(m, client, 'Jordan'), code('INVITE_EXISTS'))
  m = pw.respondToInvite(m, 'Jordan', true)
  assert.deepEqual([m.stage, m.team], ['engaged', ['Jordan']])
})

test('a professional not on the team cannot act', () => {
  assert.throws(() => pw.requestDocument(engaged(), other, { title: 'Current lease' }), code('NOT_ON_TEAM'))
})

test('formal decisions come from a professional and only the client decides', () => {
  const m = engaged()
  assert.throws(() => pw.submitDecision(m, client, { type: 'proposal', title: 'x', amountAud: 10 }), code('ROLE_FORBIDDEN'))
  assert.throws(() => pw.submitDecision(m, pro, { type: 'proposal', title: 'No price' }), code('AMOUNT_REQUIRED'))
  const sub = pw.submitDecision(m, pro, { type: 'proposal', title: 'Lease review', amountAud: 1200 })
  assert.throws(() => pw.decide(sub, pro, sub.decisions[0].id, true), code('ROLE_FORBIDDEN'))
  const done = pw.decide(sub, client, sub.decisions[0].id, true)
  assert.equal(done.stage, 'in_progress')
  assert.equal(done.agreement.amount_aud, 1200)
  assert.throws(() => pw.decide(done, client, sub.decisions[0].id, false), code('DECISION_CLOSED'))
})

test('a second proposal is a new version and replaces the agreement only when approved', () => {
  let m = agreed(1200)
  m = pw.submitDecision(m, pro, { type: 'proposal', title: 'Extra negotiation round', amountAud: 1500 })
  assert.equal(m.decisions.at(-1).version, 2)
  assert.equal(m.agreement.amount_aud, 1200)
  m = pw.decide(m, client, m.decisions.at(-1).id, true)
  assert.deepEqual([m.agreement.amount_aud, m.agreement.version], [1500, 2])
})

test('a document is reviewed by a professional before the client marks it final', () => {
  let m = pw.requestDocument(agreed(), pro, { title: 'Signed heads of agreement' })
  const id = m.checklist[0].id
  m = pw.setDocumentStatus(m, client, id, 'drafted')
  assert.throws(() => pw.setDocumentStatus(m, client, id, 'reviewed'), code('ROLE_FORBIDDEN'))
  assert.throws(() => pw.setDocumentStatus(m, client, id, 'final'), code('REVIEW_REQUIRED'))
  m = pw.setDocumentStatus(m, pro, id, 'reviewed')
  m = pw.setDocumentStatus(m, client, id, 'final')
  assert.throws(() => pw.setDocumentStatus(m, pro, id, 'drafted'), code('DOCUMENT_FINAL'))
  assert.equal(m.checklist[0].history.length, 3)
})

test('handover closes the matter only when every document is final', () => {
  let m = pw.requestDocument(agreed(), pro, { title: 'Lease' })
  m = pw.moveToReview(m, pro)
  m = pw.submitDecision(m, pro, { type: 'handover', title: 'Final documents handed over' })
  assert.throws(() => pw.decide(m, client, m.decisions.at(-1).id, true), code('DOCUMENTS_OPEN'))
  m = pw.setDocumentStatus(m, pro, 'doc-1', 'reviewed')
  m = pw.setDocumentStatus(m, client, 'doc-1', 'final')
  m = pw.decide(m, client, m.decisions.at(-1).id, true)
  assert.deepEqual([m.stage, m.status], ['closed', 'closed'])
  assert.throws(() => pw.requestDocument(m, pro, { title: 'More' }), code('MATTER_CLOSED'))
})

test('review waits for pending decisions', () => {
  const m = pw.submitDecision(agreed(), pro, { type: 'milestone', title: 'Draft sent to landlord' })
  assert.throws(() => pw.moveToReview(m, pro), code('DECISIONS_PENDING'))
})

test('an invoice must match the approved proposal', () => {
  assert.throws(() => pw.issueInvoice(engaged(), pro, { title: 'Fees', amountAud: 1200 }), code('NO_AGREEMENT'))
  assert.throws(() => pw.issueInvoice(agreed(1200), pro, { title: 'Fees', amountAud: 1300 }), code('AMOUNT_MISMATCH'))
  assert.equal(pw.issueInvoice(agreed(1200), pro, { title: 'Fees', amountAud: 1200 }).invoices[0].status, 'issued')
})

test('a client transfer claim is never payment; only the issuer reconciles', () => {
  let m = pw.issueInvoice(agreed(1200), pro, { title: 'Fees', amountAud: 1200 })
  assert.throws(() => pw.setInvoiceStatus(m, client, 'inv-1', 'paid'), code('TRANSITION_INVALID'))
  m = pw.setInvoiceStatus(m, client, 'inv-1', 'accepted')
  assert.throws(() => pw.setInvoiceStatus(m, pro, 'inv-1', 'paid'), code('TRANSITION_INVALID'))
  assert.throws(() => pw.setInvoiceStatus(m, client, 'inv-1', 'transfer_claimed', { amountAud: 1200, reference: 'REF-1' }), code('EVIDENCE_REQUIRED'))
  assert.throws(() => pw.setInvoiceStatus(m, client, 'inv-1', 'transfer_claimed', { amountAud: 1000, reference: 'REF-1', date: '2026-11-20' }), code('AMOUNT_MISMATCH'))
  m = pw.setInvoiceStatus(m, client, 'inv-1', 'transfer_claimed', { amountAud: 1200, reference: 'REF-1', date: '2026-11-20' })
  assert.throws(() => pw.setInvoiceStatus(m, client, 'inv-1', 'paid'), code('ROLE_FORBIDDEN'))
  m = pw.setInvoiceStatus(m, pro, 'inv-1', 'paid')
  assert.equal(m.invoices[0].status, 'paid')
  assert.throws(() => pw.setInvoiceStatus(m, pro, 'inv-1', 'void'), code('TRANSITION_INVALID'))
})

test('the client declines and the issuer voids, not the other way round', () => {
  const m = pw.issueInvoice(agreed(1200), pro, { title: 'Fees', amountAud: 1200 })
  assert.throws(() => pw.setInvoiceStatus(m, pro, 'inv-1', 'declined'), code('ROLE_FORBIDDEN'))
  assert.throws(() => pw.setInvoiceStatus(m, client, 'inv-1', 'void'), code('ROLE_FORBIDDEN'))
  assert.equal(pw.setInvoiceStatus(m, client, 'inv-1', 'declined').invoices[0].status, 'declined')
  const accepted = pw.setInvoiceStatus(m, client, 'inv-1', 'accepted')
  assert.throws(() => pw.setInvoiceStatus(accepted, pro, 'inv-1', 'void'), code('TRANSITION_INVALID'))
  assert.equal(pw.setInvoiceStatus(accepted, client, 'inv-1', 'declined').invoices[0].status, 'declined')
})

test('appointments are formal and come from a professional; invoices freeze when the matter closes', () => {
  const m = agreed()
  assert.throws(() => pw.submitDecision(m, client, { type: 'appointment', title: 'Meet', appointment: { date: '2026-12-01' } }), code('ROLE_FORBIDDEN'))
  assert.equal(pw.submitDecision(m, client, { type: 'document_review', title: 'I read the draft' }).decisions.at(-1).status, 'pending')
  let closed = pw.issueInvoice(m, pro, { title: 'Fees', amountAud: 1200 })
  closed = pw.submitDecision(closed, pro, { type: 'handover', title: 'Done' })
  closed = pw.decide(closed, client, closed.decisions.at(-1).id, true)
  assert.throws(() => pw.setInvoiceStatus(closed, client, 'inv-1', 'accepted'), code('MATTER_CLOSED'))
})

test('CSV export escapes commas, quotes and new lines', () => {
  const m = pw.requestDocument(agreed(), pro, { title: 'Lease, "final"', note: 'two\nlines' })
  assert.equal(pw.checklistCSV(m).split('\n')[1], 'doc-1,"Lease, ""final""",needed,professional,"two')
})

test('functions never mutate the previous matter', () => {
  const before = engaged()
  const snapshot = JSON.stringify(before)
  pw.requestDocument(before, pro, { title: 'x' })
  assert.equal(JSON.stringify(before), snapshot)
})
