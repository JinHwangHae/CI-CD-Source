/* eslint-disable */

import { font } from "./font";
import { Theme } from "../theme";
import { utils } from "../utils/utils";
const { style } = utils;

function IconButton(size, icon, tooltip, dispatcher) {
    const iconStyle = {
        padding: "0.2em 0.4em",
        margin: "0em",
        background: "none",
        outline: "none",
        fontSize: "16px",
        border: "none",
        borderRadius: "0.2em"
    };

    let button = document.createElement("button");

    button.title = tooltip;

    style(button, iconStyle);

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");

    button.appendChild(canvas);

    this.ctx = ctx;
    this.dom = button;
    this.canvas = canvas;

    const me = this;
    this.size = size;
    let dpr = 1;

    this.resize = function () {
        dpr = window.devicePixelRatio;
        let height = size;

        const glyph = font.fonts[icon];

        canvas.height = height * dpr;
        canvas.style.height = height + "px";

        const scale = height / font.unitsPerEm;
        let width = (glyph.advanceWidth * scale + 0.5) | 0;

        width += 2;

        canvas.width = width * dpr;
        canvas.style.width = width + "px";

        ctx.fillStyle = Theme.c;
        me.draw();
    };

    if (dispatcher) dispatcher.on("resize", this.resize);

    this.setSize = function (s) {
        size = s;
        this.resize();
    };

    this.setIcon = function (icon) {
        me.icon = icon;

        if (!font.fonts[icon]) console.warn("Font icon not found!");
        this.resize();
    };

    this.onClick = function (e) {
        button.addEventListener("click", e);
    };

    const LONG_HOLD_DURATION = 500;
    let longHoldTimer;

    this.onLongHold = function (f) {
        // not most elagent but oh wells.
        function startHold(e) {
            e.preventDefault();
            e.stopPropagation();
            longHoldTimer = setTimeout(function () {
                if (longHoldTimer) {
                    console.log("LONG HOLD-ED!");
                    f();
                }
            }, LONG_HOLD_DURATION);
        }

        function clearLongHoldTimer() {
            clearTimeout(longHoldTimer);
        }

        button.addEventListener("mousedown", startHold);
        button.addEventListener("touchstart", startHold);
        button.addEventListener("mouseup", clearLongHoldTimer);
        button.addEventListener("mouseout", clearLongHoldTimer);
        button.addEventListener("touchend", clearLongHoldTimer);
    };

    this.setTip = function (tip) {
        tooltip = tip;
        this.dom.title = tip;
    };

    const borders = {
        border: "1px solid " + Theme.b
        // boxShadow: Theme.b + ' 1px 1px'
    };

    const no_borders = {
        border: "1px solid transparent"
        // boxShadow: 'none'
    };

    const normal = "none"; // Theme.b;
    const down = Theme.b;

    button.style.background = normal;
    style(button, no_borders);

    button.addEventListener("mouseover", function () {
        // button.style.background = up;
        style(button, borders);

        ctx.fillStyle = Theme.d;
        ctx.shadowColor = Theme.b;
        ctx.shadowBlur = 0.5 * dpr;
        ctx.shadowOffsetX = dpr;
        ctx.shadowOffsetY = dpr;
        me.draw();

        if (tooltip && dispatcher) dispatcher.fire("status", tooltip);
    });

    button.addEventListener("mousedown", function () {
        button.style.background = down;
        // ctx.fillStyle = Theme.b;
        // me.draw();
    });

    button.addEventListener("mouseup", function () {
        // ctx.fillStyle = Theme.d;
        button.style.background = normal;
        style(button, borders);
        // me.draw();
    });

    button.addEventListener("mouseout", function () {
        // ctx.fillStyle = Theme.c;

        button.style.background = normal;
        style(button, no_borders);
        me.dropshadow = false;
        ctx.fillStyle = Theme.c;
        ctx.shadowColor = null;
        ctx.shadowBlur = 0;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;
        me.draw();
    });

    if (icon) this.setIcon(icon);
}

IconButton.prototype.CMD_MAP = {
    M: "moveTo",
    L: "lineTo",
    Q: "quadraticCurveTo",
    C: "bezierCurveTo",
    Z: "closePath"
};

IconButton.prototype.draw = function () {
    if (!this.icon) return;

    const ctx = this.ctx;

    const glyph = font.fonts[this.icon];

    const height = this.size;
    const dpr = window.devicePixelRatio;
    const scale = (height / font.unitsPerEm) * dpr;
    const path_commands = glyph.commands.split(" ");

    ctx.save();
    ctx.clearRect(0, 0, this.canvas.width * dpr, this.canvas.height * dpr);

    if (this.dropshadow) {
        ctx.save();
        ctx.fillStyle = Theme.b;
        ctx.translate(1.5 * dpr, 1.5 * dpr);
        ctx.scale(scale, -scale);
        ctx.translate(0, -font.ascender);
        ctx.beginPath();

        for (let i = 0, il = path_commands.length; i < il; i++) {
            const cmds = path_commands[i].split(",");
            const params = cmds.slice(1);

            try {
                ctx[this.CMD_MAP[cmds[0]]].apply(ctx, params);
            } catch (e) {
                console.error(e.message);
            }
        }

        ctx.fill();
        ctx.restore();
    }

    ctx.scale(scale, -scale);
    ctx.translate(0, -font.ascender);
    ctx.beginPath();

    for (let i = 0, il = path_commands.length; i < il; i++) {
        const cmds = path_commands[i].split(",");
        const params = cmds.slice(1);

        if (!ctx[this.CMD_MAP[cmds[0]]]) {
            console.warn(`invalid path command: ${path_commands[i]}`);
            continue;
        }

        try {
            ctx[this.CMD_MAP[cmds[0]]].apply(ctx, params);
        } catch (e) {
            console.error(e.message);
        }
    }
    ctx.fill();
    ctx.restore();

    /*
	const triangle = height / 3 * dpr;
	ctx.save();
	// ctx.translate(dpr * 2, 0);
	// ctx.fillRect(this.canvas.width - triangle, this.canvas.height - triangle, triangle, triangle);
	ctx.beginPath();
	ctx.moveTo(this.canvas.width - triangle, this.canvas.height - triangle / 2);
	ctx.lineTo(this.canvas.width, this.canvas.height - triangle / 2);
	ctx.lineTo(this.canvas.width - triangle / 2, this.canvas.height);
	ctx.fill();
	ctx.restore();
	*/
};

export { IconButton };
