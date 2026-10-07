import * as THREE from 'three'
import type { Impact } from './sim'

/**
 * The crater's shape through time, in metres, shared by the CPU (houses,
 * trees, labels) and the GPU (the ground surface and the cut face).
 *
 * Excavation: a paraboloid transient crater that grows to its full size in
 * about sqrt(D/g). Modification: it collapses into the final crater, a bowl
 * if it is under 3.2 km across, otherwise a flat floor with a central peak
 * and terraced walls. Ejecta thin out as (R/r)^3 beyond the rim.
 */

export const CRATER_GLSL = /* glsl */ `
uniform float uRt, uDt, uR, uDf, uCx, uE, uM, uAir, uRim, uY0;
float bowlH(float r, float rc, float d, float rim){
  if (r < rc) return -d * (1.0 - (r / rc) * (r / rc)) + rim * pow(r / rc, 6.0);
  float k = rc / r; return rim * k * k * k;
}
float finalH(float r){
  if (uCx < 0.5) return bowlH(r, uR, uDf, uRim);
  float x = r / uR;
  if (x > 1.0) { float k = 1.0 / x; return uRim * k * k * k; }
  float floorH = -uDf + uDf * 0.6 * exp(-pow(x / 0.11, 2.0)); // central peak
  float wall = smoothstep(0.5, 1.0, x);
  float terr = wall + 0.06 * sin(x * 60.0) * wall * (1.0 - wall) * 4.0; // terraces
  return mix(floorH, uRim, clamp(terr, 0.0, 1.0));
}
float craterH(float r){
  if (uAir > 0.5 || uRt <= 0.0) return 0.0;
  float g = 1.0 - pow(1.0 - clamp(uE, 0.0, 1.0), 2.5);
  float ht = bowlH(r, max(uRt * g, 1.0), uDt * g, uDt * 0.12 * g);
  return max(uY0 + 60.0, mix(ht, finalH(r), clamp(uM, 0.0, 1.0)));
}
`

export class Crater {
  readonly u = {
    uRt: { value: 0 }, uDt: { value: 0 }, uR: { value: 0 }, uDf: { value: 0 }, uCx: { value: 0 },
    uE: { value: 0 }, uM: { value: 0 }, uAir: { value: 0 }, uRim: { value: 0 }, uY0: { value: -6000 },
  }
  /** transient crater formation time, s */
  tEx = 1
  set(im: Impact) {
    const u = this.u
    u.uAir.value = im.airburst ? 1 : 0
    u.uRt.value = im.dtc / 2
    u.uDt.value = (im.dtc / (2 * Math.SQRT2)) * 0.9
    u.uR.value = im.dfr / 2
    u.uDf.value = im.depth
    u.uCx.value = im.complex ? 1 : 0
    u.uRim.value = im.dfr * (im.complex ? 0.012 : 0.036)
    this.tEx = Math.max(0.5, Math.sqrt(Math.max(im.dtc, 1) / 9.81) * 0.9)
  }
  /** set the excavation and collapse progress for a time after contact */
  at(t: number) {
    this.u.uE.value = THREE.MathUtils.clamp(t / this.tEx, 0, 1)
    this.u.uM.value = THREE.MathUtils.smoothstep(t, this.tEx * 0.9, this.tEx * 2.6)
  }
  private bowl(r: number, rc: number, d: number, rim: number) {
    if (r < rc) return -d * (1 - (r / rc) ** 2) + rim * (r / rc) ** 6
    const k = rc / r; return rim * k * k * k
  }
  private fin(r: number) {
    const u = this.u
    if (u.uCx.value < 0.5) return this.bowl(r, u.uR.value, u.uDf.value, u.uRim.value)
    const x = r / u.uR.value
    if (x > 1) return u.uRim.value / (x * x * x)
    const floorH = -u.uDf.value + u.uDf.value * 0.6 * Math.exp(-((x / 0.11) ** 2))
    const wall = THREE.MathUtils.smoothstep(x, 0.5, 1)
    return floorH + (u.uRim.value - floorH) * THREE.MathUtils.clamp(wall + 0.06 * Math.sin(x * 60) * wall * (1 - wall) * 4, 0, 1)
  }
  /** height of the ground at range r, m */
  h(r: number) {
    const u = this.u
    if (u.uAir.value > 0.5 || u.uRt.value <= 0) return 0
    const g = 1 - (1 - THREE.MathUtils.clamp(u.uE.value, 0, 1)) ** 2.5
    const ht = this.bowl(r, Math.max(u.uRt.value * g, 1), u.uDt.value * g, u.uDt.value * 0.12 * g)
    return Math.max(u.uY0.value + 60, ht + (this.fin(r) - ht) * THREE.MathUtils.clamp(u.uM.value, 0, 1))
  }
  /** the current crater rim radius, m */
  rim() {
    const u = this.u
    if (u.uAir.value > 0.5) return 0
    const g = 1 - (1 - THREE.MathUtils.clamp(u.uE.value, 0, 1)) ** 2.5
    return THREE.MathUtils.lerp(u.uRt.value * g, u.uR.value, u.uM.value)
  }
}
