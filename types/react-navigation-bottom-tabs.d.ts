declare module "@react-navigation/bottom-tabs" {
  import type { GestureResponderEvent } from 'react-native';

  export type BottomTabBarButtonProps = {
    onPress?: (e?: GestureResponderEvent | MouseEvent) => void;
    accessibilityState?: { selected?: boolean } | undefined;
    // allow any additional props — real lib has more, but we only need these
    [key: string]: any;
  };

  export {};
}
