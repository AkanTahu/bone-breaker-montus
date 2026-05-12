<script setup>
import { computed, onMounted, onUnmounted, ref } from "vue";
import {
  BriefcaseBusiness,
  Check,
  CircleAlert,
  ExternalLink,
  Frown,
  Heart,
  Link as LinkIcon,
  Loader2,
  Plus,
  Trash2,
  Wifi,
  WifiOff,
} from "lucide-vue-next";
import { firebaseConfigWarning, hasFirebaseConfig } from "./services/firebase";
import {
  createJobListing,
  deleteJobListing,
  isValidHttpUrl,
  scrapeJobLink,
  updateApplicationStatus,
  updateInterestStatus,
  updateJobCategory,
  updateJobNotes,
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
const categoryUpdatingIds = ref(new Set());
const interestUpdatingIds = ref(new Set());
const deletingIds = ref(new Set());
const noteInputIds = ref(new Set());
const noteSavingIds = ref(new Set());
const noteDrafts = ref({});
const failedToastIds = ref(new Set());
let unsubscribeListings = null;
let toastTimer = null;

const jobCategories = ["Staff Admin", "IT", "MT", "Purchasing", "Logistic", "Others"];

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
    showToast("Perubahan sudah diproses.", "success");
  } catch {
    listings.value = previousListings;
    showToast("Gagal menyimpan status lamaran.");
  } finally {
    const nextSet = new Set(updatingIds.value);
    nextSet.delete(job.id);
    updatingIds.value = nextSet;
  }
}

async function changeCategory(job, kategori) {
  const previousListings = listings.value.map((item) => ({ ...item }));

  listings.value = listings.value.map((item) =>
    item.id === job.id ? { ...item, kategori } : item,
  );
  categoryUpdatingIds.value = new Set(categoryUpdatingIds.value).add(job.id);

  try {
    await updateJobCategory(job.id, kategori);
    showToast("Perubahan sudah diproses.", "success");
  } catch {
    listings.value = previousListings;
    showToast("Gagal menyimpan kategori lowongan.");
  } finally {
    const nextSet = new Set(categoryUpdatingIds.value);
    nextSet.delete(job.id);
    categoryUpdatingIds.value = nextSet;
  }
}

function isInterested(job) {
  return job.tertarik !== false;
}

async function toggleInterest(job) {
  const nextValue = !isInterested(job);
  const previousListings = listings.value.map((item) => ({ ...item }));

  listings.value = listings.value.map((item) =>
    item.id === job.id ? { ...item, tertarik: nextValue } : item,
  );
  interestUpdatingIds.value = new Set(interestUpdatingIds.value).add(job.id);

  try {
    await updateInterestStatus(job.id, nextValue);
    showToast("Perubahan sudah diproses.", "success");
  } catch {
    listings.value = previousListings;
    showToast("Gagal menyimpan status tertarik.");
  } finally {
    const nextSet = new Set(interestUpdatingIds.value);
    nextSet.delete(job.id);
    interestUpdatingIds.value = nextSet;
  }
}

function showNoteInput(job) {
  noteInputIds.value = new Set(noteInputIds.value).add(job.id);
  noteDrafts.value = {
    ...noteDrafts.value,
    [job.id]: noteDrafts.value[job.id] || "",
  };
}

async function submitNote(job) {
  const text = (noteDrafts.value[job.id] || "").trim();
  if (!text) {
    return;
  }

  const previousListings = listings.value.map((item) => ({ ...item }));
  const previousNotes = Array.isArray(job.notes) ? job.notes : [];
  const nextNote = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    text,
    createdAt: Date.now(),
  };
  const nextNotes = [...previousNotes, nextNote];

  listings.value = listings.value.map((item) =>
    item.id === job.id ? { ...item, notes: nextNotes } : item,
  );
  noteDrafts.value = { ...noteDrafts.value, [job.id]: "" };
  noteSavingIds.value = new Set(noteSavingIds.value).add(job.id);

  try {
    await updateJobNotes(job.id, nextNotes);
    showToast("Note sudah diproses.", "success");
  } catch {
    listings.value = previousListings;
    noteDrafts.value = { ...noteDrafts.value, [job.id]: text };
    showToast("Gagal menyimpan note.");
  } finally {
    const nextSet = new Set(noteSavingIds.value);
    nextSet.delete(job.id);
    noteSavingIds.value = nextSet;
  }
}

async function removeJob(job) {
  const confirmed = window.confirm("Hapus lowongan ini dari daftar?");
  if (!confirmed) {
    return;
  }

  deletingIds.value = new Set(deletingIds.value).add(job.id);

  try {
    await deleteJobListing(job.id);
    showToast("Lowongan berhasil dihapus.", "success");
  } catch {
    showToast("Gagal menghapus lowongan.");
  } finally {
    const nextSet = new Set(deletingIds.value);
    nextSet.delete(job.id);
    deletingIds.value = nextSet;
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
              <div class="job-meta-row">
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
                <button
                  class="note-add-button"
                  type="button"
                  title="Tambah note"
                  :disabled="deletingIds.has(job.id)"
                  @click="showNoteInput(job)"
                >
                  <Plus :size="15" />
                </button>
              </div>
              <form
                v-if="noteInputIds.has(job.id)"
                class="note-form"
                @submit.prevent="submitNote(job)"
              >
                <input
                  v-model="noteDrafts[job.id]"
                  type="text"
                  placeholder="Tulis note lalu tekan Enter"
                  :disabled="noteSavingIds.has(job.id)"
                />
              </form>
              <div v-if="job.notes?.length" class="note-list">
                <p v-for="note in job.notes" :key="note.id || note.text" class="job-note">
                  {{ note.text || note }}
                </p>
              </div>
            </div>

            <a class="open-link" :href="job.link" target="_blank" rel="noreferrer">
              <ExternalLink :size="17" />
            </a>

            <select
              class="category-select"
              :value="job.kategori || 'Others'"
              :title="`Kategori: ${job.kategori || 'Others'}`"
              :disabled="categoryUpdatingIds.has(job.id) || deletingIds.has(job.id)"
              @change="changeCategory(job, $event.target.value)"
            >
              <option v-for="category in jobCategories" :key="category" :value="category">
                {{ category }}
              </option>
            </select>

            <button
              class="toggle-button"
              :class="{ active: job.statusSudahLamar }"
              type="button"
              :title="job.statusSudahLamar ? 'Sudah melamar' : 'Belum melamar'"
              :disabled="updatingIds.has(job.id) || deletingIds.has(job.id)"
              @click="toggleStatus(job)"
            >
              <span class="toggle-track">
                <span class="toggle-thumb">
                  <Check :size="12" />
                </span>
              </span>
            </button>

            <button
              class="toggle-button interest-toggle"
              :class="{ active: isInterested(job) }"
              type="button"
              :title="isInterested(job) ? 'Tertarik' : 'Tidak tertarik'"
              :disabled="interestUpdatingIds.has(job.id) || deletingIds.has(job.id)"
              @click="toggleInterest(job)"
            >
              <span class="toggle-track">
                <span class="toggle-thumb">
                  <Heart v-if="isInterested(job)" :size="12" />
                  <Frown v-else :size="12" />
                </span>
              </span>
            </button>

            <button
              class="delete-button"
              type="button"
              title="Hapus lowongan"
              :disabled="deletingIds.has(job.id)"
              @click="removeJob(job)"
            >
              <Loader2 v-if="deletingIds.has(job.id)" class="spin" :size="17" />
              <Trash2 v-else :size="17" />
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
