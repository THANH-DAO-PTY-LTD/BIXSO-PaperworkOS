# Contributing

Use a GitHub issue for feedback or a bug. Include a fictional matter, the commands you ran, the result you expected and what happened. For a change to who may do what, describe the real situation it reflects.

1. Clone the repo and create a branch with `git switch -c fix/short-description`.
2. Run `npm test` and `npm run demo`.
3. Add a test that captures the behaviour, make the smallest change, and run `npm test` again.
4. Open a PR with the linked issue, a short description and your test result. The maintainer checks the change and CI before merging.

Changes that let someone other than the client decide, mark an unreviewed document final, or treat a transfer claim as payment need an issue first. This project does not accept legal, tax or regulatory content such as rules, forms or templates.

Submit only material you have the right to contribute. Contributions to this repository are provided under its [MIT license](LICENSE).

## Sign off your commits

Every commit in a pull request must be signed off. Use `git commit -s`, which adds a line like `Signed-off-by: Your Name <you@example.com>`. By signing off, you certify the [Developer Certificate of Origin 1.1](https://developercertificate.org): you wrote the change, or otherwise have the right to submit it under this project's license. A check on each pull request looks for the sign-off.

Please also follow the [code of conduct](CODE_OF_CONDUCT.md).

How decisions are made, the contributor ladder and response times: [GOVERNANCE](https://github.com/THANH-DAO-PTY-LTD/.github/blob/main/GOVERNANCE.md). Ideas without code are welcome through the **Share an idea** issue template. Direction: [ROADMAP](docs/ROADMAP.md).
