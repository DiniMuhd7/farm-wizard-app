/**
 * Eligibility lookup for the calling-plan model: is a given destination
 * another 9tel user (Airbundle, 9tel-to-9tel) or a local carrier
 * destination (Prepaid credits)? See services/callPlans.ts on the
 * mobile side, which calls this endpoint before applying a plan.
 */

jest.mock("../../models/User", () => ({ findOne: jest.fn() }));

function mockRes() {
  return {
    statusCode: undefined,
    body: undefined,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
}

describe("numbers controller — lookupNumber", () => {
  beforeEach(() => {
    jest.resetModules();
    const User = require("../../models/User");
    User.findOne.mockReset();
  });

  it("reports is9telNumber: true when the destination belongs to a 9tel user", async () => {
    const User = require("../../models/User");
    User.findOne.mockReturnValue({ select: jest.fn().mockResolvedValue({ _id: "owner1", fullName: "Ada Lovelace Byron", email: "a@x.com", avatar: 3 }) });
    const { lookupNumber } = require("./index");

    const res = mockRes();
    await lookupNumber({ body: { phoneNumber: "+15555550123" } }, res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({
      phoneNumber: "+15555550123",
      is9telNumber: true,
      account: { displayName: "Ada B.", avatar: 3, profilePicture: null },
    });
  });

  it("reports is9telNumber: false for a destination with no matching 9tel account", async () => {
    const User = require("../../models/User");
    User.findOne.mockReturnValue({ select: jest.fn().mockResolvedValue(null) });
    const { lookupNumber } = require("./index");

    const res = mockRes();
    await lookupNumber({ body: { phoneNumber: "+2348012345678" } }, res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ phoneNumber: "+2348012345678", is9telNumber: false });
  });

  it("rejects a malformed phone number instead of guessing", async () => {
    const { lookupNumber } = require("./index");

    const res = mockRes();
    await lookupNumber({ body: { phoneNumber: "not-a-number" } }, res);

    expect(res.statusCode).toBe(400);
    expect(res.body.message).toMatch(/E\.164/);
  });
});
