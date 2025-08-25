import { Cartesian3, Math as CesiumMath } from "cesium";

export function getUnitZCirclePositions(space: number = 1) {
    const zAxis = [];

    for (let i = 0; i < 360; i += space) {
        const rad = CesiumMath.toRadians(i);
        const x = Math.cos(rad);
        const y = Math.sin(rad);

        zAxis.push(new Cartesian3(x, y, 0.0));
    }

    return zAxis;
}
