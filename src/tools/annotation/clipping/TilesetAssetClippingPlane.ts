import { Cartesian3, ClippingPlane, ClippingPlaneCollection, destroyObject, Matrix4, Transforms } from "cesium";
import { TilesetAsset } from "../../../core";

interface ConstructorOptions {
    enabled: boolean;
    activated: boolean;
    asset: TilesetAsset;
    position: Cartesian3;
    normal: Cartesian3; // in world
    distance: number;
}

/**
 * Computes offset between two positions
 */
function getPositionsOffset(position: Cartesian3, targetPosition: Cartesian3, planeNormal: Cartesian3) {
    const diff = Cartesian3.subtract(position, targetPosition, new Cartesian3());
    const offset = Cartesian3.multiplyComponents(diff, planeNormal, new Cartesian3());

    return offset.x + offset.y + offset.z;
}

export class TilesetAssetClippingPlane {
    private readonly _asset: TilesetAsset;
    private _prevNormal: Cartesian3 = new Cartesian3(); // in local
    private _prevDistance: number;
    private _activated: boolean;
    private _enabled: boolean;

    constructor(options: ConstructorOptions) {
        this._asset = options.asset;

        const tileset = this._asset.tileset;

        if (tileset.clippingPlanes) {
            tileset.clippingPlanes.removeAll();
        } else {
            tileset.clippingPlanes = new ClippingPlaneCollection({
                planes: [],
                edgeWidth: 1.0,
                unionClippingRegions: true
            });
        }

        const clippingPlanes = tileset.clippingPlanes;

        const asset = options.asset;
        const tilesetOrigin = asset.originqq;
        const tilesetEastNorthUpFrame = Transforms.eastNorthUpToFixedFrame(tilesetOrigin);
        const inverse = Matrix4.inverse(tilesetEastNorthUpFrame, new Matrix4());
        const worldNormal = options.normal;
        const localNormal = Matrix4.multiplyByPointAsVector(inverse, worldNormal, new Cartesian3());

        Cartesian3.normalize(localNormal, localNormal);

        const distance = getPositionsOffset(tilesetOrigin, options.position, worldNormal);

        clippingPlanes.add(new ClippingPlane(localNormal, options.distance + distance));

        Cartesian3.clone(localNormal, this._prevNormal);
        this._prevDistance = options.distance + distance;

        this._initModelMatrixOfClippingPlanes();

        this._activated = true;
        this._enabled = true;

        if (!options.activated) {
            this.deactivate();
        }

        if (!options.enabled) {
            this.disable();
        }
    }

    get asset() {
        return this._asset;
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

    move(moveAmount: number) {
        const clippingPlanes = this._asset.tileset.clippingPlanes;

        const curDistance = clippingPlanes.get(0).distance;

        clippingPlanes.get(0).distance = curDistance + moveAmount;

        this._prevDistance = clippingPlanes.get(0).distance;
    }

    get activated() {
        return this._activated;
    }

    _doActivate() {
        const tileset = this._asset.tileset;

        if (tileset.clippingPlanes) {
            tileset.clippingPlanes.removeAll();
        } else {
            tileset.clippingPlanes = new ClippingPlaneCollection({
                planes: [],
                edgeWidth: 1.0,
                unionClippingRegions: true
            });
        }

        tileset.clippingPlanes.enabled = true;

        const clippingPlanes = this._asset.tileset.clippingPlanes;

        clippingPlanes.add(new ClippingPlane(this._prevNormal, this._prevDistance)); // left

        this._initModelMatrixOfClippingPlanes();
    }

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

    getStatus() {
        return {
            enabled: this._enabled,
            activated: this._activated
        };
    }

    flipNormal() {
        const tileset = this._asset.tileset;
        const clippingPlane = tileset.clippingPlanes.get(0);

        // @ts-ignore
        const normal = clippingPlane._normal._cartesian3;

        Cartesian3.multiplyByScalar(normal, -1, normal);

        clippingPlane.distance = -clippingPlane.distance;
    }

    destroy() {
        const tileset = this._asset.tileset;

        if (tileset.clippingPlanes) {
            tileset.clippingPlanes.removeAll();
        }

        destroyObject(this);
    }
}
