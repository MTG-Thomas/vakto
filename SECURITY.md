# Security policy

## Reporting a vulnerability

Do not report security vulnerabilities through a public issue, pull request, or
discussion. Use GitHub's private vulnerability reporting instead:

**[Report a vulnerability privately](https://github.com/MTG-Thomas/vakto/security/advisories/new)**

That starts a private advisory with the maintainers. Include:

- what the vulnerability is and its potential impact
- steps to reproduce, or a proof of concept
- affected versions or commit range
- any mitigation you have already identified

We will acknowledge within a few days and keep you informed while we work on a
fix. Please give us reasonable time before public disclosure, and do not access
or modify data that is not yours.

## Where the risk is

vakto holds credentials that can act on repositories, so the interesting assets
are:

- **Board credentials** — a token that can label, comment, and move items.
- **Transport credentials** — a webhook URL that both identifies the endpoint and
  authorises delivery. Treat the whole URL as a secret, not just a token within
  it.
- **Ledger contents** — leases and wake records describing live work.

Two consequences worth knowing when you evaluate a report:

1. A leaked trigger URL lets someone start a supervisor turn. The supervisor
   must therefore verify the sender's signature before acting and must reconcile
   from the board rather than obeying the payload, so a forged turn can, at
   worst, cause a redundant reconciliation.
2. Authority is bounded by configuration: an allowlist of repositories, no merge
   permission, and no board-schema changes. A report showing any of those
   boundaries can be crossed is a valid vulnerability.

## Supported versions

Pre-release. There are no tagged releases yet; `main` is the only supported
version and it is supported on a best-effort basis.
