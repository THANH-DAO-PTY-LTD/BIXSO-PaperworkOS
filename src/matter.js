// A paperwork matter shared by a client and the professionals helping them.
// The client owns the matter and makes every decision. Professionals submit
// proposals, request documents and issue invoices. Everything is a record:
// nothing here signs a document, holds money or gives advice.
// Functions return a new matter and leave the previous one unchanged.

export const FORMAT = 'paperwork-os/matter'
export const ROLES = ['client', 'professional']

export const STAGES = [
  { id: 'intake', label: 'Intake', who: 'client' },
  { id: 'finding_help', label: 'Finding a professional', who: 'client' },
  { id: 'engaged', label: 'Professional engaged', who: 'both' },
  { id: 'in_progress', label: 'Preparing together', who: 'both' },
  { id: 'review', label: 'Final review', who: 'professional' },
  { id: 'closed', label: 'Closed', who: 'both' },
]
export const stageIndex = (id) => STAGES.findIndex((s) => s.id === id)
export const stageLabel = (id) => STAGES.find((s) => s.id === id)?.label || id

export const DECISION_TYPES = [
  { id: 'proposal', label: 'Proposal / quote', hint: 'Approval creates the agreement record.' },
  { id: 'engagement', label: 'Engagement terms', hint: 'Scope and terms sign-off, as a record.' },
  { id: 'appointment', label: 'Appointment', hint: 'Date, time and format become a shared booking record.' },
  { id: 'milestone', label: 'Milestone', hint: 'A stage of the matter is done; the client confirms.' },
  { id: 'document_review', label: 'Document reviewed', hint: 'A shared document has been reviewed.' },
  { id: 'handover', label: 'Final handover', hint: 'Approval closes the matter.' },
]
const FORMAL = new Set(['proposal', 'engagement', 'handover', 'document_review'])

export const DOC_STATUSES = ['needed', 'drafted', 'shared', 'reviewed', 'final']
// Who may move a checklist item into each status.
const DOC_MOVES = {
  needed: ['client', 'professional'],
  drafted: ['client', 'professional'],
  shared: ['client', 'professional'],
  reviewed: ['professional'],
  final: ['client'],
}

export const INVOICE_STATUSES = ['issued', 'accepted', 'transfer_claimed', 'paid', 'declined', 'void']
// from → to → role allowed. A client's transfer claim is never treated as payment;
// only the issuing professional reconciles it to paid.
const INVOICE_MOVES = {
  issued: { accepted: 'client', declined: 'client', void: 'issuer' },
  accepted: { transfer_claimed: 'client', paid: 'issuer', void: 'issuer' },
  transfer_claimed: { paid: 'issuer', accepted: 'issuer' },
  paid: {},
  declined: {},
  void: {},
}

export class MatterError extends Error {
  constructor(code, message) { super(message); this.code = code }
}

const clone = (value) => JSON.parse(JSON.stringify(value))
const stamp = (at) => new Date(at || Date.now()).toISOString()
const text = (value, max = 2000) => String(value ?? '').trim().slice(0, max)

function actor(matter, who) {
  if (!who || !ROLES.includes(who.role)) throw new MatterError('ROLE_UNKNOWN', `Role must be one of ${ROLES.join(', ')}`)
  if (!who.name) throw new MatterError('ACTOR_REQUIRED', 'Name the person acting')
  if (who.role === 'client' && who.name !== matter.client) throw new MatterError('NOT_OWNER', 'Only the client who owns the matter acts as client')
  if (who.role === 'professional' && !matter.team.includes(who.name)) throw new MatterError('NOT_ON_TEAM', 'This professional is not engaged on the matter')
  return who
}

function log(matter, who, kind, summary, at) {
  matter.timeline.push({ at: stamp(at), by: who?.name || 'system', role: who?.role || 'system', kind, summary })
  matter.updatedAt = stamp(at)
}

