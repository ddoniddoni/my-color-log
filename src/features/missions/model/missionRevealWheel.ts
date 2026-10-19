export const MISSION_REVEAL_SLOT_COUNT = 10;

const WHEEL_FULL_TURNS = 2;

export const REVEAL_MOTION = { turn: 1_650, settle: 420, reduced: 180 } as const;

export function getRevealTargetRotation(slotIndex: number, slotCount = MISSION_REVEAL_SLOT_COUNT): number {
  if (!Number.isInteger(slotIndex) || slotIndex < 0 || slotIndex >= slotCount || slotCount < 2) {
    throw new Error('invalid_reveal_wheel_slot');
  }

  const degreesPerSlot = 360 / slotCount;
  return (WHEEL_FULL_TURNS * 360) - ((slotIndex + 0.5) * degreesPerSlot);
}
