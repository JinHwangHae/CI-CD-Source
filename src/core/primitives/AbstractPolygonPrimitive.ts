// q@ts-nocheck
/* qeslint-disable */
import {
    BoundingSphere,
    Cartesian3,
    Color,
    createGuid,
    defaultValue,
    destroyObject,
    DeveloperError,
    // @ts-ignore
    FrameState,
    GroundPrimitive,
    Math as CesiumMath,
    Matrix4,
    Primitive
} from "cesium";

export declare type AbstractPolygonPrimitiveConstructorOptions = {
    show?: boolean;
    color?: Color;
    positions?: Cartesian3[];
    depthTest?: boolean;
    clampToGround?: boolean;
    allowPicking?: boolean;
};

export abstract class AbstractPolygonPrimitive {
    public show: boolean = true;

    protected _id: string;
    protected _color: Color;
    protected _depthFailColor: Color;
    protected _positions: Cartesian3[];
    private _boundingSphere: BoundingSphere;
    protected _primitive: Primitive | GroundPrimitive | undefined;
    protected _update: boolean;
    protected _depthTest: boolean;
    protected _clampToGround: boolean;
    protected readonly _modelMatrix: Matrix4;
    protected _allowPicking: boolean;

    constructor(options: AbstractPolygonPrimitiveConstructorOptions) {
        this.show = defaultValue(options.show, true);
        const color = Color.clone(defaultValue(options.color, Color.WHITE));
        this._id = createGuid();
        this._color = color;
        this._depthFailColor = color;
        this._positions = defaultValue(options.positions, []);

        this._boundingSphere = new BoundingSphere();
        this._primitive = undefined;
        this._update = true;
        this._depthTest = defaultValue(options.depthTest, false);
        this._clampToGround = defaultValue(options.clampToGround, false);
        this._modelMatrix = Matrix4.clone(Matrix4.IDENTITY);
        this._allowPicking = defaultValue(options.allowPicking, false);
    }

    get positions() {
        return this._positions;
    }

    set positions(positions) {
        this._positions = positions;
        this._update = true;
    }

    get color() {
        return this._color;
    }

    set color(color: Color) {
        this._color = color;
        this._depthFailColor = color;
        this._update = true;
    }

    get boundingVolume() {
        return this._boundingSphere;
    }

    get id() {
        return this._id;
    }

    set id(id) {
        this._id = id;
    }

    get clampToGround() {
        return this._clampToGround;
    }

    set clampToGround(val: boolean) {
        if (val === this._clampToGround) {
            return;
        }

        this._clampToGround = val;
        this._update = true;
    }

    get modelMatrix() {
        return this._modelMatrix;
    }

    set modelMatrix(value: Matrix4) {
        if (Matrix4.equalsEpsilon(value, this._modelMatrix, CesiumMath.EPSILON10)) {
            return;
        }

        Matrix4.clone(value, this._modelMatrix);
        this._update = true;
    }

    get primitive() {
        return this._primitive;
    }

    get allowPicking() {
        return this._allowPicking;
    }

    set allowPicking(b: boolean) {
        this._allowPicking = b;
        this._update = true;
    }

    insertPosition(index: number, position: Cartesian3) {
        this._positions.splice(index, 0, position);
        this._update = true;
    }

    removePositon(index: number) {
        this._positions.splice(index, 1);
        this._update = true;
    }

    updatePosition(index: number, position: Cartesian3) {
        if (index >= this._positions.length) {
            throw new DeveloperError("invalid point index");
        }

        position.clone(this._positions[index]);
        this._update = true;
    }

    forceUpdate() {
        this._update = true;
    }

    update(frameState: FrameState) {
        if (!this.show) {
            return;
        }

        const positions = this._positions;

        if (positions.length < 3) {
            if (this._primitive) {
                this._primitive.destroy();
                this._primitive = undefined;
            }
            return;
        }

        if (this._update) {
            this._update = false;

            if (this._primitive) this._primitive.destroy();

            this.createPrimitive();

            this._boundingSphere = BoundingSphere.fromPoints(positions, this._boundingSphere);
        }

        // @ts-ignore
        this._primitive!.update(frameState);
    }

    // eslint-disable-next-line class-methods-use-this
    isDestroyed() {
        return false;
    }

    destroy() {
        if (this._primitive) this._primitive.destroy();
        return destroyObject(this);
    }

    abstract createPrimitive(): void;
}
