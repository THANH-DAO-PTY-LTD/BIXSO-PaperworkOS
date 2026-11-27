// A fictional café owner renewing a shop lease with a professional's help.
// Shows who may do what, and what the record refuses. Run: npm run demo
import * as pw from '../src/matter.js'

const owner = { role: 'client', name: 'Mai' }
const pro = { role: 'professional', name: 'Jordan' }
let m = pw.createMatter({ id: 'demo-lease', title: 'Café lease renewal', client: 'Mai' })

function step(label, fn) {
  try {
    m = fn(m)
    console.log(`✓ ${label.padEnd(48)} ${pw.stageLabel(m.stage)}`)
  } catch (e) {
    console.log(`✗ ${label.padEnd(48)} ${e.code}`)
  }
}

step('Mai invites Jordan', (x) => pw.inviteProfessional(x, owner, 'Jordan'))
step('Jordan accepts', (x) => pw.respondToInvite(x, 'Jordan', true))
step('Mai tries to submit the proposal herself', (x) => pw.submitDecision(x, owner, { type: 'proposal', title: 'Fees', amountAud: 900 }))
step('Jordan proposes fixed fees of A$900', (x) => pw.submitDecision(x, pro, { type: 'proposal', title: 'Review lease and negotiate renewal', amountAud: 900 }))
step('Jordan tries to approve it', (x) => pw.decide(x, pro, 'dec-1', true))
step('Mai approves the proposal', (x) => pw.decide(x, owner, 'dec-1', true))
step('Jordan asks for the current lease', (x) => pw.requestDocument(x, pro, { title: 'Current lease and all variations' }))
step('Jordan asks for the landlord offer', (x) => pw.requestDocument(x, pro, { title: 'Landlord renewal offer' }))
step('Mai adds drafts of both', (x) => pw.setDocumentStatus(pw.setDocumentStatus(x, owner, 'doc-1', 'drafted'), owner, 'doc-2', 'drafted'))
step('Mai tries to mark the lease final unreviewed', (x) => pw.setDocumentStatus(x, owner, 'doc-1', 'final'))
step('Jordan reviews both', (x) => pw.setDocumentStatus(pw.setDocumentStatus(x, pro, 'doc-1', 'reviewed'), pro, 'doc-2', 'reviewed'))
step('Jordan invoices A$1,100', (x) => pw.issueInvoice(x, pro, { title: 'Lease renewal fees', amountAud: 1100 }))
step('Jordan invoices the agreed A$900', (x) => pw.issueInvoice(x, pro, { title: 'Lease renewal fees', amountAud: 900 }))
step('Mai accepts the invoice', (x) => pw.setInvoiceStatus(x, owner, 'inv-1', 'accepted'))
step('Mai records a transfer claim', (x) => pw.setInvoiceStatus(x, owner, 'inv-1', 'transfer_claimed', { amountAud: 900, reference: 'CAFE-0042' }))
step('Mai tries to mark it paid', (x) => pw.setInvoiceStatus(x, owner, 'inv-1', 'paid'))
step('Jordan reconciles it as paid', (x) => pw.setInvoiceStatus(x, pro, 'inv-1', 'paid'))
step('Jordan starts final review', (x) => pw.moveToReview(x, pro))
step('Jordan submits the handover', (x) => pw.submitDecision(x, pro, { type: 'handover', title: 'Renewal documents handed over' }))
step('Mai approves handover with drafts open', (x) => pw.decide(x, owner, 'dec-2', true))
step('Mai marks both documents final', (x) => pw.setDocumentStatus(pw.setDocumentStatus(x, owner, 'doc-1', 'final'), owner, 'doc-2', 'final'))
step('Mai approves handover', (x) => pw.decide(x, owner, 'dec-2', true))

console.log(`\n${m.timeline.length} timeline entries. Checklist export:\n${pw.checklistCSV(m)}`)
