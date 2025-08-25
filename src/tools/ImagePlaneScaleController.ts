import { Cartesian3, Color, destroyObject, Event, Matrix4, Model, Scene, Transforms } from "cesium";
import { ImagePlane } from "./annotation";
import { calculateModelScale } from "../core/calculateModelScale";

export enum ImagePlaneScaleControllerType {
    PositiveX = 1,
    NegativeX = 2,
    PositiveY = 3,
    NegativeY = 4
}

const PIXEL_SIZE = 50;

const localPointScratch = new Cartesian3();

export class ImagePlaneScaleController {
    private readonly _scene: Scene;
    private readonly _imagePlane: ImagePlane;
    private readonly _type: ImagePlaneScaleControllerType;
    private _model: Model | undefined;
    private readonly _removeCallback: Event.RemoveCallback;
    private _show: boolean;

    constructor(options: { scene: Scene; imagePlane: ImagePlane; type: ImagePlaneScaleControllerType }) {
        this._scene = options.scene;
        this._imagePlane = options.imagePlane;
        this._type = options.type;

        const url = `${window.Construkted.assetsRootUrl()}/glbs/sphere.glb`;

        this._show = true;

        const promise = Model.fromGltfAsync({
            show: this._show,
            url: url,
            color: Color.YELLOW
        });

        promise.then((model: Model) => {
            this._model = model;
            this._scene.primitives.add(this._model);
        });

        this._removeCallback = this._scene.preRender.addEventListener(() => {
            this._onPreRender();
        });
    }

    get type() {
        return this._type;
    }

    get primitive() {
        return this._model;
    }

    _onPreRender() {
        if (!this._model) {
            return;
        }

        if (!this._model.ready) {
            return;
        }

        if (this._show) {
            this._updateModelMatrix();
            this._model.scale = calculateModelScale(this._scene, this._model, PIXEL_SIZE);
        }
    }

    calcPosition() {
        const planePrimitive = this._imagePlane.planePrimitive;
        const modelMatrix = planePrimitive.modelMatrix;
        const unitScaleModelMatrix = Matrix4.setScale(modelMatrix, Cartesian3.ONE, new Matrix4());
        const dimension = planePrimitive.dimensions;

        if (this._type === ImagePlaneScaleControllerType.PositiveX) {
            Cartesian3.multiplyByScalar(Cartesian3.UNIT_X, dimension.x / 2, localPointScratch);
        } else if (this._type === ImagePlaneScaleControllerType.NegativeX) {
            Cartesian3.multiplyByScalar(Cartesian3.UNIT_X, -dimension.x / 2, localPointScratch);
        } else if (this._type === ImagePlaneScaleControllerType.PositiveY) {
            Cartesian3.multiplyByScalar(Cartesian3.UNIT_Y, dimension.y / 2, localPointScratch);
        } else if (this._type === ImagePlaneScaleControllerType.NegativeY) {
            Cartesian3.multiplyByScalar(Cartesian3.UNIT_Y, -dimension.y / 2, localPointScratch);
        }

        return Matrix4.multiplyByPoint(unitScaleModelMatrix, localPointScratch, new Cartesian3());
    }

    _updateModelMatrix() {
        if (!this._model) {
            return;
        }

        if (this._show !== this._model.show) {
            this._model.show = this._show;
        }

        const position = this.calcPosition();
        const transform = Transforms.eastNorthUpToFixedFrame(position);

        this._model.modelMatrix = transform;
    }

    destroy() {
        this._removeCallback();

        this._scene.primitives.remove(this._model);

        destroyObject(this);
    }
}
