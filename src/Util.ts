import { Cartesian2, Cartesian3, Cesium3DTileset, Cesium3DTileFeature, defined, Model, Ray, Scene } from "cesium";

const rayScratch = new Ray();
const cartesianScratch = new Cartesian3();

export default class Util {
    // eslint-disable-next-line class-methods-use-this
    getWorldPosition(scene: Scene, mousePosition: Cartesian2, result: Cartesian3) {
        let position;

        if (scene.pickPositionSupported) {
            // Don't pick default 3x3, or scene.pick may allow a mousePosition that isn't on the tileset to pickPosition.
            const pickedObject = scene.pick(mousePosition, 1, 1);

            if (
                defined(pickedObject) &&
                (pickedObject instanceof Cesium3DTileFeature ||
                    pickedObject.primitive instanceof Cesium3DTileset ||
                    pickedObject.primitive instanceof Model)
            ) {
                // check to let us know if we should pick against the globe instead
                position = scene.pickPosition(mousePosition, cartesianScratch);

                if (defined(position)) {
                    return Cartesian3.clone(position, result);
                }
            }
        }

        if (!defined(scene.globe)) {
            return undefined;
        }

        const ray = scene.camera.getPickRay(mousePosition, rayScratch);
        position = scene.globe.pick(ray!, scene, cartesianScratch);

        if (position) {
            return Cartesian3.clone(position, result);
        }

        return undefined;
    }
}
