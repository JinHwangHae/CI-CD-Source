/* qeslint-disable */
// q@ts-nocheck

import { Event } from "cesium";

import { ParsedConstruktedAjax } from "./types/common";
import { TMSTilesAsset } from "./core";

import AbstractViewer, { ViewModes } from "./AbstractViewer";

export interface OrthomosaicViewerConstructorOptions {
    construktedAjax: ParsedConstruktedAjax;
}

export default class OrthomosaicViewer extends AbstractViewer {
    private _asset: TMSTilesAsset | undefined;
    private _orthomosaicAdded = new Event();

    // eslint-disable-next-line no-useless-constructor
    constructor(options: OrthomosaicViewerConstructorOptions) {
        super(options);
    }

    _init(): void {
        this._viewer = this._createCesiumViewer();
        const construktedAjax = this._construktedAjax;

        this._asset = new TMSTilesAsset({
            type: construktedAjax.asset_type,
            postId: construktedAjax.post_id,
            viewer: this._viewer,
            assetServer: construktedAjax.assets_server,
            postSlug: construktedAjax.post_slug
        });

        this._asset.readyEvt.addEventListener(() => {
            jQuery("#nav-geo").hide();

            this._viewer!.camera.flyTo({
                destination: this._asset!.rectangle
            });
        });

        // hide loading indicator
        window.jQuery(".viewer-loading").addClass("loaded");
        // enable sidebar
        window.jQuery("#side-menu-bar-wrapper").removeClass("disabled not-loaded");
    }

    get orthomosaicAdded() {
        return this._orthomosaicAdded;
    }

    get asset() {
        return this._asset as TMSTilesAsset;
    }

    // @ts-ignore
    setViewMode(mode: ViewModes) {
        super.setViewMode(mode);
        console.warn("not implemented");
    }
}
