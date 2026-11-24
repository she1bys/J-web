import { describe, expect, it } from "vitest";
import { songTitle } from "../src/core/songStore";

describe("songTitle", () => {
  it("turns a file name into a readable title", () => {
    expect(songTitle("../assets/music/our-song_v2.mp3")).toBe("our song v2");
    expect(songTitle("Track 01.m4a")).toBe("Track 01");
    expect(songTitle(".mp3")).toBe("Untitled");
  });
});
