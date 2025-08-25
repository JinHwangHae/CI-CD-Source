/* eslint-disable */
/* eslint-disable  operator-assignment */
// @ts-nocheck

/* from threejs's Quaternion

   .setFromUnitVectors ( vFrom : Vector3, vTo : Vector3 ) : this
   Sets this quaternion to the rotation required to rotate direction vector vFrom to direction vector vTo.
   Adapted from the method here.
   vFrom and vTo are assumed to be normalized.
*/

import { Cartesian3, Quaternion } from "cesium";

export default function createQuaternionFromUnitVectors(vFrom, vTo) {
    let r = Cartesian3.dot(vFrom, vTo) + 1;

    let x;
    let y;
    let z;
    let w;

    if (r < Number.EPSILON) {
        // vFrom and vTo point in opposite directions

        r = 0;

        if (Math.abs(vFrom.x) > Math.abs(vFrom.z)) {
            x = -vFrom.y;
            y = vFrom.x;
            z = 0;
            w = r;
        } else {
            x = 0;
            y = -vFrom.z;
            z = vFrom.y;
            w = r;
        }
    } else {
        // crossVectors( vFrom, vTo ); // inlined to avoid cyclic dependency on Vector3

        x = vFrom.y * vTo.z - vFrom.z * vTo.y;
        y = vFrom.z * vTo.x - vFrom.x * vTo.z;
        z = vFrom.x * vTo.y - vFrom.y * vTo.x;
        w = r;
    }

    // normalize

    let l = Math.sqrt(x * x + y * y + z * z + w * w);

    if (l === 0) {
        x = 0;
        y = 0;
        z = 0;
        w = 1;
    } else {
        l = 1 / l;

        x = x * l;
        y = y * l;
        z = z * l;
        w = w * l;
    }

    return new Quaternion(x, y, z, w);
}
