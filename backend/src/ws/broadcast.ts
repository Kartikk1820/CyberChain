import { EventEmitter } from "node:events";
import type { WsEvent } from "@sixsync/shared";

export const wsBus = new EventEmitter();
wsBus.setMaxListeners(0);

export function broadcast(event: WsEvent) {
  wsBus.emit("event", event);
}
