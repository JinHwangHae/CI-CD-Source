/* eslint-disable */
/* eslint-disable  class-methods-use-this */

import {
    BoxGeometry,
    Camera,
    Cartesian3,
    Cartesian4,
    CatmullRomSpline,
    Color,
    ColorGeometryInstanceAttribute,
    CornerType,
    CylinderGeometry,
    EventHelper,
    Ellipsoid,
    Event,
    GeometryInstance,
    HeadingPitchRoll,
    HermiteSpline,
    LinearSpline,
    Math as CesiumMath,
    Matrix3,
    Matrix4,
    PerInstanceColorAppearance,
    Primitive,
    Quaternion,
    Transforms
} from "cesium";

const SplineType = {
    LINEAR: 0,
    CATMULL_ROM: 1,
    HERMITE_NATURAL: 2,
    HERMITE_CLAMPED: 3,
    HERMITE_C1: 4
};

const d = {};

d.getWorldUpVector = function (e) {
    return Ellipsoid.WGS84.geodeticSurfaceNormal(e, new Cartesian3());
};

function A(options, splineTension) {
    const n = options.points;
    const i = new Cartesian3();
    const r = new Array(n.length);

    r[0] = Cartesian3.multiplyByScalar(Cartesian3.subtract(n[1], n[0], i), splineTension, new Cartesian3());

    for (let o = 1; o < r.length - 1; ++o)
        r[o] = Cartesian3.multiplyByScalar(Cartesian3.subtract(n[o + 1], n[o - 1], i), splineTension, new Cartesian3());

    const a = r.length - 1;

    r[a] = Cartesian3.multiplyByScalar(Cartesian3.subtract(n[a], n[a - 1], i), splineTension, new Cartesian3());

    return r;
}

// store.dispatch will change store.state

const actions = {
    ADD_CONTROL_POINT: "ADD_CONTROL_POINT",
    REMOVE_CONTROL_POINT: "REMOVE_CONTROL_POINT",
    UPDATE_TIME: "UPDATE_TIME",
    SET_CURRENT_FRAME: "SET_CURRENT_FRAME",
    SET_CURRENT_POSITION: "SET_CURRENT_POSITION",
    SET_SELECTED_INDEX: "_SET_SELECTED_INDEX"
};

export class VideoRecorder {
    constructor(options) {
        this.viewer = options.viewer;

        this.positionSpline = null;
        this.lookAtSpline = null;
        this.entities = [];
        this.primitives = [];
        this.controlPrimitives = [];
        this.cameraScale = 1;
        this.showSplinesOnMove = false;
        this.hideTimer = null;
        this.editingIndex = -1;
        this.editingPrimitive = null;
        this.translatingPrimitive = null;
        this.tempCamera = null;
        this.removeCallback = null;
        this.firstLoad = true;
        this.cachedCameraGeometry = null;
        this.onCameraChangedEvents = [];
        this.isEditing = false;

        this.state = {
            fps: 30,
            totalDuration: 15,
            currentPosition: 0, // has meaning of percent
            numPoints: 0,
            currentFrame: 0,
            positionControlPoints: [],
            lookAtControlPoints: [],
            timeControlPoints: [],
            previewRunning: false,
            recording: false,
            // splineType: SplineType.HERMITE_CLAMPED,
            splineType: SplineType.LINEAR,
            splineTension: 0.5, // Array<Cartesian3>
            lookAtDistance: 200,
            selectedIndex: -1,
            editing: false,
            flags: {
                syncTimePoints: false
            }
        };

        this.viewer.camera.moveEnd.addEventListener((e) => {
            // the camera stopped moving

            if (this.showSplinesOnMove) {
                this.showSplinesOnMove = false;
                this.drawSplines();
                this.drawKeyframes();
            }

            if (this.editingIndex >= 0) {
                this.updateControlPointFromCamera(e);
            }

            // eslint-disable-next-line arrow-body-style
            this.onCameraChangedEvents.forEach((t) => {
                return t(e);
            });

            this.onCameraChangedEvents = [];
        });

        /*
        return n.bus.$on(r.Scene.Events.CAMERA_CHANGED, function (e) {
            n.showSplinesOnMove && ((n.showSplinesOnMove = false), n.drawSplines(), n.drawKeyframes()),
                n.editingIndex >= 0 && n.updateControlPointFromCamera(e),
                n.onCameraChangedEvents.forEach(function (t) {
                    return t(e);
                }),
                (n.onCameraChangedEvents = []);
        });
         */

        document.addEventListener("keyup", this.processKeyUp.bind(this));

        this.addedControlPoint = new Event();
    }

