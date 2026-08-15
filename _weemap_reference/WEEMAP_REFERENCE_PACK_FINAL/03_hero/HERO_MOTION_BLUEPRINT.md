# WEEMAP SINAI — Cinematic Hero Motion Blueprint

## Concept

A fullscreen, scroll-driven Sinai road scene.

The visual journey transitions:

Golden Hour -> Dusk -> Blue Hour -> Sinai Night

A classic older off-road vehicle / Jeep / Land Cruiser style vehicle is viewed from behind and gradually travels deeper into the road.

The animation should feel cinematic and restrained, never game-like.

## Composition

Preferred scene:
- Sinai mountain road
- large open sky
- strong road depth
- mountains framing the scene
- vehicle relatively small in frame
- visual breathing room for headline and CTAs
- no crowded foreground
- realistic photographic treatment

Do not reproduce the night-road reference image literally if its composition hurts text readability.

## Desktop scroll model

Suggested total hero scroll space:
250–320vh

Scene remains pinned for the main transition.

### 0% — Golden Hour

Visible:
- warm sky
- mountains
- road
- vehicle
- no visible stars
- no moon
- headlights off

Copy:
WE MAP SINAI.
YOU LIVE IT.

Primary CTA:
PLAN YOUR TRIP

Secondary CTA:
EXPLORE SINAI

### 0–25%

- very subtle camera push
- light mountain parallax
- vehicle progresses slightly forward
- warm light begins fading
- sky shifts toward dusk

### 25–45%

- transition into blue hour
- shadows deepen
- first stars appear
- vehicle continues progressing

### 45–70%

- deep indigo sky
- natural-looking Milky Way gradually appears
- subtle moon appears
- headlights turn on
- warm road glow contrasts with cool night sky

Avoid neon/fantasy Milky Way treatment.

### 70–90%

- full night state
- stars fully visible
- subtle camera push
- vehicle moves deeper into scene
- main hero copy begins gentle fade

### 90–100%

- prepare section release
- optional small line:
  NOW FIND YOUR WAY.
- unpin into next section:
  WHAT BRINGS YOU TO SINAI?

## Mobile

Use a deliberately simplified version.

Recommended:
- shorter hero scroll length: roughly 180–220vh
- day/night crossfade
- very small vehicle movement
- stars fade
- no expensive particles
- reduced parallax

Prioritize performance, CTA visibility and readability.

## Reduced motion

When `prefers-reduced-motion` is enabled:
- no pinned cinematic sequence
- use static hero or simple crossfade
- preserve all content and CTAs

## Preferred implementation

Use:
- Next.js existing stack
- GSAP
- ScrollTrigger

Avoid Three.js/WebGL unless there is a demonstrated need.

Prefer layered assets:
- day background
- night background
- transparent vehicle
- stars
- moon
- optional headlight glow/noise

## Motion rule

Do:
slow, cinematic, atmospheric movement.

Do not:
- bounce vehicle
- rotate vehicle
- add arcade-like steering
- use excessive particles
- block booking/navigation while animation plays
