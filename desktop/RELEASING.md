# Releasing the desktop app (GitHub Releases)

Installers are built by GitHub Actions and attached to a **draft** release, so nothing is public until you
publish it. No installer binaries are committed to git.

## Cut a release

1. Test locally first: `npm run desktop:dev` (Windows, macOS and Linux; no extra tools needed).
2. Bump `version` in `desktop/package.json` (e.g. `2.3.0`) and commit it to `main`.
3. Tag and push the tag. The tag **must** equal `v` + the package version, or the workflow stops with a clear error:
   ```
   git tag v2.3.0
   git push origin v2.3.0
   ```
4. Watch **Actions → Release desktop app**. It builds Windows and macOS in parallel (about 5–10 minutes).
5. Open **Releases**. You'll find a draft `v2.3.0` with the installers attached. Download one, install it, check it.
6. Write the release notes and click **Publish release**.

You can also run the workflow by hand (Actions → Run workflow) to check that the build works without tagging.

## Stable download links

The website's Download button goes through `/api/download/windows` (and `/windows-portable`). That route looks up the
newest **published** release on GitHub and redirects to the installer. If there is no published release yet it sends the
visitor to the Releases page, so the button can never serve a broken file. Installers are never stored in git or in the
Vercel deployment.

## Code signing (Windows)

Builds are **unsigned** today, so Windows SmartScreen says "Windows protected your PC" until the user clicks
*More info -> Run anyway*. The workflow signs automatically as soon as these repository secrets exist
(Settings -> Secrets and variables -> Actions):

- `WIN_CSC_LINK`: the `.pfx` certificate, base64-encoded (`certutil -encode cert.pfx cert.b64` on Windows)
- `WIN_CSC_KEY_PASSWORD`: its password

Ways to get a certificate (check current prices and rules before buying):

| Option | Cost | Notes |
|---|---|---|
| **SignPath Foundation** | Free for qualifying open-source projects | Apply at signpath.org. Needs a genuinely open-source project with an OSI licence file (this repo has none yet; only `"license": "MIT"` in `desktop/package.json`). Signing happens through their GitHub Action, not a `.pfx`, so the workflow needs a SignPath step instead of the secrets above. |
| **OV certificate** from a certificate authority | Paid, yearly | Works for individuals in any country. Many CAs now ship the key on a hardware token or a cloud service, which changes how CI signs, so ask the CA about CI/cloud signing before buying. |
| **EV certificate** | Paid, more expensive | Removes the SmartScreen warning immediately. OV certificates build reputation over time. |
| **Microsoft Artifact Signing** (formerly Trusted Signing) | Paid Azure subscription | Individual developers only in the USA and Canada (organisations in the USA, Canada, EU and UK). |

Signing removes the "unknown publisher" label; SmartScreen reputation for a new OV certificate still takes a while to build.

macOS needs an Apple Developer account (paid yearly) for signing and notarization. Until then the macOS build is not offered
on the website.

## Good to know

- **No auto-update yet.** Nothing in the app checks for new versions (no `electron-updater`).
- **Private repos.** If the repo ever goes private, anonymous visitors can't download release files.
