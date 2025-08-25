import { Cartesian2, Cartesian3, Scene, SceneTransforms } from "cesium";

const cart2Scratch1 = new Cartesian2();
const cart2Scratch2 = new Cartesian2();

export function calculateMostTopPosition(scene: Scene, positions: Cartesian3[], result: Cartesian3) {
    let top = positions[0];

    const pos2d = SceneTransforms.wgs84ToWindowCoordinates(scene, top, cart2Scratch1);
    let lastY = pos2d ? pos2d.y : Number.POSITIVE_INFINITY;

    for (let i = 1; i < positions.length; i++) {
        const nextScreenPos = SceneTransforms.wgs84ToWindowCoordinates(scene, positions[i], cart2Scratch2);
        if (!nextScreenPos) {
            continue;
        }
        if (nextScreenPos.y < lastY) {
            lastY = nextScreenPos.y;
            top = positions[i];
        }
    }

    top.clone(result);

    return result;
}
