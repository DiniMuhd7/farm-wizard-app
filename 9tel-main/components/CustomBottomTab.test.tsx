import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { describe, expect, it, jest } from "@jest/globals";
import CustomBottomTab from "./CustomBottomTab";

function buildState(activeIndex = 0) {
  return {
    index: activeIndex,
    routes: [
      { key: "home-1", name: "home" },
      { key: "recent-1", name: "recent" },
      { key: "messages-1", name: "messages" },
      { key: "profile-1", name: "profile" },
    ],
  };
}

describe("CustomBottomTab", () => {
  it("renders the icon and label inside a single, whole-item press target for every tab", () => {
    const navigate = jest.fn();
    const emit = jest.fn(() => ({ defaultPrevented: false }));

    let renderer: any;
    act(() => {
      renderer = TestRenderer.create(
        <CustomBottomTab
          state={buildState(0) as any}
          navigation={{ emit, navigate } as any}
          descriptors={{} as any}
          insets={{} as any}
        />
      );
    });

    // One press target per visible tab, each exposing both the icon and the
    // label as accessible children — not two separate tappable regions.
    const messagesTarget = renderer.root.findAllByProps({ accessibilityLabel: "Messages" })[0];
    expect(typeof messagesTarget.props.onPressIn).toBe("function");
    expect(messagesTarget.findByProps({ children: "Messages" })).toBeTruthy();

    act(() => renderer.unmount());
  });

  it("navigates when the whole tab item (which includes the text label) is pressed", () => {
    const navigate = jest.fn();
    const emit = jest.fn(() => ({ defaultPrevented: false }));

    let renderer: any;
    act(() => {
      renderer = TestRenderer.create(
        <CustomBottomTab
          state={buildState(0) as any}
          navigation={{ emit, navigate } as any}
          descriptors={{} as any}
          insets={{} as any}
        />
      );
    });

    const messagesTarget = renderer.root.findAllByProps({ accessibilityLabel: "Messages" })[0];
    act(() => {
      messagesTarget.props.onPressIn();
    });

    expect(emit).toHaveBeenCalledWith(
      expect.objectContaining({ type: "tabPress", target: "messages-1" })
    );
    expect(navigate).toHaveBeenCalledWith("messages");

    act(() => renderer.unmount());
  });

  it("does not re-navigate when the already-active tab is pressed", () => {
    const navigate = jest.fn();
    const emit = jest.fn(() => ({ defaultPrevented: false }));

    let renderer: any;
    act(() => {
      renderer = TestRenderer.create(
        <CustomBottomTab
          state={buildState(2) as any} // "messages" already active
          navigation={{ emit, navigate } as any}
          descriptors={{} as any}
          insets={{} as any}
        />
      );
    });

    const messagesTarget = renderer.root.findAllByProps({ accessibilityLabel: "Messages" })[0];
    expect(messagesTarget.props.accessibilityState).toEqual({ selected: true });

    act(() => {
      messagesTarget.props.onPressIn();
    });

    expect(navigate).not.toHaveBeenCalled();

    act(() => renderer.unmount());
  });
});
