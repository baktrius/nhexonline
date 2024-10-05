export default function upload(onSuccess, signal) {
  const element = document.createElement("input");
  element.setAttribute("type", "file");

  element.style.display = "none";
  document.body.appendChild(element);

  element.click();
  element.addEventListener("change", () => {
    if (element.files.length > 0) {
      const selectedFile = element.files[0];
      const reader = new FileReader();
      reader.onload = (ev) => {
        onSuccess(ev.target.result);
      };
      reader.readAsText(selectedFile);

      document.body.removeChild(element);
    }
  }, { signal });
}
