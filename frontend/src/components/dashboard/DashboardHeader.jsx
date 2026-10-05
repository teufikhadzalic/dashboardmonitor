import { useState } from 'react'
import telkomselLogo from '../../assets/telkomsel_logo.png'
import { formatTime } from '../../utils/formatTime.js'

export default function DashboardHeader({
  auth,
  dashboard,
  connectionState,
  healthDisplay,
  approvalRequests,
  onDecideRequest,
  onLogout,
}) {
  const [requestsOpen, setRequestsOpen] = useState(false)

  return (
    <header className="masthead">
      <div className="mast-id">
        <div className="brand-lockup"><img src={telkomselLogo} alt="Telkomsel" /><p className="eyebrow">CS-ASOP / platform dashboard</p></div>
        <h1>CS-ASOP platform assurance</h1>
        <p className="mast-sub">Live posture for the nine core security capabilities used to protect identity, access control, detection, automation, and edge enforcement.</p>
        <span className="mockup-flag">9 core platforms</span>
      </div>

      <div className="mast-meta">
        <div>
          <span>Stream</span>
          {connectionState === 'live' ? 'Live' : 'Offline'}
        </div>
        <div>
          <span>Updated</span>
          {formatTime(dashboard?.updatedAt)}
        </div>
        <div>
          <span>State</span>
          {healthDisplay}
        </div>
        {auth?.user?.role === 'admin' && (
          <div className="admin-requests">
            <button className="requests-toggle" type="button" onClick={() => setRequestsOpen((open) => !open)}>
              <span>Access requests</span>
              <b>{approvalRequests.length}</b>
            </button>
            {requestsOpen && (
              <div className="requests-window">
                <div className="requests-heading">
                  <div>
                    <h2>Pending users</h2>
                    <p>Approve accounts before they can view the dashboard.</p>
                  </div>
                  <button type="button" onClick={() => setRequestsOpen(false)} aria-label="Close access requests">Close</button>
                </div>
                <div className="requests-list">
                  {!approvalRequests.length && <p className="empty-requests">No pending requests.</p>}
                  {approvalRequests.map((request) => (
                    <div className="request-row" key={request.id}>
                      <div>
                        <strong>{request.name}</strong>
                        <span>{request.email}</span>
                      </div>
                      <div className="request-actions">
                        <button type="button" className="approve" onClick={() => onDecideRequest(request.id, 'approve')}>Approve</button>
                        <button type="button" className="reject" onClick={() => onDecideRequest(request.id, 'reject')}>Reject</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
        <button className="logout-btn" type="button" onClick={onLogout}>Log out</button>
      </div>
    </header>
  )
}
