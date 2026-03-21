# Find The Chord

A modular, dark-mode web app for exploring chord choices in a key/mode, with playback and a piano visualizer.

- **UI**: Tailwind CSS (CDN) + custom CSS in `styles.css`
- **Logic**: JavaScript in `app.js` (loaded as ES module)
- **Theory engine**: Tonal (browser bundle via CDN + runtime fallback)
- **Audio**: Tone.js PolySynth with a soft “electric piano-ish” patch

---

## Run it

### Option A: Open the file (quickest)

1. Open `index.html` in a modern browser (Chrome/Edge/Firefox).
2. Click **Enable Audio** (or click anywhere once, then try again) to unlock sound.

> Note: This app loads libraries from CDNs. If your network blocks them, chord generation/audio may not work until you switch networks or allow those CDNs.

### Option B: Serve it locally (recommended)

Some browsers apply stricter rules when opening files via `file://`. Serving locally avoids that and makes debugging easier.

From the project folder:

**PowerShell (Python installed):**

```powershell
python -m http.server 5173
```

Then open:
- `http://localhost:5173/`

---

## How to use

### Selector (top controls)

- **Root Note**: choose the key center (e.g. `C`, `F#`)
- **Scale**: `Major`, `Minor`, `Mixolydian`, `Dorian`

Triads / 7ths / 9ths for the **suggestion grids** are chosen with **Color** (Triad / 7th / 9th) in the Explore card.

**Voicing** (below Color) controls how chords sound when you play the current chord or the progression (when Voice-lead is off): **Spread** (wide, default), **Close** (compact root position), **1st / 2nd / 3rd inv** (bass on successive chord tones), **Drop-2** (jazz-style; for triads the middle voice is dropped an octave).

The **Scale Notes** row shows the active scale tones.

### Explore (single card)

One card with **current chord + Color** on top and the **chord suggestion grid** below (same border, divided by a subtle line).

- **Add to Progression**: adds the **current chord** to your progression.
- **Chord suggestions**: tabbed grids (**Diatonic**, **Smooth Subs**, **Harmonic Spice**).

### Progression (separate card)

Build your row with **← / →**, **×**, **Clear**, **Play**, BPM, voice-lead, copy, loop, metronome, undo/redo.

#### History (automatic)

Logs the last **5** chords you clicked anywhere in the app so you can see what you’ve been trying. Click a history item to recall/replay it.

### Piano visualizer

The on-screen keyboard highlights the pitch classes in the current chord.

---

## Audio notes

- Browsers require a **user gesture** before audio starts.
- If nothing plays, click **Enable Audio** and then try again.

---

## Troubleshooting

### “No chords populate”

This usually means **Tonal didn’t load** (blocked CDN / offline).

Try:
- Refresh (Ctrl+F5)
- Switch networks (e.g. home vs corporate)
- Use the **Diagnostics** button at the bottom of the page to see whether Tonal/Tone loaded

### Audio works, but chord engine doesn’t

Tone.js and Tonal.js load separately. It’s possible your network blocks one CDN but not the other.

### No sound on iPhone / iPad (Safari), even after “Enable Audio”

Some iOS devices or versions are stricter about when the browser allows Web Audio to start. The app is written so that audio is unlocked in the same touch as the button (which helps on many devices). If it still doesn’t work:

- **Tap “Enable Audio” once**, then try playing a chord. Avoid tapping elsewhere first.
- Turn **Low Power Mode** off and try again.
- Try with the device **ringer/side switch set to sound on** (not silent).
- Close other tabs and apps, then reload the page and tap “Enable Audio” again.
- If you recently had no internet or the tab in the background, do a full reload and tap “Enable Audio” on the freshly loaded page.

If it works on one iPhone but not another, it’s often due to different iOS versions or Low Power Mode. There’s no extra install required; it’s all browser-based.

---

## Publish on GitHub Pages

If you want this hosted as a simple website:

1. Create a GitHub repo (any name)
2. Commit and push this folder (include `index.html`, `app.js`, and `styles.css`)
3. In GitHub: **Settings → Pages**
4. Source: **Deploy from a branch**
5. Branch: `main` (or `master`), folder: `/ (root)`

After a minute, your site will be available at your GitHub Pages URL.

---

## Project structure

- **index.html** — Markup, CDN links (Tailwind, Tonal, Tone.js), and `<script type="module" src="./app.js"></script>`. No build step.
- **app.js** — All application logic (selectors, workbench, progression, suggestions, piano, history, audio). Loaded as an ES module.
- **styles.css** — Custom styles (piano layout, mobile tweaks, etc.). Linked from `index.html`.
- **README.md** — This guide.

