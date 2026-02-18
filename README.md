# Chrome Doodle

A Chrome extension for drawing annotations on any webpage.

## Modes

| Mode | Annotations | Mouse |
|------|------------|-------|
| **Off** | Hidden | Normal |
| **Annotate** | Visible, can draw | Captures clicks for drawing (scroll wheel still works) |
| **View** | Visible, scroll with page | Normal — click, scroll, select text |

## Keyboard Shortcuts

- `Alt+A` — Cycle modes (Off → Annotate → View → Off)
- `Ctrl+Z` — Undo last stroke
- `Esc` — Turn off

## Popup Controls

Click the extension icon to access:
- Mode selector
- Brush color picker
- Brush size slider
- Undo / Clear All buttons

## Install

1. Go to `chrome://extensions`
2. Enable **Developer mode** (top right)
3. Click **Load unpacked**
4. Select this folder

## Notes

- Annotations automatically clear on page navigation or reload
- Works on SPAs (React, Next.js, etc.) that use inner scroll containers
- Scrolling works in annotate mode via the mouse wheel
