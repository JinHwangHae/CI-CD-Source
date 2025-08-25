/* qeslint-disable */
// q@ts-nocheck

import { WebXRButton } from "./util/webxr-button";
import { InlineViewerHelper } from "./util/inline-viewer-helper";
import { eulerFromQuaternionDegree, create$1 } from "./util/math";

export function enableXRDependencies() {
    window.CONSTRUKTEDXR = {};

    window.CONSTRUKTEDXR.WebXRButton = WebXRButton;
    window.CONSTRUKTEDXR.InlineViewerHelper = InlineViewerHelper;
    window.CONSTRUKTEDXR.eulerFromQuaternionDegree = eulerFromQuaternionDegree;
    window.CONSTRUKTEDXR.create$1 = create$1;
}
