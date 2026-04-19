import React from 'react';

import { CharacterScene } from './character-3d/scene';

export interface CharacterConfig {
  skinColor: string;
  hairStyle: 'bald' | 'short' | 'medium' | 'long' | 'curly';
  hairColor: string;
  glasses: 'none' | 'round' | 'rectangle';
  glassesColor: string;
}

export const DEFAULT_CHARACTER: CharacterConfig = {
  skinColor: '#f5cba7',
  hairStyle: 'short',
  hairColor: '#3b2314',
  glasses: 'none',
  glassesColor: '#1a1a1a',
};

export const SKIN_TONES = [
  '#fde9d3',
  '#f5cba7',
  '#e8b88a',
  '#c8885a',
  '#8d5524',
  '#4a2c17',
];

export const GLASSES_COLORS = [
  '#1a1a1a',
  '#5c3d1e',
  '#c9a84c',
  '#9e9e9e',
  '#2d5f8a',
  '#c0392b',
  '#6d3b8a',
  '#2e7d5e',
];

export const HAIR_COLORS = [
  '#1a1008',
  '#3b2314',
  '#7b4f2e',
  '#d4a84b',
  '#8b3a1a',
  '#9e9e9e',
  '#4a6fa5',
  '#e87d9b',
];

export function isValidCharacterConfig(obj: unknown): obj is CharacterConfig {
  if (!obj || typeof obj !== 'object') return false;
  const c = obj as Record<string, unknown>;
  return (
    typeof c.skinColor === 'string' &&
    ['bald', 'short', 'medium', 'long', 'curly'].includes(c.hairStyle as string) &&
    typeof c.hairColor === 'string' &&
    ['none', 'round', 'rectangle'].includes(c.glasses as string) &&
    typeof c.glassesColor === 'string'
  );
}

interface CharacterAvatarProps {
  config: CharacterConfig;
  size?: number;
  interactive?: boolean;
}

export const CharacterAvatar = React.memo(function CharacterAvatar({
  config,
  size = 100,
  interactive = false,
}: CharacterAvatarProps) {
  return <CharacterScene config={config} size={size} interactive={interactive} />;
});
