import "@fontsource/silkscreen/400.css";
import "./styles/base.css";
import "./styles/title.css";
import "./styles/menu.css";
import "./styles/cinematic.css";
import "./styles/game.css";
import "./styles/touch.css";
import "./styles/inventory.css";
import "./styles/commands.css";
import { App } from "./app/App";
import { blockZoomGestures } from "./core/mobile";
import { enableOffline } from "./core/offline";

blockZoomGestures();
enableOffline();
new App(document.getElementById("app")!);
