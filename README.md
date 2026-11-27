# BIXSO PaperworkOS

One shared record of a paperwork matter between a client and the professionals helping them, such as a lawyer, accountant, conveyancer or agent. Everyone works from the same document checklist, decisions and invoice records, and the client stays in charge.

- **The client decides.** Professionals submit proposals, engagement terms, milestones and handovers. Only the client who owns the matter approves or declines them.
- **Documents have a clear path.** Each item moves `needed → drafted → shared → reviewed → final`. A professional reviews a document before the client can mark it final, and a final document is not edited.
- **Agreements are versioned.** Each new proposal is a new version. The agreement changes only when the client approves.
- **Invoices match what was agreed.** An invoice must equal the approved proposal. A client's "I transferred it" is recorded as a claim with a reference; only the professional who issued the invoice reconciles it to paid.
- **Handover closes the matter** only when every document on the checklist is final.
- **Every action is on the timeline**, and checklists and invoices export to CSV.

## Not advice, not a vault

PaperworkOS is a record-keeping tool. It contains no legal, tax or financial content and does not give advice. It does not create legally binding signatures, hold or move money, or verify who anyone is. Talk to a qualified professional about your situation.

## Try it

Use Node.js 22 or later. There are no dependencies to install.

```sh
npm test
npm run demo
```

The demo follows a fictional café owner renewing a shop lease, including the steps the record refuses.

Run your own matter from the command line. Matters are saved in `.paperwork-os/<id>.json` in the current folder.

```sh
node bin/paperworkos.js new lease --client Mai --title "Lease renewal"
node bin/paperworkos.js invite lease Jordan --as client:Mai
node bin/paperworkos.js accept lease Jordan
node bin/paperworkos.js submit lease proposal "Review and negotiate" --amount 900 --as professional:Jordan
node bin/paperworkos.js decide lease dec-1 approve --as client:Mai
node bin/paperworkos.js help
```

## Limits of this preview

- One computer, one file per matter, with no accounts, sharing, locking or backup. `--as` is typed, not authenticated, and anyone using the command line can accept an invite.
- Documents are tracked by title and status. Files themselves are not stored.
- Use fictional records. Do not put real client documents or personal information in this preview or in issues.

## Use it as a library

```js
import { createMatter, inviteProfessional } from './src/matter.js'
```

Every function returns a new matter and leaves the previous one unchanged.

## Help shape it

Open an [issue](https://github.com/THANH-DAO-PTY-LTD/BIXSO-PaperworkOS/issues) if a step does not match how your matters run. See [CONTRIBUTING](CONTRIBUTING.md) and the [security policy](SECURITY.md).

## License

[MIT](LICENSE) · Copyright (c) 2026 Thanh Dao Pty Ltd. See [docs/PROVENANCE.md](docs/PROVENANCE.md).
