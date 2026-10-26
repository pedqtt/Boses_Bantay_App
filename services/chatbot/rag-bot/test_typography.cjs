const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const React = require("react");
const Test = require("react-test-renderer");
const ts = require("typescript");
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const root = path.resolve(__dirname, "../../..");
function moduleAt(relative, modules) {
  const exports = {};
  const source = fs.readFileSync(path.join(root, relative), "utf8");
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2020 } }).outputText, { exports, require: name => modules[name] || require(name), console, setTimeout, clearTimeout });
  return exports;
}
const tokens = moduleAt("lib/typography.ts", {});
const flatten = style => Array.isArray(style) ? Object.assign({}, ...style.map(flatten)) : style || {};
let scale = 1;
const native = {
  Text: React.forwardRef((props, ref) => React.createElement("NativeText", { ...props, style: flatten(props.style), ref })),
  TextInput: React.forwardRef((props, ref) => React.createElement("NativeInput", { ...props, style: flatten(props.style), ref })),
  StyleSheet: { create: value => value, flatten },
};
const UI = moduleAt("components/AppText.tsx", {
  "react-native": native,
  nativewind: { cssInterop: component => component },
  "@/lib/typography": tokens,
  "@/lib/typography-context": { useTypography: () => ({ scale }) },
});
const saved = new Map([[tokens.fontPreferenceKey("account-a"), "extraLarge"], [tokens.fontPreferenceKey("account-b"), "small"]]);
let account = "account-a";
const context = moduleAt("lib/typography-context.tsx", {
  "@/lib/auth-context": { useAuth: () => ({ profile: account ? { id: account } : null }) },
  "@/lib/typography": tokens,
  "expo-secure-store": { getItemAsync: async key => saved.get(key) || null, setItemAsync: async (key, value) => { saved.set(key, value); } },
});
(async () => {
  const ordered = ["display", "screenTitle", "heading", "title", "section", "body", "secondary", "caption"];
  for (let i = 1; i < ordered.length; i++) assert.ok(tokens.TEXT_ROLES[ordered[i - 1]].fontSize > tokens.TEXT_ROLES[ordered[i]].fontSize);
  for (const option of tokens.FONT_SIZE_OPTIONS) {
    for (const role of ordered) { const value = tokens.textMetrics(role, option.scale); assert.ok(value.lineHeight >= value.fontSize); }
  }
  assert.equal(tokens.isFontSizePreference("invalid"), false);
  assert.notEqual(tokens.fontPreferenceKey("account-a"), tokens.fontPreferenceKey("account-b"));
  let renderer;
  const tree = () => React.createElement(UI.Text, { style: { fontSize: 15 } }, "Hello ", React.createElement(UI.Text, { style: { color: "blue" } }, "inline"), React.createElement(UI.Text, { style: { fontSize: 14 } }, "secondary"));
  await Test.act(async () => { renderer = Test.create(tree()); });
  let text = renderer.root.findAllByType("NativeText");
  assert.equal(text[0].props.style.fontSize, 16);
  assert.equal(text[1].props.style.fontSize, undefined, "Inline text must inherit without double scaling");
  assert.equal(text[2].props.style.fontSize, 14);
  assert.equal(text[0].props.allowFontScaling, true);
  scale = 1.4;
  await Test.act(async () => { renderer.update(tree()); });
  text = renderer.root.findAllByType("NativeText");
  assert.equal(text[0].props.style.fontSize, 22.5);
  assert.equal(text[1].props.style.fontSize, undefined);
  assert.equal(text[2].props.style.fontSize, 19.5);
  await Test.act(async () => { renderer.update(React.createElement(UI.Text, { variant: "screenTitle", style: { fontSize: 15 }, numberOfLines: 1 }, "Heading")); });
  text = renderer.root.findByType("NativeText");
  assert.equal(text.props.style.fontSize, 39);
  assert.equal(text.props.numberOfLines, undefined, "Large titles may wrap");
  await Test.act(async () => { renderer.update(React.createElement(UI.TextInput, { style: { fontSize: 19, paddingVertical: 12, minHeight: 44 } })); });
  const input = renderer.root.findByType("NativeInput");
  assert.equal(input.props.style.fontSize, 22.5);
  assert.equal(input.props.style.minHeight, 58);
  assert.equal(input.props.allowFontScaling, true);
  await Test.act(async () => { renderer.unmount(); });
  let current;
  function Probe() { current = context.useTypography(); return null; }
  const provider = () => React.createElement(context.TypographyProvider, null, React.createElement(Probe));
  await Test.act(async () => { renderer = Test.create(provider()); });
  assert.equal(current.size, "extraLarge");
  await Test.act(async () => { current.setSize("large"); });
  assert.equal(saved.get(tokens.fontPreferenceKey("account-a")), "large");
  account = "account-b";
  await Test.act(async () => { renderer.update(provider()); });
  assert.equal(current.size, "small", "Account B must not inherit A's preference");
  assert.equal(saved.get(tokens.fontPreferenceKey("account-a")), "large");
  await Test.act(async () => { renderer.unmount(); renderer = Test.create(provider()); });
  assert.equal(current.size, "small", "Preference survives provider restart");
  account = "";
  await Test.act(async () => { renderer.update(provider()); });
  assert.equal(current.size, "standard", "Guest uses its own default");
  await Test.act(async () => { renderer.unmount(); });
  // Exercise the actual Settings flow: select -> preview -> Apply, plus Cancel.
  const previewUI = moduleAt("components/AppText.tsx", { "react-native": native, nativewind: { cssInterop: component => component }, "@/lib/typography": tokens, "@/lib/typography-context": context });
  let resetPrompt; let resetCalls = 0;
  const preferences = { showBot: true, fadeBotWhenIdle: true, notificationsEnabled: true };
  const settings = moduleAt("app/(resident)/settings.tsx", {
    "@/lib/typography": tokens, "@/lib/typography-context": context, "@/components/AppText": previewUI,
    "react-native": { ...native, View: "View", Pressable: "Pressable", ScrollView: "ScrollView", Switch: "Switch", ActivityIndicator: "ActivityIndicator", Alert: { alert: (...args) => { resetPrompt = args; } } },
    "react-native-safe-area-context": { SafeAreaView: "SafeAreaView" },
    "expo-router": { router: {}, useFocusEffect: callback => React.useEffect(callback, [callback]) },
    "@/components/AppIcon": { Ionicons: "Icon" },
    "@/lib/theme": { colors: { primary: "blue", residentBackground: "white" } },
    "@/components/home/homeStyles": { homeStyles: { card: {}, sectionTitle: {}, itemIcon: {}, headerButton: {} } },
    "@/lib/app-preferences": { DEFAULT_PREFERENCES: preferences, updateAppPreferences: () => { resetCalls++; }, useAppPreferences: () => ({ loaded: true, error: "", preferences }) },
  });
  account = "preview-account";
  saved.set(tokens.fontPreferenceKey(account), "standard");
  await Test.act(async () => { renderer = Test.create(React.createElement(context.TypographyProvider, null, React.createElement(React.Fragment, null, React.createElement(Probe), React.createElement(settings.default)))); });
  const button = label => renderer.root.findAllByType("Pressable").find(node => node.props.accessibilityLabel === label);
  assert.equal(current.size, "standard");
  await Test.act(async () => { button("Malaki").props.onPress(); });
  assert.equal(current.size, "standard", "Choosing a size must not apply it globally");
  assert.equal(saved.get(tokens.fontPreferenceKey(account)), "standard", "Choosing must not persist a size");
  let sampleText = renderer.root.findByProps({ testID: "font-size-preview" }).findAllByType("NativeText");
  assert.ok(sampleText.some(node => node.props.style.fontSize === 19), "Only the sample previews the large body size");
  await Test.act(async () => { button("I-apply ang laki ng text").props.onPress(); });
  assert.equal(current.size, "large");
  assert.equal(saved.get(tokens.fontPreferenceKey(account)), "large");
  assert.equal(button("I-apply ang laki ng text").props.disabled, true, "Already applied choice disables Apply");
  await Test.act(async () => { button("Maliit").props.onPress(); });
  assert.equal(current.size, "large");
  await Test.act(async () => { button("Kanselahin ang napiling laki").props.onPress(); });
  assert.equal(current.size, "large");
  assert.equal(button("I-apply ang laki ng text").props.disabled, true);
  await Test.act(async () => { button("Ibalik sa default ang preferences").props.onPress(); });
  assert.equal(resetCalls, 0, "Reset must wait for confirmation");
  assert.ok(resetPrompt[2].some(action => action.style === "cancel"));
  await Test.act(async () => { resetPrompt[2].find(action => action.text === "Ibalik").onPress(); });
  assert.equal(resetCalls, 1);
  assert.equal(current.size, "large", "Reset prepares standard preview without changing applied text size");
  sampleText = renderer.root.findByProps({ testID: "font-size-preview" }).findAllByType("NativeText");
  assert.ok(sampleText.some(node => node.props.style.fontSize === 16));
  assert.equal(button("I-apply ang laki ng text").props.disabled, false);
  await Test.act(async () => { renderer.unmount(); });
  console.log("Typography and Settings flow checks passed, including confirmed reset and unchanged applied text size.");
})().catch(error => { console.error(error); process.exit(1); });
