// q@ts-nocheck
/* qeslint-disable */
import {
    Cartesian2,
    Cartesian3,
    ClassificationType,
    ColorGeometryInstanceAttribute,
    CoplanarPolygonGeometry,
    GeometryInstance,
    GroundPrimitive,
    Material,
    MaterialAppearance,
    PolygonHierarchy,
    PolygonGeometry,
    Primitive
} from "cesium";

import { AbstractPolygonPrimitive, AbstractPolygonPrimitiveConstructorOptions } from "./AbstractPolygonPrimitive";

declare type GridPolygonPrimitiveConstrutorOptions = AbstractPolygonPrimitiveConstructorOptions & {
    lineCount: Cartesian2;
    cellAlpha: number;
};

export class GridPolygonPrimitive extends AbstractPolygonPrimitive {
    private _lineCount: Cartesian2;
    private _cellAlpha: number;
    private _origPositions: Cartesian3[]; // height will be stored

    constructor(options: GridPolygonPrimitiveConstrutorOptions) {
        super(options);

        this._lineCount = options.lineCount;
        this._cellAlpha = options.cellAlpha;
        this._origPositions = [];

        if (options.positions) {
            options.positions.forEach((position) => {
                this._origPositions.push(position.clone(new Cartesian3()));
            });
        }
    }

    get positions() {
        return this._origPositions;
    }

    set positions(positions) {
        positions.forEach((position) => {
            this._origPositions.push(position.clone(new Cartesian3()));
        });

        super.positions = positions;
    }

    getClonedOrigPositions() {
        const ret: Cartesian3[] = [];

        this._origPositions.forEach((position) => {
            ret.push(position.clone(new Cartesian3()));
        });

        return ret;
    }

    updatePosition(index: number, position: Cartesian3) {
        position.clone(this._origPositions[index]);

        super.updatePosition(index, position);
    }

    get lineCount() {
        return this._lineCount;
    }

    set lineCount(lineCount: Cartesian2) {
        this._lineCount = lineCount;
        this._update = true;
    }

    createPrimitive(): void {
        const positions = this.getClonedOrigPositions();
        const modelMatrix = this._modelMatrix;

        const uniforms = {
            color: this._color,
            cellAlpha: this._cellAlpha,
            lineCount: this._lineCount
        };

        const material = new Material({
            translucent: false,
            fabric: {
                type: "Grid",
                uniforms: uniforms
            }
        });

        const appearance = new MaterialAppearance({
            material: material,
            translucent: true
        });

        if (this._clampToGround) {
            const geometry = new PolygonGeometry({
                polygonHierarchy: new PolygonHierarchy(positions),
                perPositionHeight: true,
                vertexFormat: MaterialAppearance.MaterialSupport.TEXTURED.vertexFormat
            });

            this._primitive = new GroundPrimitive({
                geometryInstances: new GeometryInstance({
                    geometry: geometry,
                    attributes: {
                        color: ColorGeometryInstanceAttribute.fromColor(this._color)
                        // depthFailColor : ColorGeometryInstanceAttribute.fromColor(this._depthFailColor)
                    },
                    id: this._id
                }),
                appearance: appearance,
                // depthFailAppearance : new PerInstanceColorAppearance({
                //     flat : true,
                //     closed : false,
                //     translucent : this._depthFailColor.alpha < 1.0
                // }),
                allowPicking: this._allowPicking,
                asynchronous: false,
                releaseGeometryInstances: false,
                classificationType: ClassificationType.CESIUM_3D_TILE
            });
        } else {
            const geometry = CoplanarPolygonGeometry.fromPositions({
                positions: positions,
                vertexFormat: MaterialAppearance.MaterialSupport.TEXTURED.vertexFormat
            });

            this._primitive = new Primitive({
                geometryInstances: new GeometryInstance({
                    geometry: geometry,
                    attributes: {
                        color: ColorGeometryInstanceAttribute.fromColor(this._color),
                        depthFailColor: ColorGeometryInstanceAttribute.fromColor(this._depthFailColor)
                    },
                    id: this._id
                }),
                appearance: appearance,
                depthFailAppearance: this._depthTest ? undefined : appearance,
                allowPicking: this._allowPicking,
                asynchronous: false,
                modelMatrix: modelMatrix
            });
        }
    }

    insertPosition(index: number, position: Cartesian3) {
        this._origPositions.splice(index, 0, position.clone(new Cartesian3()));

        super.insertPosition(index, position);
    }

    removePositon(index: number) {
        this._origPositions.splice(index, 1);

        super.removePositon(index);
    }
}