    changeState(action, data) {
        const state = this.state;

        switch (action) {
            case actions.ADD_CONTROL_POINT: {
                state.positionControlPoints.push(data.position);
                state.lookAtControlPoints.push(data.lookAt);
                state.timeControlPoints.push(data.time);
                state.numPoints += 1;
                state.flags.syncTimePoints = true;
                break;
            }
            case actions.REMOVE_CONTROL_POINT: {
                const index = data.index;

                state.positionControlPoints.splice(index, 1);
                state.lookAtControlPoints.splice(index, 1);
                state.timeControlPoints.splice(index, 1);
                state.numPoints -= 1;
                state.flags.syncTimePoints = true;
                break;
            }
            case actions.UPDATE_TIME: {
                state.timeControlPoints[data.index] = data.time;
                state.flags.syncTimePoints = true;
                break;
            }
            case actions.SET_CURRENT_FRAME: {
                state.currentFrame = data;
                break;
            }
            case actions.SET_CURRENT_POSITION: {
                state.currentPosition = data;
                break;
            }
            case actions.SET_SELECTED_INDEX: {
                state.selectedIndex = data;
                break;
            }
            default:
                console.warn("oop");
        }
    }

    togglePreview() {
        this.state.previewRunning ? this.endPreview() : this.startPreview();
    }

    startPreview() {
        if (this.state.previewRunning) {
            this.endPreview();
        }

        this.onCameraChangedEvents = [];
        // this.componentContext.store.commit(this.componentContext.mutations.SET_RECORDING_ACTIVE, !1),

        this.state.recording = false;

        // this.componentContext.store.commit(this.componentContext.mutations.SET_PREVIEW_ACTIVE, !0),

        this.state.previewRunning = true;

        // this.componentContext.store.commit(this.componentContext.mutations.SET_CURRENT_FRAME, 0),

        this.state.currentFrame = 0;

        // this.componentContext.store.commit(this.componentContext.mutations.SET_CURRENT_POSITION, 0),

        this.state.currentPosition = 0;

        this.hideDebugSplines();
        this.createSplines();
        this.setViewAtTime(0);
        this.removeCallback = new EventHelper().add(this.viewer.clock.onTick, this.previewTick.bind(this));
        // this.bus.$emit(r.Scene.Events.INVALIDATE_CLIENT);
        // this.bus.$emit(E.PREVIEW_STARTED);
    }

    addControlPoint() {
        const self = this;
        const state = this.state;
        const numPoints = state.numPoints;

        /*
        (0, p.addMessage)(this.store, {
            message: "Added control point ".concat(n + 1),
            duration: 2,
            type: "success"
        });
        */

        const camera = this.viewer.camera;
        const cameraPosition = camera.position.clone();
        const o = (100 - 100 / numPoints) / 100;

        state.timeControlPoints.forEach((time, index) => {
            self.changeState(actions.UPDATE_TIME, {
                index: index,
                time: time * o
            });
        });

        const lookAt = this.getLookAtPoint(camera);

        this.changeState(actions.ADD_CONTROL_POINT, {
            position: cameraPosition,
            time: 100,
            lookAt: lookAt
        });

        this.clearObjects();
        this.createSplines();
        this.drawSplines();

        this.onCameraChangedEvents.push(() => {
            this.clearControlPoints();

            if (this.state.numPoints > 1) {
                this.controlPrimitives.forEach((t) => {
                    return self.viewer.scene.primitives.remove(t);
                });

                this.controlPrimitives = [];
                this.isEditing || self.drawKeyframes();
            }
        });

        this.addedControlPoint.raiseEvent(numPoints);
    }

