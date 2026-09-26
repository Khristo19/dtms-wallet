# DTMS Wallet — Design Handoff

An iOS-style crypto wallet (Liquid Glass era look). Four screens, 390×844 (iPhone 14/15/16 logical size).

Light and dark mode are both specified. The app must follow the system appearance.

- `html/light/`, `html/dark/` — static reference markup for each screen (open in a browser; links between screens work)
- `screenshots/light/`, `screenshots/dark/` — @2x renders of each screen (rendered on Linux, so the font is a fallback; on Apple devices it's SF Pro)

## Flow
Welcome → (Continue) → Home → (Send tile) → Send sheet → (Send with Passkey) → Sent → (Done) → Home

## Tokens

| Token | Light | Dark | Use |
|---|---|---|---|
| bg.base (under gradient) | `#F5EEF0` | `#06060B` | Screen background (Home, Send sheet, Sent) |
| surface.glass | see Glass surfaces | see Glass surfaces | Cards, list rows, action tiles, receipt |
| label | `#000000` | `#FFFFFF` | Primary text |
| label.secondary | `#4E4E54` | `#B4B4BA` | Secondary text |
| label.tertiary | `#8E8E93` | `#8E8E93` | Cents, "SOL" unit, captions |
| separator | `rgba(60,60,67,0.16)` | `rgba(255,255,255,0.12)` | Hairlines, inset 66px (lists) / 16px (receipt) |
| fill.tertiary | `rgba(118,118,128,0.14)` | `rgba(118,118,128,0.26)` | Gray pill buttons, segmented-control track (0.12) |
| accent | `#0071E3` | `#0A84FF` | Primary buttons, active tab, icons |
| link | `#0066CC` | `#409CFF` | Text links |
| positive | `#34C759` fill · `#248A3D` text | `#30D158` | Gains, success |
| coin colors | SOL `#5E5CE6` · BTC `#FF9F0A` · USDC `#0A84FF` | same | Coin avatars |

**Glass material** (top buttons, floating tab bar, search button):
`background: rgba(255,255,255,0.62); backdrop-filter: blur(28px) saturate(180%); border: 1px solid rgba(255,255,255,0.8); box-shadow: 0 10px 30px rgba(0,0,0,.12), inset 0 1px 0 rgba(255,255,255,.95)`

**Glass material, dark:** `background: rgba(44,44,46,0.62)`, same blur, `border: 1px solid rgba(255,255,255,0.14)`, `box-shadow: 0 10px 30px rgba(0,0,0,.5), inset 0 1px 0 rgba(255,255,255,.12)`

**Dark-only details:** segmented-control selected pill `#636366`. The Send sheet surface is `#1C1C1E` with cards at `#2C2C2E` over a `#000000` backdrop, and the stacked sheet behind it is `#3A3A3C`. The Welcome app icon is `#1C1C1E` with a `#3A3A3C` border and a faint blue glow. The chart end-dot ring matches the background. Coin avatars and white-on-accent text don't change.

## Background gradient (all screens, both modes)
A full-screen layer behind all content, made of a base color plus 4 heavily blurred circles. It's an original composition; don't use Apple's wallpapers.

| Blob | Position (390×844 frame) | Size | Blur | Light color / opacity | Dark color / opacity |
|---|---|---|---|---|---|
| Magenta | top −140, right −120 | 380 | 90 | `#FF4F8B` / 0.62 | `#C8175F` / 0.60 |
| Blue | top 180, left −170 | 400 | 100 | `#4C6FFF` / 0.55 | `#1B3BD1` / 0.62 |
| Coral | bottom −120, right −100 | 360 | 100 | `#FF9A5C` / 0.55 | `#E4552A` / 0.38 |
| Lilac | bottom 60, left −60 | 260 | 90 | `#B792FF` / 0.45 | `#5B22C9` / 0.50 |

Base: light `#F5EEF0`, dark `#06060B`. Native: render it once as a reusable `GradientBackground` view (blurred circles, or a pre-rendered image per mode), placed behind every screen and ignoring safe areas.

On the Send screen the gradient behind the sheet is dimmed with a black overlay: 0.35 in light, 0.5 in dark.

## Glass surfaces
- **Cards / list rows / action tiles / receipt / segmented track**: light `rgba(255,255,255,0.55)`, dark `rgba(38,38,44,0.48)`. Both use backdrop blur 30 + saturate 180% and a 1px inner stroke (light `rgba(255,255,255,0.65)`, dark `rgba(255,255,255,0.10)`).
- **Cards inside the Send sheet (dark)**: `rgba(80,80,88,0.40)`, same blur and stroke.
- **Send sheet**: light `rgba(246,242,246,0.72)`, dark `rgba(28,28,32,0.70)`, blur 40.
- **Controls (top buttons, floating tab bar, search)**: as in "Glass material" above.
- The segmented control's selected pill stays solid (light `#FFFFFF`, dark `#636366`). The Send tile and primary buttons stay solid accent.
- Native mapping: SwiftUI `.ultraThinMaterial` / `.glassEffect()` (iOS 26), Compose `Modifier.blur` plus a translucent fill (or the Haze library for real backdrop blur).

## Type
- UI: SF Pro (`-apple-system`). Large title 34/700, −0.02em. Body 17. Secondary 13–15. Tab labels 10/600.
- Numbers: SF Pro Rounded (`ui-rounded`) 700, tight tracking (−0.03 to −0.04em), tabular figures. Balance 50, Send amount 80, Sent amount 44.

## Shape
- Buttons: full capsules (radius 999), height 52–54.
- Circular icon buttons: 44×44.
- Action tiles: 64 tall, radius 20.
- Grouped list / receipt cards: radius 26.
- Sheet: top radius 38, 36×5 grabber.
- Floating tab bar: 62 tall capsule, 16px side inset, 26px from bottom; separate 62×62 circular search button.

## Screens
1. **Welcome**: app icon (84, radius 20, black), "Welcome to DTMS Wallet" (brand name in accent), three feature rows (36px colored filled symbol + 15/600 title + 15 secondary body), privacy note, "Continue" capsule.
2. **Home**: glass eye (hide balance toggle) + avatar top-right; large title "Wallet"; rounded balance with gray cents; green change line; area sparkline (green line 2.4px, gradient fill to 0); 1D/1W/1M/1Y/All capsule segmented control; 4 action tiles (Send is filled accent); inset grouped asset list with chevrons; floating glass tab bar (Wallet / Collectibles / Activity) + search.
3. **Send (sheet)**: dimmed stacked sheet behind; grabber; glass × close (left) and accent ↑ confirm (right); recipient card with "Change" pill; big rounded amount + unit; fiat value with swap-units icon; available balance; round-key number pad; "Send with Passkey" capsule.
4. **Sent**: green check in two concentric rings with soft green glow; amount; "Sent to Maya"; receipt card (Value, Network Fee, Status); Share (gray) + Done (accent) capsules.

## Notes
- All figures are sample data; network fee is a placeholder `[FEE]`.
- Icons are custom SVG approximations; in a native app use SF Symbols: `eye.fill`, `arrow.up.circle.fill`, `arrow.down.circle.fill`, `arrow.left.arrow.right.circle.fill`, `plus.circle.fill`, `wallet.bifold.fill`, `square.grid.2x2.fill`, `clock.fill`, `magnifyingglass`, `xmark`, `lock.fill`, `checkmark`, `delete.left.fill`, `checkmark.shield.fill`, `bolt.fill`, `chart.bar.fill`.
- Min touch target 44pt everywhere.
