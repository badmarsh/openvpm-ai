# Clinic Website Builder (Drag-and-Drop)

OpenVPM AI features an integrated visual drag-and-drop website builder that enables veterinary clinics to assemble and customize their public representative site directly from their PMS clinical data.

## Key Features

1. **Library of 17 Section Templates:**
   - **Hero Banner:** Headline, primary/secondary CTAs, contact card.
   - **About & Story:** Practice history with rich formatted text and statistics.
   - **Stats Strip:** Key milestone numbers and practice achievements.
   - **Services Grid:** Treatment and diagnostics cards with icons and pricing.
   - **Veterinary Team:** Staff members gated by GDPR consent (`photo_web`).
   - **Trust Badges:** Fear-Free certifications, veterinary chamber membership, and data privacy badges.
   - **Client Reviews:** Verified Google and Facebook testimonials (grid or carousel layout).
   - **Social Proof:** Direct links to clinic Instagram, Facebook, and TikTok profiles.
   - **Client Handouts:** Dynamic educational care sheets from OpenVPM.
   - **Booking CTA:** High-conversion online appointment booking call-to-action.
   - **Emergency Banner:** High-contrast urgent care alert with quick-dial phone.
   - **Contact Form:** Secure client inquiry and message submission.
   - **Hours & Location:** Opening hours schedule and interactive map embed.
   - **Gallery:** Clinic facilities and pet photos from the media library.
   - **Video Embed:** Responsive YouTube and Vimeo player without autoplay.
   - **FAQ Accordion:** Collapsible questions and answers.
   - **Custom Rich Text:** Sanitized markdown block for announcements.

2. **Automatic Brand Kit Theming:**
   - Every section visual element automatically inherits `--wb-primary` and `--wb-secondary` colors from the clinic's Brand Kit.
   - Contrast text colors (`--wb-on-primary`) are dynamically computed for readability.

3. **Drag-and-Drop & Inline Editing:**
   - Drag sections to reorder using `@dnd-kit`.
   - Side sheet property editor for instant content changes.
   - Draft autosave with optimistic UI updates.

4. **Draft vs. Published Workflow:**
   - Edits in the builder remain in draft mode until the administrator clicks **Publish Website**.
