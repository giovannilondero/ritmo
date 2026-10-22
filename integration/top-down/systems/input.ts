import { InputCapture } from "@typeonce/ritmo-browser"
import {
  DeltaTime,
  FrameContext,
  Game,
  GamepadInput,
  InputState,
  KeyboardInput,
  PadState
} from "../schema.ts"

export const CaptureInputSystem = InputCapture.system(Game, {
  name: "TopDown/CaptureInput",
  source: KeyboardInput,
  resource: InputState
})

export const CapturePadSystem = InputCapture.system(Game, {
  name: "TopDown/CapturePad",
  source: GamepadInput,
  resource: PadState
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
