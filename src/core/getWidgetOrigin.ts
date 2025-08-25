/* qeslint-disable */
// q@ts-nocheck

// @ts-ignore
import { Cartesian3, Check, Matrix4 } from "cesium";

const noScale = new Cartesian3(1.0, 1.0, 1.0);
const matrixScratch = new Matrix4();
const scaleScratch = new Cartesian3();

function getWidgetOrigin(transform: Matrix4, originOffset: Cartesian3, result: Cartesian3) {
    // >>includeStart('debug', pragmas.debug);
    Check.defined("transform", transform);
    Check.defined("originOffset", originOffset);
    Check.defined("result", result);
    // >>includeEnd('debug');

    const startScale = Matrix4.getScale(transform, scaleScratch);
    const modelMatrix = Matrix4.setScale(transform, noScale, matrixScratch);

    return Matrix4.multiplyByPoint(
        modelMatrix,
        Cartesian3.multiplyComponents(originOffset, startScale, result),
        result
    );
}

export default getWidgetOrigin;
