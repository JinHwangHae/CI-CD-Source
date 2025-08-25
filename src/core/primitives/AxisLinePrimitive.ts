/* qeslint-disable */
// q@ts-nocheck

import {
    ArcType,
    BoundingSphere,
    Color,
    ColorGeometryInstanceAttribute,
    defaultValue,
    destroyObject,
    // @ts-ignore
    FrameState,
    GeometryInstance,
    Math as CesiumMath,
    Material,
    Matrix4,
    PolylineColorAppearance,
    PolylineGeometry,
    PolylineMaterialAppearance,
    Primitive,
    Cartesian3
} from "cesium";

declare type ConstrutorOptions = {
    id?: any;
    positions: Cartesian3[];
    color: Color;
    show?: boolean;
    loop?: boolean;
    width?: number;
    arrow?: boolean;
    depthFail?: boolean;
};

export class AxisLinePrimitive {
    private _show: boolean;
    private id: any;
    private _width: number;
    private _color: Color;
    private _depthFailColor: Color;
    private _positions: Cartesian3[];
    private _arrow: boolean;
    private _depthFail: boolean;
    private _boundingSphere: BoundingSphere;
    private _transformedBoundingSphere: BoundingSphere;
    private _modelMatrix: Matrix4;
    private _update: boolean;
    private _primitive: Primitive | undefined;

    constructor(options: ConstrutorOptions) {
        this._show = defaultValue(options.show, true);
        this.id = options.id;

        let positions = options.positions;

        if (options.loop) {
            positions = positions.slice();
            positions.push(positions[0]);
        }

        const isArrow = defaultValue(options.arrow, false);

        if (options.width) {
            this._width = options.width;
        } else {
            this._width = isArrow ? 25 : 8;
        }

        this._color = options.color;
        this._depthFailColor = options.color.withAlpha(0.3);
        this._positions = positions;
        this._arrow = isArrow;
        this._depthFail = defaultValue(options.depthFail, true);

        this._primitive = undefined;
        this._boundingSphere = BoundingSphere.fromPoints(positions);
        this._transformedBoundingSphere = BoundingSphere.clone(this._boundingSphere);
        this._modelMatrix = Matrix4.clone(Matrix4.IDENTITY);

        this._update = true;
    }

    get show() {
        return this._show;
    }

    set show(val: boolean) {
        this._show = val;
    }

    get modelMatrix() {
        return this._modelMatrix;
    }

    set modelMatrix(value: Matrix4) {
        if (Matrix4.equalsEpsilon(value, this._modelMatrix, CesiumMath.EPSILON10)) {
            return;
        }
        this._modelMatrix = Matrix4.clone(value, this._modelMatrix);
        this._update = true;
    }

    get color() {
        return this._color;
    }

    set color(color) {
        this._color = color;
        this._depthFailColor = color.withAlpha(0.3);

        this._update = true;
    }

    get positions() {
        return this._positions;
    }

    set positions(positions) {
        this._positions = positions;
        this._update = true;
    }

    get width() {
        return this._width;
    }

    get boundingVolume() {
        return this._transformedBoundingSphere;
    }

    get primitive() {
        return this._primitive;
    }

    update(frameState: FrameState) {
        if (!this._show) {
            return;
        }

        if (this._update) {
            this._update = false;
            if (this._primitive) {
                this._primitive.destroy();
            }

            const geometry = new PolylineGeometry({
                positions: this._positions,
                width: this._width,
                vertexFormat: PolylineMaterialAppearance.VERTEX_FORMAT,
                arcType: ArcType.NONE
            });

            let appearance1;
            let appearance2;
            if (this._arrow) {
                appearance1 = new PolylineMaterialAppearance({
                    material: Material.fromType(Material.PolylineArrowType, {
                        color: this._color
                    })
                });
                if (this._depthFail) {
                    appearance2 = new PolylineMaterialAppearance({
                        material: Material.fromType(Material.PolylineArrowType, {
                            color: this._depthFailColor
                        })
                    });
                }
            } else {
                appearance1 = new PolylineColorAppearance({
                    translucent: this._color.alpha !== 1.0
                });
                if (this._depthFail) {
                    appearance2 = new PolylineColorAppearance({
                        translucent: this._depthFailColor.alpha !== 1.0
                    });
                }
            }

            const modelMatrix = this._modelMatrix;
            this._primitive = new Primitive({
                geometryInstances: new GeometryInstance({
                    geometry: geometry,
                    attributes: {
                        color: ColorGeometryInstanceAttribute.fromColor(this._color),
                        depthFailColor: ColorGeometryInstanceAttribute.fromColor(this._depthFailColor)
                    },
                    id: this.id,
                    modelMatrix: modelMatrix
                }),
                appearance: appearance1,
                depthFailAppearance: appearance2,
                asynchronous: false
            });
            this._transformedBoundingSphere = BoundingSphere.transform(
                this._boundingSphere,
                modelMatrix,
                this._transformedBoundingSphere
            );
        }

        // @ts-ignore
        this._primitive!.update(frameState);
    }

    // eslint-disable-next-line class-methods-use-this
    isDestroyed() {
        return false;
    }

    destroy() {
        if (this._primitive) {
            this._primitive.destroy();
        }
        return destroyObject(this);
    }
}

export default AxisLinePrimitive;
