import { useMemo, useEffect, useRef } from "react";
import { Alert, Linking } from "react-native";
import { WebView } from "react-native-webview";
import { osmPickerHtml } from "@/lib/osm-picker-html";
import { parseMapMessage } from "@/lib/map-location";
import type { OsmPickerMapProps } from "./OsmPickerMap.types";
export function OsmPickerMap({ initialPin, focusPin, onPin, onReady, onError, onOutside }: OsmPickerMapProps) {
  const view = useRef<WebView<{}>>(null);
  const loaded = useRef(false);
  const focus = () => { if (focusPin && loaded.current) view.current?.injectJavaScript(`window.bosesFocusPin && window.bosesFocusPin(${JSON.stringify(focusPin)});true;`); };
  useEffect(focus, [focusPin]);
  const source = useMemo(() => ({ html: osmPickerHtml(initialPin) }), [initialPin]);
  return <WebView<{}> ref={view} onLoadEnd={() => { loaded.current = true; focus(); }} style={{ flex: 1, backgroundColor: "#EDF1F7" }} source={source} originWhitelist={["*"]} javaScriptEnabled domStorageEnabled={false}
    userAgent="BosesBantay/0.1 OpenStreetMapPicker (+https://github.com/pedqtt/Boses_Bantay_App)"
    mixedContentMode="never" setSupportMultipleWindows={false} scrollEnabled={false} bounces={false} overScrollMode="never" setBuiltInZoomControls={false}
    onError={onError} onHttpError={event => { if (event.nativeEvent.url.startsWith("about:")) onError(); }}
    onShouldStartLoadWithRequest={request => {
      if (request.url === "about:blank" || request.url.startsWith("about:blank#")) return true;
      if (request.url.startsWith("https://www.openstreetmap.org/")) void Linking.openURL(request.url).catch(() => Alert.alert("Hindi mabuksan ang link"));
      return false;
    }}
    onMessage={event => {
      const message = parseMapMessage(event.nativeEvent.data);
      if (message?.type === "pin") onPin(message.pin);
      else if (message?.type === "ready") onReady();
      else if (message?.type === "error") onError();
      else if (message?.type === "outside") onOutside();
    }} />;
}
