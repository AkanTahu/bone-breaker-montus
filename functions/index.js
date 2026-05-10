import axios from "axios";
import * as cheerio from "cheerio";
import admin from "firebase-admin";
import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { logger } from "firebase-functions";

admin.initializeApp();

const MAX_FETCH_MS = 18_000;

export const scrapeJobListing = onDocumentCreated(
  {
    document: "jobListings/{jobId}",
    timeoutSeconds: 20,
    memory: "256MiB",
  },
  async (event) => {
    const snapshot = event.data;
    const jobId = event.params.jobId;
    const job = snapshot?.data();

    if (!snapshot || !job?.link || job.scrapingStatus !== "pending") {
      return;
    }

    try {
      const result = await scrapeJobPage(job.link);
      await snapshot.ref.update({
        namaPerusahaan: result.namaPerusahaan,
        namaPosisi: result.namaPosisi,
        scrapingStatus: result.namaPerusahaan || result.namaPosisi ? "success" : "failed",
        scrapingSelesaiAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    } catch (error) {
      logger.warn("Scraping failed", {
        jobId,
        link: job.link,
        message: error?.message,
      });

      await snapshot.ref.update({
        namaPerusahaan: "",
        namaPosisi: "",
        scrapingStatus: "failed",
        scrapingSelesaiAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }
  },
);

async function scrapeJobPage(link) {
  assertHttpUrl(link);

  const response = await axios.get(link, {
    timeout: MAX_FETCH_MS,
    maxRedirects: 5,
    responseType: "text",
    headers: {
      "User-Agent":
        "Mozilla/5.0 (compatible; BreakerBoneMontus/0.1; +https://firebase.google.com/)",
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    },
  });

  const $ = cheerio.load(response.data);
  const title = cleanText($("title").first().text());
  const ogTitle = getMeta($, "og:title") || getMeta($, "twitter:title");
  const siteName = getMeta($, "og:site_name");
  const jsonLd = readJsonLd($);

  const namaPosisi =
    firstValue([
      jsonLd.title,
      jsonLd.name,
      getByLikelySelector($, [
        "[data-testid*='job-title']",
        "[class*='job-title']",
        "[class*='position']",
        "h1",
      ]),
      splitTitle(ogTitle || title).position,
    ]) || "";

  const namaPerusahaan =
    firstValue([
      jsonLd.hiringOrganization?.name,
      jsonLd.organization?.name,
      jsonLd.company,
      getByLikelySelector($, [
        "[data-testid*='company']",
        "[class*='company']",
        "[class*='employer']",
        "[class*='organization']",
      ]),
      splitTitle(ogTitle || title).company,
      siteName,
    ]) || "";

  return {
    namaPerusahaan: normalizeResult(namaPerusahaan),
    namaPosisi: normalizeResult(namaPosisi),
  };
}

function assertHttpUrl(value) {
  const url = new URL(value);
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Unsupported URL protocol");
  }
}

function getMeta($, property) {
  return cleanText(
    $(`meta[property='${property}']`).attr("content") ||
      $(`meta[name='${property}']`).attr("content") ||
      "",
  );
}

function getByLikelySelector($, selectors) {
  for (const selector of selectors) {
    const value = cleanText($(selector).first().text());
    if (value) {
      return value;
    }
  }

  return "";
}

function readJsonLd($) {
  const scripts = $("script[type='application/ld+json']").toArray();

  for (const script of scripts) {
    const raw = $(script).contents().text();
    try {
      const parsed = JSON.parse(raw);
      const candidate = findJobPosting(Array.isArray(parsed) ? parsed : [parsed]);
      if (candidate) {
        return candidate;
      }
    } catch {
      logger.debug("Invalid JSON-LD ignored");
    }
  }

  return {};
}

function findJobPosting(items) {
  for (const item of items) {
    if (!item || typeof item !== "object") {
      continue;
    }

    const graph = Array.isArray(item["@graph"]) ? item["@graph"] : [];
    const type = Array.isArray(item["@type"]) ? item["@type"] : [item["@type"]];

    if (type.includes("JobPosting")) {
      return item;
    }

    const nested = findJobPosting(graph);
    if (nested) {
      return nested;
    }
  }

  return null;
}

function splitTitle(value) {
  const title = cleanText(value);
  const separators = [" at ", " - ", " | ", " @ "];

  for (const separator of separators) {
    if (title.includes(separator)) {
      const [position, company] = title.split(separator).map(cleanText);
      return { position, company };
    }
  }

  return { position: title, company: "" };
}

function firstValue(values) {
  return values.find((value) => cleanText(value));
}

function cleanText(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeResult(value) {
  return cleanText(value).slice(0, 160);
}
