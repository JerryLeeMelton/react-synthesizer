import type { Envelope } from "./types";

/** Smallest value we allow on a param we may later ramp exponentially. */
const EPSILON = 0.0001;

/**
 * Pin a param to whatever value it currently has and drop every future event,
 * so a new ramp can start from the audible position instead of jumping.
 * `cancelAndHoldAtTime` is not implemented everywhere (Firefox), hence the fallback.
 */
export function cancelAndHold(param: AudioParam, time: number): void {
  const holdable = param as AudioParam & {
    cancelAndHoldAtTime?: (t: number) => AudioParam;
  };
  if (typeof holdable.cancelAndHoldAtTime === "function") {
    holdable.cancelAndHoldAtTime(time);
  } else {
    const current = param.value;
    param.cancelScheduledValues(time);
    param.setValueAtTime(current, time);
  }
}

/** Attack -> decay -> sustain, scaled so the envelope peaks at `peak`. */
export function triggerAttack(
  param: AudioParam,
  env: Envelope,
  peak: number,
  time: number,
): void {
  cancelAndHold(param, time);
  param.setValueAtTime(param.value, time);

  const attackEnd = time + Math.max(env.attack, 0.001);
  param.linearRampToValueAtTime(peak, attackEnd);

  const decayEnd = attackEnd + Math.max(env.decay, 0.001);
  param.linearRampToValueAtTime(Math.max(env.sustain * peak, EPSILON), decayEnd);
}

/**
 * Ramp down to `floor` over the release time.
 * Returns the time at which the envelope has finished.
 */
export function triggerRelease(
  param: AudioParam,
  release: number,
  time: number,
  floor = 0,
): number {
  cancelAndHold(param, time);
  param.setValueAtTime(param.value, time);
  const end = time + Math.max(release, 0.001);
  param.linearRampToValueAtTime(floor, end);
  return end;
}

/**
 * Same shape as triggerAttack but expressed between two absolute values,
 * which is what the filter envelope needs (it moves between frequencies).
 */
export function triggerAttackBetween(
  param: AudioParam,
  env: Envelope,
  base: number,
  peak: number,
  time: number,
): void {
  cancelAndHold(param, time);
  param.setValueAtTime(param.value, time);

  const attackEnd = time + Math.max(env.attack, 0.001);
  param.linearRampToValueAtTime(peak, attackEnd);

  const decayEnd = attackEnd + Math.max(env.decay, 0.001);
  param.linearRampToValueAtTime(base + (peak - base) * env.sustain, decayEnd);
}
