// Design tokens: non-themed, static style primitives used across the app.
// Colors live in `hooks/use-theme.ts` (scheme-aware). Everything else here:
// spacing, radii, borders, typography, shadows, fixed dimensions, motion.
// FontFamily names must match the keys passed to useFonts() in app/_layout.tsx.
// Always import from this file instead of hardcoding numeric literals.

import type { TextStyle, ViewStyle } from 'react-native';

// Spacing scale. Close to an 8px grid with half-steps for fine-tuning.
// Use the t-shirt sizes for inline/component padding and gaps; `section`
// and `screenTop` are semantic tokens for larger layout-level spacing.
export const Space = {
  xs: 4,
  sm: 6,
  md: 8,
  base: 12,
  lg: 16,
  xl: 20,
  '2xl': 32,
  section: 24,    // vertical spacing between major UI groups/sections
  screenTop: 60,  // header top padding on top-level screens
} as const;

// Corner radii. `pill` produces a fully rounded end-cap on any element.
// `xs` is reserved for tiny chrome (legend bars, dividers) where 2px reads
// as a square with softened pixel edges.
export const Radius = {
  xs: 2,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  pill: 999,
} as const;

// Border widths. `strong` is for interactive outlines (buttons, inputs);
// `emphasis` for selected/active states.
export const Border = {
  hairline: 1,
  strong: 1.5,
  emphasis: 2,
} as const;

// Font families for display/heading text.
// Regular: page titles, numbers. Italic: accent word in titles, user name in greeting.
export const FontFamily = {
  displaySerif:       'InstrumentSerif_400Regular',
  displaySerifItalic: 'InstrumentSerif_400Regular_Italic',
} as const;

// Font weights. `medium` (500) is reserved for tertiary text (links,
// secondary button labels, faint day labels) where semibold feels too heavy.
// `heavy` (800) is reserved for big-number displays (count totals, log totals)
// where bold reads too thin against large numerals.
export const Weight = {
  regular: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
  heavy: '800',
} as const satisfies Record<string, TextStyle['fontWeight']>;

// Typography roles. Spread into a StyleSheet entry to apply a role, then
// add `color` and any overrides. Prefer a role over raw fontSize/weight.
// Note: headings + body deliberately set a `lineHeight`; inline roles
// (h2, bodyMd, label, fieldLabel, caption, overline) omit it because they
// typically sit inside rows where the surrounding layout controls leading.
export const Type = {
  display:    { fontSize: 34, fontWeight: Weight.regular,  lineHeight: 36, letterSpacing: -0.5, fontFamily: FontFamily.displaySerif },
  h1:         { fontSize: 22, fontWeight: Weight.bold,     lineHeight: 28 },
  h2:         { fontSize: 17, fontWeight: Weight.bold },
  body:       { fontSize: 16, fontWeight: Weight.semibold, lineHeight: 20 },
  bodyMd:     { fontSize: 15, fontWeight: Weight.semibold },
  // label:     section headers ("History", "Routines", "All Trackers")
  // fieldLabel: form field captions above inputs ("Name", "Type", "Color")
  label:      { fontSize: 13, fontWeight: Weight.bold,     letterSpacing: 0.5, textTransform: 'uppercase' },
  fieldLabel: { fontSize: 13, fontWeight: Weight.semibold, letterSpacing: 0.5, textTransform: 'uppercase' },
  caption:    { fontSize: 12, fontWeight: Weight.semibold },
  overline:   { fontSize: 10, fontWeight: Weight.bold,     letterSpacing: 0.6, textTransform: 'uppercase' },
} as const satisfies Record<string, TextStyle>;

// Shadow tiers. `card` for standard elevated surfaces (tracker rows),
// `floating` for above-the-fold chrome (tab bar, FABs),
// `popover` for overlays/modals.
export const Shadow = {
  card: {
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  floating: {
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  popover: {
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
} as const satisfies Record<string, ViewStyle>;

// Fixed object sizes (square containers, controls). Not spacing, not radii.
export const Size = {
  iconBg: 44,        // primary icon-with-color-bg container (tracker rows)
  iconBgSm: 32,      // small icon square (settings rows, badges)
  checkbox: 34,      // today-view checkbox hit target
  control: 40,       // standard button / pill height
  controlLg: 52,     // large CTA button height ("New tracker")
} as const;

// Animation durations in milliseconds.
export const Motion = {
  fast: 90,
  base: 200,
  slow: 260,
  loop: 2200,
} as const;
