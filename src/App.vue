<script setup>
import { computed, onMounted, onUnmounted, ref } from "vue";
import {
  BriefcaseBusiness,
  Check,
  CircleAlert,
  ExternalLink,
  Link as LinkIcon,
  Loader2,
  Plus,
  Wifi,
  WifiOff,
} from "lucide-vue-next";
import { firebaseConfigWarning, hasFirebaseConfig } from "./services/firebase";
import {
  createJobListing,
  isValidHttpUrl,
  scrapeJobLink,
  updateApplicationStatus,
  updateScrapingResult,
  watchJobListings,
} from "./services/jobListings";
import { formatDate } from "./utils/formatDate";

const urlInput = ref("");
const urlError = ref("");
const submitLoading = ref(false);
const listLoading = ref(false);
const listings = ref([]);
const connectionError = ref("");
const toast = ref(null);
const updatingIds = ref(new Set());
const failedToastIds = ref(new Set());
let unsubscribeListings = null;
let toastTimer = null;

const stats = computed(() => {
  const total = listings.value.length;
  const applied = listings.value.filter((job) => job.statusSudahLamar).length;
  const pendingScrape = listings.value.filter((job) => job.scrapingStatus === "pending").length;

  return { total, applied, pendingScrape };
});

function showToast(message, tone = "error") {
  toast.value = { message, tone };
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.value = null;
  }, 3200);
}

async function submitJob() {
  const normalizedUrl = urlInput.value.trim();
  urlError.value = "";

  if (!isValidHttpUrl(normalizedUrl)) {
    urlError.value = "Format URL tidak valid, pastikan link diawali http:// atau https://";
    return;
  }

  submitLoading.value = true;
  let jobRef = null;
  try {
    jobRef = await createJobListing(normalizedUrl);
    urlInput.value = "";
    showToast("Link lowongan tersimpan. Scraping sedang berjalan.", "success");

    const scrapingResult = await scrapeJobLink(normalizedUrl);
    await updateScrapingResult(jobRef.id, scrapingResult);

    if (!scrapingResult.success) {
      showToast("Gagal mengambil data lowongan.");
    }
  } catch {
    if (jobRef) {
      await updateScrapingResult(jobRef.id, { success: false });
      showToast("Gagal mengambil data lowongan.");
    } else {
      showToast("Gagal menyimpan link lowongan.");
    }
  } finally {
    submitLoading.value = false;
  }
}

async function toggleStatus(job) {
  const nextValue = !job.statusSudahLamar;
  const previousListings = listings.value.map((item) => ({ ...item }));

  listings.value = listings.value.map((item) =>
    item.id === job.id ? { ...item, statusSudahLamar: nextValue } : item,
  );
  updatingIds.value = new Set(updatingIds.value).add(job.id);

  try {
    await updateApplicationStatus(job.id, nextValue);
  } catch {
    listings.value = previousListings;
    showToast("Gagal menyimpan status lamaran.");
  } finally {
    const nextSet = new Set(updatingIds.value);
    nextSet.delete(job.id);
    updatingIds.value = nextSet;
  }
}

function listenToJobs() {
  if (unsubscribeListings || !hasFirebaseConfig) {
    return;
  }

  listLoading.value = true;
  connectionError.value = "";
  unsubscribeListings = watchJobListings(
    (items) => {
      listings.value = items;
      listLoading.value = false;
      connectionError.value = "";

      const failedNewest = items.find(
        (job) => job.scrapingStatus === "failed" && !failedToastIds.value.has(job.id),
      );
      if (failedNewest) {
        failedToastIds.value = new Set(failedToastIds.value).add(failedNewest.id);
        showToast("Gagal mengambil data lowongan.");
      }
    },
    () => {
      listLoading.value = false;
      connectionError.value = "Koneksi ke Firestore terputus.";
    },
  );
}

function stopListeningToJobs() {
  if (unsubscribeListings) {
    unsubscribeListings();
    unsubscribeListings = null;
  }
  listings.value = [];
  failedToastIds.value = new Set();
}

onMounted(() => {
  if (hasFirebaseConfig) {
    listenToJobs();
  }
});

