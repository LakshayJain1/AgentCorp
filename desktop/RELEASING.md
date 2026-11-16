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

Installer names have no version in them, so these links always point at the newest published release:

| File | Link |
|---|---|
| Windows installer | `https://github.com/LakshayJain1/AgentCorp/releases/latest/download/AgentCorp-Setup.exe` |
| Windows portable | `https://github.com/LakshayJain1/AgentCorp/releases/latest/download/AgentCorp-Portable.exe` |
| macOS | `https://github.com/LakshayJain1/AgentCorp/releases/latest/download/AgentCorp.dmg` |

Point the buttons in `src/app/download/page.tsx` at these **after** the first release is published. Until then
the page keeps serving `public/downloads/`, so the download buttons never break.

## Good to know

- **Unsigned builds.** There's no code-signing certificate yet. Windows SmartScreen shows "unknown publisher"
  and macOS Gatekeeper may block the app until the user right-clicks → Open. Signing needs a paid certificate
  (Windows) and an Apple Developer account (macOS).
- **No auto-update yet.** Nothing in the app checks for new versions (no `electron-updater`). The download page's
  "Auto-updates" line isn't true until that's added. The `publish` config here is the groundwork for it.
- **Private repos.** If the repo ever goes private, anonymous visitors can't download release files.
