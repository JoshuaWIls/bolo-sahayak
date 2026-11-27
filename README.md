# Bolo Sahayak (Scan-and-Speak)

A voice-first help desk for people in India at bank branches, government hospitals and bus stops.
People scan a QR poster (or call a toll-free number), speak in their own language, and get one
clear step at a time — with safety rules enforced in code.

```
bolo-sahayak/
├── backend/    Express + TypeScript API (clean architecture, mock or Claude LLM)
└── frontend/   React + Vite voice client (Web Speech API, mobile-first)
```

## Quick start

```bash
npm run install:all
```

```bash
npm run dev:backend      # http://localhost:4000  (LLM_PROVIDER=mock by default — no keys needed)
```

```bash
npm run dev:frontend     # http://localhost:5173  → open /v/BLR-JNR-DEP-02
```

Demo help points: `/v/BLR-JNR-DEP-02` (bank), `/v/HOSP-OPD-01` (hospital), `/v/BUS-JN4B-N` (bus stop).
Voice input needs Chrome (desktop or Android) and microphone permission; every screen also has a
"Type instead" box.

To use Claude instead of the scripted mock, set `LLM_PROVIDER=anthropic` and `ANTHROPIC_API_KEY`
(see `backend/.env.example`). The default model is `claude-opus-5-5` at low effort for voice latency.

```bash
npm test          # backend acceptance + unit tests, frontend domain tests
npm run typecheck
```

## How a turn works

```
Phone (frontend)                          Server (backend)
────────────────                          ────────────────
mic → speech-to-text
mask Aadhaar/account/phone  ──POST /api/turn──▶  mask again (defence in depth)
                                                detect language → LanguagePolicy (switch after 2)
                                                input guardrails: Emergency → Credential → Fraud
                                                   └─ match? fixed reply, model NOT called
                                                ClarificationPolicy: low confidence → confirm,
                                                   2 failures → pictogram fallback + toll-free
                                                LanguageModel (mock | Claude) → Zod validation
                                                   └─ invalid twice → staff hand-off
                                                output guardrail: block requests for OTP/PIN
speak reply (text-to-speech)  ◀──── reply ────
```

## Architecture and SOLID

Both apps use the same layering: **domain** (pure types and rules) → **ports** (interfaces) →
**application** (use cases) → **infrastructure** (adapters) → **interfaces/UI**.
Dependencies point inward only; concrete classes are wired in one composition root
(`backend/src/container.ts`, `frontend/src/application/services.tsx`).

| Principle | Where it shows |
|---|---|
| **S**ingle responsibility | `TurnService` only orchestrates. Masking (`PiiMasker`), language switching (`LanguagePolicy`), clarification (`ClarificationPolicy`), prompts (`PromptBuilder`) and each guardrail are separate classes. The frontend voice loop is a pure reducer (`voiceMachine.ts`), separate from the hook that wires browser APIs. |
| **O**pen/closed | Add a guardrail by implementing `InputGuardrail`/`OutputGuardrail` and registering it in `container.ts`. `TurnService` doesn't change. Same for venues (a new JSON file) and UI action panels. |
| **L**iskov substitution | `MockLanguageModel` and `AnthropicLanguageModel` are interchangeable behind `LanguageModel`; both are held to the same Zod contract by the application, so tests run on either. |
| **I**nterface segregation | Small ports: `VenueRepository`, `SessionStore`, `TextMasker`, `LanguageDetector`, `LanguageModel`; on the frontend `SpeechRecognizer`, `SpeechSynthesizer`, `AssistantApi`. |
| **D**ependency inversion | The application layer imports only `domain/ports.ts`. Infrastructure (Express, Anthropic SDK, file system, Web Speech) is injected. |

## Safety guarantees (enforced in code, not only in prompts)

- Aadhaar (12 digits), phone (10 digits starting 6–9) and account numbers (9–11 / 13–18 digits) are masked **on the device** before sending, and again on the server. Only the last 4 digits stay on the phone for display.
- Any mention of OTP / PIN / password returns a fixed refusal; the model is never called.
- Emergency words (Hindi, Kannada, English) return "Go to Emergency / call 108"; the model is never called.
- Fraud words return the 1930 cyber-fraud helpline and a staff hand-off.
- Model replies that ask for credentials are replaced with a staff hand-off.
- Sessions are in memory only, expire after 30 minutes, and "End and erase" deletes them.

## Status

| Area | State |
|---|---|
| Voice loop, barge-in, slow speech, typed fallback | Done (browser Web Speech API) |
| Guardrails, masking, language policy, clarification | Done, covered by tests |
| Claude adapter (structured JSON output) | Done; not exercised by tests (tests use the mock) |
| Camera / form reading | Placeholder notice — next milestone (vision adapter) |
| Indic cloud speech (Sarvam / Bhashini) | Next: add `SpeechRecognizer`/`SpeechSynthesizer` adapters |
| Toll-free IVR channel | Next: telephony adapter calling the same `/api/turn` |
| Printable QR poster page | Next |

Bank, hospital and transport names, phone numbers, fares and routes in `backend/data/venues` are placeholders.
