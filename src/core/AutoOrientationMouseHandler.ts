/* qeslint-disable */
// @qts-nocheck

import {
    Cartesian2,
    Cartesian3,
    Cesium3DTileFeature,
    Cesium3DTileset,
    Color,
    Event,
    HorizontalOrigin,
    LabelCollection,
    Matrix4,
    PointPrimitiveCollection,
    PrimitiveCollection,
    Scene,
    SceneMode,
    ScreenSpaceEventHandler,
    ScreenSpaceEventType,
    VerticalOrigin
} from "cesium";

import { TilesetAsset } from "./TilesetAsset";
import getCursorStyle from "./getCursorStyle";

class AutoOrientationMouseHandler {
    private readonly _asset: TilesetAsset;
    private readonly _sseh: ScreenSpaceEventHandler;
    private readonly _scene: Scene;
    private readonly _localPositions: Cartesian3[] = [];
    private readonly _pointCollection: PointPrimitiveCollection;
    private readonly _labelCollection: LabelCollection;
    private readonly _pointOptions: any;
    private readonly _labelOptions: any;
    private _activated: boolean;
    private readonly _preparedThreePoints: Event;

    constructor(options: { asset: TilesetAsset; scene: Scene }) {
        const scene = options.scene;

        this._asset = options.asset;
        this._sseh = new ScreenSpaceEventHandler(scene.canvas);
        this._scene = scene;

        const primitiveCollection = new PrimitiveCollection();

        // @ts-ignore
        primitiveCollection.id = "AutoOrientationMouseHandler-PrimitiveCollection";

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
        this._preparedThreePoints = new Event();
    }

    activate() {
        this.clear();

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

        if (this._pointCollection.length === 3) {
            this.deactivate();
            this._preparedThreePoints.raiseEvent();
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

        const matrix = this._asset.worldToLocalMatrix(new Matrix4());

        this._localPositions.push(Matrix4.multiplyByPoint(matrix, position, new Cartesian3()));
    }

    clear() {
        this._localPositions.length = 0;

        this._pointCollection.modelMatrix = Matrix4.IDENTITY;
        this._labelCollection.modelMatrix = Matrix4.IDENTITY;

        this._pointCollection.removeAll();
        this._labelCollection.removeAll();
    }

    updatePositions() {
        const matrix = this._asset.localToWorldMatrix(new Matrix4());

        for (let i = 0; i < this._localPositions.length; i++) {
            const localPosition = this._localPositions[i];

            const world = Matrix4.multiplyByPoint(matrix, localPosition, new Cartesian3());

            this._pointCollection.get(i).position = world;
            this._labelCollection.get(i).position = world;
        }
    }

    get activated() {
        return this._activated;
    }

    get pointCollection() {
        return this._pointCollection;
    }

    get preparedThreePoints() {
        return this._preparedThreePoints;
    }
}

export default AutoOrientationMouseHandler;
