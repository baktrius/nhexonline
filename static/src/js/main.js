import Alpine from 'alpinejs'
import focus from '@alpinejs/focus'
import htmx from 'htmx.org'
import tippy from 'tippy.js';
import 'tippy.js/dist/tippy.css';

window.jsonData = function (id) {
    return JSON.parse(document.getElementById(id).textContent)
}

window.Alpine = Alpine
Alpine.plugin(focus)
Alpine.start()

window.htmx = htmx

window.tippy = tippy

function showTippy(el, duration, options) {
    const instance = tippy(el, Object.assign({ 'onHidden': () => instance.destroy() }, options))
    instance.show()
}

window.showTippy = showTippy