    updateFramePosition() {
        const state = this.state;
        let currentPosition = state.currentPosition;

        currentPosition += 100 / (state.fps * state.totalDuration);

        currentPosition += 1 / state.fps;
        this.changeState(actions.SET_CURRENT_POSITION, currentPosition);
        this.changeState(actions.SET_CURRENT_FRAME, state.currentFrame + 1);

        console.log(currentPosition);

        return currentPosition;
    }

    updateControlPointFromCamera() {
        let t = this.editingPrimitive;
        if (t) {
            let n = new HeadingPitchRoll(
                CesiumMath.toRadians(e.heading),
                CesiumMath.toRadians(e.roll),
                CesiumMath.toRadians(e.pitch) + CesiumMath.PI_OVER_TWO
            );
            (n.roll = CesiumMath.clamp(n.roll, 0.1, CesiumMath.PI - 0.1)),
                (t.modelMatrix = Transforms.headingPitchRollToFixedFrame(e.position, n));
            let i = this.getLookAtPoint(this.viewer.scene.camera);
            this.componentContext.store.dispatch(this.componentContext.actions.UPDATE_CONTROL_POINT, {
                index: this.editingIndex,
                lookAt: i
            });
        }
    }

    clearObjects() {
        this.entities.forEach((entity) => {
            return this.viewer.entities.remove(entity);
        });

        this.entities = [];
        this.primitives.forEach((primitive) => {
            return this.viewer.scene.primitives.remove(primitive);
        });

        this.primitives = [];
    }

    clearControlPoints() {
        const self = this;

        this.controlPrimitives.forEach(function (t) {
            return self.viewer.scene.primitives.remove(t);
        });

        this.controlPrimitives = [];
    }

    createSplines() {
        const state = this.state;

        if (state.timeControlPoints.length > 1) {
            this.positionSpline = this.createSpline({
                times: state.timeControlPoints,
                points: state.positionControlPoints
            });

            this.lookAtSpline = this.createSpline({
                times: state.timeControlPoints,
                points: state.lookAtControlPoints
            });
        }
    }

    createSpline(options) {
        switch (this.state.splineType) {
            case SplineType.LINEAR:
                return new LinearSpline(options);
            case SplineType.CATMULL_ROM:
                return new CatmullRomSpline(options);
            case SplineType.HERMITE_NATURAL:
                return HermiteSpline.createNaturalCubic(options);
            case SplineType.HERMITE_C1:
                let t = A(options, this.state.splineTension);

                return HermiteSpline.createC1(
                    Object.assign(Object.assign({}, options), {
                        tangents: t
                    })
                );
            case SplineType.HERMITE_CLAMPED:
            default:
                return HermiteSpline.createClampedCubic(options);
        }
    }

    drawKeyframes() {
        const self = this,
            state = this.state,
            camera = new Camera(this.viewer.scene),
            i = this.controlPrimitives.length < state.positionControlPoints.length;

        state.positionControlPoints.forEach(function (positionControlPoint, index) {
            const lookAtControlPoint = state.lookAtControlPoints[index],
                s = Cartesian3.subtract(lookAtControlPoint, positionControlPoint, new Cartesian3());

            Cartesian3.normalize(s, s);

            const l = (0, d.getWorldUpVector)(positionControlPoint),
                u = self.getLookAt(positionControlPoint, s, camera, l),
                c = Transforms.headingPitchRollToFixedFrame(positionControlPoint, u);

            if (i) {
                const h = self.getCameraGeometry(c, self.cameraScale);

                self.controlPrimitives.push(self.viewer.scene.primitives.add(h));
            }
        });
    }

