// The bottom tab bar (components/CustomBottomTab) is absolutely positioned and
// floats over every tab screen, so scrollable content has to leave room for it
// or its last items end up hidden underneath.
//
// Bar height: 1 (border) + 8 (top padding) + 56 (tab: icon 33 + label + padding)
// + 20 (bottom padding) ≈ 85. Keep TAB_BAR_HEIGHT in step if the bar changes.
export const TAB_BAR_HEIGHT = 85;

// Bottom padding for a scroll area on a tab screen: the bar plus breathing room.
export const TAB_BAR_CLEARANCE = TAB_BAR_HEIGHT + 25;

// Same, for screens that also float the keypad/contacts FABs over the content.
export const FAB_CLEARANCE = TAB_BAR_HEIGHT + 105;
