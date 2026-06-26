# Implementation Plan

[Overview]
Create a premium, icon-based loading UI system with high-end creative animations that deliver an "unbelievable" feeling across the RoadRules platform, including a global site-wide splash on initial load and manual triggers for heavy operations.

Multiple paragraphs outlining the scope, context, and high-level approach: The RoadRules platform is a vanilla HTML/CSS/JS exam prep site with an already-polished premium aesthetic (layered backgrounds, glass morphism, Font Awesome icons, dark mode, smooth transitions). The loading UI will integrate seamlessly into this existing design language. It will feature a full-screen splash overlay for page/asset initialization, plus a reusable compact loading component for action-triggered states (exam start, data submission). Animations will be CSS-first with minimal JS orchestration to maintain performance while achieving a premium, "impossible" visual feel through coordinated transforms, progressive reveals, floating icon particles, and shimmer effects.

[Types]
No new data types are required; the implementation will use existing CSS classes and a lightweight JS state manager.

[Files]
New files and modifications:
- New: `loading.css` — dedicated premium loading styles (keyframes, overlays, shimmer, transforms)
- New: `loading.js` — manager for global splash, manual triggers, lifecycle (show/hide with callbacks)
- Modify: `index.html` — include loading.css and loading.js, add initial splash container
- Modify: `imyitozo.html`, `ibibazo.html`, `ifitabuguzi.html`, `login.html`, `signup.html`, `admin.html`, `auth.html` — include loading.css and loading.js
- Modify: `common.js` — extend `window.RoadRulesCommon` with loading utilities

[Functions]
- `RoadRulesLoading.showSplash({ minDuration?, onReady? })` — display full-screen premium splash during initial load
- `RoadRulesLoading.hideSplash({ immediate? })` — dismiss splash with exit animation
- `RoadRulesLoading.start(options)` — show manual inline/compact loader before an action
- `RoadRulesLoading.stop(result?)` — end manual loader with success/error state
- `RoadRulesLoading.isVisible()` — current visibility state
- `RoadRulesLoading.once(callback)` — run callback when first splash finishes

[Classes]
No new classes; design uses functional composition with CSS utility classes:
- `.rr-splash-overlay` — full-screen backdrop
- `.rr-loader-card` — centered glass card container
- `.rr-loader-icon-stage` — icon animation area with floating particles
- `.rr-loader-ring` — circular progress/activity ring
- `.rr-loader-bar` — animated shimmer bar
- `.rr-loader-ticker` — staggered text reveal

[Dependencies]
No new packages. Uses existing Tailwind CDN, Font Awesome 6.5.1, and vanilla CSS/JS. Ensure GPU-friendly properties (transform, opacity) for 60fps.

[Testing]
Validate dark/light mode rendering, responsive breakpoints (mobile/desktop), splash dismiss on Escape and click-outside, manual trigger/release cycle, and page load timing behavior. Verify no layout shift or jank on low-end devices.

[Implementation Order]
1) Create `loading.css` with all premium animations and responsive variants
2) Install styles and markup into `index.html` (splash container)
3) Implement `loading.js` (splash lifecycle + manual triggers)
4) Add script/link includes to remaining HTML pages via `common.js` extension or direct tags
5) Hook initial splash into existing `DOMContentLoaded` flow
6) Polish and verify dark-mode fidelity