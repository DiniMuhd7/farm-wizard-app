import { keyFor, tr } from "./tr";

describe("tr()", () => {
  it("returns the English text (with interpolation) when i18n hasn't started", () => {
    expect(tr("Top up")).toBe("Top up");
    expect(tr("Hello, {{name}} 👋", { name: "Ada" })).toBe("Hello, Ada 👋");
    expect(tr("Call {{name}}")).toBe("Call {{name}}"); // missing value left visible
  });

  // These keys are what the translation files on the server are keyed by, and
  // scripts/i18nkeys.py must produce the same ones. If this test fails, a change to
  // keyFor() has silently orphaned every translation — don't "fix" the expectations.
  it("derives stable keys from the English text", () => {
    expect(keyFor("Top up")).toBe("ui.top_up_yqb72x");
    expect(keyFor("Hello, {{name}} 👋")).toBe("ui.hello_119hs8o");
    expect(keyFor("SMS & MMS from your 9tel number")).toBe("ui.sms_mms_from_your_9tel_number_1e4qdf5");
  });
});
