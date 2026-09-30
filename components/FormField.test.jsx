import React from "react";
import { TextInput, TouchableOpacity } from "react-native";
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
