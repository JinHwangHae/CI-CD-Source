/* qeslint-disable */
// q@ts-nocheck

import {
    BoundingSphere,
    Cartesian3,
    Color,
    ComponentDatatype,
    Geometry,
    GeometryAttribute,
    GeometryInstance,
    GeometryPipeline,
    Matrix4,
    PerInstanceColorAppearance,
    Primitive,
    PrimitiveType
} from "cesium";

export function createMeshPrimitive(
    modelMatrix: Matrix4,
    vertices: Array<Cartesian3>,
    indices: Array<number>,
    colors: Array<Color>,
    wireframe: boolean
) {
    const positions = new Float64Array(Cartesian3.packArray(vertices, []));
    const colorsByte: Array<number> = [];

    colors.forEach((color) => {
        const bytes: Array<number> = [];
        color.toBytes(bytes);

        bytes.forEach((byte) => {
            colorsByte.push(byte);
        });
    });

    const colorBuffer = new Uint8Array(colorsByte);

    const geometry = new Geometry({
        // @ts-ignore
        attributes: {
            position: new GeometryAttribute({
                componentDatatype: ComponentDatatype.DOUBLE,
                componentsPerAttribute: 3,
                values: positions
            }),
            color: new GeometryAttribute({
                componentDatatype: ComponentDatatype.UNSIGNED_BYTE,
                componentsPerAttribute: 4,
                values: colorBuffer,
                normalize: true
            })
            // normal: new GeometryAttribute(),
            // st: new GeometryAttribute(),
            // tangent: new GeometryAttribute(),
            // bitangent: new GeometryAttribute()
        },
        indices: new Uint16Array(indices),
        primitiveType: wireframe ? PrimitiveType.LINES : PrimitiveType.TRIANGLES,
        boundingSphere: BoundingSphere.fromVertices(Array.from(positions))
    });

    GeometryPipeline.computeNormal(geometry);

    const instance = new GeometryInstance({
        geometry: geometry
    });

    return new Primitive({
        geometryInstances: instance,
        appearance: new PerInstanceColorAppearance({
            translucent: false,
            flat: true
        }),
        modelMatrix: modelMatrix,
        asynchronous: false,
        releaseGeometryInstances: true
    });
}
