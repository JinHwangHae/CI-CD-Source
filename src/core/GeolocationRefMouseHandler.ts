/* qeslint-disable */
// q@ts-nocheck

import {
    Cartesian2,
    Cartesian3,
    Cesium3DTileFeature,
    Cesium3DTileset,
    Color,
    defined,
    Event,
    PointPrimitive,
    PointPrimitiveCollection,
    PrimitiveCollection,
    Scene,
    SceneMode,
    ScreenSpaceEventHandler,
    ScreenSpaceEventType
} from "cesium";

import getCursorStyle from "./getCursorStyle";

const cartesianScratch = new Cartesian3();

class GeolocationRefMouseHandler {
    private readonly _sseh: ScreenSpaceEventHandler;
    private readonly _scene: Scene;
    private readonly _pointCollection: PointPrimitiveCollection;
    private _refPoint: PointPrimitive;

    private readonly _pointOptions: any;

    private _activated: boolean;
    private readonly _pointSelected: Event;

    constructor(scene: Scene) {
        this._sseh = new ScreenSpaceEventHandler(scene.canvas);
        this._scene = scene;

        const primitiveCollection = new PrimitiveCollection();

        // @ts-ignore
        primitiveCollection.id = "GeolocationRefMouseHandler-PrimitiveCollection";

        const primitives = scene.primitives.add(primitiveCollection);
        const points = primitives.add(new PointPrimitiveCollection());
        this._pointCollection = points;

        this._pointOptions = {
            pixelSize: 10,
            color: Color.YELLOW,
            position: new Cartesian3(),
            disableDepthTestDistance: Number.POSITIVE_INFINITY, // for draw-over
            show: false
        };

        this._refPoint = this._pointCollection.add(this._pointOptions);

        this._activated = false;
        this._pointSelected = new Event();
    }

    activate() {
        const sseh = this._sseh;
        sseh.setInputAction(this._handleLeftClick.bind(this), ScreenSpaceEventType.LEFT_CLICK);
        sseh.setInputAction(this._handleRightClick.bind(this), ScreenSpaceEventType.RIGHT_CLICK);

        const canvas = this._scene.canvas;

        canvas.style.cursor = getCursorStyle();

        this._activated = true;
        // this._refPoint.show = true;
    }

    _doDeactivate() {
        const sseh = this._sseh;

        sseh.removeInputAction(ScreenSpaceEventType.LEFT_CLICK);
        sseh.removeInputAction(ScreenSpaceEventType.RIGHT_CLICK);

        const canvas = this._scene.canvas;

        canvas.style.cursor = "default";

        this._activated = false;
    }

    deactivate() {
        this._doDeactivate();

        this._refPoint.position = new Cartesian3();
        this._refPoint.show = false;
    }

    _handleLeftClick(click: { position: Cartesian2 }) {
        const scene = this._scene;

        if (scene.mode === SceneMode.MORPHING) {
            return;
        }

        let position: Cartesian3 | undefined;
        const mousePosition = click.position;

        if (scene.pickPositionSupported) {
            const pickedObject = scene.pick(mousePosition, 1, 1);

            if (
                defined(pickedObject) &&
                (pickedObject instanceof Cesium3DTileFeature || pickedObject.primitive instanceof Cesium3DTileset)
            ) {
                // check to let us know if we should pick against the globe instead
                position = scene.pickPosition(mousePosition, cartesianScratch);
            }
        }

        if (!defined(position)) {
            alert("Click correctly tileset!");
            return;
        }

        this._refPoint!.position = position!;
        this._refPoint!.show = true;

        if (scene.requestRenderMode) {
            scene.requestRender();
        }

        // @ts-ignore
        this._pointSelected.raiseEvent(position!);

        this._doDeactivate();
    }

    _handleRightClick() {
        this.deactivate();
    }

    showRefPoint() {
        this._refPoint.show = true;
    }

    updateRefPointPosition(pos: Cartesian3) {
        this._refPoint.position = pos;
    }

    get activated() {
        return this._activated;
    }

    get pointCollection() {
        return this._pointCollection;
    }

    get pointSelected() {
        return this._pointSelected;
    }
}

export default GeolocationRefMouseHandler;
