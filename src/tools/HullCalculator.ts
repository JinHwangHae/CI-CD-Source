import { Cartesian3, Matrix4 } from "cesium";
import * as THREE from "three";
// @ts-ignore
import { OGC3DTile } from "@jdultra/threedtiles";

export class HullCalculator {
    renderer: THREE.WebGLRenderer | undefined;

    constructor() {
        this.renderer = new THREE.WebGLRenderer();
    }

    computeHullMatrix(url: string, rotationMatrix: Matrix4 | undefined) {
        const self = this;

        return new Promise((resolve, reject) => {
            self.getMeshes(url).then((meshes: any) => {
                const promises = [];

                for (let i = 0; i < meshes.urls.length; i++) {
                    promises.push(
                        fetch(meshes.urls[i])
                            .then((result: Response) => {
                                if (!result.ok) {
                                    throw new Error(
                                        `Request failed with status ${result.status} : ${result.statusText}`
                                    );
                                }

                                return result.arrayBuffer();
                            })
                            .then((bytes) => meshes.loader.parseB3DM(bytes, null, 0, false))
                            .then((mesh) => {
                                if (meshes.transforms[i]) {
                                    mesh.applyMatrix4(meshes.transforms[i]);
                                }
                                return mesh;
                            })
                            .catch((e) => {
                                console.error(e);
                                reject();
                            })
                    );
                }

                resolve(
                    Promise.all(promises).then((results) => {
                        const hull = self.computeConvexHull(rotationMatrix, results);

                        results.forEach((mesh) => {
                            mesh.traverse((o: any) => {
                                if (o.material) {
                                    if (o.material.length) {
                                        for (let i = 0; i < o.material.length; ++i) {
                                            o.material[i].dispose();
                                        }
                                    } else {
                                        o.material.dispose();
                                    }
                                }
                                if (o.geometry) o.geometry.dispose();
                            });
                        });

                        return hull;
                    })
                );

                // this.renderer.dispose();
            });
        });
    }

    getMeshes(url: string) {
        return new Promise((resolve /* ,  reject */) => {
            const tileset = new OGC3DTile({
                renderer: this.renderer,
                url: url,
                geometricErrorMultiplier: Number.MAX_VALUE,
                meshCallback: (/* mesh */) => {
                    tileset.updateMatrixWorld(true);
                    const meshURLs: string[] = [];
                    const transforms: THREE.Matrix4[] = [];

                    tileset.traverse((o: any) => {
                        if (o.contentURL && o.contentURL.endsWith("b3dm")) {
                            meshURLs.push(o.contentURL);
                            transforms.push(o.matrixWorld);
                        }
                        if (o.material) {
                            if (o.material.length) {
                                for (let i = 0; i < o.material.length; ++i) {
                                    o.material[i].dispose();
                                }
                            } else {
                                o.material.dispose();
                            }
                        }
                        if (o.geometry) o.geometry.dispose();
                    });

                    tileset.dispose();
                    resolve({ urls: meshURLs, transforms: transforms, loader: tileset.tileLoader.b3dmDecoder });
                }
            });

            // fix the bug of @jdultra/threedtiles
            const origDownloadFunc = tileset.tileLoader.download.bind(tileset.tileLoader);

            tileset.tileLoader.download = () => {
                if (!tileset.tileLoader.b3dmDecoder.gltfLoader.dracoLoader) {
                    // console.warn("b3dmDecoder.gltfLoader is not yet initialized!");
                    return;
                }

                origDownloadFunc();
            };

            const cameraRight = new THREE.PerspectiveCamera(180, 1, 0.000000001, Number.MAX_VALUE);
            const cameraLeft = new THREE.PerspectiveCamera(180, 1, 0.000000001, Number.MAX_VALUE);

            cameraRight.lookAt(1, 0, 0);
            cameraLeft.lookAt(-1, 0, 0);
            cameraRight.updateProjectionMatrix();
            cameraLeft.updateProjectionMatrix();

            const frustumRight = new THREE.Frustum();
            frustumRight.setFromProjectionMatrix(
                new THREE.Matrix4().multiplyMatrices(cameraRight.projectionMatrix, cameraRight.matrixWorldInverse)
            );

            const frustumLeft = new THREE.Frustum();

            frustumLeft.setFromProjectionMatrix(
                new THREE.Matrix4().multiplyMatrices(cameraLeft.projectionMatrix, cameraLeft.matrixWorldInverse)
            );

            const searchInterval = setInterval(() => {
                if (tileset.deleted) clearInterval(searchInterval);
                tileset.update(cameraRight, frustumRight);
                tileset.update(cameraLeft, frustumLeft);
            }, 10);
        });
    }

    // eslint-disable-next-line class-methods-use-this
    computeConvexHull(rotationMatrix: Matrix4 | undefined, meshes: THREE.Mesh[]) {
        const points: Cartesian3[] = [];

        // meshes.shift()

        meshes.forEach((mesh) => {
            mesh.traverse((o: any) => {
                if (o.geometry) {
                    const positions = o.geometry.attributes.position.array;
                    const count = o.geometry.attributes.position.count;

                    for (let i = 0; i < count; i++) {
                        const point = new Cartesian3(positions[i * 3], -positions[i * 3 + 2], positions[i * 3 + 1]);

                        // Cesium.Matrix4.multiplyByPoint(localMatrix, point, point)

                        if (rotationMatrix) {
                            Matrix4.multiplyByPoint(rotationMatrix, point, point);
                        } else {
                            point.y = point.z;
                        }

                        point.z = 0;
                        points.push(point);
                    }
                }
            });
        });

        points.sort((a, b) => (a.x === b.x ? a.y - b.y : a.x - b.x));

        const lower = [];

        function cross(a: Cartesian3, b: Cartesian3, o: Cartesian3) {
            return (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
        }

        for (let i = 0; i < points.length; i++) {
            while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], points[i]) <= 0) {
                lower.pop();
            }

            lower.push(points[i]);
        }

        const upper = [];

        for (let i = points.length - 1; i >= 0; i--) {
            while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], points[i]) <= 0) {
                upper.pop();
            }
            upper.push(points[i]);
        }

        upper.pop();
        lower.pop();
        const hull = lower.concat(upper);

        const localMatrix = new Matrix4(
            meshes[meshes.length - 1].matrix.elements[0],
            meshes[meshes.length - 1].matrix.elements[4],
            meshes[meshes.length - 1].matrix.elements[8],
            meshes[meshes.length - 1].matrix.elements[12],
            meshes[meshes.length - 1].matrix.elements[1],
            meshes[meshes.length - 1].matrix.elements[5],
            meshes[meshes.length - 1].matrix.elements[9],
            meshes[meshes.length - 1].matrix.elements[13],
            meshes[meshes.length - 1].matrix.elements[2],
            meshes[meshes.length - 1].matrix.elements[6],
            meshes[meshes.length - 1].matrix.elements[10],
            meshes[meshes.length - 1].matrix.elements[14],
            meshes[meshes.length - 1].matrix.elements[3],
            meshes[meshes.length - 1].matrix.elements[7],
            meshes[meshes.length - 1].matrix.elements[11],
            meshes[meshes.length - 1].matrix.elements[15]
        );

        hull.forEach((element) => {
            Matrix4.multiplyByPoint(localMatrix, element, element);
        });

        return hull;
    }
}
