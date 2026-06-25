# TrainVision Accessibility

TrainVision targets WCAG 2.1 AA for the Operations command-center experience.

## Keyboard shortcuts

| Key | Action |
|-----|--------|
| `F` | Open Command Center fullscreen (Operations view) |
| `Esc` | Close Command Center |
| `R` | Refresh all data |
| `/` | Focus search (when available) |
| `?` | Open keyboard help |

## Landmarks and navigation

- **Skip link** — first focusable element jumps to `#main-content`
- **Header** — product title and global actions
- **Nav** — `aria-label="Main"` for Operations / Simulation / Analytics
- **Main** — primary workspace content

## Live regions

- Conflict and delay changes announce via `aria-live="polite"` (`LiveRegion`)
- System health badge uses `role="status"`

## Motion

`prefers-reduced-motion: reduce` disables pulse animations and shortens transitions (see `index.css`).

## Modals

Override and delay-warning dialogs use focus trap, `aria-modal`, and `aria-labelledby`.

## Contrast

Slate surfaces with indigo accent; status colors (amber/red) reserved for delays and conflicts only.
