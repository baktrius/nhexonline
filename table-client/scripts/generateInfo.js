import escapeHtml from "./escapeHtml.js";

export default function generateInfo(armyInfo, text, name) {
  text = text || "";
  const tagRegex = /\B#\p{L}+/gu;
  const tags = [];
  const tagsDupLock = new Set();
  let res = "";
  const process = function (text, title = "") {
    for (const [tag] of text.matchAll(tagRegex)) {
      if (!tagsDupLock.has(tag)) {
        tagsDupLock.add(tag);
        tags.push(tag);
      }
    }
    res += `<p>${title ? `<b>${escapeHtml(title)}</b><br>` : ""}${escapeHtml(
      text,
    )
      .replaceAll("\n", "<br>")
      .replaceAll(tagRegex, (tag) => {
        const tagName = tag.substring(1);
        const tagInfo = armyInfo?.tags?.[tagName];
        if (tagInfo?.type === "ref") return `<b>${tagName}</b>`;
        else if (tagInfo?.type === "link")
          return `<a href="${tagInfo.href}" target=”_blank”>${tagName}</a>`;
        else return `<b style='color: red'>${tagName}</b>`;
      })}</p>`;
  };
  process(text, name);
  for (let i = 0; i < tags.length; ++i) {
    const tag = tags[i];
    const tagName = tag.substring(1);
    const tagInfo = armyInfo?.tags?.[tagName];
    if (tagInfo?.type === "ref") process(tagInfo.text, tagName);
  }
  return res;
}
