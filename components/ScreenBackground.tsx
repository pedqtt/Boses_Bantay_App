import { View, ImageBackground } from "react-native";
import type { ReactNode } from "react";
import { colors } from "@/lib/theme";

/**
 * The app-wide page surface: a near-white base with a barely-there dot
 * texture over it.
 *
 * The texture is an 8x8 pixel PNG (inlined as base64 below, so there's no
 * asset file to load and no new dependency) tiled with resizeMode="repeat".
 * It carries two ink-colored pixels at ~3% alpha in a staggered grid -
 * deliberately below the threshold where it reads as a "pattern." At normal
 * viewing distance it should register as the page having a surface rather
 * than as dots you can pick out, which is the whole intent: texture, not
 * decoration. Anything more visible would compete with content on screens
 * where a resident may be reading under stress.
 *
 * Base color is #FCFCFD rather than pure #FFFFFF: a hair off-white, so the
 * white Cards and input rows sitting on top of it read as distinct raised
 * surfaces without needing heavier borders or shadows to separate them.
 *
 * Usage: replace a screen's outer `<SafeAreaView className="flex-1 bg-white">`
 * body wrapper with this, keeping SafeAreaView on the outside for insets.
 */
const DOT_TEXTURE_URI =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAYAAADED76LAAAAE0lEQVR42mPgF9diZxhkYADcBACAfgCvKI9HHwAAAABJRU5ErkJggg==";

export function ScreenBackground({ children }: { children: ReactNode }) {
  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <ImageBackground
        source={{ uri: DOT_TEXTURE_URI }}
        resizeMode="repeat"
        style={{ flex: 1 }}
        // The tile is 8x8 at 1x; without this it would be upscaled to the
        // device's pixel density and the dots would drift toward visible.
        imageStyle={{ width: 8, height: 8 }}
      >
        {children}
      </ImageBackground>
    </View>
  );
}
