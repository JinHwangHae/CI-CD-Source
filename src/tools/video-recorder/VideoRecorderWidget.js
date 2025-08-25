/* eslint-disable */
// q@ts-nocheck

import { TimelinePanel } from "./views/TimelinePanel";
import { Dispatcher } from "./utils/util_dispatcher";
import { DataStore } from "./utils/util_datastore";
import { utils } from "./utils/utils";
import { Theme } from "./theme";
import { DockingWindow } from "./utils/docking_window";
import { IconButton } from "./ui/IconButton";
import { LayoutParameters } from "./Settings";
import { setBounds } from "./utils";

const style = utils.style;
const Z_INDEX = 999;

const headerStyles = {
    position: "absolute",
    top: "0px",
    width: "100%",
    height: "22px",
    lineHeight: "22px",
    overflow: "hidden"
};

const buttonStyles = {
    width: "20px",
    height: "20px",
    padding: "2px",
    marginRight: "2px"
};

export class VideoRecorderWidget {
    constructor(options) {
        this._videoRecorder = options.videoRecorder;

        const dispatcher = new Dispatcher();
        const dataStore = new DataStore();

        this._dispatcher = dispatcher;
        this._dataStore = dataStore;

        this._timelinePanel = new TimelinePanel(dataStore, dispatcher, this._videoRecorder);
        this._createDom();
        this._connectEventHandlers();

        this._loop(0);
    }

    show() {
        this._rootPanel.style.display = "block";
    }

    hide() {
        this._rootPanel.style.display = "none";
    }

    _connectEventHandlers() {
        const dispatcher = this._dispatcher;

        dispatcher.on("controls.toggle_play", () => {
            if (this._videoRecorder.state.previewRunning) {
                this._stopPlaying();
            } else {
                this.startPlaying();
            }
        });

        const videoRecorder = this._videoRecorder;

        videoRecorder.addedControlPoint.addEventListener(this._onAddedControlPoint.bind(this));
    }

    _onAddedControlPoint(/* numPoint */) {
        const state = this._videoRecorder.state;
        const positionControlPoints = state.positionControlPoints;

        if (positionControlPoints.length < 2) {
            return;
        }

        this._timelinePanel.repaint();
    }

    startPlaying() {
        const state = this._videoRecorder.state;

        if (state.timeControlPoints.length < 2) {
            alert("need to add control points");
            return;
        }

        this._videoRecorder.startPreview();
        this._playButton.setIcon("stop");
        this._playButton.setTip("Stop");
    }

    _stopPlaying() {
        this._playButton.setIcon("play");
        this._playButton.setTip("Play");

        this._videoRecorder.endPreview();
    }

    _createDom() {
        const rootPanel = document.createElement("div");

        this._rootPanel = rootPanel;

        rootPanel.id = "animation-editor-root-panel";

        style(rootPanel, {
            position: "fixed",
            top: "20px",
            left: "20px",
            margin: 0,
            border: `1px solid ${Theme.a}`,
            padding: 0,
            overflow: "hidden",
            backgroundColor: Theme.a,
            color: Theme.d,
            zIndex: Z_INDEX,
            fontFamily: "monospace",
            fontSize: "12px"
        });

        const centralPanel = document.createElement("div");

        centralPanel.id = "animation-editor-central-panel";

        style(centralPanel, {
            textAlign: "left",
            lineHeight: "1em",
            position: "absolute",
            top: "44px"
        });

        const titlePanel = this._createTitlePanel();
        const toolbarPanel = this._createToolbar();

        rootPanel.appendChild(centralPanel);
        rootPanel.appendChild(titlePanel);
        rootPanel.appendChild(toolbarPanel);

        const ghostPanel = document.createElement("div");

        ghostPanel.id = "ghost-panel";

        style(ghostPanel, {
            background: "#999",
            opacity: 0.2,
            position: "fixed",
            margin: 0,
            padding: 0,
            zIndex: Z_INDEX - 1,
            // transition: 'all 0.25s ease-in-out',
            transitionProperty: "top, left, width, height, opacity",
            transitionDuration: "0.25s",
            transitionTimingFunction: "ease-in-out"
        });

        // Handle DOM Views

        // Shadow Root
        const root = document.createElement("timeliner");

        document.body.appendChild(root);

        window.r = root;

        root.appendChild(rootPanel);
        root.appendChild(ghostPanel);

        // centralPanel.appendChild(layerPanel.dom);
        centralPanel.appendChild(this._timelinePanel.dom);

        const width =
            LayoutParameters.LEFT_GUTTER +
            this._videoRecorder.state.totalDuration * LayoutParameters.time_scale +
            LayoutParameters.RIGHT_GUTTER;

        setBounds(rootPanel, 0, 0, width, LayoutParameters.height);
        setBounds(ghostPanel, 0, 0, width, LayoutParameters.height);

        /* Integrate pane into docking window */

        const widget = new DockingWindow(rootPanel, ghostPanel);

        widget.allowMove(false);
        widget.resizes.do(this._resize.bind(this));

        titlePanel.addEventListener("mouseover", () => {
            widget.allowMove(true);
        });

        titlePanel.addEventListener("mouseout", () => {
            widget.allowMove(false);
        });
    }

