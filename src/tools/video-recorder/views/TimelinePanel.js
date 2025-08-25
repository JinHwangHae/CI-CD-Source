/* eslint-disable */

import { LayoutParameters } from "../Settings";
import { Theme } from "../theme";
import { utils } from "../utils/utils";
import { handleDrag } from "../utils/util_handle_drag";
import Diamond from "./Diamond";

const proxy_ctx = utils.proxy_ctx;

const LINE_HEIGHT = LayoutParameters.LINE_HEIGHT,
    TIME_SCROLLER_HEIGHT = 35,
    MARKER_TRACK_HEIGHT = 25;
let timeScale = LayoutParameters.time_scale;

let frameStart = 0; // this is the current scroll position.

/*
 * This class contains the view for the right main section of timeliner
 */

// TODO
// dirty rendering
// drag block
// DON'T use time.update for everything

let tickMark1;
let tickMark2;
let tickMark3;

function timeScaled() {
    /*
     * Subdivison LOD
     * time_scale refers to number of pixels per unit
     * Eg. 1 inch - 60s, 1 inch - 60fps, 1 inch - 6 mins
     */
    let div = 60;

    tickMark1 = timeScale / div;
    tickMark2 = 2 * tickMark1;
    tickMark3 = 10 * tickMark1;
}

timeScaled();

/**************************/
// Timeline Panel
/**************************/

