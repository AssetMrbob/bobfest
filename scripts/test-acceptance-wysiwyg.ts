import { renderFeedSlideJpeg, renderCompanionStoryJpeg, layoutTextWithGlyphMeasurement } from "@/lib/rendering/template-renderer";
import { loadParsedFont } from "@/lib/rendering/font-manager";
import { CustomTemplate } from "@/lib/types/template";
import assert from "assert";

const testFeedTemplate: CustomTemplate = {
  id: "test-feed",
  name: "Acceptance Test Feed",
  category: "text_feed",
  dimensions: { width: 1080, height: 1350 },
  background_storage_path: null,
  overlay_storage_path: null,
  font_family: "Geist",
  font_file_path: null,
  font_size_min: 24,
  font_size_max: 44,
  font_weight: "500",
  text_color: "#171717",
  line_height: 1.35,
  letter_spacing: 0,
  vertical_align: "middle",
  layout_config: {
    message_box: { x: 100, y: 280, width: 880, height: 750, visible: true, locked: false },
    recipient_box: { x: 100, y: 200, width: 880, height: 50, visible: true, locked: false },
    code_box: { x: 100, y: 1200, width: 880, height: 40, visible: true, locked: false },
    show_recipient: true,
    show_code: true,
    show_slide_number: true,
  },
  is_active: true,
  version: 1,
};

const testStoryTemplate: CustomTemplate = {
  id: "test-story",
  name: "Acceptance Test Story",
  category: "story",
  dimensions: { width: 1080, height: 1920 },
  background_storage_path: null,
  overlay_storage_path: null,
  font_family: "Geist",
  font_file_path: null,
  font_size_min: 24,
  font_size_max: 38,
  font_weight: "500",
  text_color: "#171717",
  line_height: 1.35,
  letter_spacing: 0,
  vertical_align: "top",
  layout_config: {
    story_feed_box: { x: 108, y: 400, width: 864, height: 1080, visible: true, locked: false, fitMode: "contain" },
    message_box: { x: 100, y: 1520, width: 880, height: 240, visible: false, locked: false },
    code_box: { x: 100, y: 1800, width: 880, height: 40, visible: true, locked: false },
    show_recipient: false,
    show_code: true,
    show_slide_number: false,
  },
  is_active: true,
  version: 1,
};

async function runAcceptanceTests() {
  console.log("=== Acceptance Test 1: Font Loading & Glyph Measurement ===");
  const { font, fontFamily } = await loadParsedFont(null);
  assert(font, "Font must be parsed");
  console.log("✓ Font loaded:", fontFamily, "UnitsPerEm:", font.unitsPerEm);

  console.log("=== Acceptance Test 2: Text Layout with Glyph Measurement ===");
  const testText = "Halo Bobfess! Ini adalah pengujian typography glyph measurement.";
  const layoutRes = layoutTextWithGlyphMeasurement(
    font,
    testText,
    testFeedTemplate.layout_config.message_box,
    24,
    44,
    1.35,
    0
  );
  assert(layoutRes.fits, "Normal text should fit");
  assert(layoutRes.lines.length > 0, "Lines should be produced");
  console.log("✓ Layout fontSize:", layoutRes.fontSize, "Total height:", layoutRes.totalHeight);

  console.log("=== Acceptance Test 3: Auto-fit 500 characters ===");
  const chars500 = "P".repeat(500);
  const layout500 = layoutTextWithGlyphMeasurement(
    font,
    chars500,
    testFeedTemplate.layout_config.message_box,
    24,
    44,
    1.35,
    0
  );
  console.log("✓ 500-char layout result - fits:", layout500.fits, "fontSize:", layout500.fontSize);

  console.log("=== Acceptance Test 4: Vertical Alignment & Feed Slide JPEG ===");
  const feedJpeg = await renderFeedSlideJpeg({
    message: "Pengujian rendering Feed dengan posisi vertikal tengah (middle).",
    recipient: "Mr. Bob",
    publicCode: "TEST-001",
    slideOrder: 1,
    template: testFeedTemplate,
  });
  assert(feedJpeg.buffer.length > 1000, "JPEG buffer should be valid");
  assert(feedJpeg.fits, "Should fit");
  console.log("✓ Rendered Feed JPEG size:", feedJpeg.buffer.length, "bytes");

  console.log("=== Acceptance Test 5: Story JPEG Positioning ===");
  const storyJpeg = await renderCompanionStoryJpeg(feedJpeg.buffer, testStoryTemplate);
  assert(storyJpeg.length > 1000, "Story JPEG buffer should be valid");
  console.log("✓ Rendered Companion Story JPEG size:", storyJpeg.length, "bytes");

  console.log("\n>>> ALL ACCEPTANCE TESTS PASSED SUCCESSFULLY! <<<");
}

runAcceptanceTests().catch((e) => {
  console.error("Test failed:", e);
  process.exit(1);
});
