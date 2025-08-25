import { destroyObject, Matrix4 } from "cesium";
import { TilesetAsset } from "../../../core";

interface ConstructorOptions {
    asset: TilesetAsset;
}

export abstract class TilesetAssetClipping {
    private readonly _asset: TilesetAsset;
    private _activated: boolean;
    private _enabled: boolean;

    constructor(options: ConstructorOptions) {
        this._asset = options.asset;

        this._init();

        this._activated = true;
        this._enabled = true;
    }

    get asset() {
        return this._asset;
    }

    get activated() {
        return this._activated;
    }

    abstract _doActivate(): void;
    abstract _init(): void;

    activate() {
        if (this._enabled) {
            this._doActivate();
        }

        this._activated = true;
    }

    deactivate() {
        const tileset = this._asset.tileset;

        if (tileset.clippingPlanes) {
            tileset.clippingPlanes.enabled = false;

            /**
             * https://github.com/Construkted-Reality/construkted_reality_v1.x/issues/1080
             *
             * why not remove all?
             * even if clipping box is not activated, user can rotate this.
             * distances of clipping planes is necessary to store at them.
             */

            // tileset.clippingPlanes.removeAll();
        }

        this._activated = false;
    }

    enable() {
        if (this.activated) {
            this._doActivate();
        }

        this._enabled = true;
    }

    disable() {
        if (this.activated) {
            const tileset = this._asset.tileset;

            tileset.clippingPlanes.removeAll();
        }

        this._enabled = false;
    }

    destroy() {
        if (this._enabled && this._activated) {
            const tileset = this._asset.tileset;

            if (tileset.clippingPlanes) {
                tileset.clippingPlanes.removeAll();
            }
        }

        destroyObject(this);
    }

    _initModelMatrixOfClippingPlanes() {
        const asset = this._asset;
        const tileset = asset.tileset;
        const referenceFrame = this._asset.getRefereceFrame(new Matrix4());

        // @ts-ignore
        // to remove the affect of modelMatrix of the tileset to clippingPlanes 's modelMatrix

        const inv = Matrix4.inverse(tileset.clippingPlanesOriginMatrix, new Matrix4());

        tileset.clippingPlanes.modelMatrix = Matrix4.multiply(inv, referenceFrame, new Matrix4());
    }
}
