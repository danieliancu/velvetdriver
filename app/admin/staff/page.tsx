'use client';

import React, { useMemo, useState } from 'react';
import PageShell from '@/components/PageShell';
import AdminPageHeader from '@/components/AdminPageHeader';
import Modal from '@/components/Modal';

type StaffMember = {
  id: string;
  name: string;
  email: string;
  username: string;
  password: string;
  role: string;
  createdAt: string;
};

const initialStaff: StaffMember[] = [
  {
    id: 'staff-1',
    name: 'Roxana Viulet',
    email: 'roxana@velvetdrivers.co.uk',
    username: 'roxana',
    password: 'Velvet!2024',
    role: 'Operations Manager',
    createdAt: '18/04/2023 09:15',
  },
  {
    id: 'staff-2',
    name: 'Daniel Iancu',
    email: 'daniel@velvetdrivers.co.uk',
    username: 'daniel',
    password: 'Admin#998',
    role: 'Director',
    createdAt: '07/02/2021 11:20',
  },
  {
    id: 'staff-3',
    name: 'Eliza Popescu',
    email: 'eliza@velvetdrivers.co.uk',
    username: 'eliza',
    password: 'London*55',
    role: 'Customer Support',
    createdAt: '03/09/2024 08:05',
  },
];

type FormMode = 'add' | 'edit';

const emptyForm = {
  name: '',
  email: '',
  username: '',
  password: '',
  role: '',
};

