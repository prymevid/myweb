# Aether — Professional Customer Support Chatbot

**A modern, production-grade, self-contained customer support chatbot experience.**  
Built entirely from first principles to compete with Intercom, Zendesk, and Drift.

## Design Philosophy

- **Lunar Professional** aesthetic: Deep space navy/indigo palette, refined cyan + amber accents for warmth + trust.
- Distinctive typography using Space Grotesk + Inter system stack with careful tracking and weight hierarchy.
- Generous but purposeful whitespace, premium glassmorphism, layered shadows, and micro-interactions.
- Zero generic AI slop — every detail (borders, animation curves, sentiment color shifts, avatar treatment) was deliberately chosen.

## Key Differentiators

- **Conversation Co-Pilot Sidebar**: Real-time intent detection, live sentiment analysis, contextual knowledge base suggestions that can be shared instantly into the thread.
- **Fluid Multimodal Input**: Text, drag-and-drop files, native voice input (Web Speech API), inline rich cards, quick replies.
- **Intelligent Streaming Replies**: Realistic word-by-word streaming with variable timing for a human-like feel.
- **Lightweight On-Device "NLU"**: Fast keyword + scoring intent classification with context carry-over and sentiment delta detection.
- **Seamless Escalation**: One-click handoff to "Senior Agent" with full transcript + simulated persona switch.
- **Proactive Intelligence**: Occasionally surfaces smart suggestions (e.g. Loom walkthrough offers).
- **Enterprise Polish**: Command palette (`?`), keyboard shortcuts, full local persistence, multi-language (EN/FR/ES), exportable transcripts, CSAT + confetti delight.
- **Accessible & Responsive**: Full ARIA-friendly, keyboard operable, beautiful on desktop and mobile.

## Features Implemented

- Elegant chat UI with avatars, timestamps, typing indicators, read states
- Dynamic quick-reply chips that adapt to conversation context
- File attachments (button + full drag-and-drop)
- Voice input with visual feedback
- Inline action cards (invoices, etc.)
- Live-updating insights panel (intent, sentiment gauge, suggested articles)
- Knowledge base search + one-click sharing
- Escalation to human with beautiful transition
- Multiple demo scenarios (Billing, Technical, General)
- Command palette with power-user actions
- Persistent conversations across reloads
- CSAT rating + confetti on positive resolution
- Multi-language switching
- Subtle sound design (send chimes via Web Audio)
- Export transcript as .txt with full context summary

## How to Use

1. Open `index.html` in any modern browser (Chrome, Firefox, Edge, Safari).
2. The experience launches immediately — fully functional with no backend.
3. Try different scenarios using the top navigation buttons.
4. Type normally, use voice, drag files, or press `?` for the command palette.
5. Click "Escalate", "Mark Resolved", or rate the conversation.

## Embedding / Scaling

This artifact is deliberately a **single file** for maximum portability. To scale into a real product:

- Extract the chat widget into a Web Component or React/Vue component.
- Replace the in-memory `classifyIntent` + response templates with calls to your LLM / rules engine.
- Connect the escalation and file upload to real APIs.
- Add authentication context for personalized greetings and real customer data.

The architecture (state machine + render pipeline + insight engine) is intentionally clean and easy to extend.

## Browser Support

- Modern evergreen browsers (2024+)
- Voice input requires `SpeechRecognition` (available in Chrome/Edge)
- Drag-and-drop and file upload work everywhere

## Why This Stands Out

Most chatbot demos look like generic chat bubbles.  
Aether feels like a **premium, trustworthy product** you would actually ship to enterprise customers — calm, fast, emotionally intelligent, and delightful without being gimmicky.

Built with love for craft, clarity, and real user outcomes.

---

**Ready to compete at the highest level.**  
Open the demo. Experience the difference.