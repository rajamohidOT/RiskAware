"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { ATTACK_TEMPLATE_OPTIONS, TRAINING_MODULE_OPTIONS } from "@/lib/campaign-options";

type Learner = {
  _id?: string;
  email: string;
  firstName?: string;
  lastName?: string;
  status?: string;
};

type LearnersResponse = {
  success?: boolean;
  message?: string;
  learners?: Learner[];
};

type CurrentUser = {
  email?: string;
  firstName?: string;
  lastName?: string;
  role?: string;
};

type CampaignFormProps = {
  title: string;
  description: string;
  campaignType: "training" | "attack";
  assignmentLabel: string;
  mode?: "create" | "edit";
  campaignId?: string;
  initialValues?: {
    name?: string;
    description?: string;
    startDate?: string;
    endDate?: string;
    assignments?: Array<string | { id?: string }>;
    users?: "all" | string[];
    sendTime?: string;
    timezone?: string;
  };
};

const ATTACK_TIMEZONE_OPTIONS = [
  "UTC",
  "Europe/London",
  "Europe/Paris",
  "America/New_York",
  "America/Chicago",
  "America/Los_Angeles",
  "Asia/Dubai",
  "Asia/Karachi",
  "Asia/Kolkata",
  "Asia/Singapore",
  "Asia/Tokyo",
  "Australia/Sydney",
];

