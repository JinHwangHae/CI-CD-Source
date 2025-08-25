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
    HorizontalOrigin,
    Label,
    LabelCollection,
    Model,
    Matrix4,
    PointPrimitive,
    PointPrimitiveCollection,
    PrimitiveCollection,
    Scene,
    SceneMode,
    ScreenSpaceEventHandler,
    ScreenSpaceEventType,
    VerticalOrigin
} from "cesium";

import getCursorStyle from "../getCursorStyle";

const scratchMatrix = new Matrix4();
const cartesianScratch = new Cartesian3();

class GCPMouseHandler {
    private readonly _sseh: ScreenSpaceEventHandler;
    private readonly _scene: Scene;
    private readonly _pointCollection: PointPrimitiveCollection;
    private readonly _labelCollection: LabelCollection;
    private _point: PointPrimitive | undefined;
    private _label: Label | undefined;
    private _modelMatrix: Matrix4;

    private readonly _pointOptions: any;
    private readonly _labelOptions: any;

    private _activated: boolean;
    private _activeGCPIndex: number;
    private readonly _GCPPlaced: Event;

    constructor(scene: Scene, tileset: Cesium3DTileset) {
        this._sseh = new ScreenSpaceEventHandler(scene.canvas);
        this._scene = scene;

        const primitiveCollection = new PrimitiveCollection();

        // @ts-ignore
        primitiveCollection.id = "GCPMouseHandler-PrimitiveCollection";

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

        // 0 based
        this._activeGCPIndex = -1;

        this._modelMatrix = tileset.modelMatrix.clone(new Matrix4());
        this._pointCollection.modelMatrix = tileset.modelMatrix;
        this._labelCollection.modelMatrix = tileset.modelMatrix;
        this._GCPPlaced = new Event();
    }

    activate() {
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

        let position: Cartesian3 | undefined;
        const mousePosition = click.position;

        if (scene.pickPositionSupported) {
            const pickedObject = scene.pick(mousePosition, 1, 1);

            if (
                defined(pickedObject) &&
                (pickedObject instanceof Cesium3DTileFeature ||
                    pickedObject.primitive instanceof Cesium3DTileset ||
                    pickedObject.primitive instanceof Model)
            ) {
                // check to let us know if we should pick against the globe instead
                position = scene.pickPosition(mousePosition, cartesianScratch);
            }
        }

        if (!defined(position)) {
            alert("Click correctly tileset!");
            return;
        }

        const localPosition = this._getLocalPosition(position!, position!);

        this._point!.position = localPosition;
        this._point!.show = true;

        const label = this._label!;

        label.position = localPosition;
        label.show = true;
        label.text = `GCP0${this._activeGCPIndex + 1}`;

        if (scene.requestRenderMode) {
            scene.requestRender();
        }

        // @ts-ignore
        this._GCPPlaced.raiseEvent(this._activeGCPIndex);
    }

    // index starts from 0
    setActiveGCPIndex(index: number) {
        if (this._pointCollection.length < index + 1) {
            while (this._pointCollection.length < index + 1) {
                this._pointCollection.add(this._pointOptions);
                this._labelCollection.add(this._labelOptions);
            }
        }

        this._point = this._pointCollection.get(index);
        this._label = this._labelCollection.get(index);

        this._activeGCPIndex = index;
    }

    hideGCP(index: number) {
        if (this._pointCollection.length >= index + 1) {
            const point = this._pointCollection.get(index);
            const label = this._labelCollection.get(index);

            point.show = false;
            label.show = false;
        }
    }

    _getLocalPosition(position: Cartesian3, result: Cartesian3) {
        const inv = Matrix4.inverse(this._modelMatrix, scratchMatrix);

        return Matrix4.multiplyByPoint(inv, position, result);
    }

    forceUpdate() {
        // @ts-ignore
        this._pointCollection._createVertexArray = true;

        const positions = [];

        for (let i = 0; i < this._labelCollection.length; ++i) {
            positions.push(this._labelCollection.get(i).position);
        }

        this._labelCollection.removeAll();

        positions.forEach((position, index) => {
            const label = this._labelCollection.add(this._labelOptions);

            label.position = position;
            label.show = true;
            label.text = `GCP0${index + 1}`;
        });

        this.setActiveGCPIndex(this._activeGCPIndex);
    }

    insertNew(position: Cartesian3, index: number) {
        const point = this._pointCollection.add(this._pointOptions);

        point.position = position;
        point.show = true;

        const label = this._labelCollection.add(this._labelOptions);

        label.position = position;
        label.show = true;
        label.text = `GCP0${index + 1}`;
    }

    showAllPoints() {
        this._pointCollection.show = true;
        this._labelCollection.show = true;
    }

    hideAllPoints() {
        this._pointCollection.show = false;
        this._labelCollection.show = false;
    }

    count() {
        return this._pointCollection.length;
    }

    clear() {
        this._pointCollection.removeAll();
        this._labelCollection.removeAll();

        this._activeGCPIndex = -1;
    }

    get activated() {
        return this._activated;
    }

    get pointCollection() {
        return this._pointCollection;
    }

    get modelMatrix() {
        return this._modelMatrix;
    }

    set modelMatrix(m: Matrix4) {
        this._modelMatrix = m;
        this._pointCollection.modelMatrix = m;
        this._labelCollection.modelMatrix = m;
    }

    get GCPPlaced() {
        return this._GCPPlaced;
    }
}

export default GCPMouseHandler;
