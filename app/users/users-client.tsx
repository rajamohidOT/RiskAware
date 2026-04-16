"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import ConfirmModal from "@/components/ConfirmModal";

type Learner = {
  _id?: string;
  email: string;
  firstName?: string;
  lastName?: string;
  country?: string;
  department?: string;
  status?: string;
  role?: string;
  invitedAt?: string;
  createdAt?: string;
};

type CurrentUser = {
  email?: string;
  firstName?: string;
  lastName?: string;
};

type LearnersResponse = {
  success?: boolean;
  message?: string;
  learners?: Learner[];
};

type InviteForm = {
  email: string;
  firstName: string;
  lastName: string;
  country: string;
  department: string;
};

type EditableLearnerStatus = "active" | "inactive" | "invited";

const initialForm: InviteForm = {
  email: "",
  firstName: "",
  lastName: "",
  country: "",
  department: "",
};

const COUNTRY_OPTIONS = [
  "Afghanistan", "Albania", "Algeria", "Andorra", "Angola", "Antigua and Barbuda", "Argentina", "Armenia", "Australia", "Austria",
  "Azerbaijan", "Bahamas", "Bahrain", "Bangladesh", "Barbados", "Belarus", "Belgium", "Belize", "Benin", "Bhutan",
  "Bolivia", "Bosnia and Herzegovina", "Botswana", "Brazil", "Brunei", "Bulgaria", "Burkina Faso", "Burundi", "Cabo Verde", "Cambodia",
  "Cameroon", "Canada", "Central African Republic", "Chad", "Chile", "China", "Colombia", "Comoros", "Congo", "Costa Rica",
  "Croatia", "Cuba", "Cyprus", "Czechia", "Democratic Republic of the Congo", "Denmark", "Djibouti", "Dominica", "Dominican Republic", "Ecuador",
  "Egypt", "El Salvador", "Equatorial Guinea", "Eritrea", "Estonia", "Eswatini", "Ethiopia", "Fiji", "Finland", "France",
  "Gabon", "Gambia", "Georgia", "Germany", "Ghana", "Greece", "Grenada", "Guatemala", "Guinea", "Guinea-Bissau",
  "Guyana", "Haiti", "Honduras", "Hungary", "Iceland", "India", "Indonesia", "Iran", "Iraq", "Ireland",
  "Israel", "Italy", "Jamaica", "Japan", "Jordan", "Kazakhstan", "Kenya", "Kiribati", "Kuwait", "Kyrgyzstan",
  "Laos", "Latvia", "Lebanon", "Lesotho", "Liberia", "Libya", "Liechtenstein", "Lithuania", "Luxembourg", "Madagascar",
  "Malawi", "Malaysia", "Maldives", "Mali", "Malta", "Marshall Islands", "Mauritania", "Mauritius", "Mexico", "Micronesia",
  "Moldova", "Monaco", "Mongolia", "Montenegro", "Morocco", "Mozambique", "Myanmar", "Namibia", "Nauru", "Nepal",
  "Netherlands", "New Zealand", "Nicaragua", "Niger", "Nigeria", "North Korea", "North Macedonia", "Norway", "Oman", "Pakistan",
  "Palau", "Palestine", "Panama", "Papua New Guinea", "Paraguay", "Peru", "Philippines", "Poland", "Portugal", "Qatar",
  "Romania", "Russia", "Rwanda", "Saint Kitts and Nevis", "Saint Lucia", "Saint Vincent and the Grenadines", "Samoa", "San Marino", "Sao Tome and Principe", "Saudi Arabia",
  "Senegal", "Serbia", "Seychelles", "Sierra Leone", "Singapore", "Slovakia", "Slovenia", "Solomon Islands", "Somalia", "South Africa",
  "South Korea", "South Sudan", "Spain", "Sri Lanka", "Sudan", "Suriname", "Sweden", "Switzerland", "Syria", "Taiwan",
  "Tajikistan", "Tanzania", "Thailand", "Timor-Leste", "Togo", "Tonga", "Trinidad and Tobago", "Tunisia", "Turkey", "Turkmenistan",
  "Tuvalu", "Uganda", "Ukraine", "United Arab Emirates", "United Kingdom", "United States", "Uruguay", "Uzbekistan", "Vanuatu", "Vatican City",
  "Venezuela", "Vietnam", "Yemen", "Zambia", "Zimbabwe"
];

