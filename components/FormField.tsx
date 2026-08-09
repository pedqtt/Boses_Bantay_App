import { forwardRef, useState } from "react";
import { View, Text, TextInput, Pressable, type ReturnKeyTypeOptions } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, fieldBorderColor } from "@/lib/theme";

export type FormFieldProps = {
  label: string;
  value: string;
  onChangeText: (t: string) => void;
  onFocus?: (e: any) => void;
  onBlur?: () => void;
  placeholder: string;
  // "number-pad" for pure numeric fields (age) - distinct from "phone-pad",
  // which on Android includes symbols like +/*/# a phone number can need
  // but an age never does. Using the narrowest correct keypad for each
  // field means the resident never sees keys that can't produce a valid
  // answer.
  keyboardType?: "default" | "phone-pad" | "number-pad" | "email-address";
  // Hard cap on typed length - e.g. age's 3-digit cap (see
  // lib/validation.ts's AGE_MAX_DIGITS) so a value that's already out of
  // any realistic range can't even be fully typed in the first place.
  maxLength?: number;
  autoFocus?: boolean;
  // Was `secureTextEntry` - renamed because this now also controls whether
  // the show/hide eye icon renders, not just whether typing is masked.
  isPassword?: boolean;
  autoCapitalize?: "none" | "sentences" | "words" | "characters";
  // Shown right under the field, live as the resident types - not just
  // after Continue, and not cleared just because they started typing
  // again. It only goes away once what's typed actually satisfies the
  // requirement, so a resident can't miss a still-unresolved problem by
  // glancing away mid-edit.
  error?: string | null;
  // The requirement itself, always visible under the field regardless of
  // error state - a resident should be able to see what's expected before
  // they type anything wrong, not only after.
  hint?: string;
  // Overrides the default "mb-7" full-width wrapper - used to make two
  // fields sit side by side as flex-1 halves of one row instead of each
  // taking the full row on its own.
  wrapperClassName?: string;
  // Keyboard-return-key chaining between fields, mirroring PhoneInput's
  // version of the same props. blurOnSubmit defaults to false whenever
  // onSubmitEditing is given, so moving to the next field doesn't also
  // dismiss and reopen the keyboard.
  returnKeyType?: ReturnKeyTypeOptions;
  onSubmitEditing?: () => void;
  blurOnSubmit?: boolean;
};

/**
 * The one underlined-field component used across every auth screen
 * (register, login's password field, reset-password) - extracted here
 * (it used to be defined locally inside register.tsx as `Field`) so any
 * screen that wants the exact same look/feel imports the same component
 * instead of hand-copying its JSX. ConfirmYouScreen (the report flow's
 * "Bahagi 1 - Sino ang Nagrereklamo" step) is the first non-auth screen to
 * reuse it, on request: the report flow otherwise uses its own boxed-card
 * input style (AnswerEditor), and that screen specifically needed to read
 * as "a form like the one you signed up with," not "a card in the middle
 * of a voice-filing flow."
 */
export const FormField = forwardRef<TextInput, FormFieldProps>(function FormField(
  {
    label,
    value,
    onChangeText,
    onFocus,
    onBlur,
    placeholder,
    keyboardType,
    maxLength,
    autoFocus,
    isPassword,
    autoCapitalize,
    error,
    hint,
    wrapperClassName,
    returnKeyType,
    onSubmitEditing,
    blurOnSubmit,
  },
  ref
) {
  // Starts masked (the safer default for a password field); the toggle
  // only reveals it on request, it never defaults to visible.
  const [visible, setVisible] = useState(false);
  // Same focus-highlight rationale as PhoneInput: a distinct border color
  // while a field is focused (but not yet in error) tells a resident
  // moving through a form which field the keyboard is about to affect
  // next, especially once "Next" starts jumping between fields without a
  // tap.
  const [focused, setFocused] = useState(false);

  return (
    <View className={wrapperClassName ?? "mb-7"}>
      <Text className="text-[12px] font-semibold text-ink-faint mb-2 uppercase tracking-wider">
        {label}
      </Text>
      <View
        className="flex-row items-center border-b"
        style={{ borderColor: fieldBorderColor({ error: !!error, focused }) }}
      >
        {/* TextInput wrapped in its own flex-1 View instead of putting
            flex-1 on the TextInput directly - an ambiguous-width text
            node inside a flex-row can trigger Android's native text
            justification (visibly stretched letter/word gaps). Wrapping
            first gives Yoga a definite width to hand down, so this can't
            happen regardless of autoFocus timing or which field it is. */}
        <View style={{ flex: 1 }}>
          <TextInput
            ref={ref}
            value={value}
            onChangeText={onChangeText}
            onFocus={(e) => {
              setFocused(true);
              onFocus?.(e);
            }}
            onBlur={() => {
              setFocused(false);
              onBlur?.();
            }}
            placeholder={placeholder}
            placeholderTextColor={colors.outline}
            keyboardType={keyboardType ?? "default"}
            maxLength={maxLength}
            autoFocus={autoFocus}
            secureTextEntry={isPassword && !visible}
            autoCapitalize={autoCapitalize}
            returnKeyType={returnKeyType}
            onSubmitEditing={onSubmitEditing}
            blurOnSubmit={blurOnSubmit ?? !onSubmitEditing}
            // Password fields disable autocorrect/spellcheck regardless of
            // what the caller passes for autoCapitalize - masked text has
            // no business being spell-checked or corrected, and doing it
            // here (not left to each call site) means this can't be
            // forgotten the next time a password field gets added.
            autoCorrect={isPassword ? false : undefined}
            spellCheck={isPassword ? false : undefined}
            // Applied to every field, not just password ones, so there's
            // one consistent spacing rule: on Android, secureTextEntry
            // otherwise applies the password font's wide character
            // spacing to the placeholder as well as the masked dots,
            // stretching it out past the field edge.
            style={{ letterSpacing: 0 }}
            className="text-[19px] text-ink pb-3"
          />
        </View>
        {isPassword && (
          <Pressable onPress={() => setVisible((v) => !v)} hitSlop={14} className="pb-3 pl-2">
            <Ionicons name={visible ? "eye-off-outline" : "eye-outline"} size={20} color={colors.outline} />
          </Pressable>
        )}
      </View>
      {hint && <Text className="text-[13px] text-ink-faint mt-1.5">{hint}</Text>}
      {error && <Text className="text-[13px] text-alert mt-1">{error}</Text>}
    </View>
  );
});
