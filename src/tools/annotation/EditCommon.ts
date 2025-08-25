import { Cartesian3, Cartographic, Color, Ellipsoid } from "cesium";

export const editingPointOptions = {
    color: Color.WHITE,
    pixelSize: 15,
    outlineWidth: 2,
    outlineColor: Color.BLACK
};

export function getOffsetedPosition(position: Cartesian3, offset: number, result: Cartesian3) {
    const carto = Cartographic.fromCartesian(position);
    carto.height += offset;

    return Cartesian3.fromRadians(carto.longitude, carto.latitude, carto.height, Ellipsoid.WGS84, result);
}
