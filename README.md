# Find The Chord

A single-file, dark-mode web app for exploring chord choices in a key/mode, with playback and a piano visualizer.

- **UI**: Tailwind CSS (CDN)
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
- **Chord Type**:
  - **Triads**: basic 3-note diatonic chords
  - **7ths**: diatonic 7th chords
  - **9ths**: diatonic 9th chords

The **Scale Notes** row shows the active scale tones.

### Workbench

#### Current Chord

Shows:
- **Chord name**
- **Notes**
- **Roman numeral** (relative to the selected key/mode)

Buttons:
- **Play**: plays the current chord with a spread voicing (root low, other notes higher)
- **Add**: adds the current chord to your progression (user-controlled)

#### Progression (user-controlled)

Build your own chord progression (separate from History).

- **Add**: appends the current chord to the progression
- **← / →**: reorder chords
- **×**: remove a chord
- **Clear**: remove all chords
- **Play**: plays the progression with more separation between chords for clarity

#### History (automatic)

Logs the last **5** chords you clicked anywhere in the app so you can see what you’ve been trying. Click a history item to recall/replay it.

### Suggestion Engine

The grids provide different “families” of options:

- **Diatonic**: the 7 primary chords inside the selected key/mode
- **Smooth Subs**: diatonic substitutes that share **2+ notes** with other diatonic chords (captures many “relative”/mediant-type moves)
- **Harmonic Spice**:
  - **Secondary dominants** (e.g. `V/ii`, `V/V`)
  - **Borrowed chords** from the parallel major/minor (depending on mode)
  - **Tritone substitutions** of secondary dominants

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

---

## Publish on GitHub Pages

If you want this hosted as a simple website:

1. Create a GitHub repo (any name)
2. Commit and push this folder (must include `index.html`)
3. In GitHub: **Settings → Pages**
4. Source: **Deploy from a branch**
5. Branch: `main` (or `master`), folder: `/ (root)`

After a minute, your site will be available at your GitHub Pages URL.

---

## Project structure

- `index.html`: the entire app (UI + logic + audio)
- `README.md`: this guide

