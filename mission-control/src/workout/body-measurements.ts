export const bodyMeasurementParts = [
  'neck',
  'shoulders',
  'chest',
  'waist',
  'hips',
  'left arm',
  'right arm',
  'left forearm',
  'right forearm',
  'left thigh',
  'right thigh',
  'left calf',
  'right calf',
] as const

export type BodyMeasurementPart = typeof bodyMeasurementParts[number]

export function formatBodyPartLabel(part: string) {
  return part
    .split(' ')
    .map((word) => word ? word[0].toUpperCase() + word.slice(1) : word)
    .join(' ')
}
