import { Cartesian2, Cartesian3, CoplanarPolygonGeometry, Matrix4, VertexFormat } from "cesium";

const v0Scratch = new Cartesian3();
const v1Scratch = new Cartesian3();

export function triangleArea(p0: Cartesian3, p1: Cartesian3, p2: Cartesian3) {
    const v0 = Cartesian3.subtract(p0, p1, v0Scratch);
    const v1 = Cartesian3.subtract(p2, p1, v1Scratch);
    const cross = Cartesian3.cross(v0, v1, v0);
    return Cartesian3.magnitude(cross) * 0.5;
}

const p0Scratch = new Cartesian3();
const p1Scratch = new Cartesian3();
const p2Scratch = new Cartesian3();

export function calculateAreaOfPolygon(positions: Cartesian3[]) {
    const geometry = CoplanarPolygonGeometry.createGeometry(
        CoplanarPolygonGeometry.fromPositions({
            positions: positions,
            vertexFormat: VertexFormat.POSITION_ONLY
        })
    );

    if (!geometry) {
        return 0;
    }

    const flatPositions = geometry.attributes.position.values as number[];
    const indices = geometry.indices;

    let area = 0;

    for (let i = 0; i < indices.length; i += 3) {
        const i0 = indices[i];
        const i1 = indices[i + 1];
        const i2 = indices[i + 2];

        const p0 = Cartesian3.unpack(flatPositions, i0 * 3, p0Scratch);
        const p1 = Cartesian3.unpack(flatPositions, i1 * 3, p1Scratch);
        const p2 = Cartesian3.unpack(flatPositions, i2 * 3, p2Scratch);

        area += triangleArea(p0, p1, p2);
    }

    return area;
}

const vector1Scratch = new Cartesian3();
const vector2Scratch = new Cartesian3();
const inverseTransformScratch = new Matrix4();
const localStartScratch = new Cartesian3();
const localEndScratch = new Cartesian3();

export function getRotationAngle(
    transform: Matrix4,
    originOffset: Cartesian3,
    axis: Cartesian3,
    start: Cartesian3,
    end: Cartesian3
) {
    const inverseTransform = Matrix4.inverse(transform, inverseTransformScratch);
    let localStart = Matrix4.multiplyByPoint(inverseTransform, start, localStartScratch); // project points to local coordinates so we can project to 2D
    let localEnd = Matrix4.multiplyByPoint(inverseTransform, end, localEndScratch);

    localStart = Cartesian3.subtract(localStart, originOffset, localStart);
    localEnd = Cartesian3.subtract(localEnd, originOffset, localEnd);

    const v1 = vector1Scratch;
    const v2 = vector2Scratch;
    if (axis.x) {
        v1.x = localStart.y;
        v1.y = localStart.z;
        v2.x = localEnd.y;
        v2.y = localEnd.z;
    } else if (axis.y) {
        v1.x = -localStart.x;
        v1.y = localStart.z;
        v2.x = -localEnd.x;
        v2.y = localEnd.z;
    } else {
        v1.x = localStart.x;
        v1.y = localStart.y;
        v2.x = localEnd.x;
        v2.y = localEnd.y;
    }

    const ccw = v1.x * v2.y - v1.y * v2.x >= 0.0; // true when minimal angle between start and end is a counter clockwise rotation

    let angle = Cartesian2.angleBetween(v1, v2);
    if (!ccw) {
        angle = -angle;
    }
    return angle;
}