export default function CampaignForm({
  title,
  description,
  campaignType,
  assignmentLabel,
  mode = "create",
  campaignId,
  initialValues,
}: CampaignFormProps) {
  const PAGE_SIZE = 20;
  const router = useRouter();
  const [learners, setLearners] = useState<Learner[]>([]);
  const [loadingLearners, setLoadingLearners] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [selectAll, setSelectAll] = useState(true);
  const [selectedLearners, setSelectedLearners] = useState<string[]>([]);
  const [selectedAssignmentIds, setSelectedAssignmentIds] = useState<string[]>([]);
  const [learnerSearchTerm, setLearnerSearchTerm] = useState("");
  const [learnerPage, setLearnerPage] = useState(1);
  const profileRef = useRef<HTMLDivElement>(null);
  const [form, setForm] = useState({
    name: initialValues?.name || "",
    description: initialValues?.description || "",
    startDate: initialValues?.startDate || "",
    endDate: initialValues?.endDate || "",
    sendTime: initialValues?.sendTime || "09:00",
    timezone: initialValues?.timezone || "UTC",
  });

  useEffect(() => {
    if (initialValues?.users === 'all') {
      setSelectAll(true);
      setSelectedLearners([]);
      return;
    }
    if (Array.isArray(initialValues?.users)) {
      setSelectAll(false);
      setSelectedLearners(initialValues.users);
    }
  }, [initialValues?.users]);

  useEffect(() => {
    if (!Array.isArray(initialValues?.assignments)) {
      return;
    }

    const validIds = (campaignType === "attack" ? ATTACK_TEMPLATE_OPTIONS : TRAINING_MODULE_OPTIONS).map((item) => item.id);
    const initialIds = initialValues.assignments
      .map((assignment) => {
        if (typeof assignment === "string") {
          return assignment;
        }
        return typeof assignment?.id === "string" ? assignment.id : "";
      })
      .filter((id) => validIds.includes(id));

    setSelectedAssignmentIds(initialIds);
  }, [campaignType, initialValues?.assignments]);

  useEffect(() => {
    async function loadLearners() {
      try {
        setLoadingLearners(true);
        const response = await fetch("/api/admin/learners", {
          method: "GET",
          credentials: "include",
        });
        const data = (await response.json().catch(() => ({}))) as LearnersResponse;
        if (!response.ok || !data.success) {
          throw new Error(data.message || "Unable to load learners.");
        }
        const activeLearners = Array.isArray(data.learners)
          ? data.learners.filter((learner) => learner.status === "active")
          : [];
        setLearners(activeLearners);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unable to load learners.";
        setError(message);
      } finally {
        setLoadingLearners(false);
      }
    }

    void loadLearners();
  }, []);

  useEffect(() => {
    async function loadCurrentUser() {
      try {
        const response = await fetch("/api/learners", {
          method: "GET",
          credentials: "include",
        });

        if (!response.ok) {
          return;
        }

        const data = (await response.json().catch(() => ({}))) as CurrentUser;
        setCurrentUser(data);
      } catch {
        setCurrentUser(null);
      }
    }

    void loadCurrentUser();
  }, []);

  useEffect(() => {
    function onDocumentClick(event: MouseEvent) {
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setProfileMenuOpen(false);
      }
    }

    document.addEventListener("mousedown", onDocumentClick);
    return () => {
      document.removeEventListener("mousedown", onDocumentClick);
    };
  }, []);

  const availableAssignments = useMemo(
    () => (campaignType === "attack" ? ATTACK_TEMPLATE_OPTIONS : TRAINING_MODULE_OPTIONS),
    [campaignType]
  );

  const currentDisplayName = useMemo(() => {
    const firstName = (currentUser?.firstName || "").trim();
    const lastName = (currentUser?.lastName || "").trim();
    const fullName = `${firstName} ${lastName}`.trim();
    if (fullName) {
      return fullName;
    }
    return currentUser?.email || "User";
  }, [currentUser]);

  const currentInitials = useMemo(() => {
    const firstName = (currentUser?.firstName || "").trim().charAt(0);
    const lastName = (currentUser?.lastName || "").trim().charAt(0);
    if (firstName || lastName) {
      return `${firstName}${lastName}`.toUpperCase();
    }
    return (currentUser?.email || "U").charAt(0).toUpperCase();
  }, [currentUser]);

  const filteredLearners = useMemo(() => {
    const query = learnerSearchTerm.trim().toLowerCase();
    if (!query) {
      return learners;
    }

    return learners.filter((learner) => {
      const fullName = `${learner.firstName || ""} ${learner.lastName || ""}`.toLowerCase();
      const email = (learner.email || "").toLowerCase();
      return fullName.includes(query) || email.includes(query);
    });
  }, [learners, learnerSearchTerm]);

  const learnerTotalPages = Math.max(1, Math.ceil(filteredLearners.length / PAGE_SIZE));

  const paginatedLearners = useMemo(() => {
    const start = (learnerPage - 1) * PAGE_SIZE;
    return filteredLearners.slice(start, start + PAGE_SIZE);
  }, [filteredLearners, learnerPage]);

  useEffect(() => {
    setLearnerPage(1);
  }, [learnerSearchTerm, selectAll]);

  useEffect(() => {
    if (learnerPage > learnerTotalPages) {
      setLearnerPage(learnerTotalPages);
    }
  }, [learnerPage, learnerTotalPages]);

  function updateField(field: keyof typeof form, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function toggleLearner(email: string) {
    setSelectedLearners((current) =>
      current.includes(email) ? current.filter((item) => item !== email) : [...current, email]
    );
  }

  function toggleAssignment(id: string) {
    setSelectedAssignmentIds((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id]
    );
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (selectedAssignmentIds.length === 0) {
      setError(`Select at least one ${assignmentLabel.toLowerCase()}.`);
      return;
    }

    if (!selectAll && selectedLearners.length === 0) {
      setError("Select at least one learner or choose all learners.");
      return;
    }

    try {
      setSubmitting(true);
      setError("");
      setSuccess("");

      const response = await fetch("/api/learners/campaigns", {
        method: mode === "edit" ? "PATCH" : "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          ...(mode === "edit" ? { id: campaignId } : {}),
          name: form.name,
          description: form.description,
          startDate: form.startDate,
          endDate: form.endDate,
          sendTime: campaignType === "attack" ? form.sendTime : undefined,
          timezone: campaignType === "attack" ? form.timezone : undefined,
          users: selectAll ? "all" : selectedLearners,
          type: campaignType,
          assignmentIds: selectedAssignmentIds,
        }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data?.success) {
        throw new Error(data?.message || `Unable to ${mode === "edit" ? "update" : "create"} campaign.`);
      }

      setSuccess(`${title} ${mode === "edit" ? "updated" : "created"} successfully.`);
      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : `Unable to ${mode === "edit" ? "update" : "create"} campaign.`;
      setError(message);
    } finally {
      setSubmitting(false);
    }
  }

  async function onLogout() {
    try {
      await fetch("/api/learners/logout", {
        method: "POST",
        credentials: "include",
      });
    } finally {
      window.location.href = "/signin";
    }
  }

  return (
    <main className="min-h-screen bg-[#0d0d0d] text-white">
      <header className="sticky top-0 z-10 border-b border-white/10 bg-[#111111]/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-6">
            <img src="/images/flavio.png" alt="RiskAware logo" className="h-10 w-10 rounded-md" />
            <span className="text-lg font-semibold tracking-wide">RiskAware</span>
            <Link href="/dashboard" className="text-white/80 transition-colors hover:text-white">
              Dashboard
            </Link>
            <span className="text-white font-medium">{title}</span>
          </div>

          <div className="relative" ref={profileRef}>
            <button
              type="button"
              onClick={() => setProfileMenuOpen((prev) => !prev)}
              className="flex items-center gap-3 rounded-full border border-white/15 bg-white/5 px-2 py-1 hover:bg-white/10"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-[#FFD12A] to-[#FF7B80] text-sm font-bold text-black">
                {currentInitials}
              </span>
              <span className="max-w-[200px] truncate text-sm font-medium text-white/90">{currentDisplayName}</span>
            </button>

            {profileMenuOpen && (
              <div className="absolute right-0 mt-2 w-40 rounded-lg border border-white/15 bg-[#151515] p-1 shadow-xl">
                <button
                  type="button"
                  onClick={() => void onLogout()}
                  className="w-full rounded-md px-3 py-2 text-left text-sm text-red-200 hover:bg-red-500/20"
                >
                  Logout
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8 space-y-8">
        <div>
          <h1 className="text-3xl font-semibold">{title}</h1>
          <p className="mt-2 text-sm text-white/70">{description}</p>
        </div>

        {error && (
          <div className="rounded-xl border border-red-400/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {error}
          </div>
        )}

        {success && (
          <div className="rounded-xl border border-emerald-400/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
            {success}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6 rounded-2xl border border-white/10 bg-white/5 p-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <label className="block text-sm text-gray-400">Campaign Name</label>
              <input
                type="text"
                value={form.name}
                onChange={(event) => updateField("name", event.target.value)}
                className="mt-2 w-full rounded-lg border border-white/10 bg-[#1a1a1a] px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#A857FF]"
                placeholder="Quarterly cyber awareness campaign"
                required
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm text-gray-400">Description</label>
              <textarea
                value={form.description}
                onChange={(event) => updateField("description", event.target.value)}
                className="mt-2 min-h-28 w-full rounded-lg border border-white/10 bg-[#1a1a1a] px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#A857FF]"
                placeholder="Describe the purpose and learner outcomes for this campaign."
                required
              />
            </div>

            <div>
              <label className="block text-sm text-gray-400">Start Date</label>
              <input
                type="date"
                value={form.startDate}
                onChange={(event) => updateField("startDate", event.target.value)}
                className="mt-2 w-full rounded-lg border border-white/10 bg-[#1a1a1a] px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#A857FF]"
                required
              />
            </div>

            <div>
              <label className="block text-sm text-gray-400">End Date</label>
              <input
                type="date"
                value={form.endDate}
                onChange={(event) => updateField("endDate", event.target.value)}
                className="mt-2 w-full rounded-lg border border-white/10 bg-[#1a1a1a] px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#A857FF]"
                required
              />
            </div>

            {campaignType === "attack" && (
              <>
                <div>
                  <label className="block text-sm text-gray-400">Send Time</label>
                  <input
                    type="time"
                    value={form.sendTime}
                    onChange={(event) => updateField("sendTime", event.target.value)}
                    className="mt-2 w-full rounded-lg border border-white/10 bg-[#1a1a1a] px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#A857FF]"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm text-gray-400">Timezone</label>
                  <select
                    value={form.timezone}
                    onChange={(event) => updateField("timezone", event.target.value)}
                    className="mt-2 w-full rounded-lg border border-white/10 bg-[#1a1a1a] px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#A857FF]"
                    required
                  >
                    {ATTACK_TIMEZONE_OPTIONS.map((tz) => (
                      <option key={tz} value={tz}>
                        {tz}
                      </option>
                    ))}
                  </select>
                </div>
              </>
            )}
          </div>

          <div className="rounded-xl border border-white/10 bg-[#141414] p-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold">Audience</h2>
                <p className="text-sm text-white/65">Choose whether this campaign applies to all learners or selected users only.</p>
              </div>
              <label className="flex items-center gap-2 text-sm text-white/85">
                <input
                  type="checkbox"
                  checked={selectAll}
                  onChange={(event) => setSelectAll(event.target.checked)}
                  className="accent-[#A857FF]"
                />
                All learners
              </label>
            </div>

            {!selectAll && (
              <div className="mt-4 space-y-3">
                <input
                  type="text"
                  value={learnerSearchTerm}
                  onChange={(event) => setLearnerSearchTerm(event.target.value)}
                  placeholder="Search learners"
                  className="w-full rounded-lg border border-white/15 bg-[#1a1a1a] px-3 py-2 text-sm text-white placeholder:text-white/45 focus:outline-none focus:ring-2 focus:ring-[#A857FF]"
                />

                <div className="grid gap-3 sm:grid-cols-2">
                {loadingLearners ? (
                  <p className="text-sm text-white/70">Loading learners...</p>
                ) : filteredLearners.length === 0 ? (
                  <p className="text-sm text-white/70">No active learners available yet.</p>
                ) : (
                  paginatedLearners.map((learner) => {
                    const name = `${learner.firstName || ""} ${learner.lastName || ""}`.trim() || learner.email;
                    const checked = selectedLearners.includes(learner.email);
                    return (
                      <label key={learner.email} className="flex items-center gap-3 rounded-lg border border-white/10 bg-[#1a1a1a] px-4 py-3 text-sm">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleLearner(learner.email)}
                          className="accent-[#A857FF]"
                        />
                        <span>
                          <span className="block text-white">{name}</span>
                          <span className="block text-white/55">{learner.email}</span>
                        </span>
                      </label>
                    );
                  })
                )}
                </div>

                {!loadingLearners && filteredLearners.length > 0 && (
                  <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-3">
                    <p className="text-xs text-white/65">
                      Showing {(learnerPage - 1) * PAGE_SIZE + 1}-{Math.min(learnerPage * PAGE_SIZE, filteredLearners.length)} of {filteredLearners.length}
                    </p>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setLearnerPage((prev) => Math.max(1, prev - 1))}
                        disabled={learnerPage === 1}
                        className="rounded-md border border-white/15 px-3 py-1 text-xs hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Previous
                      </button>
                      <span className="text-xs text-white/70">Page {learnerPage} of {learnerTotalPages}</span>
                      <button
                        type="button"
                        onClick={() => setLearnerPage((prev) => Math.min(learnerTotalPages, prev + 1))}
                        disabled={learnerPage === learnerTotalPages}
                        className="rounded-md border border-white/15 px-3 py-1 text-xs hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm text-gray-400">{assignmentLabel}</label>
            <div className="mt-2 grid gap-3">
              {availableAssignments.map((assignment) => {
                const checked = selectedAssignmentIds.includes(assignment.id);
                const isAttackOption = campaignType === "attack";

                return (
                  <label
                    key={assignment.id}
                    className={`block cursor-pointer rounded-lg border p-4 transition-colors ${
                      checked
                        ? "border-[#A857FF]/60 bg-[#A857FF]/10"
                        : "border-white/10 bg-[#1a1a1a] hover:border-white/25"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleAssignment(assignment.id)}
                        className="mt-1 accent-[#A857FF]"
                      />
                      <div>
                        <p className="text-sm font-semibold text-white">{assignment.title}</p>
                        <p className="mt-1 text-xs text-white/65">{assignment.description}</p>
                        {isAttackOption ? (
                          <p className="mt-2 text-xs text-[#FFB3B7]">Email template: {(assignment as (typeof ATTACK_TEMPLATE_OPTIONS)[number]).templateFile}</p>
                        ) : (
                          <>
                            <p className="mt-2 text-xs text-[#B9DCFF]">Video: {(assignment as (typeof TRAINING_MODULE_OPTIONS)[number]).videoUrl}</p>
                            <p className="mt-1 text-xs text-white/55">Questions: {(assignment as (typeof TRAINING_MODULE_OPTIONS)[number]).questions.length}</p>
                          </>
                        )}
                      </div>
                    </div>
                  </label>
                );
              })}
            </div>
            <p className="mt-2 text-xs text-white/55">Pick one or more modules/templates for this campaign.</p>
          </div>

          <div className="flex items-center justify-end gap-3">
            <Link href="/dashboard" className="rounded-lg border border-white/15 px-4 py-3 text-sm text-white/80 transition-colors hover:bg-white/10">
              Cancel
            </Link>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-lg bg-[#A857FF] px-5 py-3 text-sm font-medium text-white transition-all hover:bg-[#9440E6] disabled:cursor-not-allowed disabled:opacity-70"
            >
              {submitting
                ? mode === "edit"
                  ? "Saving..."
                  : "Creating..."
                : mode === "edit"
                  ? "Save Changes"
                  : `Create ${campaignType === "training" ? "Training" : "Attack Simulation"}`}
            </button>
          </div>
        </form>
      </section>
    </main>
  );
}
