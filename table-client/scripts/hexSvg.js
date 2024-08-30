export default function hexSvg(path, srcRect) {
  return `<svg viewBox="-2 -2 197 172">
  <defs>
  <clipPath id="hexClip" clipPathUnits="userSpaceOnUse">
    <polygon points="48 0, 0 83.5, 48 167, 144 167, 192 83.5, 144 0" />
  </clipPath>
  </defs>
  <path d="M 48,1 L 0,85 48,167 144,167 192,85 144,1 48,1 Z" fill="#7e7e7e" style="pointer-events: fill" />
  <svg clip-path="url(#hexClip)" width="192" height="167">
  ${
    srcRect === undefined
      ? `<image xlink:href="${path}" width="192" height="167"/>`
      : `<image xlink:href="${path}" transform="scale(${192 / srcRect.w}, ${167 / srcRect.h}) translate(${-srcRect.x}, ${-srcRect.y})"/>`
  }
  </svg>
  <path class="border" d="M 48,1 L 0,85 48,167 144,167 192,85 144,1 48,1 Z" fill="none" stroke="#BBBBBB" stroke-width="2" />
  <path class="selection" d="M 48,1 L 0,85 48,167 144,167 192,85 144,1 48,1 Z" fill="#00007f3f" stroke="blue" stroke-width="4" />
</svg>`;
}
