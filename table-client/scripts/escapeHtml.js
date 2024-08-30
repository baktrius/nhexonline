const entityMap = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#x27;",
};

export default function escapeHtml(string) {
  return String(string).replace(/[&<>"']/g, function (s) {
    return entityMap[s];
  });
}