const AdminStaffPage = () => {
  const [staffMembers, setStaffMembers] = useState<StaffMember[]>(initialStaff);
  const [search, setSearch] = useState('');
  const [viewPasswords, setViewPasswords] = useState<Record<string, boolean>>({});
  const [formModalOpen, setFormModalOpen] = useState(false);
  const [formMode, setFormMode] = useState<FormMode>('add');
  const [formState, setFormState] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<StaffMember | null>(null);

  const filteredStaff = useMemo(() => {
    if (!search.trim()) return staffMembers;
    const q = search.toLowerCase();
    return staffMembers.filter(
      (member) =>
        member.name.toLowerCase().includes(q) ||
        member.email.toLowerCase().includes(q) ||
        member.username.toLowerCase().includes(q) ||
        member.role.toLowerCase().includes(q)
    );
  }, [staffMembers, search]);

  const openAddModal = () => {
    setFormMode('add');
    setFormState(emptyForm);
    setEditingId(null);
    setFormModalOpen(true);
  };

  const openEditModal = (member: StaffMember) => {
    setFormMode('edit');
    setFormState({
      name: member.name,
      email: member.email,
      username: member.username,
      password: member.password,
      role: member.role,
    });
    setEditingId(member.id);
    setFormModalOpen(true);
  };

  const handleFormChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = event.target;
    setFormState((prev) => ({ ...prev, [name]: value }));
  };

  const handleFormSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!formState.name.trim() || !formState.username.trim() || !formState.password.trim()) {
      return;
    }
    if (formMode === 'add') {
      const now = new Date().toLocaleString('en-GB', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
      setStaffMembers((prev) => [
        ...prev,
        {
          id: `staff-${Date.now()}`,
          name: formState.name.trim(),
          email: formState.email.trim(),
          username: formState.username.trim(),
          password: formState.password,
          role: formState.role.trim() || 'Staff',
          createdAt: now,
        },
      ]);
    } else if (editingId) {
      setStaffMembers((prev) =>
        prev.map((member) =>
          member.id === editingId
            ? {
                ...member,
                name: formState.name.trim(),
                email: formState.email.trim(),
                username: formState.username.trim(),
                password: formState.password,
                role: formState.role.trim() || member.role,
              }
            : member
        )
      );
    }
    setFormModalOpen(false);
    setFormState(emptyForm);
    setEditingId(null);
  };

  const confirmDelete = (member: StaffMember) => {
    setDeleteTarget(member);
  };

  const handleDelete = () => {
    if (!deleteTarget) return;
    setStaffMembers((prev) => prev.filter((member) => member.id !== deleteTarget.id));
    setDeleteTarget(null);
  };

  const togglePasswordView = (id: string) => {
    setViewPasswords((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <PageShell mainClassName="flex flex-col px-4 sm:px-6 md:px-8 py-10" hideFooter hideHeader>
      <div className="w-full flex-grow">
        <div className="max-w-6xl mx-auto space-y-8">
          <AdminPageHeader active="staff" />

          <section className="space-y-6 rounded-3xl border border-white/10 bg-black/60 p-6 shadow-lg shadow-black/60">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-2xl font-bold text-white">Staff Accounts</h2>
                <p className="text-sm text-gray-400">Manage admin access for Velvet staff.</p>
              </div>
              <button
                type="button"
                onClick={openAddModal}
                className="w-full md:w-auto rounded-full border border-amber-500 bg-amber-500 px-6 py-2 text-sm font-semibold text-black shadow-[0_0_18px_rgba(251,191,36,0.4)] hover:shadow-[0_0_28px_rgba(251,191,36,0.6)] transition"
              >
                + Add staff member
              </button>
            </div>

            <div className="relative">
              <span className="absolute inset-y-0 left-3 flex items-center text-gray-400">
                <svg width="16" height="16" fill="currentColor">
                  <path d="M11.742 10.344h-.793l-.28-.27a6.471 6.471 0 001.57-4.29A6.477 6.477 0 105.76 11.19l.27.28v.79l4.997 4.987L16.73 15.33l-4.987-4.987zm-5.271 0a4.453 4.453 0 110-8.906 4.453 4.453 0 010 8.906z" />
                </svg>
              </span>
              <input
                type="text"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search by name, email, username or role..."
                className="w-full rounded-2xl border border-white/15 bg-black/50 px-10 py-3 text-white placeholder-gray-500 focus:border-amber-400 focus:outline-none"
              />
            </div>

            {filteredStaff.length === 0 ? (
              <div className="rounded-2xl border border-white/10 bg-black/40 p-6 text-center text-gray-400">
                No staff member matches your search.
              </div>
            ) : (
              <div className="space-y-4">
                {filteredStaff.map((member) => (
                  <div
                    key={member.id}
                    className="rounded-2xl border border-white/10 bg-black/40 p-5 flex flex-col gap-4 md:flex-row md:items-center md:justify-between"
                  >
                    <div className="space-y-1">
                      <p className="text-lg font-semibold text-white">{member.name}</p>
                      <p className="text-sm text-gray-300">{member.role}</p>
                      <p className="text-xs text-gray-400">Email: {member.email || '—'}</p>
                      <p className="text-xs text-gray-400">Username: {member.username}</p>
                      <p className="text-xs text-gray-400">
                        Password:{' '}
                        <span className="font-mono text-white/90">
                          {viewPasswords[member.id] ? member.password : '••••••••'}
                        </span>
                        <button
                          type="button"
                          onClick={() => togglePasswordView(member.id)}
                          className="ml-2 text-[11px] uppercase tracking-wider text-amber-300 hover:text-amber-100"
                        >
                          {viewPasswords[member.id] ? 'Hide' : 'Show'}
                        </button>
                      </p>
                      <p className="text-xs text-gray-500">Added on: {member.createdAt}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => openEditModal(member)}
                        className="rounded-full border border-white/30 px-4 py-1.5 text-xs font-semibold text-white hover:border-amber-400"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => confirmDelete(member)}
                        className="rounded-full border border-red-500/60 px-4 py-1.5 text-xs font-semibold text-red-200 hover:bg-red-500/10"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>

      <Modal
        isOpen={formModalOpen}
        onClose={() => {
          setFormModalOpen(false);
          setEditingId(null);
        }}
        title={formMode === 'add' ? 'Add staff member' : 'Edit staff member'}
      >
        <form className="space-y-4" onSubmit={handleFormSubmit}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="text-xs uppercase tracking-[0.3em] text-gray-400">Full name</label>
              <input
                name="name"
                value={formState.name}
                onChange={handleFormChange}
                required
                className="mt-1 w-full rounded-xl border border-white/15 bg-black/50 px-3 py-2 text-sm text-white focus:border-amber-400 focus:outline-none"
              />
            </div>
            <div>
              <label className="text-xs uppercase tracking-[0.3em] text-gray-400">Email</label>
              <input
                name="email"
                value={formState.email}
                onChange={handleFormChange}
                type="email"
                className="mt-1 w-full rounded-xl border border-white/15 bg-black/50 px-3 py-2 text-sm text-white focus:border-amber-400 focus:outline-none"
              />
            </div>
            <div>
              <label className="text-xs uppercase tracking-[0.3em] text-gray-400">Username</label>
              <input
                name="username"
                value={formState.username}
                onChange={handleFormChange}
                required
                className="mt-1 w-full rounded-xl border border-white/15 bg-black/50 px-3 py-2 text-sm text-white focus:border-amber-400 focus:outline-none"
              />
            </div>
            <div>
              <label className="text-xs uppercase tracking-[0.3em] text-gray-400">Password</label>
              <input
                name="password"
                value={formState.password}
                onChange={handleFormChange}
                required
                className="mt-1 w-full rounded-xl border border-white/15 bg-black/50 px-3 py-2 text-sm text-white focus:border-amber-400 focus:outline-none"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="text-xs uppercase tracking-[0.3em] text-gray-400">Role</label>
              <input
                name="role"
                value={formState.role}
                onChange={handleFormChange}
                className="mt-1 w-full rounded-xl border border-white/15 bg-black/50 px-3 py-2 text-sm text-white focus:border-amber-400 focus:outline-none"
              />
            </div>
          </div>
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => {
                setFormModalOpen(false);
                setEditingId(null);
              }}
              className="rounded-full border border-white/20 px-5 py-2 text-sm font-semibold text-gray-100 hover:border-white/40 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-full border border-amber-400 bg-amber-400 px-6 py-2 text-sm font-semibold text-black shadow-[0_0_15px_rgba(251,191,36,0.4)] hover:shadow-[0_0_25px_rgba(251,191,36,0.6)] transition"
            >
              {formMode === 'add' ? 'Add staff' : 'Save changes'}
            </button>
          </div>
        </form>
      </Modal>

      {deleteTarget && (
        <Modal
          isOpen={true}
          onClose={() => setDeleteTarget(null)}
          title="Delete staff member"
        >
          <p className="text-sm text-gray-200">
            Are you sure you want to remove <span className="font-semibold text-white">{deleteTarget.name}</span> from
            the staff list?
          </p>
          <div className="mt-6 flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setDeleteTarget(null)}
              className="rounded-full border border-white/20 px-5 py-2 text-sm font-semibold text-gray-100 hover:border-white/40 transition"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleDelete}
              className="rounded-full border border-red-500 bg-red-500 px-6 py-2 text-sm font-semibold text-black shadow-[0_0_15px_rgba(220,38,38,0.4)] hover:shadow-[0_0_25px_rgba(220,38,38,0.6)] transition"
            >
              Delete
            </button>
          </div>
        </Modal>
      )}
    </PageShell>
  );
};

export default AdminStaffPage;
