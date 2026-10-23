/**
 * The keys a keyboard device binds now, as they read in a lint (`" "`,
 * `KeyW`): what a player pool compares to report two players sharing a key.
 * Live and scripted keyboards implement it.
 */
export const boundKeys = Symbol("ritmo-browser/boundKeys")

export interface ReportsBoundKeys {
  readonly [boundKeys]?: () => ReadonlyArray<string>
}

/** Every source a device was handed to (a merge, a pool), to report a device used twice. */
const owners = new WeakMap<object, Array<string>>()

/** Records that `owner` takes the snapshots of `device`. */
export const claim = (device: object, owner: string): void => {
  const list = owners.get(device)
  if (list === undefined) owners.set(device, [owner])
  else list.push(owner)
}

/** The sources that take the snapshots of `device`. */
export const ownersOf = (device: object): ReadonlyArray<string> => owners.get(device) ?? []
