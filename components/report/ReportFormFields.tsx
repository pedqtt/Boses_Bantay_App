import { TextInput } from "@/components/AppText";
import { forwardRef, useState, type ComponentProps, type ReactNode } from "react";
import { View } from "react-native";
import { FormField as BaseField } from "@/components/FormField";
import { FormChoiceField as BaseChoice } from "@/components/FormChoiceField";
import { FormCheckboxField as BaseCheckbox } from "@/components/FormCheckboxField";
import { PhoneInput as BasePhone } from "@/components/PhoneInput";
import { colors } from "@/lib/theme";

/** Report-only field boundaries; shared login/profile forms stay unchanged. */
function FieldFrame({ children, focused = false, error = false }: {
  children: ReactNode; focused?: boolean; error?: boolean;
}) {
  return (
    <View style={{ backgroundColor: focused ? "#FAFBFF" : "#FFFFFF",
      borderColor: error ? colors.error : focused ? colors.primary : "#DDE3EE",
      borderWidth: 1, borderRadius: 18, padding: 18, marginBottom: 18,
      shadowColor: "#182858", shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.025, shadowRadius: 8 }}>
      {focused && <View pointerEvents="none" style={{ position: "absolute", left: -1,
        top: 18, bottom: 18, width: 3, borderRadius: 2, backgroundColor: error ? colors.error : colors.primary }} />}
      {children}
    </View>
  );
}

export const FormField = forwardRef<TextInput, ComponentProps<typeof BaseField>>(function ReportField(props, ref) {
  const [focused, setFocused] = useState(false);
  return <FieldFrame focused={focused} error={Boolean(props.error)}>
    <BaseField {...props} ref={ref} wrapperClassName="mb-0"
      onFocus={event => { setFocused(true); props.onFocus?.(event); }}
      onBlur={() => { setFocused(false); props.onBlur?.(); }} />
  </FieldFrame>;
});
export function FormChoiceField(props: ComponentProps<typeof BaseChoice>) {
  return <FieldFrame error={Boolean(props.error)}><BaseChoice {...props} wrapperClassName="mb-0" /></FieldFrame>;
}
export function FormCheckboxField(props: ComponentProps<typeof BaseCheckbox>) {
  return <FieldFrame><BaseCheckbox {...props} wrapperClassName="mb-0" /></FieldFrame>;
}
export const PhoneInput = forwardRef<TextInput, ComponentProps<typeof BasePhone>>(function ReportPhone(props, ref) {
  const [focused, setFocused] = useState(false);
  return <FieldFrame focused={focused} error={Boolean(props.error)}>
    <BasePhone {...props} ref={ref}
      onFocus={event => { setFocused(true); props.onFocus?.(event); }}
      onBlur={() => { setFocused(false); props.onBlur?.(); }} />
  </FieldFrame>;
});
