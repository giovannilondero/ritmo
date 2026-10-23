// Code block annotations, all from the fence or a comment in the code:
// - ```ts {2,4-6}               highlight lines
// - ```ts /Game.System/         highlight a word
// - ```ts title="systems.ts"    a file name above the block
// - // [!code highlight]  // [!code focus]  // [!code ++]  // [!code --]
//   // [!code error]  // [!code warning]  // [!code word:Name]
import {
  transformerMetaHighlight,
  transformerMetaWordHighlight,
  transformerNotationDiff,
  transformerNotationErrorLevel,
  transformerNotationFocus,
  transformerNotationHighlight,
  transformerNotationWordHighlight
} from "@shikijs/transformers"

/** Puts the block in a figure, with `title="..."` from the fence as its caption. */
const transformerTitle = () => ({
  name: "ritmo:title",
  root(root) {
    const title = /title="([^"]+)"/.exec(this.options.meta?.__raw ?? "")?.[1]
    const caption = title === undefined ? [] : [{ type: "element", tagName: "figcaption", properties: {}, children: [{ type: "text", value: title }] }]
    root.children = [
      {
        type: "element",
        tagName: "figure",
        properties: { class: title === undefined ? "code" : "code titled" },
        children: [...caption, ...root.children]
      }
    ]
  }
})

export const annotations = () => [
  transformerNotationDiff({ matchAlgorithm: "v3" }),
  transformerNotationHighlight({ matchAlgorithm: "v3" }),
  transformerNotationWordHighlight({ matchAlgorithm: "v3" }),
  transformerNotationFocus({ matchAlgorithm: "v3" }),
  transformerNotationErrorLevel({ matchAlgorithm: "v3" }),
  transformerMetaHighlight(),
  transformerMetaWordHighlight(),
  transformerTitle()
]
