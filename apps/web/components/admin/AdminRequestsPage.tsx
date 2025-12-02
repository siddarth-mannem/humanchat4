'use client';

import { useEffect, useState } from 'react';
import AdminRequestedPeopleTable from '../AdminRequestedPeopleTable';
import { AdminRequestSummary, fetchAdminRequests } from '../../services/adminApi';
import { updateRequestStatus } from '../../services/requestApi';

export default function AdminRequestsPage() {
  const [requests, setRequests] = useState<AdminRequestSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setLoading(true);
      try {
        const data = await fetchAdminRequests();
        if (mounted) {
          setRequests(data);
          setError(null);
        }
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err.message : 'Unable to load requests');
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };
    void load();
    return () => {
      mounted = false;
    };
  }, []);

  const handleStatusChange = async (id: string, status: AdminRequestSummary['status']) => {
    setUpdatingId(id);
    try {
      const updated = await updateRequestStatus(id, status);
      setRequests((prev) => prev.map((request) => (request.id === id ? { ...request, status: updated.status } : request)));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update request');
    } finally {
      setUpdatingId((prev) => (prev === id ? null : prev));
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold text-white">Requests & demand</h1>
        <p className="text-white/60">Track concierge requests and requested names.</p>
      </div>
      <div className="rounded-3xl border border-white/10 bg-white/5">
        <div className="border-b border-white/10 px-6 py-4 text-sm text-white/70">Pending managed requests</div>
        {loading ? (
          <div className="p-6 text-white/70">Loading requests…</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-white/10 text-left text-sm">
              <thead>
                <tr className="text-white/60">
                  <th className="px-6 py-3">Member</th>
                  <th className="px-6 py-3">Target</th>
                  <th className="px-6 py-3">Message</th>
                  <th className="px-6 py-3">Preferred time</th>
                  <th className="px-6 py-3">Submitted</th>
                  <th className="px-6 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {requests.map((request) => (
                  <tr key={request.id} className="text-white/90">
                    <td className="px-6 py-3">
                      <div className="font-medium">{request.requester_name}</div>
                      <div className="text-xs text-white/60">{request.requester_user_id}</div>
                    </td>
                    <td className="px-6 py-3">
                      <div className="font-medium">{request.target_name}</div>
                      <div className="text-xs text-white/60">{request.target_user_id}</div>
                    </td>
                    <td className="px-6 py-3 text-white/70">{request.message}</td>
                    <td className="px-6 py-3 text-white/60">{request.preferred_time ?? '—'}</td>
                    <td className="px-6 py-3 text-white/60">{new Date(request.created_at).toLocaleString()}</td>
                    <td className="px-6 py-3">
                      <select
                        aria-label={`Update status for ${request.requester_name}`}
                        className="rounded-2xl border border-white/30 bg-white/5 px-3 py-1 text-sm text-white"
                        value={request.status}
                        disabled={updatingId === request.id}
                        onChange={(event) => handleStatusChange(request.id, event.target.value as AdminRequestSummary['status'])}
                      >
                        <option className="text-black" value="pending">
                          Pending
                        </option>
                        <option className="text-black" value="approved">
                          Approved
                        </option>
                        <option className="text-black" value="declined">
                          Declined
                        </option>
                      </select>
                    </td>
                  </tr>
                ))}
                {!requests.length && !loading && (
                  <tr>
                    <td className="px-6 py-4 text-white/60" colSpan={5}>
                      No pending requests.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
        {error && <div className="border-t border-red-400/30 bg-red-500/10 px-6 py-3 text-sm text-red-100">{error}</div>}
      </div>
      <AdminRequestedPeopleTable />
    </div>
  );
}