export function createMatter({ id, title, client, at } = {}) {
  if (!id || !/^[a-zA-Z0-9_.-]{1,80}$/.test(id)) throw new MatterError('ID_INVALID', 'Matter ids use letters, numbers, dot, dash or underscore')
  if (!client) throw new MatterError('CLIENT_REQUIRED', 'A matter needs a client')
  const created = stamp(at)
  return {
    format: FORMAT, version: 1, id, title: text(title || id, 200), client: text(client, 160),
    stage: 'intake', status: 'open', team: [], invites: [],
    checklist: [], decisions: [], invoices: [], agreement: null,
    timeline: [{ at: created, by: text(client, 160), role: 'client', kind: 'created', summary: 'Matter opened' }],
    createdAt: created, updatedAt: created,
  }
}

function assertOpen(matter) {
  if (matter.status === 'closed') throw new MatterError('MATTER_CLOSED', 'The matter is closed')
}

// ── Team ──────────────────────────────────────────────────────────────────
export function inviteProfessional(previous, who, name, at) {
  const matter = clone(previous)
  assertOpen(matter)
  if (who.role !== 'client') throw new MatterError('ROLE_FORBIDDEN', 'Only the client invites professionals')
  actor(matter, who)
  const invitee = text(name, 160)
  if (!invitee) throw new MatterError('INVITE_INVALID', 'Name the professional')
  if (matter.team.includes(invitee) || matter.invites.some((i) => i.name === invitee && i.status === 'pending')) throw new MatterError('INVITE_EXISTS', `${invitee} is already invited or engaged`)
  matter.invites.push({ name: invitee, status: 'pending', at: stamp(at) })
  if (matter.stage === 'intake') matter.stage = 'finding_help'
  log(matter, who, 'invite_sent', `Invited ${invitee}`, at)
  return matter
}

export function respondToInvite(previous, name, accept, at) {
  const matter = clone(previous)
  assertOpen(matter)
  const invite = matter.invites.find((i) => i.name === name && i.status === 'pending')
  if (!invite) throw new MatterError('INVITE_NOT_FOUND', `No pending invite for ${name}`)
  invite.status = accept ? 'accepted' : 'declined'
  invite.respondedAt = stamp(at)
  if (accept) {
    matter.team.push(name)
    if (stageIndex(matter.stage) < stageIndex('engaged')) matter.stage = 'engaged'
  }
  log(matter, { name, role: 'professional' }, accept ? 'invite_accepted' : 'invite_declined', `${name} ${accept ? 'joined' : 'declined'}`, at)
  return matter
}

// ── Document checklist ────────────────────────────────────────────────────
export function requestDocument(previous, who, { title, note } = {}, at) {
  const matter = clone(previous)
  assertOpen(matter)
  actor(matter, who)
  if (!text(title)) throw new MatterError('DOCUMENT_INVALID', 'A document needs a title')
  const id = `doc-${matter.checklist.length + 1}`
  matter.checklist.push({ id, title: text(title, 200), note: text(note), requestedBy: who.role, status: 'needed', history: [] })
  log(matter, who, 'document_requested', `${who.name} requested: ${text(title, 200)}`, at)
  return matter
}

export function setDocumentStatus(previous, who, id, status, at) {
  const matter = clone(previous)
  assertOpen(matter)
  actor(matter, who)
  if (!DOC_STATUSES.includes(status)) throw new MatterError('STATUS_INVALID', `Document status is one of ${DOC_STATUSES.join(', ')}`)
  const item = matter.checklist.find((d) => d.id === id)
  if (!item) throw new MatterError('DOCUMENT_NOT_FOUND', `No document ${id}`)
  if (!DOC_MOVES[status].includes(who.role)) throw new MatterError('ROLE_FORBIDDEN', `Only the ${DOC_MOVES[status].join(' or ')} can mark a document ${status}`)
  if (status === 'final' && item.status !== 'reviewed') throw new MatterError('REVIEW_REQUIRED', 'A document is reviewed before it is final')
  if (item.status === 'final') throw new MatterError('DOCUMENT_FINAL', 'A final document is not changed; request a new version')
  item.history.push({ from: item.status, to: status, by: who.name, at: stamp(at) })
  item.status = status
  log(matter, who, 'document_status', `${item.title}: ${status}`, at)
  return matter
}

