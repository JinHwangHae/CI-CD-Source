/* qeslint-disable */
// q@ts-nocheck

import { Cartesian3, Cartographic, destroyObject, Event } from "cesium";
import { MapTool, MapToolConstructorOptions, MouseEvent, TilesetAssetGroup } from "../../../core";
import { ClippingBox, ClippingBoxParameters } from "./clippingbox/ClippingBox";

function getExtrudedPosition(position: Cartesian3, height: number) {
    const carto = Cartographic.fromCartesian(position);

    return Cartesian3.fromRadians(carto.longitude, carto.latitude, carto.height + height);
}

export class ClippingBoxTool extends MapTool {
    private _tilesetAssetGroup: TilesetAssetGroup | undefined;
    private readonly _clippingBoxCreated: Event;
    private readonly _clippingBoxes: ClippingBox[];
    private _lastActiveClippingBoxId: string;

    constructor(options: MapToolConstructorOptions) {
        super(options);

        this._clippingBoxes = [];
        this._clippingBoxCreated = new Event();
        this._lastActiveClippingBoxId = "";
    }

    get clippingBoxCreated() {
        return this._clippingBoxCreated;
    }

    get clippingBoxes() {
        return this._clippingBoxes;
    }

    activate(options: { tilesetAssetGroup: TilesetAssetGroup }) {
        super.activate(options);

        this._tilesetAssetGroup = options.tilesetAssetGroup;
    }

    deactivate(deactivateOptions: any) {
        super.deactivate(deactivateOptions);
    }

    canvasClickEvent(event: MouseEvent): void {
        const position = this.getWorldPositionOn3DTiles(event.pos, new Cartesian3());

        if (!position) {
            return;
        }

        const dimension = this._calcDimension(position);

        const clippingBox = new ClippingBox({
            viewer: this._viewer
        });

        this.storeStatus();
        this.deactivateAll();

        clippingBox.doActivate({
            center: getExtrudedPosition(position, dimension[2] / 2),
            dimension: new Cartesian3(dimension[0], dimension[1], dimension[2]),
            tilesetAssetGroup: this._tilesetAssetGroup!
        });

        this._clippingBoxes.push(clippingBox);
        // @ts-ignore
        this._clippingBoxCreated.raiseEvent(this._clippingBoxes.length - 1);
    }

    _calcDimension(position: Cartesian3) {
        const scene = this._viewer.scene;
        const camera = scene.camera;
        const distance = Cartesian3.distance(camera.position, position);
        // @ts-ignore
        const fov = camera.frustum.fov;
        const height = Math.tan(fov / 2) * distance;
        // @ts-ignore
        const width = camera.frustum.aspectRatio * height;
        const carto = Cartographic.fromCartesian(position);

        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const verticalHeight = camera.positionCartographic.height - carto.height;

        const ratio = 4;

        return [width / ratio, width / ratio, width / ratio];
    }

    removeClippingBoxById(id: string) {
        const index = this._clippingBoxes.findIndex((clippingBox) => clippingBox.id === id);

        if (index === -1) {
            return false;
        }

        const clippingBox = this._clippingBoxes[index];

        clippingBox.destroy();

        this._clippingBoxes.splice(index, 1);

        return true;
    }

    getClippingBoxById(id: string) {
        const index = this._clippingBoxes.findIndex((clippingBox) => clippingBox.id === id);

        if (index === -1) {
            return undefined;
        }

        return this._clippingBoxes[index];
    }

    loadData(data: ClippingBoxParameters) {
        const viewer = this._viewer;

        const clippingBox = new ClippingBox({
            viewer: viewer
        });

        /**
         * https://github.com/Construkted-Reality/construkted_reality_v1.x/issues/1078
         *
         * The state of Activate/Deactivate should not be saved.
         * When the Project is re-opened, none of the clipping boxes should be active.
         * All the clipping boxes should show the walls on the Cesium view so that the user knows there are clipping boxes at those locations.
         */

        data.activated = false;

        data.clippingBoxes.forEach((clipBox) => {
            clipBox.activated = false;
        });

        data.showWall = true;

        clippingBox.loadParameters(data);

        this._clippingBoxes.push(clippingBox);

        clippingBox.showWall = data.showWall;

        clippingBox.showHideEditingBalls(false);

        return clippingBox;
    }

    activateClippingBox(id: string) {
        for (let i = 0; i < this._clippingBoxes.length; i++) {
            const clippingBox = this._clippingBoxes[i];

            clippingBox.deactivate();
        }

        for (let i = 0; i < this._clippingBoxes.length; i++) {
            const clippingBox = this._clippingBoxes[i];

            if (clippingBox.id === id) {
                clippingBox.activate();
            }
        }
    }

    deactivateClippingBox(id: string) {
        const clippingBox = this.getClippingBoxById(id);

        if (!clippingBox) {
            return;
        }

        clippingBox.deactivate();
    }

    storeStatus() {
        this._clippingBoxes.forEach((clippingBox) => {
            if (clippingBox.activated) {
                this._lastActiveClippingBoxId = clippingBox.id;
            }
            clippingBox.storeStatus();
        });
    }

    restoreStatus() {
        this._clippingBoxes.forEach((clippingBox) => {
            clippingBox.restoreStatus();
        });

        if (this._lastActiveClippingBoxId) {
            const clippingBox = this.getClippingBoxById(this._lastActiveClippingBoxId);
            if (clippingBox) {
                clippingBox.activate();
            }

            this._lastActiveClippingBoxId = "";
        }
    }

    deactivateAll() {
        this._clippingBoxes.forEach((clippingBox) => {
            clippingBox.deactivate();
        });
    }

    // eslint-disable-next-line class-methods-use-this, @typescript-eslint/no-unused-vars
    canvasMoveEvent(event: MouseEvent): void {}

    // eslint-disable-next-line class-methods-use-this
    isDestroyed() {
        return false;
    }

    /**
     * Destroys the measurement.
     */
    destroy() {
        return destroyObject(this);
    }

    // eslint-disable-next-line class-methods-use-this
    reset() {}
}
