/* qeslint-disable */
// q@ts-nocheck

import {
    Cartesian2,
    Cartesian3,
    Cesium3DTileFeature,
    Cesium3DTileset,
    Color,
    Event,
    HorizontalOrigin,
    LabelCollection,
    PointPrimitiveCollection,
    PrimitiveCollection,
    Scene,
    SceneMode,
    ScreenSpaceEventHandler,
    ScreenSpaceEventType,
    VerticalOrigin
} from "cesium";

import getCursorStyle from "./getCursorStyle";

class AutoScaleMouseHandler {
    private _scene: Scene;
    private _sseh: ScreenSpaceEventHandler;
    private _pointCollection: PointPrimitiveCollection;
    private _labelCollection: LabelCollection;
    private _pointOptions: {
        pixelSize: number;
        color: Color;
        position: Cartesian3;
        disableDepthTestDistance: number;
        show: boolean;
    };

    private _labelOptions: {
        show: boolean;
        font: string;
        scale: number;
        fillColor: Color;
        showBackground: boolean;
        backgroundColor: Color;
        backgroundPadding: Cartesian2;
        horizontalOrigin: HorizontalOrigin;
        verticalOrigin: VerticalOrigin;
        pixelOffset: Cartesian2;
        disableDepthTestDistance: number;
        position: Cartesian3;
    };

    private _activated: boolean;
    private _preparedTwoPoints: Event;

    constructor(scene: Scene) {
        this._sseh = new ScreenSpaceEventHandler(scene.canvas);
        this._scene = scene;

        const primitiveCollection = new PrimitiveCollection();

        // @ts-ignore
        primitiveCollection.id = "AutoScaleMouseHandler-PrimitiveCollection";

        const primitives = scene.primitives.add(primitiveCollection);
        const points = primitives.add(new PointPrimitiveCollection());
        const labels = primitives.add(new LabelCollection());

        this._pointCollection = points;
        this._labelCollection = labels;

        this._pointOptions = {
            pixelSize: 10,
            color: Color.YELLOW,
            position: new Cartesian3(),
            disableDepthTestDistance: Number.POSITIVE_INFINITY, // for draw-over
            show: false
        };

        this._labelOptions = {
            show: false,
            font: "16px Lucida Console",
            scale: 1.0,
            fillColor: Color.WHITE,
            showBackground: true,
            backgroundColor: new Color(0.165, 0.165, 0.165, 0.8),
            backgroundPadding: new Cartesian2(7, 5),
            horizontalOrigin: HorizontalOrigin.LEFT,
            verticalOrigin: VerticalOrigin.CENTER,
            pixelOffset: new Cartesian2(10, 0),
            disableDepthTestDistance: Number.POSITIVE_INFINITY, // for draw-over
            position: new Cartesian3()
        };

        this._activated = false;
        this._preparedTwoPoints = new Event();
    }

    get activated() {
        return this._activated;
    }

    get pointCollection() {
        return this._pointCollection;
    }

    get preparedTwoPoints() {
        return this._preparedTwoPoints;
    }

    activate() {
        this._pointCollection.removeAll();
        this._labelCollection.removeAll();

        const sseh = this._sseh;
        sseh.setInputAction(this._click.bind(this), ScreenSpaceEventType.LEFT_CLICK);

        const canvas = this._scene.canvas;

        canvas.style.cursor = getCursorStyle();

        this._activated = true;
    }

    deactivate() {
        const sseh = this._sseh;

        sseh.removeInputAction(ScreenSpaceEventType.LEFT_CLICK);

        const canvas = this._scene.canvas;

        canvas.style.cursor = "default";
        this._activated = false;
    }

    _click(click: { position: Cartesian2 }) {
        this._handleClick(click);
    }

    _handleClick(click: { position: Cartesian2 }) {
        const scene = this._scene;

        if (scene.mode === SceneMode.MORPHING) {
            return;
        }

        let position;
        const mousePosition = click.position;

        if (!scene.pickPositionSupported) {
            alert("Picking is not supported");
            return;
        }

        const pickedObject = scene.pick(mousePosition, 1, 1);

        if (!pickedObject) {
            alert("Click correctly tileset!");
            return;
        }

        if (pickedObject instanceof Cesium3DTileFeature || pickedObject.primitive instanceof Cesium3DTileset) {
            position = scene.pickPosition(click.position);
        }

        if (!position) {
            alert("Click correctly tileset");
            return;
        }

        this.insertNew(position, this._pointCollection.length);

        if (this._pointCollection.length === 2) {
            this.deactivate();
            this._preparedTwoPoints.raiseEvent();
        }
    }

    insertNew(position: Cartesian3, index: number) {
        const point = this._pointCollection.add(this._pointOptions);

        point.position = position;
        point.show = true;

        const label = this._labelCollection.add(this._labelOptions);

        label.position = position;
        label.show = true;
        label.text = `Point ${index + 1}`;
    }

    clear() {
        this._pointCollection.removeAll();
        this._labelCollection.removeAll();
    }
}

export default AutoScaleMouseHandler;
