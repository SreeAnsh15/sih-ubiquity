# Bharat Connect

Act as a Principal UI/UX Frontend Architect. Refactor this entire application to match the exact aesthetic of India's Digital Public Infrastructure (like BHIM UPI / ONDC / DigiLocker).

Color Palette & Design System:

- Background: Ultra-clean soft white/light-gray background (#F8FAFC).

- Primary Action Buttons & CTAs: Vibrant Bharat/BHIM Saffron-Orange (#F97316 / #EA580C) with bold white text.

- Trust & Verification Accents: Deep Emerald Green (#059669 / #10B981) for verified badges, savings callouts, and success states.

- Typography & Headers: High-contrast Indian Navy Blue (#0F172A / #1E293B).

- Card Containers: Crisp pure white (#FFFFFF) with subtle, clean 1px borders (#E2E8F0) and soft elevation shadows. Remove all dark mode / neon cyberpunk elements.

Header & Navigation:

- Top bar with a clean white/navy finish:

  * Brand: "UBIQUITY" with a green "CO-OP / GOVT AFFILIATED" pill tag.

  * Title: "Cooperative Gig Services Network (SIH26089 - Ministry of Cooperation)".

  * Live status pill: "⚡ Backend Engine: Connected" with a pulsing green dot.

  * Clean tab pills to switch between:

    1. "Customer Booking Portal"

    2. "Worker Voice Onboarding"

---

1. CUSTOMER BOOKING PORTAL (Split Grid View: Left Booking Panel + Right Map Canvas)

Left Booking Panel (40% width):

- Category Selection: Clean pill buttons for services (Plumbing, Electrical, House Cleaning, Carpentry, Masonry).

- Primary Action: Saffron-Orange button "🔍 Search Nearby Cooperative Workers".

- Selected Worker Card:

  * Worker avatar/initials, Name (e.g., "Murugan S."), and a prominent green shield: "✔ PACS & SHG Verified Worker".

  * Rating: Gold stars (4.8 ★) and "Top Community Match" badge (DO NOT show confusing raw decimals like 0.791 to normal users).

  * Price Comparison Card (BHIM UPI Invoice Style):

    - Large bold green cooperative fair price: "₹198.40".

    - Strikethrough commercial price: "Aggregator: ₹268.90".

    - Highlight banner: "🎉 Zero Middleman Commission — You save ₹70.50".

  * "Book Service Now" primary Saffron-Orange button.

  * Collapsible Jury Accordion: "⚙️ Inspect Fair-Pool Algorithm (Jury Mode)" showing the breakdown: 40% Proximity, 30% Trust Rating, 30% Idle-Days Equalizer.

- Interactive OTP & Settlement Simulation:

  * 4-digit OTP input box with numeric keypad styling.

  * "Verify & Release 98% Worker Payout" button.

  * Live settlement modal showing the 98% (Worker UPI), 1.5% (PACS Server Maintenance), and 0.5% (Emergency Mutual Aid Fund) splits.

Right Map Canvas (60% width):

- Replace the dark radar grid with a realistic OpenStreetMap-style light interactive road map (Leaflet / OSM tiles).

- Clean circular pin markers for workers showing their name and rate tags.

- Blue marker for "Customer Current Location".

- A "2G Network Low-Bandwidth Mode" toggle that smoothly flips the map into an accessible sorted card list.

---

2. WORKER VOICE ONBOARDING PORTAL (Zero-Literacy Voice AI)

- Dedicated mobile-friendly clean card for informal daily-wage workers:

  * Language Selector: Tamil, Hindi, Telugu, Marathi, English.

  * Large, inviting central Microphone Button in deep emerald green with subtle ripple waves.

  * Status text: "Tap to Speak your experience, work area, and baseline rate in your native language".

  * Extracted Profile Card (Appears after recording):

    - Transcribed Regional Voice Bubble in quotes.

    - Clean structured profile grid showing: Full Name, Primary Skill, Experience, Base Rate (₹), and Service Zone.

    - "Confirm & Register with Local PACS" Saffron-Orange button with Audio TTS read-back support.

Keep all API endpoints wired to `http://localhost:8000` (`GET /`, `POST /api/bookings/match-and-price`, `POST /api/bookings/verify-settle`, `POST /api/workers/voice-onboard`). Make the whole UI crisp, highly responsive, and demo-ready.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://govt-gig-link.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/a4b1607a-7667-4397-8a56-9187a6538bdf).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
