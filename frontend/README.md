<h1 align="center">
Activity Detector
</h1>

## Project structure

```text
.
├── src/
│   ├── app/              # Next.js App Router & Global Layouts
│   ├── components/       # Shared UI components & Providers
│   ├── features/         # Domain-specific modules (Logic, API, Components)
│   ├── lib/              # Core utilities & API configuration
│   └── types/            # Global/API type definitions
└── [config files]        # Orval, PostCSS, TSConfig
```

Features:

- detection-explorer
  - video-player: uses shaka-player for DASH playback
  - video-list: media browsing and selection
  - stores: feature store for UI state (Zustand)
- detection-rules
  - settings-window, rule creator, deletion flows
- forbidden-zones
  - zone-drawer, forbidden-areas-panel

State management

- Zustand: per-feature stores in src/features/\*/stores (local and cross-component UI state)

API layer

- Orval: generates typed React Query clients into src/features/\*/api
- axios mutator configured at src/lib/orval-axios.ts
