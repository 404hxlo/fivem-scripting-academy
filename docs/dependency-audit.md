# Dependency review — 18 November 2026

This review records the npm dependency tree audited for version 1.0.0. The SHA-256 of the reviewed `package-lock.json` was `4EBCCDADD710925A4C35D7A8FE0F30553C505C73C58F38FA2EA7DE9B12011716`.

## Changes

- Upgraded Vitest from 3.2.7 to 4.1.12, compatible with the installed Node 24 and Vite 6. This updates `@vitest/mocker` to 4.1.12 and removes `tinypool` from the resolved tree. The relevant advisories are [mock redirect traversal](https://github.com/vitest-dev/vitest/security/advisories/GHSA-82fw-gwwq-j7x9), [manual mock code injection](https://github.com/vitest-dev/vitest/security/advisories/GHSA-qxg6-89mg-rqv8), and tinypool's [worker-options](https://github.com/advisories/GHSA-5gmw-xhrv-c9v3) and [run-options](https://github.com/tinylibs/tinypool/security/advisories/GHSA-85c8-ppgw-ccpr) prototype-pollution gadgets.
- Overrode only minimatch versions in `>=7.0.0 <11.0.1` with 11.0.9. This replaces the affected 9.0.9 and 10.2.6 copies while retaining the older callable APIs used by other packaging dependencies. It addresses [globparts amplification](https://github.com/advisories/GHSA-g3hv-75wg-m249) and avoids selecting the early 11.x releases affected by subsequent denial-of-service reports. Electron Builder remains at 26.18.0.

## Remaining report

`npm audit` reports **0 critical, 0 moderate, and 11 high dependency entries**. All 11 entries are the same underlying [picomatch advisory, GHSA-fc5q-39xc-vjpf](https://github.com/advisories/GHSA-fc5q-39xc-vjpf), propagated through development and packaging tools. The npm registry's latest published picomatch version is still 4.0.7; no fixed version was available during this review. Its [upstream issue](https://github.com/micromatch/picomatch/issues/247) contains discussion disputing the report and a comment about a Snyk revocation, but npm continues to flag it. This review does not dismiss the advisory or claim it is fixed.

The reported path concerns tools processing untrusted glob patterns. This app's Vite, Vitest, and packaging globs come from the local developer configuration. Student resource code runs in the separate Lua sandbox; it is not passed to these development tools. Do not expose development/test servers or execute untrusted project tooling. Recheck the advisory and registry when updating the toolchain.

`npm audit --omit=dev` reports **0 vulnerabilities**. The packaged Node dependency is fflate. React, Monaco, Wasmoon and other frontend libraries are compiled into the bundled renderer; their presence is not erased by classifying the build inputs as devDependencies. The remaining audit advisory is for picomatch, which is not bundled as a student-code execution dependency. A zero npm audit result is not a comprehensive security certification.

## Verification

The resolved dependency tree contains no tinypool, mocker is 4.1.12, affected minimatch copies are 11.0.9, and `npm ls minimatch --all` reports no invalid dependencies. All **186 tests in 6 files passed** with Vitest 4.1.12, and the production frontend build passed. A focused check of Electron Builder's actual `FileMatcher` confirmed that the configured renderer, backend, icon, and package metadata remain included while test files remain excluded with minimatch 11.0.9. Release packaging and installed-app acceptance are documented separately in the main project README.

Avoid `npm audit fix --force`: the current suggestions include downgrades that would undo these fixes. Future changes should preserve the older minimatch APIs needed by packaging dependencies and rerun the test suite, production build, and installer checks.
