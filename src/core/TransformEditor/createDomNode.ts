/* qeslint-disable */
// q@ts-nocheck

// @ts-ignore
import { Check } from "cesium";

/**
 * Creates a DOM Node from a String containing HTML
 *
 * @param {String} html The html string
 * @ionsdk
 *
 * @private
 */
function createDomNode(html: string) {
    // >>includeStart('debug', pragmas.debug);
    Check.typeOf.string("html", html);
    // >>includeEnd('debug');

    const div = document.createElement("div");

    div.innerHTML = html;

    if (div.children.length === 1) {
        // @ts-ignore
        return div.removeChild(div.firstChild) as HTMLElement;
    }

    return div;
}
export default createDomNode;