onUnmounted(() => {
  clearTimeout(toastTimer);
  stopListeningToJobs();
});
</script>

<template>
  <main class="app-shell">
    <section v-if="!hasFirebaseConfig" class="setup-panel">
      <CircleAlert :size="28" />
      <div>
        <h1>Breaker Bone Montus</h1>
        <p>{{ firebaseConfigWarning }}</p>
      </div>
    </section>

    <template v-else>
      <header class="topbar">
        <div>
          <div class="eyebrow">Personal Job Tracker</div>
          <h1>Breaker Bone Montus</h1>
        </div>
      </header>

      <section class="summary-grid" aria-label="Ringkasan lowongan">
        <article>
          <span>Total link</span>
          <strong>{{ stats.total }}</strong>
        </article>
        <article>
          <span>Sudah melamar</span>
          <strong>{{ stats.applied }}</strong>
        </article>
        <article>
          <span>Sedang scraping</span>
          <strong>{{ stats.pendingScrape }}</strong>
        </article>
      </section>

      <form class="input-panel" @submit.prevent="submitJob">
        <label for="job-url">Masukkan Link Lowongan Kerja</label>
        <div class="input-row">
          <div class="url-field">
            <LinkIcon :size="18" />
            <input
              id="job-url"
              v-model="urlInput"
              type="url"
              placeholder="https://contoh.com/lowongan"
              :disabled="submitLoading"
            />
          </div>
          <button class="primary-button submit-button" type="submit" :disabled="submitLoading">
            <Loader2 v-if="submitLoading" class="spin" :size="18" />
            <Plus v-else :size="18" />
            Submit
          </button>
        </div>
        <p v-if="urlError" class="field-error">{{ urlError }}</p>
      </form>

      <section class="list-section">
        <div class="section-heading">
          <div>
            <h2>Daftar Lowongan</h2>
            <p>{{ listings.length }} item terbaru</p>
          </div>
          <div class="sync-status" :class="{ offline: connectionError }">
            <WifiOff v-if="connectionError" :size="18" />
            <Wifi v-else :size="18" />
            {{ connectionError ? "Terputus" : "Sinkron" }}
          </div>
        </div>

        <div v-if="listLoading" class="center-state list-loading">
          <Loader2 class="spin" :size="32" />
        </div>

        <div v-else-if="!listings.length" class="empty-state">
          <BriefcaseBusiness :size="30" />
          <p>Belum ada link lowongan tersimpan.</p>
        </div>

        <div v-else class="job-list">
          <article v-for="job in listings" :key="job.id" class="job-item">
            <div class="job-time">{{ formatDate(job.createdAt) }}</div>

            <div class="job-main">
              <h3 :class="{ muted: !job.namaPosisi }">
                {{ job.namaPosisi || "Belum diketahui" }}
              </h3>
              <p :class="{ muted: !job.namaPerusahaan }">
                {{ job.namaPerusahaan || "Belum diketahui" }}
              </p>
              <span v-if="job.scrapingStatus === 'pending'" class="status-pill pending">
                <Loader2 class="spin" :size="14" />
                Scraping
              </span>
              <span v-else-if="job.scrapingStatus === 'failed'" class="status-pill failed">
                <CircleAlert :size="14" />
                Failed
              </span>
              <span v-else class="status-pill success">
                <Check :size="14" />
                Success
              </span>
            </div>

            <a class="open-link" :href="job.link" target="_blank" rel="noreferrer">
              <ExternalLink :size="17" />
              Buka Link
            </a>

            <button
              class="toggle-button"
              :class="{ active: job.statusSudahLamar }"
              type="button"
              :disabled="updatingIds.has(job.id)"
              @click="toggleStatus(job)"
            >
              <span class="toggle-track"><span class="toggle-thumb"></span></span>
              {{ job.statusSudahLamar ? "Sudah Melamar" : "Belum Melamar" }}
            </button>
          </article>
        </div>
      </section>
    </template>

    <div v-if="toast" class="toast" :class="toast.tone">
      {{ toast.message }}
    </div>
  </main>
</template>
