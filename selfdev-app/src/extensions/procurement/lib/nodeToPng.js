/** Render a DOM node to a PNG, with no dependency.
 *
 * A library would have been the obvious choice, and it was the first one made.
 * It does not work here: the container mounts only `src/`, `public/` and the
 * Vite config, and `node_modules` lives inside the image — so a package added to
 * `package.json` is invisible to the running dev server and stays invisible
 * until somebody rebuilds the image. Shipping a dashboard whose export button
 * throws until an image rebuild is worse than writing the hundred lines here.
 *
 * The method is the standard one: clone the node, inline every computed style
 * (the clone leaves the document, so no stylesheet reaches it), wrap it in an
 * SVG `foreignObject`, and paint that through an `Image` onto a canvas.
 *
 * Its limits are real and worth stating, because they are the reason a library
 * exists at all: remote images and webfonts do not survive the trip. Neither
 * appears in these charts — the marks are CSS backgrounds and inline SVG, and
 * the type is the system sans — so the limits do not bite here. They would bite
 * a chart with a logo in it.
 */

/** Properties worth carrying over. The full computed set is ~340 declarations
 *  per element, which makes the serialized SVG enormous and slow to parse; this
 *  list is what actually shows up in a chart. */
const CARRIED = [
  'box-sizing', 'display', 'position', 'top', 'right', 'bottom', 'left', 'z-index',
  'flex', 'flex-direction', 'flex-wrap', 'align-items', 'justify-content', 'gap',
  'grid-template-columns', 'grid-template-rows', 'grid-column', 'grid-row',
  'width', 'height', 'min-width', 'min-height', 'max-width', 'max-height',
  'margin-top', 'margin-right', 'margin-bottom', 'margin-left',
  'padding-top', 'padding-right', 'padding-bottom', 'padding-left',
  'font-family', 'font-size', 'font-weight', 'font-style', 'font-variant-numeric',
  'line-height', 'letter-spacing', 'text-align', 'text-transform', 'text-decoration',
  'white-space', 'overflow-wrap', 'color', 'opacity', 'visibility',
  'background-color', 'background-image', 'background-size', 'background-position',
  'background-repeat', 'border-radius', 'box-shadow', 'fill', 'stroke', 'stroke-width',
  'border-top-width', 'border-right-width', 'border-bottom-width', 'border-left-width',
  'border-top-style', 'border-right-style', 'border-bottom-style', 'border-left-style',
  'border-top-color', 'border-right-color', 'border-bottom-color', 'border-left-color',
  'outline-width', 'outline-style', 'outline-color', 'outline-offset',
]

const IGNORED = element => element?.dataset?.exportIgnore === 'true'

function inlineStyles(source, clone) {
  const computed = window.getComputedStyle(source)
  const declarations = []
  for (const property of CARRIED) {
    const value = computed.getPropertyValue(property)
    if (value) declarations.push(`${property}:${value}`)
  }
  clone.setAttribute('style', declarations.join(';'))

  const sourceChildren = source.children
  const cloneChildren = clone.children
  for (let index = 0; index < sourceChildren.length; index += 1) {
    inlineStyles(sourceChildren[index], cloneChildren[index])
  }
}

/** Copy the styles first, then drop the chrome.
 *
 * The order is not a preference. `inlineStyles` walks the source and the clone
 * in parallel by child index, so removing anything from the clone beforehand
 * shifts every later sibling and the walk reads styles off the wrong element —
 * or off nothing at all. The marker attribute survives cloning, so the clone can
 * be pruned on its own afterwards.
 */
function prepare(node) {
  const clone = node.cloneNode(true)
  inlineStyles(node, clone)
  for (const element of [...clone.querySelectorAll('*')]) {
    if (IGNORED(element)) element.remove()
  }
  return clone
}

const escapeXml = value => value
  .replace(/&(?![a-zA-Z#0-9]+;)/g, '&amp;')
  .replace(/\u00a0/g, '&#160;')

export async function nodeToPngBlob(node, { pixelRatio = 2, background = '#ffffff', padding = 16 } = {}) {
  const rect = node.getBoundingClientRect()
  const width = Math.ceil(rect.width)
  const height = Math.ceil(rect.height)
  if (!width || !height) throw new Error('Нечего выгружать: элемент не имеет размера.')

  const clone = prepare(node)
  clone.setAttribute('xmlns', 'http://www.w3.org/1999/xhtml')
  const serialized = escapeXml(new XMLSerializer().serializeToString(clone))

  const svg = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width + padding * 2}" height="${height + padding * 2}">`,
    `<rect width="100%" height="100%" fill="${background}"/>`,
    `<foreignObject x="${padding}" y="${padding}" width="${width}" height="${height}">`,
    serialized,
    '</foreignObject></svg>',
  ].join('')

  const image = new Image()
  // A data URL rather than a blob URL: a blob URL counts as a separate origin
  // for the image, which taints the canvas and makes toBlob throw.
  image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
  await new Promise((resolve, reject) => {
    image.onload = resolve
    image.onerror = () => reject(new Error('Не удалось отрисовать изображение.'))
  })

  const canvas = document.createElement('canvas')
  canvas.width = (width + padding * 2) * pixelRatio
  canvas.height = (height + padding * 2) * pixelRatio
  const context = canvas.getContext('2d')
  context.scale(pixelRatio, pixelRatio)
  context.drawImage(image, 0, 0)

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      blob => (blob ? resolve(blob) : reject(new Error('Не удалось собрать PNG.'))),
      'image/png',
    )
  })
}
