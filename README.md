# RYS — Remove YouTube Suggestions
#### A Browser Extension

---

### What it does
A browser extension that lets you hide recommendations, customize the interface, and take control of your YouTube experience.

---

### Feedback and Support
Leave a review!
- [Firefox](https://addons.mozilla.org/en-US/firefox/addon/remove-youtube-s-suggestions)
- [Chrome](https://chrome.google.com/webstore/detail/remove-youtube-suggestion/cdhdichomdnlaadbndgmagohccgpejae)
- [Google Form](https://docs.google.com/forms/d/1AzQQxTWgG6M5N87jinvXKQkGS6Mehzg19XV4mjteTK0/edit)

Free to use with optional [premium features](https://lawrencehook.com/rys/premium/).

---

### Why I made it
YouTube's recommendation algorithm optimizes for the most _engaging_ videos, not the ones you actually want to watch — and it's easy to lose hours to the rabbit hole. This extension lets you cut the noise and use YouTube on your own terms.

Available for download at the links below:
- [Firefox](https://addons.mozilla.org/en-US/firefox/addon/remove-youtube-s-suggestions)
- [Chrome](https://chrome.google.com/webstore/detail/remove-youtube-suggestion/cdhdichomdnlaadbndgmagohccgpejae)

---

### Development
This project is 100% open source. Created and maintained by me, [Lawrence Hook](https://lawrencehook.com).  

Have a feature request or found a bug? Feel free to create a Github issue, submit a PR, or contact me at lawrencehook@gmail.com.

```bash
git clone https://github.com/lawrencehook/remove-youtube-suggestions.git
cd remove-youtube-suggestions
npm install --global web-ext

./dev.sh firefox     # opens Firefox with the extension loaded
./dev.sh chrome      # builds dist/chrome/ — load as unpacked in chrome://extensions
```

---

### Building & Releasing

**Local build (no store, no auto-update).** Stage `src/` with the correct
per-browser manifest into `dist/`:

```bash
./chrome.sh          # → extension.zip (Chrome/Brave)
./firefox.sh         # → src/web-ext-artifacts/*.zip (Firefox, needs web-ext)
```

To install the local build in Brave/Chrome: go to `chrome://extensions`, enable
**Developer mode**, click **Load unpacked**, and select the unpacked build
directory (e.g. `dist/chrome-unpacked/`). Re-run the build and hit **reload**
after editing `src/`.

**Release pipeline.** `.github/workflows/release.yml` is **tag-triggered** — it
fires on any pushed git tag matching `v*`. On GitHub's runner it installs
`web-ext`, runs `./firefox.sh` and `./chrome.sh`, then publishes a GitHub
Release with both zips attached (`rys-firefox-<tag>.zip`, `rys-chrome-<tag>.zip`).

To cut a release:

```bash
git push origin main                 # publish your commits first
git tag v4.3.81.2                    # tag matching the manifest version
git push origin v4.3.81.2            # pushing the v* tag triggers the workflow
```

Then watch the **Actions** tab; the Release appears under **Releases** when the
job finishes.

> Note: the release job runs on GitHub's runner (`web-ext` is installed there,
> not required locally). Pushing publishes the source and the Release zips
> publicly.