// ── Decisions ─────────────────────────────────────────────────────────────
export function submitDecision(previous, who, { type, title, detail, amountAud, appointment } = {}, at) {
  const matter = clone(previous)
  assertOpen(matter)
  actor(matter, who)
  if (!DECISION_TYPES.some((t) => t.id === type)) throw new MatterError('DECISION_TYPE', `Decision type is one of ${DECISION_TYPES.map((t) => t.id).join(', ')}`)
  if (FORMAL.has(type) && who.role !== 'professional') throw new MatterError('ROLE_FORBIDDEN', `A ${type} is submitted by an engaged professional`)
  if (!text(title)) throw new MatterError('DECISION_INVALID', 'A decision needs a title')
  const amount = amountAud === undefined || amountAud === null || amountAud === '' ? null : Number(amountAud)
  if (amount !== null && !(amount > 0)) throw new MatterError('AMOUNT_INVALID', 'Amounts are positive')
  if ((type === 'proposal') && amount === null) throw new MatterError('AMOUNT_REQUIRED', 'A proposal states its amount')
  if (type === 'appointment' && !appointment?.date) throw new MatterError('APPOINTMENT_INVALID', 'An appointment needs a date')
  const version = matter.decisions.filter((d) => d.type === type).reduce((max, d) => Math.max(max, d.version), 0) + 1
  const decision = {
    id: `dec-${matter.decisions.length + 1}`, type, version, title: text(title, 200), detail: text(detail),
    amount_aud: amount, appointment: type === 'appointment' ? { date: text(appointment.date, 20), time: text(appointment.time, 20), mode: text(appointment.mode || 'online', 20) } : null,
    status: 'pending', submittedBy: who.name, submittedRole: who.role, submittedAt: stamp(at), decidedAt: null,
  }
  matter.decisions.push(decision)
  log(matter, who, 'decision_submitted', `Submitted for approval: ${decision.title}${amount ? ` (A$${amount.toLocaleString('en-AU')})` : ''}`, at)
  return matter
}

export function decide(previous, who, id, approve, at) {
  const matter = clone(previous)
  assertOpen(matter)
  if (who.role !== 'client') throw new MatterError('ROLE_FORBIDDEN', 'Only the client decides')
  actor(matter, who)
  const decision = matter.decisions.find((d) => d.id === id)
  if (!decision) throw new MatterError('DECISION_NOT_FOUND', `No decision ${id}`)
  if (decision.status !== 'pending') throw new MatterError('DECISION_CLOSED', 'This decision is already decided')
  if (approve && decision.type === 'handover') {
    const open = matter.checklist.filter((d) => d.status !== 'final')
    if (open.length) throw new MatterError('DOCUMENTS_OPEN', `${open.length} document${open.length === 1 ? ' is' : 's are'} not final yet`)
  }
  decision.status = approve ? 'approved' : 'declined'
  decision.decidedAt = stamp(at)
  if (approve && (decision.type === 'proposal' || decision.type === 'engagement')) {
    matter.agreement = {
      scope: decision.title, detail: decision.detail, amount_aud: decision.amount_aud ?? matter.agreement?.amount_aud ?? null,
      professional: decision.submittedBy, approvedAt: stamp(at), decisionId: decision.id, version: decision.version,
    }
    if (matter.stage === 'engaged') matter.stage = 'in_progress'
  }
  if (approve && decision.type === 'handover') { matter.stage = 'closed'; matter.status = 'closed' }
  log(matter, who, 'decision_decided', `${approve ? 'Approved' : 'Declined'}: ${decision.title}`, at)
  return matter
}

// ── Stage ─────────────────────────────────────────────────────────────────
export function moveToReview(previous, who, at) {
  const matter = clone(previous)
  assertOpen(matter)
  if (who.role !== 'professional') throw new MatterError('ROLE_FORBIDDEN', 'An engaged professional starts the final review')
  actor(matter, who)
  if (matter.stage !== 'in_progress') throw new MatterError('STAGE_INVALID', 'Final review follows the in-progress stage')
  const pending = matter.decisions.filter((d) => d.status === 'pending' && d.type !== 'handover')
  if (pending.length) throw new MatterError('DECISIONS_PENDING', `${pending.length} decision${pending.length === 1 ? ' is' : 's are'} still waiting`)
  matter.stage = 'review'
  log(matter, who, 'stage_changed', 'Stage moved to "Final review"', at)
  return matter
}

