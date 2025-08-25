import { Cartesian3, Cartesian2, Math as CesiumMath, Matrix4, SceneTransforms, Viewer } from "cesium";

import { DimensionLabel } from "./DimensionLabel";
import { LabelService } from "./LabelService";
import { DimensionLabelTypes, LabelAlignments } from "./common";

export function createOrUpdateLabel(
    position: Cartesian3,
    angle: number,
    modelMatrix: Matrix4,
    localPosition: Cartesian3,
    viewer: Viewer,
    labelService: LabelService,
    label: DimensionLabel | undefined
) {
    const {
        position: l,
        align: c,
        offset: h
    } = (function (e1, t1, n1, i1) {
        const scene = e1.scene;
        const a1 = t1;
        const s1 = SceneTransforms.wgs84ToWindowCoordinates(scene, n1);
        const l1 = Matrix4.multiplyByPoint(a1, i1, new Cartesian3());
        const c1 = SceneTransforms.wgs84ToWindowCoordinates(scene, l1);

        let align;
        let offsetX;
        let offsetY;

        if (c1.x > s1.x) {
            align = LabelAlignments.leading;
            offsetX = 20;
            offsetY = c1.y > s1.y ? 30 : -50;
        } else {
            align = LabelAlignments.trailing;
            offsetX = -20;
            offsetY = c1.y > s1.y ? 30 : -50;
        }

        return { align: align, offset: new Cartesian2(offsetX, offsetY), position: l1 };
    })(viewer, modelMatrix, position, localPosition);

    let text = (function (e2) {
        let t2 = CesiumMath.toDegrees(e2);

        if (Math.abs(t2) % 180 === 0) {
            t2 = Math.abs(t2);
        }

        const n2 = navigator.languages?.length ? navigator.languages[0] : navigator.language;

        return Intl.NumberFormat(n2, {
            minimumIntegerDigits: 1,
            maximumFractionDigits: 0
        }).format(t2);
    })(angle);

    text = `${text}\xb0`;

    if (label) {
        label.cesiumPosition = l;
        label.alignment = c;
        label.offset = h;
        label.text = text;
    } else {
        // eslint-disable-next-line no-param-reassign
        label = new DimensionLabel({
            type: DimensionLabelTypes.TEXT,
            position: l,
            alignment: c,
            offset: h,
            text: text,
            labelService: labelService
        });
    }

    return label;
}