    drawSplines() {
        const state = this.state;

        if (!(state.timeControlPoints.length < 2)) {
            this.clearObjects();
            let t = new Camera(this.viewer.scene);

            this.selectedPoint;
            for (
                var n = new CylinderGeometry({
                        length: 5,
                        topRadius: 0.1,
                        bottomRadius: 0.1,
                        vertexFormat: PerInstanceColorAppearance.VERTEX_FORMAT
                    }),
                    i = [],
                    o = [],
                    a = [],
                    s = state.totalDuration * state.fps,
                    l = state.fps / 2,
                    u = 0;
                u < s;
                u += l
            ) {
                let c = u * (100 / s),
                    h = this.positionSpline.evaluate(c);
                i.push(h);
                let f = this.lookAtSpline.evaluate(c);

                o.push(f);
                const p = Cartesian3.subtract(f, h, new Cartesian3());

                Cartesian3.normalize(p, p);

                const m = (0, d.getWorldUpVector)(h),
                    v = this.getLookAt(h, p, t, m),
                    g = Transforms.headingPitchRollToFixedFrame(h, v);

                Matrix4.multiplyByTranslation(g, new Cartesian3(0, 0, -2.5), g);

                const y = {
                    geometry: n,
                    modelMatrix: g,
                    attributes: {
                        color: new ColorGeometryInstanceAttribute(1, 0, 0, 1)
                    }
                };
                a.push(new GeometryInstance(y));
            }

            i.push(this.positionSpline.evaluate(100));

            const primitive = new Primitive({
                geometryInstances: a,
                appearance: new PerInstanceColorAppearance({
                    translucent: false,
                    closed: true,
                    flat: true,
                    faceForward: true
                }),
                allowPicking: false
            });

            this.primitives.push(this.viewer.scene.primitives.add(primitive));

            const polylineOptions = {
                name: "test_spline_example",
                polyline: {
                    width: 4,
                    positions: i,
                    material: Color.RED,
                    cornerType: CornerType.ROUNDED,
                    followSurface: false
                }
            };

            this.entities.push(this.viewer.entities.add(polylineOptions));
            // this.bus.$emit(r.Scene.Events.INVALIDATE_CLIENT);
        }
    }

    getCameraGeometry(matrix, cameraScale) {
        if (!this.cachedCameraGeometry) {
            this.cachedCameraGeometry = [];
            let n = Matrix4.fromRotationTranslation(
                Matrix3.fromRotationZ(CesiumMath.PI_OVER_FOUR, new Matrix3()),
                new Cartesian3(0, 0, -5 * cameraScale)
            );
            this.cachedCameraGeometry.push({
                geometry: new CylinderGeometry({
                    length: 6 * cameraScale,
                    slices: 4,
                    topRadius: 1 * cameraScale,
                    bottomRadius: 2.5 * cameraScale,
                    vertexFormat: PerInstanceColorAppearance.VERTEX_FORMAT
                }),
                modelMatrix: n,
                attributes: {
                    color: new ColorGeometryInstanceAttribute(1, 0.8, 0, 0.8)
                }
            }),
                this.cachedCameraGeometry.push({
                    geometry: BoxGeometry.createGeometry(
                        new BoxGeometry({
                            minimum: new Cartesian3(-1.8 * cameraScale, -2.1 * cameraScale, -4 * cameraScale),
                            maximum: new Cartesian3(1.8 * cameraScale, 2.1 * cameraScale, 4 * cameraScale),
                            vertexFormat: PerInstanceColorAppearance.VERTEX_FORMAT
                        })
                    ),
                    attributes: {
                        color: new ColorGeometryInstanceAttribute(1, 0.8, 0, 0.8)
                    }
                });
            let i = Matrix4.fromRotationTranslation(
                    Matrix3.fromRotationY(CesiumMath.PI_OVER_TWO, new Matrix3()),
                    new Cartesian3(0, 4 * cameraScale, -2 * cameraScale)
                ),
                r = Matrix4.fromRotationTranslation(
                    Matrix3.fromRotationY(CesiumMath.PI_OVER_TWO, new Matrix3()),
                    new Cartesian3(0, 4 * cameraScale, 2.5 * cameraScale)
                ),
                o = new CylinderGeometry({
                    length: 1.5 * cameraScale,
                    topRadius: 2.5 * cameraScale,
                    bottomRadius: 2.5 * cameraScale,
                    vertexFormat: PerInstanceColorAppearance.VERTEX_FORMAT
                });
            this.cachedCameraGeometry.push({
                geometry: o,
                modelMatrix: i,
                attributes: {
                    color: new ColorGeometryInstanceAttribute(1, 0.8, 0, 0.8)
                }
            }),
                this.cachedCameraGeometry.push({
                    geometry: o,
                    modelMatrix: r,
                    attributes: {
                        color: new ColorGeometryInstanceAttribute(1, 0.8, 0, 0.8)
                    }
                });
        }
        let a = new Primitive({
                geometryInstances: this.cachedCameraGeometry.map(function (e) {
                    return new GeometryInstance(e);
                }),
                appearance: new PerInstanceColorAppearance({
                    translucent: false,
                    closed: true,
                    flat: false,
                    faceForward: true
                }),
                allowPicking: true,
                modelMatrix: matrix,
                asynchronous: false
            }),
            s = this.viewer,
            l = a.update.bind(a);
        return (
            (a.update = function () {
                let e = s.scene.camera,
                    t = Matrix4.getColumn(a.modelMatrix, 3, new Cartesian4()),
                    n = Cartesian3.distance(e.positionWC, new Cartesian3(t.x, t.y, t.z)),
                    i = Math.max(n / 1e3, 0.05),
                    r = new Cartesian3(i, i, i);
                return Matrix4.setScale(a.modelMatrix, r, a.modelMatrix), l.apply(void 0, arguments);
            }),
            a
        );
    }

