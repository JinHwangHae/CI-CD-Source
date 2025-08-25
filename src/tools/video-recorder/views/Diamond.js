/* eslint-disable */
/* eslint-disable camelcase */
// q@ts-nocheck

import { Theme } from "../theme";
import { LayoutParameters } from "../Settings";

const DIAMOND_SIZE = LayoutParameters.DIAMOND_SIZE;
const LINE_HEIGHT = LayoutParameters.LINE_HEIGHT;

function Diamond(options) {
    const indexOfFrame = options.indexOfFrame;
    const frame = options.frame;
    const x = options.x;
    const y = options.y;
    const trackCanvas = options.trackCanvas;
    const ctx_wrap = options.ctx_wrap;
    const dispatcher = options.dispatcher;
    const xToTime = options.xToTime;

    const y2 = y + LINE_HEIGHT * 0.5 - DIAMOND_SIZE / 2;

    const self = this;

    let isOver = false;

    this.path = function (ctx_wrap1) {
        ctx_wrap1
            .beginPath()
            .moveTo(x, y2)
            .lineTo(x + DIAMOND_SIZE / 2, y2 + DIAMOND_SIZE / 2)
            .lineTo(x, y2 + DIAMOND_SIZE)
            .lineTo(x - DIAMOND_SIZE / 2, y2 + DIAMOND_SIZE / 2)
            .closePath();
    };

    this.paint = function (ctx_wrap1) {
        self.path(ctx_wrap1);

        if (!isOver) ctx_wrap1.fillStyle(Theme.c);
        else ctx_wrap1.fillStyle("yellow"); // Theme.d

        ctx_wrap1.fill().stroke();
    };

    this.mouseover = function () {
        isOver = true;
        trackCanvas.style.cursor = "move"; // pointer move ew-resize
        self.paint(ctx_wrap);
    };

    this.mouseout = function () {
        isOver = false;
        trackCanvas.style.cursor = "default";
        self.paint(ctx_wrap);
    };

    /**
     * @param {object} e
     * @param {number} e.dx
     * @param {number} e.dy
     * @param {boolean} e.moved
     * @param {number} e.offsetx
     * @param {number} e.offsety
     * @param {number} e.startx
     * @param {number} e.starty
     * @param {number} e.x
     * @param {number} e.y
     */
    this.mouseDrag = function (e) {
        let updatedTime = xToTime(x + e.dx);

        updatedTime = Math.max(0, updatedTime);

        // TODO limit moving to neighbours
        frame.time = updatedTime;

        dispatcher.fire("frameChanged", {
            indexOfFrame: indexOfFrame,
            updatedTime: updatedTime
        });
    };
}

export default Diamond;
