// Types for the brand's motion model (brand/motion-model.mjs), the one source
// of the icon's jump, stamp, and return.
declare module "*/brand/motion-model.mjs" {
  export const timing: {
    readonly launch: number
    readonly stamp: number
    readonly rebound: number
    readonly land: number
    readonly rest: number
    readonly duration: number
    readonly reduced: number
  }
  /** The whole scene as an SVG string, posed at `t` milliseconds. */
  export const scene: (t: number) => string
  /** `pose` and `attributes` as source, to inline in a page script. */
  export const browserModel: string
}
