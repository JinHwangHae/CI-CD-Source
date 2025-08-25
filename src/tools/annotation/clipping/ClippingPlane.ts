import {
    BoundingSphere,
    Cartesian2,
    Cartesian3,
    Color,
    createGuid,
    destroyObject,
    ScreenSpaceEventHandler,
    ScreenSpaceEventType,
    Viewer
} from "cesium";
import { PlanePrimitive, TilesetAssetGroup } from "../../../core";
import { TilesetAssetClippingPlane } from "./TilesetAssetClippingPlane";
import { ClippingPlaneArrow } from "./ClippingPlaneArrow";

export interface ClippingPlaneParameters {
    position: Cartesian3;
    normal: Cartesian3; // in world
    distance: number;
    dimensions: Cartesian2;
    clippingPlanes: { enabled: boolean; activated: boolean }[];
}
interface ConstructorOptions extends ClippingPlaneParameters {
    viewer: Viewer;
    assetGroup: TilesetAssetGroup;
}

const defaultPlaneColor = Color.WHITE.withAlpha(0.1);
const highlightPlaneColor = Color.WHITE.withAlpha(0.05);

const _scratchArrowPosition2d: Cartesian2 = new Cartesian2();
const _scratchOppositeArrowPosition2d: Cartesian2 = new Cartesian2();
const _scratchBoundingSphere: BoundingSphere = new BoundingSphere();
const _scratchAxisVector2d: Cartesian2 = new Cartesian2();
const _scratchMouseMoveVector: Cartesian2 = new Cartesian2();

export class ClippingPlane {
    private readonly _viewer: Viewer;
    private readonly _assetGroup: TilesetAssetGroup;
    private _id: string;
    private _assetClippingPlanes: TilesetAssetClippingPlane[];
    private _planePrimitive: PlanePrimitive;
    private _eventHandler: ScreenSpaceEventHandler;
    private _pickedPlane: boolean;
    private _editable: boolean;
    private _lastStatus: ClippingPlaneParameters | undefined;
    private _activated: boolean;
    private _initOptions: ClippingPlaneParameters;
    private _arrow: ClippingPlaneArrow;

    constructor(options: ConstructorOptions) {
        this._id = createGuid();

        const viewer = options.viewer;
        this._viewer = viewer;
        const assetGroup = options.assetGroup;

        this._assetGroup = assetGroup;
        this._assetClippingPlanes = [];

        for (let i = 0; i < this._assetGroup.assets.length; i++) {
            this._assetClippingPlanes.push(
                new TilesetAssetClippingPlane({
                    enabled: options.clippingPlanes[i].enabled,
                    activated: options.clippingPlanes[i].activated,
                    asset: this._assetGroup.assets[i],
                    position: options.position,
                    normal: options.normal,
                    distance: options.distance
                })
            );
        }

        this._planePrimitive = viewer.scene.primitives.add(
            new PlanePrimitive({
                position: options.position,
                normal: options.normal,
                dimensions: options.dimensions,
                distance: options.distance,
                color: defaultPlaneColor
            })
        );

        this._arrow = new ClippingPlaneArrow({
            scene: this._viewer.scene,
            position: options.position,
            normal: options.normal,
            distance: options.distance
        });

        this._pickedPlane = false;
        this._editable = false;

        this._eventHandler = new ScreenSpaceEventHandler(this._viewer.canvas);

        this._eventHandler.setInputAction(this.onLeftDown.bind(this), ScreenSpaceEventType.LEFT_DOWN);
        this._eventHandler.setInputAction(this.onMouseMove.bind(this), ScreenSpaceEventType.MOUSE_MOVE);
        this._eventHandler.setInputAction(this.onLeftUp.bind(this), ScreenSpaceEventType.LEFT_UP);

        this._activated = true;

        const clippingPlanes: { enabled: boolean; activated: boolean }[] = [];

        this._assetClippingPlanes.forEach((plane) => {
            clippingPlanes.push(plane.getStatus());
        });

        this._initOptions = {
            position: Cartesian3.clone(options.position, new Cartesian3()),
            normal: Cartesian3.clone(options.normal, new Cartesian3()),
            distance: options.distance,
            dimensions: Cartesian2.clone(options.dimensions, new Cartesian2()),
            clippingPlanes: clippingPlanes
        };
    }

    get showWall() {
        return this._planePrimitive.show;
    }

    set showWall(val) {
        this._planePrimitive.show = val;
    }

    get editable() {
        return this._editable;
    }

    set editable(val) {
        this._editable = val;

        this._arrow.show = val;
    }

    _pickPlanePrimitive(position: Cartesian2) {
        const pickedObject = this._viewer.scene.pick(position);

        if (
            pickedObject &&
            pickedObject.primitive &&
            Object.is(pickedObject.primitive, this._planePrimitive.primitive)
        ) {
            return true;
        }

        return false;
    }

    onLeftDown(event: { position: Cartesian2 }) {
        if (!this._editable) {
            return;
        }

        if (this._pickPlanePrimitive(event.position)) {
            this._pickedPlane = true;
            this._viewer.scene.screenSpaceCameraController.enableRotate = false;
            this._planePrimitive.color = highlightPlaneColor;
        }
    }

