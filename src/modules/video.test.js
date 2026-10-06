import { beforeAll, describe, expect, it } from "vitest";

let embedUrl;
let initVideo;
beforeAll(async () => {
  HTMLDialogElement.prototype.showModal ??= function () {
    this.open = true;
  };
  HTMLDialogElement.prototype.close ??= function () {
    this.open = false;
    this.dispatchEvent(new Event("close"));
  };
  ({ embedUrl, initVideo } = await import("./video.js"));
});

describe("embedUrl", () => {
  it("turns YouTube links into a no-cookie player", () => {
    const player = "https://www.youtube-nocookie.com/embed/abc123?autoplay=1&rel=0";
    expect(embedUrl("https://www.youtube.com/watch?v=abc123&t=4")).toBe(player);
    expect(embedUrl("https://youtu.be/abc123")).toBe(player);
    expect(embedUrl("https://youtube.com/shorts/abc123")).toBe(player);
  });

  it("turns Vimeo links into a do-not-track player, keeping a private link's hash", () => {
    expect(embedUrl("https://vimeo.com/76979871")).toBe("https://player.vimeo.com/video/76979871?autoplay=1&dnt=1");
    expect(embedUrl("https://vimeo.com/76979871/ab12cd")).toBe(
      "https://player.vimeo.com/video/76979871?autoplay=1&dnt=1&h=ab12cd",
    );
  });

  it("leaves every other link alone", () => {
    expect(embedUrl("#")).toBeNull();
    expect(embedUrl("/contact")).toBeNull();
    expect(embedUrl("https://example.com/video.mp4")).toBeNull();
  });
});

describe("initVideo", () => {
  it("plays a video link in a dialog and removes the player on close", () => {
    document.body.innerHTML = `<a data-video href="https://youtu.be/abc123"><span>2 min overview</span></a>`;
    initVideo();
    const link = document.querySelector("a");
    expect(link.getAttribute("aria-haspopup")).toBe("dialog");

    const click = new MouseEvent("click", { bubbles: true, cancelable: true });
    link.querySelector("span").dispatchEvent(click);
    expect(click.defaultPrevented).toBe(true);

    const dialog = document.querySelector(".video-dialog");
    const frame = dialog.querySelector("iframe");
    expect(dialog.open).toBe(true);
    expect(frame.title).toBe("2 min overview");

    dialog.close();
    expect(dialog.querySelector("iframe")).toBeNull();
  });
});
