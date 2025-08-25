/* qeslint-disable */

import { Cartesian2, Entity } from "cesium";
import "./PopupMenu.css";
import { AssetExplorerV2 } from "./AssetExplorerV2";

class PopupMenu {
    private _jqContainer: any;
    private _ul: HTMLUListElement;
    private _assetExplorer: AssetExplorerV2;

    constructor(assetExplorer: AssetExplorerV2) {
        const container = document.createElement("div");

        container.id = "popupMenu";
        container.classList.add("ol-ctx-menu-container");
        container.classList.add("ol-unselectable");
        container.style.display = "none";
        container.style.width = "260px";

        document.body.appendChild(container);

        const ul = document.createElement("ul");

        container.appendChild(ul);

        this._assetExplorer = assetExplorer;
        this._jqContainer = jQuery(container);
        this._ul = ul;
    }

    populate(entityArray: Entity[]) {
        entityArray.forEach((entity) => {
            this._addItem(entity);
        });
    }

    _addItem(entity: Entity) {
        const li = document.createElement("li");

        li.classList.add("ol-ctx-menu-item");

        // @ts-ignore
        if (entity.image && entity.image.uri) {
            const image = document.createElement("img");
            // @ts-ignore
            image.src = entity.image.uri;
            image.classList.add("ol-ctx-menu-item-image");

            li.appendChild(image);
        }

        const span = document.createElement("span");

        if (entity.label && entity.label.text) {
            // @ts-ignore
            span.innerText = entity.label.text.getValue();
        }

        li.appendChild(span);

        li.addEventListener("click", () => {
            this.hide();
            // this._assetExplorer.flyToAsset(entity);
            // @ts-ignore
            this._assetExplorer.getAssetInfoThroughAjax(entity.assetData.ID);
        });

        this._ul.appendChild(li);
    }

    clear() {
        this._ul.innerText = "";
    }

    show(cartesian2: Cartesian2) {
        this._jqContainer.show();
        this._jqContainer.css("left", `${cartesian2.x + 20}px`);
        this._jqContainer.css("top", `${cartesian2.y}px`);
    }

    hide() {
        this._jqContainer.hide();
    }
}

export { PopupMenu };
