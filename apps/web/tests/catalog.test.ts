import { expect, it } from "vitest";
import {
  defaultFilters,
  designSamples,
  filterThemes,
  fromApi,
} from "../src/catalog";

it("combines popularity bands as OR and other filters as AND", () => {
  const filters = {
    ...defaultFilters(true),
    popularity: ["10000+", "5000-9999"],
    name: "learn",
  };
  expect(
    filterThemes(designSamples, filters).map((theme) => theme.name),
  ).toEqual(["NeoLearn", "BrightLearn"]);
  expect(
    filterThemes(designSamples, {
      ...filters,
      institution: "University of Milan",
    }).map((theme) => theme.name),
  ).toEqual(["BrightLearn"]);
});

it("sorts without mutating the supplied collection and can filter curated themes", () => {
  const original = designSamples.map((theme) => theme.id);
  expect(
    filterThemes(designSamples, {
      ...defaultFilters(true),
      sort: "name-asc",
    })[0].name,
  ).toBe("Academic Pro");
  expect(designSamples.map((theme) => theme.id)).toEqual(original);
  expect(
    filterThemes(designSamples, {
      ...defaultFilters(true),
      featured: true,
    }).map((theme) => theme.name),
  ).toEqual(["Campus Modern"]);
});

it("never attaches sample images, popularity or institutions to API records", () => {
  const live = fromApi({
    id: "9007199254740993",
    name: "Campus Modern",
    author: "Real author",
    site: "moodle.example.com",
    description: "Real record",
    version: "1",
  });
  expect(live.id).toBe("9007199254740993");
  expect(live.institution).toBe("moodle.example.com");
  expect(live.previewImage).toBeUndefined();
  expect(live.downloads).toBeUndefined();
});
