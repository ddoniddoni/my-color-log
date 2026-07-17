export const MISSION_REVEAL_SLOT_COUNT = 12;

const WHEEL_FULL_TURNS = 5;

export function getRevealTargetRotation(slotIndex: number, slotCount = MISSION_REVEAL_SLOT_COUNT): number {
  if (!Number.isInteger(slotIndex) || slotIndex < 0 || slotIndex >= slotCount || slotCount < 2) {
    throw new Error('invalid_reveal_wheel_slot');
  }

  const degreesPerSlot = 360 / slotCount;
  return (WHEEL_FULL_TURNS * 360) - ((slotIndex + 0.5) * degreesPerSlot);
}
