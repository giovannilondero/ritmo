import { InputCapture } from "@typeonce/ritmo-browser"
import { ControlsInput, DeltaTime, FrameContext, Game, InputState } from "../schema.ts"

export const CaptureInputSystem = InputCapture.system(Game, {
  name: "TopDown/CaptureInput",
  source: ControlsInput,
  resource: InputState
})

export const CaptureFrameContextSystem = Game.System(
  "TopDown/CaptureFrameContext",
  {
    resources: {
      deltaTime: Game.System.writeResource(DeltaTime)
    },
    services: {
      frame: Game.System.service(FrameContext)
    }
  },
  ({ resources, services }) =>
    {
      resources.deltaTime.set(services.frame.deltaSeconds)
    }
)