// ── Invoices (records only) ───────────────────────────────────────────────
export function issueInvoice(previous, who, { title, amountAud, dueDate } = {}, at) {
  const matter = clone(previous)
  assertOpen(matter)
  if (who.role !== 'professional') throw new MatterError('ROLE_FORBIDDEN', 'Invoices are issued by an engaged professional')
  actor(matter, who)
  const agreed = Number(matter.agreement?.amount_aud)
  const amount = Number(amountAud)
  if (!(agreed > 0)) throw new MatterError('NO_AGREEMENT', 'An invoice needs an approved proposal with an amount')
  if (!text(title) || !(amount > 0)) throw new MatterError('INVOICE_INVALID', 'An invoice needs a title and a positive amount')
  if (amount !== agreed) throw new MatterError('AMOUNT_MISMATCH', 'The invoice amount must match the approved proposal. Submit and approve a new proposal version first.')
  const invoice = { id: `inv-${matter.invoices.length + 1}`, title: text(title, 200), amount_aud: amount, due_date: dueDate ? text(dueDate, 20) : null, status: 'issued', issuer: who.name, proposalDecisionId: matter.agreement.decisionId, history: [], issuedAt: stamp(at) }
  matter.invoices.push(invoice)
  log(matter, who, 'invoice_issued', `Invoice ${invoice.id}: A$${amount.toLocaleString('en-AU')}`, at)
  return matter
}

export function setInvoiceStatus(previous, who, id, status, evidence = {}, at) {
  const matter = clone(previous)
  actor(matter, who)
  const invoice = matter.invoices.find((i) => i.id === id)
  if (!invoice) throw new MatterError('INVOICE_NOT_FOUND', `No invoice ${id}`)
  if (!INVOICE_STATUSES.includes(status)) throw new MatterError('STATUS_INVALID', `Invoice status is one of ${INVOICE_STATUSES.join(', ')}`)
  const allowed = INVOICE_MOVES[invoice.status][status]
  if (!allowed) throw new MatterError('TRANSITION_INVALID', `An invoice cannot move from ${invoice.status} to ${status}`)
  const permitted = allowed === 'issuer' ? (who.role === 'professional' && who.name === invoice.issuer) : who.role === allowed
  if (!permitted) throw new MatterError('ROLE_FORBIDDEN', allowed === 'issuer' ? 'Only the issuing professional can do that' : `Only the ${allowed} can do that`)
  if (status === 'transfer_claimed') {
    if (!(Number(evidence.amountAud) > 0) || !text(evidence.reference)) throw new MatterError('EVIDENCE_REQUIRED', 'A transfer claim states the amount and a reference')
    invoice.transfer = { amount_aud: Number(evidence.amountAud), date: text(evidence.date, 20), reference: text(evidence.reference, 120) }
  }
  invoice.history.push({ from: invoice.status, to: status, by: who.name, at: stamp(at) })
  invoice.status = status
  log(matter, who, 'invoice_updated', `Invoice ${id}: ${status}`, at)
  return matter
}

// ── Export ────────────────────────────────────────────────────────────────
const csvCell = (val) => {
  if (val === null || val === undefined) return ''
  const s = String(val)
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}
export const toCSV = (headers, rows) => [headers, ...rows].map((r) => r.map(csvCell).join(',')).join('\n')

export function checklistCSV(matter) {
  return toCSV(['id', 'title', 'status', 'requested_by', 'note'], matter.checklist.map((d) => [d.id, d.title, d.status, d.requestedBy, d.note]))
}
export function invoicesCSV(matter) {
  return toCSV(['id', 'title', 'amount_aud', 'status', 'issuer', 'due_date', 'issued_at'], matter.invoices.map((i) => [i.id, i.title, i.amount_aud, i.status, i.issuer, i.due_date, i.issuedAt]))
}
