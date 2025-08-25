// q@ts-nocheck
/* qeslint-disable */
import {
    ColorGeometryInstanceAttribute,
    CoplanarPolygonGeometry,
    GeometryInstance,
    GroundPrimitive,
    PerInstanceColorAppearance,
    PolygonHierarchy,
    PolygonGeometry,
    Primitive
} from "cesium";

import { AbstractPolygonPrimitive } from "./AbstractPolygonPrimitive";

export class PolygonPrimitive extends AbstractPolygonPrimitive {
    createPrimitive() {
        const positions = this._positions;
        const modelMatrix = this._modelMatrix;

        if (this._clampToGround) {
            const geometry = new PolygonGeometry({
                polygonHierarchy: new PolygonHierarchy(positions),
                perPositionHeight: true
                // vertexFormat : PerInstanceColorAppearance.FLAT_VERTEX_FORMAT
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
                appearance: new PerInstanceColorAppearance({
                    flat: false,
                    closed: false,
                    translucent: this._color.alpha < 1.0
                }),
                // depthFailAppearance : new PerInstanceColorAppearance({
                //     flat : true,
                //     closed : false,
                //     translucent : this._depthFailColor.alpha < 1.0
                // }),
                allowPicking: this._allowPicking,
                asynchronous: false,
                releaseGeometryInstances: false
            });
        } else {
            const geometry = CoplanarPolygonGeometry.fromPositions({
                positions: positions,
                vertexFormat: PerInstanceColorAppearance.FLAT_VERTEX_FORMAT
            });

            const appearance = new PerInstanceColorAppearance({
                flat: true,
                closed: false,
                translucent: this._color.alpha < 1.0
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
}
