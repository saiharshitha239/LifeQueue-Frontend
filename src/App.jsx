
import { useState } from "react";
import axios from "axios";
import "./App.css";

const API = "http://localhost:8080/api";

function App() {
  const [page, setPage] = useState("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [token, setToken] = useState("");
  const [role, setRole] = useState("");
  const [message, setMessage] = useState("");
  const [tickets, setTickets] = useState([]);
  const [adminTickets, setAdminTickets] = useState([]);
  const [searchEmail, setSearchEmail] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [serviceName, setServiceName] = useState(
    "General Consultation"
  );
  const [loading, setLoading] = useState(false);

  // Admin dashboard summary
  const waitingCount = adminTickets.filter(
    (ticket) => ticket.status === "WAITING"
  ).length;

  const completedCount = adminTickets.filter(
    (ticket) => ticket.status === "COMPLETED"
  ).length;

  const customerCount = new Set(
    adminTickets.map((ticket) => ticket.customerEmail)
  ).size;

  // Customer dashboard summary
  const customerWaitingCount = tickets.filter(
    (ticket) => ticket.status === "WAITING"
  ).length;

  const customerCompletedCount = tickets.filter(
    (ticket) => ticket.status === "COMPLETED"
  ).length;

  // Find the next waiting customer
  const nextCustomer = adminTickets
    .filter((ticket) => ticket.status === "WAITING")
    .sort((a, b) => a.queuePosition - b.queuePosition)[0];

  // Search and filter admin tickets
  const filteredAdminTickets = adminTickets.filter((ticket) => {
    const matchesEmail = (ticket.customerEmail || "")
      .toLowerCase()
      .includes(searchEmail.trim().toLowerCase());

    const matchesStatus =
      statusFilter === "ALL" || ticket.status === statusFilter;

    return matchesEmail && matchesStatus;
  });

  // Login and registration
  async function handleAuth(event) {
    event.preventDefault();
    setMessage("");
    setLoading(true);

    try {
      if (page === "register") {
        await axios.post(`${API}/auth/register`, {
          name,
          email,
          password,
        });

        setMessage("Registration successful! Please log in.");
        setPassword("");
        setShowPassword(false);
        setPage("login");
      } else {
        const response = await axios.post(`${API}/auth/login`, {
          email,
          password,
        });

        const currentToken = response.data.token;
        const currentName = response.data.name || email;
        const currentRole = response.data.role || "";

        setToken(currentToken);
        setName(currentName);
        setPassword("");
        setShowPassword(false);

        if (currentRole === "ADMIN") {
          setRole("ADMIN");
          setPage("admin");
          await loadAdminTickets(currentToken);
        } else if (
          currentRole === "CUSTOMER" ||
          currentRole === "USER"
        ) {
          setRole(currentRole);
          setPage("dashboard");
          await loadTickets(currentToken);
        } else {
          // Determine access if the login response omits the role
          try {
            const adminResponse = await axios.get(
              `${API}/queue/all`,
              {
                headers: {
                  Authorization: `Bearer ${currentToken}`,
                },
              }
            );

            setRole("ADMIN");
            setAdminTickets(adminResponse.data);
            setPage("admin");
          } catch (adminError) {
            if (adminError.response?.status === 403) {
              setRole("CUSTOMER");
              setPage("dashboard");
              await loadTickets(currentToken);
            } else {
              throw adminError;
            }
          }
        }
      }
    } catch (error) {
      const status = error.response?.status;

      setMessage(
        error.response?.data?.message ||
          (status === 401 || status === 403
            ? "Login failed or access denied. Check your email, password, and account role."
            : status
              ? `Request failed (HTTP ${status}).`
              : "Cannot reach the backend. Check whether it is running.")
      );
    } finally {
      setLoading(false);
    }
  }

  // Load customer tickets
  async function loadTickets(currentToken = token) {
    try {
      const response = await axios.get(
        `${API}/queue/my-tickets`,
        {
          headers: {
            Authorization: `Bearer ${currentToken}`,
          },
        }
      );

      setTickets(response.data);
      setMessage("");
    } catch (error) {
      setMessage("Could not load tickets. Please try again.");
    }
  }

  // Load all tickets for the admin
  async function loadAdminTickets(currentToken = token) {
    try {
      const response = await axios.get(`${API}/queue/all`, {
        headers: {
          Authorization: `Bearer ${currentToken}`,
        },
      });

      setAdminTickets(response.data);
      setMessage("");
    } catch (error) {
      setMessage(
        error.response?.status === 403
          ? "Admin access required. Check your account role."
          : "Could not load all tickets."
      );
    }
  }

  // Join the queue
  async function joinQueue() {
    setMessage("");
    setLoading(true);

    try {
      await axios.post(
        `${API}/queue/join`,
        { serviceName },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      setMessage("You joined the queue successfully!");
      await loadTickets();
    } catch (error) {
      setMessage(
        error.response?.data?.message ||
          "Could not join the queue."
      );
    } finally {
      setLoading(false);
    }
  }

  // Complete a ticket
  async function completeTicket(ticketId) {
    setMessage("");
    setLoading(true);

    try {
      await axios.put(
        `${API}/queue/${ticketId}/complete`,
        {},
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      setMessage(`Ticket #${ticketId} marked as completed.`);
      await loadAdminTickets();
    } catch (error) {
      setMessage(
        error.response?.status === 403
          ? "You do not have permission to complete tickets."
          : error.response?.data?.message ||
              "Could not complete the ticket."
      );
    } finally {
      setLoading(false);
    }
  }

  // Log out
  function logout() {
    setToken("");
    setTickets([]);
    setAdminTickets([]);
    setRole("");
    setName("");
    setEmail("");
    setPassword("");
    setShowPassword(false);
    setSearchEmail("");
    setStatusFilter("ALL");
    setPage("login");
    setMessage("");
  }

  // Reusable ticket card
  function renderTicket(ticket, isAdmin = false) {
    const ticketStatus = (
      ticket.status || "UNKNOWN"
    ).toLowerCase();

    const isCompleted = ticket.status === "COMPLETED";
    const isWaiting = ticket.status === "WAITING";

    return (
      <article className="ticket" key={ticket.id}>
        <div className="ticket-top">
          <span className="ticket-label">
            TICKET #{ticket.id}
          </span>

          <span className={`status status-${ticketStatus}`}>
            {ticket.status || "UNKNOWN"}
          </span>
        </div>

        <h3>{ticket.serviceName}</h3>

        {isAdmin && (
          <p className="ticket-date">
            Customer: {ticket.customerEmail}
          </p>
        )}

        <div className="queue-progress">
          <div className="queue-progress-label">
            <span>Queue progress</span>

            <strong>
              {isCompleted
                ? "Completed"
                : isWaiting
                  ? `Position ${ticket.queuePosition}`
                  : ticket.status}
            </strong>
          </div>

          <div
            className="queue-progress-track"
            role="progressbar"
            aria-label="Ticket status progress"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={isCompleted ? 100 : 0}
          >
            <div
              className={`queue-progress-fill ${
                isCompleted ? "is-complete" : ""
              }`}
            />
          </div>
        </div>

        <div className="ticket-stats">
          <div>
            <span className="stat-label">Queue position</span>
            <strong>{ticket.queuePosition}</strong>
          </div>

          <div>
            <span className="stat-label">Estimated wait</span>
            <strong>
              {isCompleted
                ? "0 min"
                : `${Math.max(
                    0,
                    ticket.queuePosition - 1
                  ) * 10} min`}
            </strong>
          </div>
        </div>

        <p className="ticket-date">
          Joined:{" "}
          {ticket.joinedAt
            ? new Date(ticket.joinedAt).toLocaleString()
            : "Date unavailable"}
        </p>

        {isAdmin && !isCompleted && (
          <button
            className="primary"
            onClick={() => completeTicket(ticket.id)}
            disabled={loading}
          >
            {loading ? "Please wait..." : "Mark as completed"}
          </button>
        )}
      </article>
    );
  }

  return (
    <main className="app">
      {/* Navigation bar */}
      <header className="navbar">
        <div className="brand">
          <span className="brand-icon">L</span>
          <span>LifeQueue</span>
        </div>

        {(page === "dashboard" || page === "admin") && (
          <button className="logout" onClick={logout}>
            Log out
          </button>
        )}
      </header>

      {/* Login and registration */}
      {page === "login" || page === "register" ? (
        <section className="auth-layout">
          <div className="hero">
            <span className="eyebrow">SMART VIRTUAL QUEUE</span>

            <h1>
              Your time matters.
              <br />
              <span>Skip the waiting.</span>
            </h1>

            <p>
              Join queues digitally, track your position, and spend
              less time waiting in line.
            </p>

            <div className="hero-points">
              <div>✓ Real-time ticket records</div>
              <div>✓ Simple queue tracking</div>
              <div>✓ Convenient digital access</div>
            </div>
          </div>

          <form className="auth-card" onSubmit={handleAuth}>
            <h2>
              {page === "login"
                ? "Welcome back"
                : "Create your account"}
            </h2>

            <p className="muted">
              {page === "login"
                ? "Log in to manage your queue."
                : "Register to start using LifeQueue."}
            </p>

            {page === "register" && (
              <label>
                Full name
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Enter your name"
                  autoComplete="name"
                  required
                />
              </label>
            )}

            <label>
              Email address
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
                required
              />
            </label>

            <label className="password-label">
              Password

              <div className="password-input-wrap">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  autoComplete={
                    page === "login"
                      ? "current-password"
                      : "new-password"
                  }
                  required
                />

                <button
                  type="button"
                  className="password-toggle"
                  onClick={() =>
                    setShowPassword((previous) => !previous)
                  }
                  aria-label={
                    showPassword ? "Hide password" : "Show password"
                  }
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
            </label>

            {message && <p className="notice">{message}</p>}

            <button
              className="primary"
              type="submit"
              disabled={loading}
            >
              {loading
                ? "Please wait..."
                : page === "login"
                  ? "Log in"
                  : "Create account"}
            </button>

            <p className="switch">
              {page === "login"
                ? "New to LifeQueue?"
                : "Already have an account?"}

              <button
                type="button"
                className="text-button"
                onClick={() => {
                  setPage(
                    page === "login" ? "register" : "login"
                  );
                  setMessage("");
                  setShowPassword(false);
                }}
              >
                {page === "login" ? " Sign up" : " Log in"}
              </button>
            </p>
          </form>
        </section>
      ) : page === "admin" ? (
        /* Admin dashboard */
        <section className="dashboard">
          <div className="welcome">
            <span className="eyebrow">ADMIN DASHBOARD</span>
            <h1>Hello, {name || email} 👋</h1>
            <p>
              Manage customer queues and complete served tickets.
            </p>
          </div>

          {message && (
            <p className="notice dashboard-notice">{message}</p>
          )}

          <div className="admin-summary">
            <article className="summary-card">
              <span className="summary-icon">▤</span>
              <p>Total Tickets</p>
              <h2>{adminTickets.length}</h2>
              <span>All queue entries</span>
            </article>

            <article className="summary-card">
              <span className="summary-icon">◷</span>
              <p>Waiting</p>
              <h2>{waitingCount}</h2>
              <span>Awaiting service</span>
            </article>

            <article className="summary-card">
              <span className="summary-icon">✓</span>
              <p>Completed</p>
              <h2>{completedCount}</h2>
              <span>Service finished</span>
            </article>

            <article className="summary-card">
              <span className="summary-icon">♙</span>
              <p>Customers</p>
              <h2>{customerCount}</h2>
              <span>Unique customers</span>
            </article>
          </div>

          <section className="next-customer">
            <span className="eyebrow">UP NEXT</span>

            {nextCustomer ? (
              <>
                <h2>Next customer to be served</h2>

                <p>
                  <strong>Ticket:</strong> #{nextCustomer.id}
                </p>

                <p>
                  <strong>Customer:</strong>{" "}
                  {nextCustomer.customerEmail}
                </p>

                <p>
                  <strong>Service:</strong>{" "}
                  {nextCustomer.serviceName}
                </p>

                <p>
                  <strong>Queue position:</strong>{" "}
                  {nextCustomer.queuePosition}
                </p>

                <button
                  className="primary"
                  onClick={() =>
                    completeTicket(nextCustomer.id)
                  }
                  disabled={loading}
                >
                  {loading
                    ? "Please wait..."
                    : "Complete next customer's ticket"}
                </button>
              </>
            ) : (
              <>
                <h2>No customers waiting</h2>
                <p>
                  All queue tickets have been served, or the queue
                  is empty.
                </p>
              </>
            )}
          </section>

          <div className="tickets-heading">
            <div>
              <h2>All queue tickets</h2>
              <p className="muted">
                View customer tickets and update their status.
              </p>
            </div>

            <span className="count">
              {filteredAdminTickets.length} of{" "}
              {adminTickets.length} tickets
            </span>
          </div>

          <div className="admin-filters">
            <input
              type="text"
              placeholder="Search by customer email"
              value={searchEmail}
              onChange={(e) => setSearchEmail(e.target.value)}
              aria-label="Search by customer email"
            />

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              aria-label="Filter tickets by status"
            >
              <option value="ALL">All statuses</option>
              <option value="WAITING">Waiting</option>
              <option value="COMPLETED">Completed</option>
            </select>
          </div>

          <button
            className="secondary"
            onClick={() => loadAdminTickets()}
            disabled={loading}
          >
            Refresh all tickets
          </button>

          {filteredAdminTickets.length === 0 ? (
            <div className="empty">
              <div className="empty-icon">▤</div>
              <h3>No matching tickets found</h3>
              <p>
                Try changing your search or status filter.
              </p>
            </div>
          ) : (
            <div className="ticket-list">
              {filteredAdminTickets.map((ticket) =>
                renderTicket(ticket, true)
              )}
            </div>
          )}
        </section>
      ) : (
        /* Customer dashboard */
        <section className="dashboard">
          <div className="welcome">
            <span className="eyebrow">CUSTOMER DASHBOARD</span>
            <h1>Hello, {name || email} 👋</h1>
            <p>
              Manage your visits without standing in a physical line.
            </p>
          </div>

          {message && (
            <p className="notice dashboard-notice">{message}</p>
          )}

          <div className="customer-summary">
            <article className="customer-summary-card">
              <span>Total Tickets</span>
              <strong>{tickets.length}</strong>
              <small>All your queue entries</small>
            </article>

            <article className="customer-summary-card waiting-card">
              <span>Waiting</span>
              <strong>{customerWaitingCount}</strong>
              <small>Awaiting service</small>
            </article>

            <article className="customer-summary-card completed-card">
              <span>Completed</span>
              <strong>{customerCompletedCount}</strong>
              <small>Service finished</small>
            </article>
          </div>

          <div className="join-card">
            <div>
              <h2>Join a queue</h2>
              <p className="muted">
                Choose a service to receive your ticket.
              </p>
            </div>

            <label>
              Select service
              <select
                value={serviceName}
                onChange={(e) =>
                  setServiceName(e.target.value)
                }
              >
                <option>General Consultation</option>
                <option>Hospital Registration</option>
                <option>Billing Service</option>
                <option>Customer Support</option>
              </select>
            </label>

            <button
              className="primary"
              onClick={joinQueue}
              disabled={loading}
            >
              {loading ? "Please wait..." : "+ Join queue"}
            </button>

            <button
              className="secondary"
              onClick={() => loadTickets()}
              disabled={loading}
            >
              Refresh tickets
            </button>
          </div>

          <div className="tickets-heading">
            <div>
              <h2>Your tickets</h2>
              <p className="muted">
                Your saved queue entries.
              </p>
            </div>

            <span className="count">
              {tickets.length} tickets
            </span>
          </div>

          {tickets.length === 0 ? (
            <div className="empty">
              <div className="empty-icon">▤</div>
              <h3>No tickets yet</h3>
              <p>Join a queue to see your ticket here.</p>
            </div>
          ) : (
            <div className="ticket-list">
              {tickets.map((ticket) => renderTicket(ticket))}
            </div>
          )}
        </section>
      )}

      <footer>
        LifeQueue · Smarter queues, better experiences.
      </footer>
    </main>
  );
}

export default App;