export default function UsersClient({ organisation }: { organisation: string }) {
  const PAGE_SIZE = 20;
  const [learners, setLearners] = useState<Learner[]>([]);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [form, setForm] = useState<InviteForm>(initialForm);
  const [editForm, setEditForm] = useState<Omit<InviteForm, "email">>({
    firstName: "",
    lastName: "",
    country: "",
    department: "",
  });
  const [editStatus, setEditStatus] = useState<EditableLearnerStatus>("active");
  const [editingLearner, setEditingLearner] = useState<Learner | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [deletingLearnerId, setDeletingLearnerId] = useState("");
  const [resendingEmail, setResendingEmail] = useState("");
  const [pendingDeleteLearner, setPendingDeleteLearner] = useState<Learner | null>(null);
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [settingsOpenFor, setSettingsOpenFor] = useState("");
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const profileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    void loadLearners();
    void loadCurrentUser();
  }, []);

  useEffect(() => {
    function onDocumentClick(event: MouseEvent) {
      const target = event.target as HTMLElement;
      if (!target.closest("[data-learner-settings]")) {
        setSettingsOpenFor("");
      }

      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setProfileMenuOpen(false);
      }
    }

    document.addEventListener("mousedown", onDocumentClick);
    return () => {
      document.removeEventListener("mousedown", onDocumentClick);
    };
  }, []);

  const currentDisplayName = useMemo(() => {
    const firstName = (currentUser?.firstName || "").trim();
    const lastName = (currentUser?.lastName || "").trim();
    const fullName = `${firstName} ${lastName}`.trim();
    if (fullName) {
      return fullName;
    }
    return currentUser?.email || "Admin";
  }, [currentUser]);

  const currentInitials = useMemo(() => {
    const firstName = (currentUser?.firstName || "").trim().charAt(0);
    const lastName = (currentUser?.lastName || "").trim().charAt(0);
    if (firstName || lastName) {
      return `${firstName}${lastName}`.toUpperCase();
    }
    return (currentUser?.email || "A").charAt(0).toUpperCase();
  }, [currentUser]);

  const filteredLearners = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) {
      return learners;
    }

    return learners.filter((learner) => {
      const fullName = `${learner.firstName || ""} ${learner.lastName || ""}`.toLowerCase();
      const email = (learner.email || "").toLowerCase();
      const department = (learner.department || "").toLowerCase();
      const status = (learner.status || "").toLowerCase();
      return fullName.includes(query) || email.includes(query) || department.includes(query) || status.includes(query);
    });
  }, [learners, searchTerm]);

  const totalPages = Math.max(1, Math.ceil(filteredLearners.length / PAGE_SIZE));

  const paginatedLearners = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredLearners.slice(start, start + PAGE_SIZE);
  }, [filteredLearners, currentPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

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

  async function loadLearners() {
    try {
      setLoading(true);
      setError("");

      const response = await fetch("/api/admin/learners", {
        method: "GET",
        credentials: "include",
      });

      const data = (await response.json().catch(() => ({}))) as LearnersResponse;
      if (!response.ok || !data.success) {
        throw new Error(data.message || "Unable to load learners.");
      }

      setLearners(Array.isArray(data.learners) ? data.learners : []);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to load learners.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  function onChangeField(field: keyof InviteForm, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function onChangeEditField(field: keyof Omit<InviteForm, "email">, value: string) {
    setEditForm((prev) => ({ ...prev, [field]: value }));
  }

  function openInviteModal() {
    setForm(initialForm);
    setInviteModalOpen(true);
    setError("");
    setSuccess("");
  }

  function openEditModal(learner: Learner) {
    setEditingLearner(learner);
    setEditForm({
      firstName: learner.firstName || "",
      lastName: learner.lastName || "",
      country: learner.country || "",
      department: learner.department || "",
    });
    const nextStatus = sanitizeLearnerStatus(learner.status);
    setEditStatus(nextStatus);
    setEditModalOpen(true);
    setSettingsOpenFor("");
    setError("");
    setSuccess("");
  }

  function sanitizeLearnerStatus(status: string | undefined): EditableLearnerStatus {
    if (status === "inactive" || status === "invited") {
      return status;
    }
    return "active";
  }

  async function onInviteLearner(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    try {
      setSubmitting(true);
      setError("");
      setSuccess("");

      const response = await fetch("/api/admin/learners", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify(form),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data?.success) {
        throw new Error(data?.message || "Unable to invite learner.");
      }

      setSuccess("Invite sent successfully.");
      setForm(initialForm);
      setInviteModalOpen(false);
      await loadLearners();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to invite learner.";
      setError(message);
    } finally {
      setSubmitting(false);
    }
  }

  async function onResendInvite(email: string) {
    try {
      setResendingEmail(email);
      setError("");
      setSuccess("");

      const response = await fetch("/api/admin/learners", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({ email, regenerate: true }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data?.success) {
        throw new Error(data?.message || "Unable to resend invite.");
      }

      setSuccess(`Invite regenerated and resent to ${email}.`);
      await loadLearners();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to resend invite.";
      setError(message);
    } finally {
      setResendingEmail("");
    }
  }

  async function onEditLearner(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!editingLearner?._id) {
      setError("Unable to edit learner.");
      return;
    }

    try {
      setSavingEdit(true);
      setError("");
      setSuccess("");

      const response = await fetch("/api/admin/learners", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          action: "edit",
          learnerId: editingLearner._id,
          status: editStatus,
          ...editForm,
        }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data?.success) {
        throw new Error(data?.message || "Unable to update learner.");
      }

      setSuccess("Learner updated successfully.");
      setEditModalOpen(false);
      setEditingLearner(null);
      await loadLearners();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to update learner.";
      setError(message);
    } finally {
      setSavingEdit(false);
    }
  }

  function openDeleteLearnerModal(learner: Learner) {
    if (!learner._id) {
      setError("Unable to delete learner.");
      return;
    }

    setPendingDeleteLearner(learner);
    setDeleteModalOpen(true);
    setSettingsOpenFor("");
  }

  async function onDeleteLearner() {
    if (!pendingDeleteLearner?._id) {
      setDeleteModalOpen(false);
      setPendingDeleteLearner(null);
      return;
    }

    try {
      setDeletingLearnerId(pendingDeleteLearner._id);
      setSettingsOpenFor("");
      setError("");
      setSuccess("");

      const response = await fetch("/api/admin/learners", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({ learnerId: pendingDeleteLearner._id }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data?.success) {
        throw new Error(data?.message || "Unable to delete learner.");
      }

      setSuccess("Learner deleted successfully.");
      setDeleteModalOpen(false);
      setPendingDeleteLearner(null);
      await loadLearners();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to delete learner.";
      setError(message);
    } finally {
      setDeletingLearnerId("");
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
          <div className="flex items-center gap-4">
            <img src="/images/flavio.png" alt="RiskAware logo" className="h-10 w-10 rounded-md" />
            <span className="text-lg font-semibold tracking-wide">RiskAware</span>
            <Link href="/dashboard" className="ml-4 text-white/80 hover:text-white transition-colors">
              Dashboard
            </Link>
            <span className="text-white font-medium">Users</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs text-white/80">
              {organisation}
            </span>
            <div className="relative" ref={profileRef}>
              <button
                type="button"
                onClick={() => setProfileMenuOpen((prev) => !prev)}
                className="flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-2 py-1 hover:bg-white/10"
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-[#FFD12A] to-[#FF7B80] text-xs font-bold text-black">
                  {currentInitials}
                </span>
                <span className="max-w-[180px] truncate text-sm text-white/90">{currentDisplayName}</span>
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
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8 space-y-8">
        <div>
          <h1 className="text-2xl font-semibold">Manage Learners</h1>
          <p className="mt-1 text-sm text-white/70">
            Invite learners to your organisation and resend secure signup links when needed.
          </p>
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

        <div className="rounded-xl border border-white/10 bg-white/5 p-5 overflow-x-auto">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">Learners</h2>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search learners"
                className="w-56 rounded-lg border border-white/15 bg-[#1a1a1a] px-3 py-2 text-sm text-white placeholder:text-white/45 focus:outline-none focus:ring-2 focus:ring-[#A857FF]"
              />
              <button
                type="button"
                onClick={openInviteModal}
                className="rounded-lg bg-[#A857FF] px-4 py-2 text-sm font-medium transition-all hover:bg-[#9440E6]"
              >
                + Add Learner
              </button>
            </div>
          </div>

          {loading ? (
            <p className="text-white/80">Loading learners...</p>
          ) : filteredLearners.length === 0 ? (
            <p className="text-white/70">No learners found for this organisation.</p>
          ) : (
            <>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-white/70 border-b border-white/10">
                    <th className="pb-3 pr-4">Name</th>
                    <th className="pb-3 pr-4">Email</th>
                    <th className="pb-3 pr-4">Department</th>
                    <th className="pb-3 pr-4">Status</th>
                    <th className="pb-3 pr-0 text-right">Settings</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedLearners.map((learner) => {
                    const name = `${learner.firstName || ""} ${learner.lastName || ""}`.trim() || "-";
                    const isInvited = learner.status === "invited";
                    const learnerId = learner._id || learner.email;
                    return (
                      <tr key={learnerId} className="border-b border-white/5">
                        <td className="py-3 pr-4">{name}</td>
                        <td className="py-3 pr-4">{learner.email}</td>
                        <td className="py-3 pr-4">{learner.department || "-"}</td>
                        <td className="py-3 pr-4">
                          <span className={`rounded-full px-2 py-1 text-xs ${
                            learner.status === "inactive"
                              ? "bg-slate-500/20 text-slate-200"
                              : isInvited
                                ? "bg-amber-500/20 text-amber-200"
                                : "bg-emerald-500/20 text-emerald-200"
                          }`}>
                            {learner.status || "unknown"}
                          </span>
                        </td>
                        <td className="py-3 pr-0 text-right">
                          <div className="relative inline-block" data-learner-settings>
                            <button
                              type="button"
                              onClick={() => setSettingsOpenFor((prev) => (prev === learnerId ? "" : learnerId))}
                              className="rounded-md border border-white/15 px-3 py-1 text-xs hover:bg-white/10"
                            >
                              Settings
                            </button>

                            {settingsOpenFor === learnerId && (
                              <div className="absolute right-0 z-20 mt-2 w-40 rounded-lg border border-white/15 bg-[#151515] p-1 shadow-xl">
                                {isInvited && (
                                  <button
                                    type="button"
                                    onClick={() => void onResendInvite(learner.email)}
                                    disabled={resendingEmail === learner.email || deletingLearnerId === learner._id}
                                    className="w-full rounded-md px-3 py-2 text-left text-xs text-white/90 hover:bg-white/10 disabled:opacity-60 disabled:cursor-not-allowed"
                                  >
                                    {resendingEmail === learner.email ? "Resending..." : "Resend invite"}
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={() => openEditModal(learner)}
                                  className="w-full rounded-md px-3 py-2 text-left text-xs text-white/90 hover:bg-white/10"
                                >
                                  Edit learner
                                </button>
                                <button
                                  type="button"
                                  onClick={() => openDeleteLearnerModal(learner)}
                                  disabled={deletingLearnerId === learner._id}
                                  className="w-full rounded-md px-3 py-2 text-left text-xs text-red-200 hover:bg-red-500/20 disabled:opacity-60"
                                >
                                  {deletingLearnerId === learner._id ? "Deleting..." : "Delete learner"}
                                </button>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-4">
                <p className="text-xs text-white/65">
                  Showing {(currentPage - 1) * PAGE_SIZE + 1}-{Math.min(currentPage * PAGE_SIZE, filteredLearners.length)} of {filteredLearners.length}
                </p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                    className="rounded-md border border-white/15 px-3 py-1 text-xs hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Previous
                  </button>
                  <span className="text-xs text-white/70">Page {currentPage} of {totalPages}</span>
                  <button
                    type="button"
                    onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                    disabled={currentPage === totalPages}
                    className="rounded-md border border-white/15 px-3 py-1 text-xs hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </section>

      {inviteModalOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 px-4">
          <div className="w-full max-w-2xl rounded-xl border border-white/10 bg-[#111111] p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold">Add Learner</h2>
              <button
                type="button"
                onClick={() => setInviteModalOpen(false)}
                className="rounded-md border border-white/15 px-3 py-1 text-sm hover:bg-white/10"
              >
                Close
              </button>
            </div>

            <form onSubmit={onInviteLearner} className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <input
                value={form.email}
                onChange={(event) => onChangeField("email", event.target.value)}
                type="email"
                placeholder="Email"
                className="rounded-lg bg-[#1a1a1a] border border-white/10 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#A857FF]"
                required
              />
              <input
                value={form.firstName}
                onChange={(event) => onChangeField("firstName", event.target.value)}
                type="text"
                placeholder="First name"
                className="rounded-lg bg-[#1a1a1a] border border-white/10 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#A857FF]"
                required
              />
              <input
                value={form.lastName}
                onChange={(event) => onChangeField("lastName", event.target.value)}
                type="text"
                placeholder="Last name"
                className="rounded-lg bg-[#1a1a1a] border border-white/10 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#A857FF]"
                required
              />
              <select
                value={form.country}
                onChange={(event) => onChangeField("country", event.target.value)}
                className="rounded-lg bg-[#1a1a1a] border border-white/10 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#A857FF]"
                required
              >
                <option value="">Select country</option>
                {COUNTRY_OPTIONS.map((country) => (
                  <option key={country} value={country}>
                    {country}
                  </option>
                ))}
              </select>
              <input
                value={form.department}
                onChange={(event) => onChangeField("department", event.target.value)}
                type="text"
                placeholder="Department"
                className="rounded-lg bg-[#1a1a1a] border border-white/10 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#A857FF] md:col-span-2"
                required
              />
              <button
                type="submit"
                disabled={submitting}
                className="rounded-lg bg-[#A857FF] hover:bg-[#9440E6] disabled:opacity-70 disabled:cursor-not-allowed px-4 py-3 font-medium transition-all md:col-span-2"
              >
                {submitting ? "Sending invite..." : "Invite Learner"}
              </button>
            </form>
          </div>
        </div>
      )}

      {editModalOpen && editingLearner && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 px-4">
          <div className="w-full max-w-2xl rounded-xl border border-white/10 bg-[#111111] p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold">Edit Learner</h2>
              <button
                type="button"
                onClick={() => {
                  setEditModalOpen(false);
                  setEditingLearner(null);
                }}
                className="rounded-md border border-white/15 px-3 py-1 text-sm hover:bg-white/10"
              >
                Close
              </button>
            </div>

            <p className="mb-4 text-sm text-white/70">{editingLearner.email}</p>

            <form onSubmit={onEditLearner} className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <input
                value={editForm.firstName}
                onChange={(event) => onChangeEditField("firstName", event.target.value)}
                type="text"
                placeholder="First name"
                className="rounded-lg bg-[#1a1a1a] border border-white/10 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#A857FF]"
                required
              />
              <input
                value={editForm.lastName}
                onChange={(event) => onChangeEditField("lastName", event.target.value)}
                type="text"
                placeholder="Last name"
                className="rounded-lg bg-[#1a1a1a] border border-white/10 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#A857FF]"
                required
              />
              <select
                value={editForm.country}
                onChange={(event) => onChangeEditField("country", event.target.value)}
                className="rounded-lg bg-[#1a1a1a] border border-white/10 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#A857FF]"
                required
              >
                <option value="">Select country</option>
                {COUNTRY_OPTIONS.map((country) => (
                  <option key={country} value={country}>
                    {country}
                  </option>
                ))}
              </select>
              <input
                value={editForm.department}
                onChange={(event) => onChangeEditField("department", event.target.value)}
                type="text"
                placeholder="Department"
                className="rounded-lg bg-[#1a1a1a] border border-white/10 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#A857FF]"
                required
              />
              <select
                value={editStatus}
                onChange={(event) => setEditStatus(event.target.value as EditableLearnerStatus)}
                className="rounded-lg bg-[#1a1a1a] border border-white/10 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#A857FF] md:col-span-2"
                required
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="invited">Invited</option>
              </select>
              <button
                type="submit"
                disabled={savingEdit}
                className="rounded-lg bg-[#A857FF] hover:bg-[#9440E6] disabled:opacity-70 disabled:cursor-not-allowed px-4 py-3 font-medium transition-all md:col-span-2"
              >
                {savingEdit ? "Saving..." : "Save Changes"}
              </button>
            </form>
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={deleteModalOpen && Boolean(pendingDeleteLearner)}
        title="Delete Learner"
        message={`Delete ${pendingDeleteLearner?.email || "this learner"}? This removes the learner from active lists.`}
        confirmLabel="Delete"
        tone="danger"
        isConfirming={Boolean(pendingDeleteLearner?._id) && deletingLearnerId === pendingDeleteLearner?._id}
        onCancel={() => {
          setDeleteModalOpen(false);
          setPendingDeleteLearner(null);
        }}
        onConfirm={() => void onDeleteLearner()}
      />
    </main>
  );
}
