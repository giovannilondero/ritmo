import { packageTag } from "@typeonce/ritmo-browser"
import { describe, expect, it } from "tstyche"

describe("@typeonce/ritmo-browser", () => {
  it("exposes the package entrypoint type through the workspace", () => {
    expect(packageTag).type.toBe<"browser">()
  })
})