    onMouseMove(movement: { startPosition: Cartesian2; endPosition: Cartesian2 }) {
        if (!this._pickedPlane) {
            return;
        }

        const position = this._planePrimitive.position;
        const planeNormal = this._planePrimitive.worldNormal;

        const position1 = Cartesian3.add(position, planeNormal, new Cartesian3());

        const scene = this._viewer.scene;

        scene.cartesianToCanvasCoordinates(position, _scratchArrowPosition2d);
        scene.cartesianToCanvasCoordinates(position1, _scratchOppositeArrowPosition2d);

        // get pixel size for calculation move distance in meters
        _scratchBoundingSphere.center = position;
        const pixelSize = scene.camera.getPixelSize(
            _scratchBoundingSphere,
            scene.drawingBufferWidth,
            scene.drawingBufferHeight
        );

        // calculate scalar of mouse move
        Cartesian2.subtract(_scratchOppositeArrowPosition2d, _scratchArrowPosition2d, _scratchAxisVector2d);

        Cartesian2.subtract(movement.endPosition, movement.startPosition, _scratchMouseMoveVector);

        const move2d =
            Cartesian2.dot(_scratchAxisVector2d, _scratchMouseMoveVector) / Cartesian2.magnitude(_scratchAxisVector2d);

        const delta = move2d * pixelSize;

        this._planePrimitive.distance -= delta;

        this._assetClippingPlanes.forEach((plane) => {
            plane.move(-delta);
        });

        this._arrow.distance -= delta;
    }

    onLeftUp() {
        if (this._pickedPlane) {
            this._planePrimitive.color = defaultPlaneColor;
            this._pickedPlane = false;
            this._viewer.scene.screenSpaceCameraController.enableRotate = true;
        }
    }

    get id() {
        return this._id;
    }

    set id(val) {
        this._id = val;
    }

    get activated() {
        return this._activated;
    }

    getParameters() {
        const clippingPlanes: { enabled: boolean; activated: boolean }[] = [];

        this._assetClippingPlanes.forEach((plane) => {
            clippingPlanes.push(plane.getStatus());
        });

        return {
            id: this._id,
            position: this._planePrimitive.position,
            normal: this._planePrimitive.worldNormal,
            distance: this._planePrimitive.distance,
            dimensions: this._planePrimitive.dimensions,
            clippingPlanes: clippingPlanes
        } as ClippingPlaneParameters;
    }

    storeStatus() {
        this._lastStatus = this.getParameters();
    }

    restoreStatus() {
        console.assert(this._lastStatus, "error");

        this.loadParameters(this._lastStatus!);
    }

    loadParameters(data: ClippingPlaneParameters) {
        this._planePrimitive.position = data.position;
        this._planePrimitive.worldNormal = data.normal;
        this._planePrimitive.distance = data.distance;

        this._assetClippingPlanes.forEach((clippingPlane) => {
            clippingPlane.destroy();
        });

        this._assetClippingPlanes.length = 0;

        for (let i = 0; i < this._assetGroup.assets.length; i++) {
            this._assetClippingPlanes.push(
                new TilesetAssetClippingPlane({
                    enabled: data.clippingPlanes[i].enabled,
                    activated: data.clippingPlanes[i].activated,
                    asset: this._assetGroup.assets[i],
                    position: data.position,
                    normal: data.normal,
                    distance: data.distance
                })
            );
        }
    }

    activate() {
        if (this._activated) {
            return;
        }

        this._assetClippingPlanes.forEach((clippingPlane) => {
            clippingPlane.activate();
        });

        this._activated = true;
    }

    deactivate() {
        if (!this._activated) {
            return;
        }

        this._assetClippingPlanes.forEach((clippingPlane) => {
            clippingPlane.deactivate();
        });

        this._activated = false;
    }

    reset() {
        this._assetClippingPlanes.forEach((plane) => {
            plane.destroy();
        });

        this._assetClippingPlanes.length = 0;

        const options = this._initOptions;

        this._assetGroup.assets.forEach((asset) => {
            this._assetClippingPlanes.push(
                new TilesetAssetClippingPlane({
                    enabled: true,
                    activated: true,
                    asset: asset,
                    position: options.position,
                    normal: options.normal,
                    distance: options.distance
                })
            );
        });

        const viewer = this._viewer;

        viewer.scene.primitives.remove(this._planePrimitive);

        this._planePrimitive = viewer.scene.primitives.add(
            new PlanePrimitive({
                position: options.position,
                normal: options.normal,
                dimensions: options.dimensions,
                distance: options.distance,
                color: defaultPlaneColor
            })
        );
    }

    setTargetAsset(postId: string | undefined) {
        if (postId === undefined) {
            for (let i = 0; i < this._assetClippingPlanes.length; i++) {
                this._assetClippingPlanes[i].enable();
            }
        } else {
            for (let i = 0; i < this._assetClippingPlanes.length; i++) {
                if (this._assetClippingPlanes[i].asset.postId === postId) {
                    this._assetClippingPlanes[i].enable();
                } else {
                    this._assetClippingPlanes[i].disable();
                }
            }
        }
    }

    flipNormal() {
        this._assetClippingPlanes.forEach((clippingPlane) => {
            clippingPlane.flipNormal();
        });

        this._planePrimitive.flip();
        this._arrow.flip();
    }

    destroy() {
        this._assetClippingPlanes.forEach((clippingPlane) => {
            clippingPlane.destroy();
        });

        this._viewer.scene.primitives.remove(this._planePrimitive);

        this._arrow.destroy();

        destroyObject(this);
    }
}