    getLookAt(e_cartesian3, t_cartesian3, camera, i_cartesian3) {
        return (
            (camera.position = e_cartesian3),
            (camera.direction = t_cartesian3),
            (camera.up = i_cartesian3),
            Cartesian3.cross(i_cartesian3, t_cartesian3, camera.right),
            {
                heading: camera.heading,
                pitch: camera.roll,
                roll: camera.pitch + CesiumMath.PI_OVER_TWO
            }
        );
    }

    getLookAtPoint(camera) {
        const state = this.state,
            direction = camera.direction.clone();

        return (
            Cartesian3.normalize(direction, direction),
            Cartesian3.multiplyByScalar(direction, state.lookAtDistance, direction),
            Cartesian3.add(camera.position, direction, new Cartesian3())
        );
    }

    hideDebugSplines() {
        if (this.hideTimer) {
            clearTimeout(this.hideTimer);
            this.hideTimer = null;
            this.showSplinesOnMove = false;
        }

        // (this.hideTimer && (clearTimeout(this.hideTimer), (this.hideTimer = null)),
        // (this.showSplinesOnMove = false),
        // this.selectedPoint) && this.toolManager.getToolByType(s.ToolType.ObjectManipulator).detach();
        this.clearObjects();
        this.clearControlPoints();
        // this.bus.$emit(r.Scene.Events.INVALIDATE_CLIENT);
    }

    processKeyDown() {
        return "Escape" === e.key
            ? this.isEditing
                ? (this.exitEditMode(), void this.clearSelection())
                : (this.componentContext.store.state.selectedIndex >= 0 &&
                      this.componentContext.store.dispatch(this.componentContext.actions.SET_SELECTED_INDEX, -1),
                  true)
            : "n" === e.key;
    }

    processKeyUp(event) {
        if (event.key === "n") {
            this.addControlPoint();
        }
    }

    removeControlPoint(index) {
        /*
        const state = this.state;

        if (2 !== state.numPoints) {
            this.componentContext.store.commit(this.componentContext.mutations._REMOVE_CONTROL_POINT, {
                index: index
            });

            const i = state.numPoints;
            const timeControlPoints = state.timeControlPoints;
            const o = timeControlPoints[i - 1] - timeControlPoints[0];
            let a = 1;

            index === i - 1 ? (a = 100 / o) : 0 === index && (a = o / 100);

            timeControlPoints.forEach((time, index) => {
                0 === index
                    ? this.changeState(actions.UPDATE_TIME, {
                          index: index,
                          time: 0
                      })
                    : index === i - 1
                    ? this.changeState(actions.UPDATE_TIME, {
                          index: index,
                          time: 100
                      })
                    : this.changeState(actions.UPDATE_TIME, {
                          index: index,
                          time: time * a
                      });
            });

            index === state.selectedIndex && this.changeState(actions.SET_SELECTED_INDEX, -1);

            this.clearControlPoints();
            this.createSplines();
            this.drawSplines();
            this.drawKeyframes();
        } else this.reset();
         */
    }

