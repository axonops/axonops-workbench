# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

This file was introduced during the 0.9.x series. For changes released before it
existed, see the [GitHub releases](https://github.com/axonops/axonops-workbench/releases).

## [Unreleased]

### Security

- Resolved all 8 outstanding `npm audit` advisories (6 high, 2 moderate). Most were
  caused by `overrides` entries in `package.json` that pinned versions below the
  patched releases, so the overrides themselves were holding vulnerable code in place
  ([#1088](https://github.com/axonops/axonops-workbench/issues/1088)).
  - `js-yaml` — quadratic CPU consumption in `!!omap` resolution (GHSA-5p4m-2wfm-xmqj).
  - `brace-expansion` — denial of service via unbounded expansion (GHSA-mh99-v99m-4gvg,
    GHSA-rgw5-rvv9-x895).
  - `undici` — response desynchronization, cross-user information disclosure, CRLF
    injection and cookie attribute injection (GHSA-8xcm-r25x-g524, GHSA-4cwx-7wf7-3272,
    GHSA-m8rv-5g2x-5cg5, GHSA-jr45-8vmc-qm54, GHSA-v3r7-h72x-cjcm).
  - `dompurify` — cross-site scripting via a detached subtree left executable after
    `IN_PLACE` hook removal (GHSA-55q2-fjhq-7xh7). This also clears the advisory
    reported against `monaco-editor`, which bundles it.
  - `fast-uri` — host confusion via a backslash authority introducer (GHSA-7p8r-x3mc-p8w7).
  - `browserslist` — unbounded memory growth and a crash via untrusted custom stats
    (GHSA-c83g-rgw3-j3cx, GHSA-73wf-gq98-2v4g).
  - `electron` — sandboxed iframes could bypass the `allow-popups` restriction through
    the OpenURL navigation path (GHSA-9f4c-93c8-jc8g).

[Unreleased]: https://github.com/axonops/axonops-workbench/compare/v0.9.3...HEAD
