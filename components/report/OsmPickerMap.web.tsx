import { createElement, useEffect, useMemo, useRef } from "react";
import { osmPickerHtml } from "@/lib/osm-picker-html";
import { parseMapMessage } from "@/lib/map-location";
import type { OsmPickerMapProps } from "./OsmPickerMap.types";
export function OsmPickerMap({ initialPin, focusPin, onPin, onReady, onError, onOutside }: OsmPickerMapProps) {
  const frame = useRef<HTMLIFrameElement>(null);
  const focus = () => { if (focusPin) frame.current?.contentWindow?.postMessage({ channel: "boses-map-control", pin: focusPin }, "*"); };
  useEffect(focus, [focusPin]);
  const html = useMemo(() => osmPickerHtml(initialPin), [initialPin]);
  useEffect(() => {
    const receive = (event: MessageEvent) => {
      if (event.source !== frame.current?.contentWindow) return;
      const message = parseMapMessage(event.data);
      if (message?.type === "pin") onPin(message.pin);
      else if (message?.type === "ready") onReady();
      else if (message?.type === "error") onError();
      else if (message?.type === "outside") onOutside();
    };
    window.addEventListener("message", receive);
    return () => window.removeEventListener("message", receive);
  }, [onPin, onReady, onError, onOutside]);
  return createElement("iframe", { ref: frame, title: "Pumili ng lokasyon sa OpenStreetMap", srcDoc: html,
    onLoad: focus, sandbox: "allow-scripts allow-popups", referrerPolicy: "strict-origin-when-cross-origin",
    style: { flex: 1, width: "100%", height: "100%", minHeight: 260, border: 0 }, onError });
}
