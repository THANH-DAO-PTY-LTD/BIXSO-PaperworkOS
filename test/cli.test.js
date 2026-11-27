import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const bin = fileURLToPath(new URL('../bin/paperworkos.js', import.meta.url))

test('CLI runs a matter from invite to paid invoice and refuses the wrong person', () => {
  const env = { ...process.env, PAPERWORKOS_HOME: mkdtempSync(join(tmpdir(), 'paperwork-os-')) }
  const cli = (...args) => execFileSync(process.execPath, [bin, ...args], { env, encoding: 'utf8' })
  cli('new', 'lease', '--client', 'Mai', '--title', 'Lease renewal')
  cli('invite', 'lease', 'Jordan', '--as', 'client:Mai')
  cli('accept', 'lease', 'Jordan')
  cli('submit', 'lease', 'proposal', 'Lease review', '--amount', '900', '--as', 'professional:Jordan')
  assert.throws(() => cli('decide', 'lease', 'dec-1', 'approve', '--as', 'client:Someone'), (e) => /NOT_OWNER/.test(e.stderr))
  assert.match(cli('decide', 'lease', 'dec-1', 'approve', '--as', 'client:Mai'), /Approved/)
  cli('invoice', 'lease', 'issue', 'Fees', '--amount', '900', '--as', 'professional:Jordan')
  cli('invoice', 'lease', 'status', 'inv-1', 'accepted', '--as', 'client:Mai')
  assert.throws(() => cli('invoice', 'lease', 'status', 'inv-1', 'paid', '--as', 'client:Mai'), (e) => /ROLE_FORBIDDEN/.test(e.stderr))
  cli('invoice', 'lease', 'status', 'inv-1', 'paid', '--as', 'professional:Jordan')
  assert.match(cli('export', 'lease', 'invoices'), /inv-1,Fees,900,paid,Jordan/)
  assert.match(cli('show', 'lease'), /agreed A\$900 \(v1\)/)
  assert.throws(() => cli('show', '../x'), (e) => /Matter ids/.test(e.stderr))
})
