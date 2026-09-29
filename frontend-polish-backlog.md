# EduLink frontend follow-ups

The supplied Claude Design handoff is in `Edu/design_handoff_edulink/`. Its current references are Landing v2 and Auth v2. The React app in `client/` already implements the handoff's page inventory and now serves the supplied images from `client/public/design/`.

## Completed

- [x] Withdraw a sent interest while it is pending. The sender (or linked parent) can withdraw it from the Interests page; the backend uses an atomic pending-to-withdrawn transition.
- [x] Integrate the supplied logo, hero, category, trust, teacher and auth illustrations.
- [x] Fix guest navigation overflow at phone width and hide mobile-only controls at desktop width.
- [x] Replace mock landing metrics, prices, refund promises and testimonials with supported product copy.

## Next UI pass

- [ ] **Profile photos:** Add a real image upload and removal flow for teachers, students and parents. The teacher form currently accepts a photo URL; student and parent accounts have no saved photo. Use public profile-image storage, separate from the private identity-document upload path. Validate type and size, show a preview, and update avatars across the app. Requires Cloudinary configuration or another chosen image store.
- [ ] **Dark theme:** Define a dark palette for the supplied blue/lavender design, including marketplace, auth and admin surfaces. Add a theme switch with a stored preference and system default. Check contrast, illustrations, charts, modals and focus states at desktop and phone widths.
- [ ] **Full UI localization:** The EN/සි/த switch currently selects translated listing descriptions and teacher bios, with an English fallback when content is missing. Translate navigation, forms, errors, notifications, dates and accessibility labels through locale dictionaries; review Sinhala and Tamil copy and fonts. Listing and bio translations remain author supplied.
- [ ] **Design refinements:** Review every screen at 1440px, 900px, 390px and 360px; compare against the `.dc.html` references; refine spacing, responsive stacking, hover/focus states, loading, empty and error views. The supplied landing and auth artwork is now available for this pass.
- [ ] **Admin Undo:** The handoff shows a four-second Undo toast after admin actions. Define which actions can truly be reversed; a suspension ends sessions immediately, and verification/report decisions have no general reversal endpoint. Only show Undo where its backend operation restores the prior state.
- [ ] **Booking refunds:** Cancellation of a paid booking currently directs the user to support. Agree on the refund policy and implement the Stripe refund path before promising automatic refunds in the UI.

## Verification snapshot

- Client lint: clean.
- Client production build: successful with route-level code splitting.
- Backend tests: 279 passed.
- Browser checks: desktop landing and sign-in; phone landing, sign-in and browse; browse filter to listing detail; content-language fallback; auth validation. No browser runtime errors were observed in these checks.
- Local Redis was unavailable during the live run, so queued email/notification delivery could not be exercised end to end.
