import {
  addDoc,
  collection,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { db } from "./firebase";

const COLLECTION_NAME = "jobListings";

export function isValidHttpUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export function watchJobListings(onData, onError) {
  const q = query(
    collection(db, COLLECTION_NAME),
    orderBy("createdAt", "desc"),
    limit(100),
  );

  return onSnapshot(
    q,
    (snapshot) => {
      onData(
        snapshot.docs.map((item) => ({
          id: item.id,
          ...item.data(),
        })),
      );
    },
    onError,
  );
}

export function createJobListing(link) {
  return addDoc(collection(db, COLLECTION_NAME), {
    link,
    namaPerusahaan: "",
    namaPosisi: "",
    statusSudahLamar: false,
    createdAt: serverTimestamp(),
    scrapingStatus: "pending",
    scrapingSelesaiAt: null,
  });
}

export function updateApplicationStatus(jobId, statusSudahLamar) {
  return updateDoc(doc(db, COLLECTION_NAME, jobId), {
    statusSudahLamar,
  });
}

export function updateScrapingResult(jobId, result) {
  const success = Boolean(result?.success && (result.namaPerusahaan || result.namaPosisi));

  return updateDoc(doc(db, COLLECTION_NAME, jobId), {
    namaPerusahaan: success ? result.namaPerusahaan || "" : "",
    namaPosisi: success ? result.namaPosisi || "" : "",
    scrapingStatus: success ? "success" : "failed",
    scrapingSelesaiAt: serverTimestamp(),
  });
}

export async function scrapeJobLink(link) {
  const response = await fetch("/api/scrape-job", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ link }),
  });

  if (!response.ok) {
    throw new Error("Scraping request failed");
  }

  return response.json();
}
