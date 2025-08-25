import { Cartesian2, Cartesian3, Cartographic, Math as CesiumMath, Scene } from "cesium";

export function pickCenterOnEllipsoid(scene: Scene) {
    const camera = scene.camera;
    const windowPosition = new Cartesian2(scene.canvas.clientWidth / 2, scene.canvas.clientHeight / 2);

    return camera.pickEllipsoid(windowPosition);
}

const scratchVector1 = new Cartesian3();
const scratchVector2 = new Cartesian3();
const scratchProjectionVector = new Cartesian3();

export function projectPointOntoVector(
    vectorPoint1: Cartesian3,
    vectorPoint2: Cartesian3,
    pointToProject: Cartesian3,
    result = new Cartesian3()
): Cartesian3 {
    Cartesian3.subtract(vectorPoint2, vectorPoint1, scratchVector1);
    Cartesian3.subtract(pointToProject, vectorPoint1, scratchVector2);
    Cartesian3.projectVector(scratchVector2, scratchVector1, scratchProjectionVector);
    return Cartesian3.add(vectorPoint1, scratchProjectionVector, result);
}

const minDifferenceScratch = new Cartesian3();
const maxDifferenceScratch = new Cartesian3();

export function clampPosition(
    position: Cartesian3,
    minPosition: Cartesian3,
    maxPosition: Cartesian3,
    start: number,
    end: number
) {
    let distanceScalar = start;
    const minDifference = Cartesian3.subtract(minPosition, position, minDifferenceScratch);
    const min = minDifference.x + minDifference.y + minDifference.z;
    if (min > 0) {
        const maxDifference = Cartesian3.subtract(maxPosition, position, maxDifferenceScratch);
        const max = maxDifference.x + maxDifference.y + maxDifference.z;
        if (max < 0) {
            const maxDistance = Cartesian3.distance(minPosition, maxPosition);
            const distance = Cartesian3.distance(minPosition, position);
            distanceScalar = distance / maxDistance;
            distanceScalar = CesiumMath.clamp(distanceScalar, start, end);
        } else {
            distanceScalar = end;
        }
    }
    Cartesian3.lerp(minPosition, maxPosition, distanceScalar, position);
}

/**
 * Sets height in meters for each cartesian3 position in array
 */
export function updateHeightForCartesianPositions(positions: Cartesian3[], height: number, scene: Scene): Cartesian3[] {
    return positions.map((p) => {
        const cartographicPosition = Cartographic.fromCartesian(p);
        cartographicPosition.height = height;
        if (scene) {
            const altitude = scene.globe.getHeight(cartographicPosition) || 0;
            cartographicPosition.height += altitude;
        }
        return Cartographic.toCartesian(cartographicPosition);
    });
}

/**
 * @param {Cartesian3} point
 * @param {Cartesian3} startPoint
 * @param {Cartesian3} endPoint
 * @param {number} start - The value corresponding to point at 0.0.
 * @param {number} end - The value corresponding to point at 1.0.
 * @param {number} height - height in meters
 * @return {Cartesian3}
 */
export function projectPointOnSegment(
    point: Cartesian3,
    startPoint: Cartesian3,
    endPoint: Cartesian3,
    start: number,
    end: number,
    height: number
): Cartesian3 {
    const position = projectPointOntoVector(startPoint, endPoint, point);
    clampPosition(position, startPoint, endPoint, start, end);
    // @ts-ignore
    return updateHeightForCartesianPositions([position], height)[0];
}

export function getCenter(positions: Cartesian3[], result: Cartesian3) {
    result.x = 0;
    result.y = 0;
    result.z = 0;

    positions.forEach((position) => {
        result.x += position.x;
        result.y += position.y;
        result.z += position.z;
    });

    const count = positions.length;

    result.x /= count;
    result.y /= count;
    result.z /= count;

    return result;
}
