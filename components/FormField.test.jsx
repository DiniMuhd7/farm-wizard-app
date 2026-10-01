import React from "react";
import { Text, TextInput, TouchableOpacity } from "react-native";
import { describe, expect, it } from "@jest/globals";
import TestRenderer, { act } from "react-test-renderer";
import FormField from "./FormField";

describe("FormField secure entry", () => {
  it("masks explicitly marked password inputs and keeps the visibility toggle", () => {
    let renderer;
    act(() => {
      renderer = TestRenderer.create(
        <FormField
          title="Password"
          placeholder="New password (optional)"
          value=""
          handleChangeText={() => {}}
          secureTextEntry
        />
      );
    });

    expect(renderer.root.findByType(TextInput).props.secureTextEntry).toBe(true);
    act(() => {
      renderer.root.findByType(TouchableOpacity).props.onPress();
    });
    expect(renderer.root.findByType(TextInput).props.secureTextEntry).toBe(false);
    act(() => renderer.unmount());
  });

  it("does not infer password behavior from placeholder text", () => {
    let renderer;
    act(() => {
      renderer = TestRenderer.create(
        <FormField
          title="Label"
          placeholder="Password"
          value=""
          handleChangeText={() => {}}
        />
      );
    });

    expect(renderer.root.findByType(TextInput).props.secureTextEntry).toBe(false);
    expect(renderer.root.findAllByType(TouchableOpacity)).toHaveLength(0);
    act(() => renderer.unmount());
  });
});

describe("FormField light variant", () => {
  // Edit Profile sits on a light/white 9tel surface; it previously reused
  // the dark-surface "auth" variant (designed for the navy sign-in/sign-up
  // screens), which rendered as a mismatched dark box with near-invisible
  // light-on-white label text. The "light" variant should use the
  // light-surface palette (navy input text, muted-purple label/
  // placeholder) instead.
  it("uses the light-surface palette instead of the dark auth-screen colors", () => {
    let renderer;
    act(() => {
      renderer = TestRenderer.create(
        <FormField
          title="Full name"
          placeholder="Full name"
          value=""
          handleChangeText={() => {}}
          variant="light"
        />
      );
    });

    const label = renderer.root.findByType(Text);
    expect(label.props.className).toContain("text-[#514D66]");
    expect(label.props.className).not.toContain("text-[#D8D5F0]");

    const input = renderer.root.findByType(TextInput);
    expect(input.props.className).toContain("text-[#211B59]");
    expect(input.props.placeholderTextColor).toBe("#9894A9");
    act(() => renderer.unmount());
  });
});
