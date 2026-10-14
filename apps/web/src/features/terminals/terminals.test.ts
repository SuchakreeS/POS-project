import type { Terminal } from "@pos/shared";
import { describe, expect, it } from "vitest";
import { thisTerminal } from "./terminals";

const t = (code: string): Terminal => ({
  id: code.toLowerCase(),
  code,
  name: code,
  nextBillNo: "",
});

describe("thisTerminal", () => {
  it("uses the picked terminal", () => {
    expect(thisTerminal([t("T1"), t("T2")], "t2")).toEqual({ status: "ready", terminal: t("T2") });
  });

  it("uses the only terminal when nothing (or something gone) was picked", () => {
    expect(thisTerminal([t("T1")], null)).toEqual({ status: "ready", terminal: t("T1") });
    expect(thisTerminal([t("T1")], "removed")).toEqual({ status: "ready", terminal: t("T1") });
  });

  it("asks for a pick when there are several, and says when there are none", () => {
    expect(thisTerminal([t("T1"), t("T2")], null)).toEqual({ status: "unpicked" });
    expect(thisTerminal([], null)).toEqual({ status: "none" });
  });
});
