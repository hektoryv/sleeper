# sleeper

A Cross Sums puzzle — a simple game made to make you fall asleep.

No build step, no dependencies, no framework. Edit a file, reload the page.

## How to play

Every cell holds a digit. Each row and column has a **target**. Decide, for every
cell, whether to keep it or cross it out, so that the kept cells in each line add
up to exactly that line's target.

A clue tile shows two numbers: the large one is the target, and the small one in
the corner is how much the *undecided* cells still owe once the cells you have
already circled are subtracted. The tile fades out once its line is fully decided.

The toggle at the bottom picks what a tap does — cross out, or circle as kept.
You get three hearts; a tap that contradicts the solution costs one and is not
applied, so the board on screen is always a correct partial solution.

## Appearance

The ⋮ button opens sliders for the size and brightness of the board numbers, the
targets, and the small "still needed" number, plus one for everything else —
tiles, borders, buttons and hearts. The defaults are deliberately dim; the point
is to find the darkest setting you can still read in a dark room.

Every one of them is a CSS custom property written onto `:root`, so the board
updates live underneath the sheet as you drag. Settings persist in
`localStorage` and are clamped back into range on load, so a stored value from
an older version can never leave the board unreadable.

## Running it

```sh
npm start            # serves on http://localhost:8080 (python3 -m http.server)
npm test             # engine + game-rule tests, via node --test
```

Any static file server works — there is nothing to compile. ES modules need
`http://`, so opening `index.html` from the filesystem will not work.

On Android, open the served page in Chrome and choose *Add to Home Screen*. The
service worker caches everything, so it runs full-screen and offline after that.
It uses a stale-while-revalidate strategy: pages are served from the cache
immediately and refreshed in the background, so a new version is picked up the
next time the app is opened — no reinstall, and no version string to bump.
(Obtainium installs APKs from GitHub Releases, which a PWA does not produce — if
you want that route later, a Bubblewrap/TWA wrapper can build an APK from this
same codebase.)

## How the puzzles are made

The interesting part is in `src/engine.js`. A board is only any good if it has
**exactly one** answer *and* can be reached by reasoning rather than guessing, so
generation is random-then-test against two solvers:

- **`countSolutions`** — the exact solver. For each row it enumerates the subsets
  of cells summing to that row's target (2⁸ masks, brute force is fine at this
  size), then searches across rows carrying running column sums, discarding a
  candidate the moment a column would overshoot its target or could no longer
  reach it with the rows that remain. It stops at two solutions, because all we
  need to know is whether the answer is unique.

- **`deduce`** — the reasoning solver, which is what makes a board *fair*. Each
  row and column keeps the list of subsets that could still be its answer. Filter
  that list by what is already decided, then look across what survives: a cell
  kept by every surviving candidate must be kept, a cell kept by none must be
  removed. Repeat to a fixpoint. If all 64 cells resolve, a human can get there
  by reasoning alone, with no guessing.

`generate` throws random boards at both filters until one passes. About 45% of
random boards survive, at well under a millisecond each, so a guaranteed-good
board costs a couple of milliseconds — no pre-generated puzzle pack needed.

The number of propagation rounds `deduce` needs is a decent difficulty signal,
and `grade` turns it into the label shown above the board.

## Layout

```
index.html              markup shell
style.css               dark theme, sized for one thumb
src/engine.js           RNG, solvers, generation, difficulty
src/game.js             marks, hearts, per-line clue arithmetic
src/settings.js         appearance sliders, persisted to localStorage
src/ui.js               DOM rendering and input
src/main.js             wiring
test/engine.test.js     engine and game-rule tests
test/settings.test.js   appearance clamping
scripts/make-icons.mjs  regenerates the PNG icons (node:zlib, no deps)
sw.js                   offline cache, stale-while-revalidate
```

## Things not built yet

Hints, difficulty selection, numbered levels, saved progress. The engine already
exposes `grade` and seeded generation, so levels and difficulty tiers can be
layered on without reworking it.
