/**
 * One button action's state in a snapshot, the same on every device
 * (`Keyboard`, `Gamepad`, `Pointer`, `Touch`) and in `Controls`.
 */
export interface ActionState {
  /** At least one bound key or button is down now. */
  readonly held: boolean
  /** A bound key or button went down since the previous snapshot, even if already released. */
  readonly pressed: boolean
  /** A bound key or button went up since the previous snapshot and none is held now. */
  readonly released: boolean
}