function TimelinePanel(dataStore, dispatcher, videoRecorder) {
    let dpr = window.devicePixelRatio;
    let trackCanvas = document.createElement("canvas");

    let scrollTop = 0,
        scrollLeft = 0,
        SCROLL_HEIGHT;
    // let layers = dataStore.get('layers').value;

    let layers = [];

    this.scrollTo = function (s, y) {
        scrollTop = s * Math.max(layers.length * LINE_HEIGHT - SCROLL_HEIGHT, 0);
        repaint();
    };

    this.resize = function () {
        const trackCanvasHeight =
            LayoutParameters.height - TIME_SCROLLER_HEIGHT - LayoutParameters.STATUS_BAR_HEIGHT - 5;

        dpr = window.devicePixelRatio;

        const width = LEFT_GUTTER +  videoRecorder.state.totalDuration * LayoutParameters.time_scale + RIGHT_GUTTER;

        trackCanvas.width = width * dpr;
        trackCanvas.height = trackCanvasHeight * dpr;
        trackCanvas.style.width = width + "px";
        trackCanvas.style.height = trackCanvasHeight + "px";
        SCROLL_HEIGHT = LayoutParameters.height - TIME_SCROLLER_HEIGHT;
    };

    let div = document.createElement("div");

    utils.style(trackCanvas, {
        position: "absolute",
        top: "0px",
        left: "0px"
    });

    const LEFT_GUTTER = LayoutParameters.LEFT_GUTTER;
    const RIGHT_GUTTER = LayoutParameters.RIGHT_GUTTER;

    div.appendChild(trackCanvas);

    trackCanvas.id = "track-canvas";

    this.dom = div;
    this.dom.id = "timeline-panel";
    this.resize();

    let ctx = trackCanvas.getContext("2d");
    let ctx_wrap = proxy_ctx(ctx);

    let currentTime; // measured in seconds
    // technically it could be in frames or  have it in string format (0:00:00:1-60)

    let i, x, y, countOfLayers;

    let needsRepaint = false;
    let renderItems = [];

    function repaint() {
        needsRepaint = true;
    }

    function drawTickMarkAreaBackground() {
        const width = LayoutParameters.width;

        ctx.fillStyle = "rgba(42, 42, 42, 1)";
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(width, 0);
        ctx.lineTo(width, 40);
        ctx.lineTo(0, 40);

        ctx.closePath();
        ctx.fill();
    }

    function drawAnimationArea() {
        const height = LayoutParameters.height;

        const startX = timeToX(0);
        const endX = timeToX(dataStore.get("ui:totalTime").value);

        ctx.fillStyle = "rgba(66, 66, 66, 1)";
        ctx.beginPath();
        ctx.moveTo(startX, 40);
        ctx.lineTo(endX, 40);
        ctx.lineTo(endX, height);
        ctx.lineTo(startX, height);

        ctx.closePath();
        ctx.fill();
    }

    function drawLayerContents() {
        // horizontal Layer lines
        for (i = 0, countOfLayers = layers.length; i <= countOfLayers; i++) {
            ctx.strokeStyle = Theme.b;
            ctx.beginPath();
            y = i * LINE_HEIGHT;
            y = ~~y - 0.5;

            ctx_wrap.moveTo(0, y).lineTo(LayoutParameters.width, y).stroke();
        }

        renderItems = [];

        const state = videoRecorder.state;

        const positionControlPoints = state.positionControlPoints;

        const totalTime = dataStore.get("ui:totalTime").value;

        for (i = 0; i < positionControlPoints.length; i++) {
            const y = LINE_HEIGHT;

            const frame = {
                time: (totalTime / (positionControlPoints.length - 1)) * i,
                tween: "",
                value: 1
            };

            renderItems.push(
                new Diamond({
                    indexOfFrame: i,
                    frame: frame,
                    x: timeToX(frame.time),
                    y: y,
                    trackCanvas: trackCanvas,
                    ctx_wrap: ctx_wrap,
                    dispatcher: dispatcher,
                    xToTime: xToTime
                })
            );
        }

        // render items
        let item;

        for (i = 0; i < renderItems.length; i++) {
            item = renderItems[i];
            item.paint(ctx_wrap);
        }
    }

    function setTimeScale() {
        let v = dataStore.get("ui:timeScale").value;

        if (timeScale !== v) {
            timeScale = v;
            timeScaled();
        }
    }

    let over = null;
    let mousedownItem = null;

    function check() {
        let item;
        let last_over = over;
        // over = [];
        over = null;
        for (i = renderItems.length; i-- > 0; ) {
            item = renderItems[i];
            item.path(ctx_wrap);

            if (ctx.isPointInPath(pointer.x * dpr, pointer.y * dpr)) {
                // over.push(item);
                over = item;
                break;
            }
        }

        // clear old mousein
        if (last_over && last_over != over) {
            item = last_over;
            if (item.mouseout) item.mouseout();
        }

        if (over) {
            item = over;
            if (item.mouseover) item.mouseover();

            if (mousedown2) {
                mousedownItem = item;
            }
        }
    }

    function pointerEvents() {
        if (!pointer) return;

        ctx_wrap
            .save()
            .scale(dpr, dpr)
            .translate(0, MARKER_TRACK_HEIGHT)
            .beginPath()
            .rect(0, 0, LayoutParameters.width, SCROLL_HEIGHT)
            .translate(-scrollLeft, -scrollTop)
            .clip()
            .run(check)
            .restore();
    }

    function _paint() {
        if (!needsRepaint) {
            pointerEvents();
            return;
        }

        setTimeScale();

        currentTime = dataStore.get("ui:currentTime").value;
        frameStart = dataStore.get("ui:scrollTime").value;

        /**************************/
        // background

        ctx.fillStyle = "rgba(51, 51, 51, 1)";
        ctx.clearRect(0, 0, trackCanvas.width, trackCanvas.height);
        ctx.save();
        ctx.scale(dpr, dpr);

        ctx.lineWidth = 1;

        const height = LayoutParameters.height;

        let units = timeScale / tickMark1;
        let offsetUnits = (frameStart * timeScale) % units;

        // let count = (width - LEFT_GUTTER + offsetUnits) / units;

        let count = Math.ceil(videoRecorder.state.totalDuration) + 1;

        // console.log('time_scale', time_scale, 'tickMark1', tickMark1, 'units', units, 'offsetUnits', offsetUnits, frame_start);

        // time_scale = pixels to 1 second (40)
        // tickMark1 = marks per second (marks / s)
        // units = pixels to every mark (40)

        drawAnimationArea();
        drawTickMarkAreaBackground();

        // draw time labels only
        //0:00 0:01 0:02
        for (i = 0; i < count; i++) {
            x = i * units + LEFT_GUTTER - offsetUnits;

            // vertical lines
            ctx.strokeStyle = Theme.b;
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, height);
            ctx.stroke();

            ctx.fillStyle = Theme.d;
            ctx.textAlign = "center";

            let t = (i * units - offsetUnits) / timeScale + frameStart;
            t = utils.format_friendly_seconds(t);
            ctx.fillText(t, x, 38);
        }

        units = timeScale / tickMark2;
        // count = (width - LEFT_GUTTER + offsetUnits) / units;

        count = Math.ceil(videoRecorder.state.totalDuration) * tickMark2 + 1;

        // marker lines - main
        for (i = 0; i < count; i++) {
            ctx.strokeStyle = Theme.c;
            ctx.beginPath();
            x = i * units + LEFT_GUTTER - offsetUnits;
            ctx.moveTo(x, MARKER_TRACK_HEIGHT - 0);
            ctx.lineTo(x, MARKER_TRACK_HEIGHT - 16);
            ctx.stroke();
        }

        let mul = tickMark3 / tickMark2;
        units = timeScale / tickMark3;
        count = Math.ceil(videoRecorder.state.totalDuration) * tickMark3;

        // small ticks
        for (i = 0; i < count; i++) {
            if (i % mul === 0) continue;
            ctx.strokeStyle = Theme.c;
            ctx.beginPath();
            x = i * units + LEFT_GUTTER - offsetUnits;
            ctx.moveTo(x, MARKER_TRACK_HEIGHT - 0);
            ctx.lineTo(x, MARKER_TRACK_HEIGHT - 10);
            ctx.stroke();
        }

        // Encapsulate a scroll rect for the layers
        ctx_wrap
            .save()
            .translate(0, MARKER_TRACK_HEIGHT)
            .beginPath()
            .rect(0, 0, LayoutParameters.width, SCROLL_HEIGHT)
            .translate(-scrollLeft, -scrollTop)
            .clip()
            .run(drawLayerContents)
            .restore();

        // Current Marker / Cursor
        ctx.strokeStyle = "red"; // Theme.c
        x = (currentTime - frameStart) * timeScale + LEFT_GUTTER;

        let txt = utils.format_friendly_seconds(currentTime);
        let textWidth = ctx.measureText(txt).width;

        let base_line = MARKER_TRACK_HEIGHT - 5,
            half_rect = textWidth / 2 + 4;

        ctx.beginPath();
        ctx.moveTo(x, base_line);
        ctx.lineTo(x, height);
        ctx.stroke();

        ctx.fillStyle = "red"; // black
        ctx.textAlign = "center";
        ctx.beginPath();
        ctx.moveTo(x, base_line + 5);
        ctx.lineTo(x + 5, base_line);
        ctx.lineTo(x + half_rect, base_line);
        ctx.lineTo(x + half_rect, base_line - 14);
        ctx.lineTo(x - half_rect, base_line - 14);
        ctx.lineTo(x - half_rect, base_line);
        ctx.lineTo(x - 5, base_line);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = "white";
        ctx.fillText(txt, x, base_line - 4);

        ctx.restore();

        needsRepaint = false;
        // pointerEvents();
    }

    function yToTrack(y) {
        if (y - MARKER_TRACK_HEIGHT < 0) return -1;
        return ((y - MARKER_TRACK_HEIGHT + scrollTop) / LINE_HEIGHT) | 0;
    }

    function xToTime(x) {
        let units = timeScale / tickMark3;

        // return frame_start + (x - LEFT_GUTTER) / time_scale;

        return frameStart + (((x - LEFT_GUTTER) / units) | 0) / tickMark3;
    }

    function timeToX(s) {
        let ds = s - frameStart;
        ds *= timeScale;
        ds += LEFT_GUTTER;

        return ds;
    }

    this.repaint = repaint;
    this._paint = _paint;

    repaint();

    let canvasBounds;

    document.addEventListener("mousemove", onMouseMove);

    function onMouseMove(e) {
        canvasBounds = trackCanvas.getBoundingClientRect();
        let mx = e.clientX - canvasBounds.left,
            my = e.clientY - canvasBounds.top;
        onPointerMove(mx, my);
    }

    let pointerDidMoved = false;
    let pointer = null;

    function onPointerMove(x, y) {
        if (mousedownItem) return;

        pointerDidMoved = true;
        pointer = { x: x, y: y };
    }

    trackCanvas.addEventListener("mouseout", function () {
        pointer = null;
    });

    let mousedown2 = false,
        mouseDownThenMove = false;

    handleDrag(
        trackCanvas,
        function down(e) {
            mousedown2 = true;

            pointer = {
                x: e.offsetx,
                y: e.offsety
            };

            pointerEvents();

            if (!mousedownItem) dispatcher.fire("time.update", xToTime(e.offsetx));
            // Hit criteria
        },
        function move(e) {
            mousedown2 = false;
            if (mousedownItem) {
                mouseDownThenMove = true;
                if (mousedownItem.mouseDrag) {
                    mousedownItem.mouseDrag(e);
                }
            } else {
                dispatcher.fire("time.update", xToTime(e.offsetx));
            }
        },
        function up(e) {
            if (mouseDownThenMove) {
                dispatcher.fire("keyframe.move");
            } else {
                dispatcher.fire("time.update", xToTime(e.offsetx));
            }
            mousedown2 = false;
            mousedownItem = null;
            mouseDownThenMove = false;
        }
    );

    this.setState = function (state) {
        layers = state.value;
        repaint();
    };
}

export { TimelinePanel, MARKER_TRACK_HEIGHT };
