const assert = require("node:assert/strict");
const path = require("node:path");
const fs = require("node:fs");
const root = path.resolve(__dirname, "../../..");
// Exercise the TabRouter actually bundled with this Expo Router version.
const { TabRouter, TabActions } = require(path.join(root, "node_modules/expo-router/build/react-navigation/routers/TabRouter.js"));
const source = fs.readFileSync(path.join(root, "app/(resident)/_layout.tsx"), "utf8");
assert.match(source, /backBehavior="fullHistory"/);
const options = { routeNames: ["home", "profile", "settings", "change-password", "directory", "bot", "reports", "report-detail", "report", "service-complaint", "verify-id", "notifications"], routeParamList: {}, routeGetIdList: {} };
function scenario(visits, expected) {
  const router = TabRouter({ backBehavior: "fullHistory", initialRouteName: "home" });
  let state = router.getInitialState(options);
  for (const name of visits) state = router.getStateForAction(state, TabActions.jumpTo(name), options);
  for (const name of expected) {
    state = router.getStateForAction(state, { type: "GO_BACK" }, options);
    assert.ok(state, "Expected a previous resident screen");
    assert.equal(state.routes[state.index].name, name);
  }
}
scenario(["profile", "settings", "change-password"], ["settings", "profile", "home"]);
scenario(["directory", "bot"], ["directory", "home"]);
scenario(["reports", "report-detail"], ["reports", "home"]);
scenario(["reports", "report", "service-complaint"], ["report", "reports", "home"]);
scenario(["profile", "verify-id"], ["profile", "home"]);
scenario(["profile", "settings", "profile", "settings"], ["profile", "settings", "profile", "home"]);
console.log("Six real TabRouter history scenarios passed, including nested screens and repeated visits.");
