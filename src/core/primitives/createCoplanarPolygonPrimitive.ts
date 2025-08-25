import {
    Cartesian3,
    Color,
    ColorGeometryInstanceAttribute,
    ComponentDatatype,
    CoplanarPolygonGeometry,
    defaultValue,
    GeometryAttribute,
    GeometryInstance,
    Material,
    MaterialAppearance,
    Matrix4,
    Primitive,
    ShadowMode
} from "cesium";

export function createCoplanarPolygonPrimitive(options: {
    id: string;
    points: Cartesian3[];
    selectable?: boolean;
    shadows: boolean;
    color: Color;
    modelMatrix: Matrix4;
}) {
    const allowPicking = defaultValue(options.selectable, true);
    const shadows = defaultValue(options.shadows, true);

    const appearance = new MaterialAppearance({
        flat: false,
        closed: false,
        translucent: true,
        faceForward: true,
        renderState: { depthTest: { enabled: false }, depthMask: false },
        material: Material.fromType("Color", { color: options.color })
    });
    const polygonGeometry = CoplanarPolygonGeometry.fromPositions({
        positions: options.points,
        vertexFormat: MaterialAppearance.MaterialSupport.BASIC.vertexFormat
    });
    const geometry = CoplanarPolygonGeometry.createGeometry(polygonGeometry);
    const pointsCount = options.points.length;
    const normalBuffer = new Float32Array(3 * pointsCount);
    for (let f = 0; f < pointsCount; f += 1) {
        normalBuffer[3 * f] = 0;
        normalBuffer[3 * f + 1] = 0;
        normalBuffer[3 * f + 2] = 1;
    }

    if (!geometry) {
        // throw new Error("geometry is not valid");
        return undefined;
    }

    geometry.attributes.normal = new GeometryAttribute({
        componentDatatype: ComponentDatatype.FLOAT,
        componentsPerAttribute: 3,
        values: normalBuffer
    });

    return new Primitive({
        geometryInstances: new GeometryInstance({
            id: options.id,
            geometry: geometry,
            modelMatrix: options.modelMatrix,
            attributes: {
                color: ColorGeometryInstanceAttribute.fromColor(options.color),
                depthFailColor: ColorGeometryInstanceAttribute.fromColor(options.color)
            }
        }),
        appearance: appearance,
        allowPicking: allowPicking,
        asynchronous: false,
        shadows: shadows ? ShadowMode.ENABLED : ShadowMode.DISABLED
    });
}
