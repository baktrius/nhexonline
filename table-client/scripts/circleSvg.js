export default function circleSvg(path, srcRect) {
  return `<svg viewBox="-2 -2 81 81" width="77" height="77">
  <path d="M 0, 38 a 38,38 0 1,1 76,0 a 38,38 0 1,1 -76,0" fill="#7e7e7e" style="pointer-events: fill" x="0" y="0" />
  <defs>
  <clipPath id="circleClip" clipPathUnits="userSpaceOnUse">
    <circle cx="38.5" cy="38.5" r="38.5" />
  </clipPath>
  </defs>
  <svg clip-path="url(#circleClip)" width="77" height="77">
  ${
    srcRect === undefined
      ? `<image xlink:href="${path}" width="77" height="77"/>`
      : `<image xlink:href="${path}" transform="scale(${77 / srcRect.w}, ${77 / srcRect.h}) translate(${-srcRect.x}, ${-srcRect.y})"/>`
  }
  </svg>
  <path class="border" d="M 0, 38 a 38,38 0 1,1 76,0 a 38,38 0 1,1 -76,0" fill="none" stroke="#BBBBBB" stroke-width="2" x="0" y="0" />
  <path class="selection" d="M 0, 38 a 38,38 0 1,1 76,0 a 38,38 0 1,1 -76,0" fill="#00007f3f" stroke="blue" stroke-width="4" x="0" y="0" />
</svg>`;
}
