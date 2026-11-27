#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import * as pw from '../src/matter.js'

const HELP = `PaperworkOS: one shared record of a matter between a client and their professionals

Usage
  paperworkos new <id> --client NAME [--title TEXT]
  paperworkos invite <id> <professional> --as client:NAME
  paperworkos accept <id> <professional>            (or: decline)
  paperworkos doc <id> request <title> [--note TEXT] --as ROLE:NAME
  paperworkos doc <id> status <doc-id> <${pw.DOC_STATUSES.join('|')}> --as ROLE:NAME
  paperworkos submit <id> <${pw.DECISION_TYPES.map((t) => t.id).join('|')}> <title> [--amount N] [--date D] --as ROLE:NAME
  paperworkos decide <id> <decision-id> approve|decline --as client:NAME
  paperworkos review <id> --as professional:NAME
  paperworkos invoice <id> issue <title> --amount N [--due DATE] --as professional:NAME
  paperworkos invoice <id> status <invoice-id> <status> [--amount N --reference R --date D] --as ROLE:NAME
  paperworkos export <id> checklist|invoices
  paperworkos show <id>

Matters are saved in .paperwork-os/<id>.json (or PAPERWORKOS_HOME).
PaperworkOS keeps records. It does not sign documents, hold money or give legal or financial advice.
Use fictional records.`

function parse(argv) {
  const args = { _: [] }
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i]
    if (!a.startsWith('--')) { args._.push(a); continue }
    const value = argv[i + 1]
    if (value === undefined || value.startsWith('--')) { args[a.slice(2)] = true; continue }
    args[a.slice(2)] = value
    i += 1
  }
  return args
}

const home = () => process.env.PAPERWORKOS_HOME || join(process.cwd(), '.paperwork-os')
function fileFor(id) {
  if (!/^[a-zA-Z0-9_.-]{1,80}$/.test(id || '')) throw new Error('Matter ids use letters, numbers, dot, dash or underscore')
  return join(home(), `${id}.json`)
}
function load(id) {
  if (!existsSync(fileFor(id))) throw new Error(`No matter ${id}. Run paperworkos new ${id} --client NAME`)
  const matter = JSON.parse(readFileSync(fileFor(id), 'utf8'))
  if (matter.format !== pw.FORMAT) throw new Error(`Unsupported matter format: ${matter.format || 'missing'}`)
  return matter
}
function save(matter) {
  const file = fileFor(matter.id)
  mkdirSync(home(), { recursive: true })
  const temp = `${file}.${process.pid}.tmp`
  writeFileSync(temp, `${JSON.stringify(matter, null, 2)}\n`)
  renameSync(temp, file)
}
function who(args) {
  const m = /^(client|professional):(.+)$/.exec(args.as || '')
  if (!m) throw new Error('--as must look like client:NAME or professional:NAME')
  return { role: m[1], name: m[2] }
}

function main() {
  const args = parse(process.argv.slice(2))
  const [command, id, ...rest] = args._
  if (!command || command === 'help' || args.help) return console.log(HELP)

  if (command === 'new') {
    if (existsSync(fileFor(id))) throw new Error(`Matter ${id} already exists`)
    const m = pw.createMatter({ id, title: args.title, client: args.client })
    save(m)
    return console.log(`Opened ${m.id} for ${m.client}`)
  }

  let m = load(id)
  if (command === 'invite') m = pw.inviteProfessional(m, who(args), rest[0])
  else if (command === 'accept' || command === 'decline') m = pw.respondToInvite(m, rest[0], command === 'accept')
  else if (command === 'doc' && rest[0] === 'request') m = pw.requestDocument(m, who(args), { title: rest[1], note: args.note })
  else if (command === 'doc' && rest[0] === 'status') m = pw.setDocumentStatus(m, who(args), rest[1], rest[2])
  else if (command === 'submit') m = pw.submitDecision(m, who(args), { type: rest[0], title: rest[1], amountAud: args.amount, appointment: args.date ? { date: args.date, time: args.time, mode: args.mode } : null })
  else if (command === 'decide') m = pw.decide(m, who(args), rest[0], rest[1] === 'approve')
  else if (command === 'review') m = pw.moveToReview(m, who(args))
  else if (command === 'invoice' && rest[0] === 'issue') m = pw.issueInvoice(m, who(args), { title: rest[1], amountAud: args.amount, dueDate: args.due })
  else if (command === 'invoice' && rest[0] === 'status') m = pw.setInvoiceStatus(m, who(args), rest[1], rest[2], { amountAud: args.amount, reference: args.reference, date: args.date })
  else if (command === 'export') return console.log(rest[0] === 'invoices' ? pw.invoicesCSV(m) : pw.checklistCSV(m))
  else if (command === 'show') {
    console.log(`${m.id} · ${m.title} · ${pw.stageLabel(m.stage)}${m.status === 'closed' ? ' (closed)' : ''}`)
    console.log(`client ${m.client} · team ${m.team.join(', ') || '-'}${m.agreement ? ` · agreed A$${m.agreement.amount_aud} (v${m.agreement.version})` : ''}`)
    for (const d of m.checklist) console.log(`  doc ${d.id} [${d.status}] ${d.title}`)
    for (const d of m.decisions) console.log(`  decision ${d.id} [${d.status}] ${d.type} v${d.version}: ${d.title}`)
    for (const i of m.invoices) console.log(`  invoice ${i.id} [${i.status}] A$${i.amount_aud} ${i.title}`)
    return
  } else throw new Error(`Unknown command ${command}. Run paperworkos help`)
  save(m)
  console.log(m.timeline.at(-1).summary)
}

try {
  main()
} catch (error) {
  console.error(error.code ? `${error.code}: ${error.message}` : error.message)
  process.exit(1)
}
