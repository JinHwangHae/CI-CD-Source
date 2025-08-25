import { Event, Viewer } from "cesium";

export class LabelService {
    viewer: Viewer;
    labels: any[];
    removeCallback: Event.RemoveCallback;

    constructor(viewer: Viewer) {
        this.viewer = viewer;
        this.labels = [];
        this.removeCallback = viewer.camera.changed.addEventListener(() => {
            this.labels.forEach((i) => {
                i.tick();
            });
        });
        new ResizeObserver(() => {
            this.labels.forEach((i) => {
                i.tick();
            });
        }).observe(viewer.container);
    }

    addCesiumText(t: any) {
        if (this.labels.indexOf(t) === -1) {
            this.labels.push(t);
        } else {
            console.error("Duplicate cesium label");
        }
    }

    removeCesiumText(t: any) {
        const n = this.labels.indexOf(t);
        if (n >= 0) {
            this.labels.splice(n, 1);
        } else {
            console.error("Cannot find label to remove: ", t);
        }
    }
}
