/* qeslint-disable */
// q@ts-nocheck

import { Cartesian3, Color } from "cesium";

class TransformAxis {
    public static X = "X";
    public static Y = "Y";
    public static Z = "Z";

    static getValue(axis: string) {
        if (axis === TransformAxis.X) {
            return Cartesian3.UNIT_X;
        }

        if (axis === TransformAxis.Y) {
            return Cartesian3.UNIT_Y;
        }

        return Cartesian3.UNIT_Z;
    }

    static getColor(axis: string) {
        if (axis === TransformAxis.X) {
            return Color.RED;
        }

        if (axis === TransformAxis.Y) {
            return Color.GREEN;
        }

        return Color.BLUE;
    }
}

export default TransformAxis;
