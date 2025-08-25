import {
    Cartesian3,
    Color,
    destroyObject,
    Event,
    Matrix4,
    Model,
    PrimitiveCollection,
    Scene,
    Transforms
} from "cesium";

import { calculateModelScale } from "../../../../core/calculateModelScale";

const PIXEL_SIZE = 30;

interface SliceArrowConstructorOptions {
    scene: Scene;
    side: string;
    oppositeSide: string;
    uri: string;
    color: Color;
    positionUpdateCallback: (side: string) => Cartesian3;
    primitiveCollection: PrimitiveCollection;
}

class SliceArrow {
    private _show: boolean;
    private readonly _scene: Scene;
    private readonly _primitiveCollection: PrimitiveCollection;
    private readonly _side;
    private readonly _oppositeSide;
    private readonly _color: Color;
    private _model: Model | undefined;
    private _scratchModelMatrix: Matrix4 = new Matrix4();
    private _scratchPosition: Cartesian3 = new Cartesian3();
    private readonly _positionUpdateCallback: (side: string) => Cartesian3;

    private readonly _removeCallback: Event.RemoveCallback;

    constructor(options: SliceArrowConstructorOptions) {
        this._show = true;
        this._side = options.side;
        this._oppositeSide = options.oppositeSide;
        this._color = options.color;
        this._positionUpdateCallback = options.positionUpdateCallback;

        const promise = Model.fromGltfAsync({
            show: this._show,
            id: this._side,
            url: options.uri,
            color: options.color
        });

        this._primitiveCollection = options.primitiveCollection;

        promise.then((model: Model) => {
            this._model = model;
            this._primitiveCollection.add(this._model);
        });

        const scene = options.scene;

        this._scene = scene;

        this._removeCallback = scene.preRender.addEventListener(() => {
            this._onPreRender();
        });
    }

    _onPreRender() {
        this.update();
    }

    update() {
        if (!this._model) {
            return;
        }

        if (!this._model.ready) {
            return;
        }

        if (this._show !== this._model.show) {
            this._model.show = this._show;
        }

        const position = this._positionUpdateCallback(this._side);

        this._model.modelMatrix = Transforms.eastNorthUpToFixedFrame(position, undefined, this._scratchModelMatrix);

        this._model.scale = calculateModelScale(this._scene, this._model, PIXEL_SIZE);
    }

    get side() {
        return this._side;
    }

    get oppositeSide() {
        return this._oppositeSide;
    }

    get originalColor() {
        return this._color;
    }

    set color(color: Color) {
        if (!this._model) {
            return;
        }

        this._model.color = color;
    }

    set show(val: boolean) {
        this._show = val;

        if (!this._model) {
            return;
        }

        this._model.show = val;
    }

    get position() {
        return Matrix4.getTranslation(this._scratchModelMatrix, this._scratchPosition);
    }

    get model() {
        return this._model;
    }

    destroy() {
        this._removeCallback();

        this._primitiveCollection.remove(this._model);

        destroyObject(this);
    }
}

export default SliceArrow;
