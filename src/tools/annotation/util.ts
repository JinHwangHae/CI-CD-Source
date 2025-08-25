/* qeslint-disable */
// q@ts-nocheck

import { Cartesian2, Cartesian3 } from "cesium";

export function cartesian3ToObject(cartesian3: Cartesian3) {
    return {
        x: cartesian3.x,
        y: cartesian3.y,
        z: cartesian3.z
    };
}

export function newCartesian2FromObject(data: { x: number; y: number }) {
    return new Cartesian2(data.x, data.y);
}

export function newCartesian3FromObject(data: { x: number; y: number; z: number }) {
    return new Cartesian3(data.x, data.y, data.z);
}

export function newCartesian3ArrayFromArray(data: { x: number; y: number; z: number }[]) {
    const ret: Cartesian3[] = [];

    data.forEach((subData) => {
        ret.push(newCartesian3FromObject(subData));
    });

    return ret;
}