    _createTitlePanel() {
        const titlePanel = document.createElement("div");

        titlePanel.id = "title-panel";

        style(titlePanel, headerStyles, {
            borderBottom: `1px solid ${Theme.b}`,
            textAlign: "center"
        });

        const titleBar = document.createElement("span");

        titlePanel.appendChild(titleBar);

        titleBar.innerHTML = "Animation Editor";
        titlePanel.appendChild(titleBar);

        const topRightBar = document.createElement("div");

        topRightBar.id = "animation-editor-top-right-bar";

        style(topRightBar, headerStyles, {
            textAlign: "right"
        });

        titlePanel.appendChild(topRightBar);

        const closeButton = new IconButton(10, "remove", "Close", this._dispatcher);

        closeButton.onClick((e) => {
            e.preventDefault();
            this.hide();
        });

        // resize full
        const resizeFull = new IconButton(10, "resize_full", "maximize", this._dispatcher);

        style(resizeFull.dom, buttonStyles, { marginRight: "2px" });

        topRightBar.appendChild(closeButton.dom);

        return titlePanel;
    }

    _createToolbar() {
        const toolbarPanel = document.createElement("div");

        toolbarPanel.id = "animation-editor-toolbar";

        style(toolbarPanel, headerStyles, {
            top: "22px",
            borderBottom: `1px solid ${Theme.b}`,
            textAlign: "center"
        });

        const dispatcher = this._dispatcher;

        const jumpToFirstButton = new IconButton(12, "jumpToFirst", "Jump to first frame in frame range.", dispatcher);

        jumpToFirstButton.onClick((e) => {
            e.preventDefault();

            if (!this._videoRecorder.state.previewRunning) {
                alert("Animation was not started");
                return;
            }

            this._videoRecorder.state.currentPosition = 0;
        });

        const playButton = new IconButton(12, "play", "Play", dispatcher);

        playButton.onClick((e) => {
            e.preventDefault();
            dispatcher.fire("controls.toggle_play");
        });

        this._playButton = playButton;

        const jumpToEndButton = new IconButton(12, "jumpToEnd", "Jump to last frame in frame range.", dispatcher);

        jumpToEndButton.onClick((e) => {
            e.preventDefault();

            if (!this._videoRecorder.state.previewRunning) {
                alert("Animation was not started");
                return;
            }

            this._videoRecorder.state.currentPosition = 100;
        });

        toolbarPanel.appendChild(jumpToFirstButton.dom);
        toolbarPanel.appendChild(playButton.dom);
        toolbarPanel.appendChild(jumpToEndButton.dom);

        return toolbarPanel;
    }

    // eslint-disable-next-line class-methods-use-this
    _resize(width, height) {
        // eslint-disable-next-line no-param-reassign
        width -= 4;
        // eslint-disable-next-line no-param-reassign
        height -= 44;

        LayoutParameters.width = width;
        LayoutParameters.height = height;
    }

    _repaintAll() {
        this._timelinePanel.repaint();
    }

    _setCurrentTime(value) {
        console.assert(value >= 0, "error");

        const currentTimeStore = this._dataStore.get("ui:currentTime");

        currentTimeStore.value = value;

        this._repaintAll();
    }

    _loop() {
        const state = this._videoRecorder.state;

        if (state.previewRunning) {
            const time = (state.currentPosition / 100) * state.totalDuration;

            this._setCurrentTime(time);
        } else {
            this._playButton.setIcon("play");
            this._playButton.setTip("Play");

            this._setCurrentTime(0);
        }

        this._timelinePanel._paint();

        window.requestAnimationFrame(this._loop.bind(this));
    }
}
