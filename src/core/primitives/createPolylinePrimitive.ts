import {
    Cartesian3,
    defaultValue,
    DeveloperError,
    GeometryInstance,
    Matrix4,
    Material,
    MaterialAppearance,
    PolylineColorAppearance,
    PolylineGeometry,
    PolylineMaterialAppearance,
    Primitive,
    ShadowMode,
    Color
} from "cesium";

export function createPolylinePrimitive(options: {
    id: string;
    hasArrow?: boolean;
    width?: number;
    alwaysOnTop?: boolean;
    selectable?: boolean;
    modelMatrix: Matrix4;
    color: Color;
    positions: Cartesian3[];
    startPoint?: Cartesian3;
    vector?: Cartesian3;
}) {
    const hasArrow = defaultValue(options.hasArrow, false);
    const width = defaultValue(options.width, 8);
    const alwaysOnTop = defaultValue(options.alwaysOnTop, false);
    const selectable = defaultValue(options.selectable, true);
    const { modelMatrix: a } = options;

    let points;

    if (options.positions) {
        points = options.positions;
    } else {
        if (!options.startPoint) {
            throw new DeveloperError("When drawing line, you must provide either positions or startPoint/vector.");
        }

        const endPoint = Cartesian3.add(options.startPoint, options.vector!, new Cartesian3());

        points = [options.startPoint, endPoint];
    }
    const positions = a
        ? points.map((A) => {
              const x = new Cartesian3();
              Matrix4.multiplyByPoint(a, A, x);
              return x;
          })
        : points;

    const colors = [];

    for (let i = 0; i < positions.length; i += 1) {
        colors[i] = options.color;
    }

    const renderState = { depthTest: { enabled: !alwaysOnTop }, depthMask: !alwaysOnTop };

    let vertexFormat;
    let appearance;

    if (hasArrow) {
        vertexFormat = PolylineMaterialAppearance.VERTEX_FORMAT;
        appearance = new PolylineMaterialAppearance({
            material: Material.fromType(Material.PolylineArrowType, { color: options.color }),
            translucent: true,
            renderState: renderState
        });
    } else {
        vertexFormat = MaterialAppearance.MaterialSupport.BASIC.vertexFormat;
        appearance = new PolylineColorAppearance({ translucent: true, renderState: renderState });
    }

    const geometry = new PolylineGeometry({
        positions: positions,
        width: width,
        vertexFormat: vertexFormat,
        colors: colors,
        colorsPerVertex: true
    });

    const primitive = new Primitive({
        geometryInstances: new GeometryInstance({ id: options.id, geometry: geometry }),
        allowPicking: selectable,
        appearance: appearance,
        shadows: ShadowMode.DISABLED,
        asynchronous: false
    });

    return primitive;
}
