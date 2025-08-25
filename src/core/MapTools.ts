import { CanvasEventHandlerParent } from "./CanvasEventHandler";
import { MapTool } from "./MapTool";

export class MapTools {
    private readonly _parent: CanvasEventHandlerParent;
    private readonly _tools: MapTool[] = [];
    private _selectedTool: MapTool | undefined;

    constructor(options: { parent: CanvasEventHandlerParent }) {
        this._parent = options.parent;

        this._tools = [];
    }

    get tools() {
        return this._tools;
    }

    get selectedTool() {
        return this._selectedTool;
    }

    selectTool(tool: MapTool, activateOptions: any = undefined) {
        this._selectedTool = tool;
        this._parent.setMapTool(tool, activateOptions);
    }

    addTool(tool: MapTool) {
        this._tools.push(tool);
    }
}