    reset() {
        /*
        this.selectedPoint && this.toolManager.getToolByType(s.ToolType.ObjectManipulator).detach(this.selectedPoint);
        this.isEditing && this.exitEditMode(),
            this.componentContext.store.commit(this.componentContext.mutations.SET_CURRENT_FRAME, 0),
            this.componentContext.store.commit(this.componentContext.mutations.SET_CURRENT_POSITION, 0),
            this.componentContext.store.commit(this.componentContext.mutations.SET_RECORDING_ACTIVE, false),
            this.componentContext.store.commit(this.componentContext.mutations.SET_PREVIEW_ACTIVE, false),
            this.componentContext.store.commit(this.componentContext.mutations.CLEAR_CONTROL_POINTS),
            this.componentContext.store.commit(this.componentContext.mutations._SET_SELECTED_INDEX, -1),
            (this.capturer = null),
            (this.positionSpline = null),
            this.clearObjects(),
            this.clearControlPoints(),
            this.hideDebugSplines(),
            this.removeCallback && this.removeCallback(),
            (this.removeCallback = null);
         */
    }

    previewTick() {
        const state = this.state;

        if (this.updateFramePosition() > 100) {
            this.endPreview();
        } else {
            this.setViewAtTime(state.currentPosition);
            // this.bus.$emit(r.Scene.Events.INVALIDATE_CLIENT)
        }
    }

    finishRecording() {
        /*
        let e = this;

        this.showSplinesNextMove(),
            this.toolManager.getToolByType(s.ToolType.MouseTracker).activate(),
            this.componentContext.store.state.recording &&
                (this.componentContext.store.commit(this.componentContext.mutations.SET_RECORDING_ACTIVE, false),
                this.capturer.complete().then(function (t) {
                    let n = "".concat(e.getCloudSlug(), "-").concat(new Date().getTime(), ".webm");
                    saveAs(t, n);
                }));
         */
    }

    endPreview() {
        // this.componentContext.store.commit(this.componentContext.mutations.SET_PREVIEW_ACTIVE, false),

        this.state.previewRunning = false;
        // this.componentContext.bus.$emit(E.PREVIEW_FINISHED),
        this.showSplinesNextMove();
        if (this.removeCallback) {
            this.removeCallback();
            this.removeCallback = null;
        }
    }

    exitEditMode() {
        /*
        this.toolManager.getToolType(s.ToolType.OrbitController).setScanMode(false),
            this.createSplines(),
            this.showSplinesNextMove(),
            (this.editingIndex = -1),
            (this.editingPrimitive = null),
            this.componentContext.store.commit(this.componentContext.mutations.SET_EDITING, false);
         */
    }

    setViewAtTime(time) {
        const destination = this.positionSpline.evaluate(time);
        const n = this.lookAtSpline.evaluate(time);
        const i = Cartesian3.subtract(n, destination, new Cartesian3());

        Cartesian3.normalize(i, i);

        const r = new Camera(this.viewer.scene);

        r.position = destination;
        r.direction = i;
        r.up = (0, d.getWorldUpVector)(this.viewer.scene.camera.position);

        const o = Quaternion.fromHeadingPitchRoll(r, new Quaternion());
        const a = Quaternion.fromHeadingPitchRoll(this.viewer.camera, new Quaternion());
        const s = Quaternion.fastSlerp(a, o, 1, new Quaternion());
        const headingPitchRoll = HeadingPitchRoll.fromQuaternion(s);

        this.viewer.camera.setView({
            destination: destination,
            orientation: {
                heading: headingPitchRoll.heading,
                pitch: headingPitchRoll.pitch,
                roll: headingPitchRoll.roll
            }
        });
    }

    showSplinesNextMove() {
        const self = this;

        if (this.hideTimer) {
            clearTimeout(this.hideTimer);
            this.hideTimer = null;
        }

        this.hideTimer = setTimeout(() => {
            self.showSplinesOnMove = true;
        }, 100);
    }
}
