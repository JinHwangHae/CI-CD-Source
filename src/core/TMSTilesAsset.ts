// @ts-ignore
import { ImageryLayer, Rectangle, SplitDirection, TileMapServiceImageryProvider, Viewer } from "cesium";

import { Asset } from "./Asset";
import { ConstruktedAssetType } from "../types/common";
import { existUrl } from "../construkted";

interface TMSTilesAssetConstructorOptions {
    type: ConstruktedAssetType;
    postId: string;
    viewer: Viewer;
    assetServer: string;
    postSlug: string;
}

export class TMSTilesAsset extends Asset {
    private _rectangle: Rectangle = new Rectangle();
    private _tmsUrl: string = "";
    private _viewer: Viewer;
    private _imageryLayer: ImageryLayer | undefined;

    constructor(options: TMSTilesAssetConstructorOptions) {
        super(options);

        this._viewer = options.viewer;

        const assetServer = options.assetServer;
        const postSlug = options.postSlug;

        let url = `${assetServer}/${postSlug}/tilemapresource.xml`;
        let newStyle = false;

        if (!existUrl(url)) {
            url = `${assetServer}/${postSlug}/tileset/tilemapresource.xml`;
            newStyle = true;
        }

        jQuery.ajax({
            url: url,
            success: (result) => {
                const parser = new DOMParser();
                const xmlDoc = parser.parseFromString(result, "text/xml");

                const boundingBox = xmlDoc.getElementsByTagName("BoundingBox")[0];

                const minX = parseFloat(boundingBox.getAttribute("minx") as string);
                const miny = parseFloat(boundingBox.getAttribute("miny") as string);
                const maxX = parseFloat(boundingBox.getAttribute("maxx") as string);
                const maxY = parseFloat(boundingBox.getAttribute("maxy") as string);

                Rectangle.clone(Rectangle.fromDegrees(minX, miny, maxX, maxY), this._rectangle);

                if (newStyle) {
                    this._tmsUrl = `${assetServer}/${postSlug}/tileset`;
                } else {
                    this._tmsUrl = `${assetServer}/${postSlug}`;
                }

                const extension = xmlDoc.getElementsByTagName("TileFormat")[0].getAttribute("extension") as string;

                const tmsPromise = TileMapServiceImageryProvider.fromUrl(this._tmsUrl, {
                    fileExtension: extension,
                    rectangle: this._rectangle
                });

                tmsPromise.then((provider: TileMapServiceImageryProvider) => {
                    const imageryLayers = this._viewer.imageryLayers;

                    if (imageryLayers.length === 0) {
                        // base layer is not added yet

                        const removeLayerAdd = imageryLayers.layerAdded.addEventListener(() => {
                            removeLayerAdd();
                            this._imageryLayer = this._viewer.imageryLayers.addImageryProvider(provider);
                        });
                    } else {
                        this._imageryLayer = this._viewer.imageryLayers.addImageryProvider(provider);
                    }
                });

                this._ready = true;
                this._readyEvt.raiseEvent();
            },
            dataType: "text"
        });
    }

    get rectangle() {
        return this._rectangle;
    }

    get tmsURL() {
        return this._tmsUrl;
    }

    setSplitDirection(leftChecked: boolean, rightChecked: boolean) {
        const imageryLayer = this._imageryLayer as ImageryLayer;

        if (rightChecked && leftChecked) {
            // @ts-ignore
            imageryLayer.splitDirection = undefined;
            imageryLayer.show = true;
            return;
        }

        if (!rightChecked && !leftChecked) {
            // @ts-ignore
            imageryLayer.splitDirection = undefined;
            imageryLayer.show = false;
            return;
        }

        imageryLayer.show = true;

        if (rightChecked) {
            // @ts-ignore
            imageryLayer.splitDirection = SplitDirection.RIGHT;
        } else {
            // @ts-ignore
            imageryLayer.splitDirection = SplitDirection.LEFT;
        }
    }

    toggle() {
        const imageryLayer = this._imageryLayer as ImageryLayer;

        imageryLayer.show = !imageryLayer.show;
    }

    setShowSplitDirection(show: boolean, splitDirection: SplitDirection) {
        const imageryLayer = this._imageryLayer as ImageryLayer;

        imageryLayer.show = show;
        // @ts-ignore
        imageryLayer.splitDirection = splitDirection;
    }

    resetShowSplitDirection() {
        const imageryLayer = this._imageryLayer as ImageryLayer;

        imageryLayer.show = true;
        // @ts-ignore
        imageryLayer.splitDirection = undefined;
    }

    get imageryLayer() {
        return this._imageryLayer as ImageryLayer;
    }
}
